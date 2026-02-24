import { describe, it, expect, vi, afterEach } from 'vitest';
import { runReview } from '../review-runner.mjs';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_ROOT = resolve(__dirname, '..', '..', '..', '..', '..', '.test-review');
const STATE_DIR = resolve(TEST_ROOT, '.claude', 'state');

function setupTestRepo() {
  if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(resolve(TEST_ROOT, '.agentkit-repo'), 'test-project', 'utf-8');
  // Initialize a real git repo so git commands don't bubble up to parent
  execSync('git init', { cwd: TEST_ROOT, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: TEST_ROOT, stdio: 'pipe' });
  execSync('git config user.name "test"', { cwd: TEST_ROOT, stdio: 'pipe' });
  execSync('git add -A && git commit --allow-empty -m "init"', { cwd: TEST_ROOT, stdio: 'pipe' });
}

function teardownTestRepo() {
  if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
}

describe('review-runner', () => {
  afterEach(() => {
    teardownTestRepo();
    vi.restoreAllMocks();
  });

  describe('secret scanning', () => {
    it('detects AWS access keys', async () => {
      setupTestRepo();
      // Create file with fake AWS key
      writeFileSync(resolve(TEST_ROOT, 'config.js'), 'const key = "AKIAIOSFODNN7EXAMPLE";', 'utf-8');

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await runReview({
        agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
        projectRoot: TEST_ROOT,
        flags: { file: 'config.js' },
      });

      expect(result.secrets).toBeGreaterThan(0);
      expect(result.findings.some(f => f.type === 'secret' && f.pattern === 'AWS Key')).toBe(true);
    });

    it('detects private keys', async () => {
      setupTestRepo();
      writeFileSync(resolve(TEST_ROOT, 'key.pem'), '-----BEGIN RSA PRIVATE KEY-----\nfake', 'utf-8');

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await runReview({
        agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
        projectRoot: TEST_ROOT,
        flags: { file: 'key.pem' },
      });

      expect(result.secrets).toBeGreaterThan(0);
      expect(result.findings.some(f => f.pattern === 'Private Key')).toBe(true);
    });

    it('passes clean files', async () => {
      setupTestRepo();
      writeFileSync(resolve(TEST_ROOT, 'clean.js'), 'const x = 42;', 'utf-8');

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await runReview({
        agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
        projectRoot: TEST_ROOT,
        flags: { file: 'clean.js' },
      });

      expect(result.secrets).toBe(0);
    });
  });

  describe('path traversal protection', () => {
    it('rejects --file paths outside project root', async () => {
      setupTestRepo();

      vi.spyOn(console, 'log').mockImplementation(() => {});

      await expect(
        runReview({
          agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
          projectRoot: TEST_ROOT,
          flags: { file: '../../etc/passwd' },
        })
      ).rejects.toThrow('must be within the project root');
    });
  });

  describe('range validation', () => {
    it('rejects invalid --range values', async () => {
      setupTestRepo();

      vi.spyOn(console, 'log').mockImplementation(() => {});

      await expect(
        runReview({
          agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
          projectRoot: TEST_ROOT,
          flags: { range: 'HEAD; rm -rf /' },
        })
      ).rejects.toThrow('Invalid --range value');
    });

    it('rejects excessively long --range values', async () => {
      setupTestRepo();

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const longRange = 'a'.repeat(257) + '..HEAD';
      await expect(
        runReview({
          agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
          projectRoot: TEST_ROOT,
          flags: { range: longRange },
        })
      ).rejects.toThrow('Invalid --range value');
    });

    it('rejects --range with reflog @{} syntax', async () => {
      setupTestRepo();

      vi.spyOn(console, 'log').mockImplementation(() => {});

      await expect(
        runReview({
          agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
          projectRoot: TEST_ROOT,
          flags: { range: 'HEAD@{1}..HEAD' },
        })
      ).rejects.toThrow('Invalid --range value');
    });

    it('accepts valid range notation', async () => {
      setupTestRepo();

      vi.spyOn(console, 'log').mockImplementation(() => {});

      // This won't fail on range validation, but may fail on git (no real repo)
      // The important thing is it doesn't throw "Invalid --range"
      const result = await runReview({
        agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
        projectRoot: TEST_ROOT,
        flags: { range: 'HEAD~3..HEAD' },
      });

      // Should not have thrown range validation error
      expect(result).toBeDefined();
    });
  });

  describe('large file detection', () => {
    it('flags files over threshold', async () => {
      setupTestRepo();
      // Create a 600KB file (over 500KB threshold)
      writeFileSync(resolve(TEST_ROOT, 'big.bin'), Buffer.alloc(600_000, 'x'), 'utf-8');

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await runReview({
        agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
        projectRoot: TEST_ROOT,
        flags: { file: 'big.bin' },
      });

      expect(result.largeFiles).toBe(1);
    });
  });

  describe('TODO scanning', () => {
    it('detects TODO comments', async () => {
      setupTestRepo();
      writeFileSync(resolve(TEST_ROOT, 'code.js'), '// TODO: fix this\n// FIXME: broken\nconst x = 1;', 'utf-8');

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await runReview({
        agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
        projectRoot: TEST_ROOT,
        flags: { file: 'code.js' },
      });

      expect(result.todos).toBe(2);
    });
  });

  describe('result structure', () => {
    it('returns SKIP when no files found', async () => {
      setupTestRepo();

      vi.spyOn(console, 'log').mockImplementation(() => {});

      // No changed files in a bare test dir
      const result = await runReview({
        agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
        projectRoot: TEST_ROOT,
        flags: {},
      });

      expect(result.status).toBe('SKIP');
      expect(result.files).toBe(0);
    });
  });
});
