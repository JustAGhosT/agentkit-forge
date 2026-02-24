import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { runHealthcheck } from '../healthcheck.mjs';
import * as runner from '../runner.mjs';
import * as orchestrator from '../orchestrator.mjs';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const PROJECT_ROOT = resolve(AGENTKIT_ROOT, '..');
const TEST_ROOT = resolve(__dirname, '..', '..', '..', '..', '..', '.test-healthcheck');
const STATE_DIR = resolve(TEST_ROOT, '.claude', 'state');

describe('runHealthcheck()', () => {
  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    vi.restoreAllMocks();
  });

  it('returns structured result with tools list', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    // Mock tool checks to avoid spawning real processes — this test only
    // verifies result shape, not actual tool detection (tests below cover that).
    // Real spawns are slow on cold CI caches and hold directory handles that
    // cause EBUSY on Windows cleanup.
    vi.spyOn(runner, 'commandExists').mockImplementation(
      (cmd) => cmd === 'node' || cmd === 'git',
    );
    vi.spyOn(runner, 'execCommand').mockReturnValue({
      exitCode: 0, stdout: 'v20.0.0\n', stderr: '', durationMs: 5,
    });

    // Prevent orchestrator from writing state files into TEST_ROOT.
    vi.spyOn(orchestrator, 'loadState').mockReturnValue({});
    vi.spyOn(orchestrator, 'saveState').mockImplementation(() => {});
    vi.spyOn(orchestrator, 'appendEvent').mockImplementation(() => {});

    mkdirSync(TEST_ROOT, { recursive: true });

    const result = await runHealthcheck({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: TEST_ROOT,
      flags: {},
    });

    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('tools');
    expect(result).toHaveProperty('stacks');
    expect(result).toHaveProperty('agentkit');
    expect(result).toHaveProperty('overallHealth');
    expect(Array.isArray(result.tools)).toBe(true);
    expect(result.tools.length).toBeGreaterThan(0);
  });

  it('detects node and git as installed tools', { timeout: 30_000 }, async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const result = await runHealthcheck({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: PROJECT_ROOT,
      flags: {},
    });

    const nodeTool = result.tools.find(t => t.name === 'node');
    expect(nodeTool).toBeDefined();
    expect(nodeTool.found).toBe(true);
    expect(nodeTool.version).toMatch(/\d+/);

    const gitTool = result.tools.find(t => t.name === 'git');
    expect(gitTool).toBeDefined();
    expect(gitTool.found).toBe(true);
  });

  it('reports agentkit setup status', { timeout: 30_000 }, async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const result = await runHealthcheck({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: PROJECT_ROOT,
      flags: {},
    });

    expect(result.agentkit).toHaveProperty('hasMarker');
    expect(result.agentkit).toHaveProperty('hasState');
    expect(result.agentkit).toHaveProperty('hasCommands');
    expect(result.agentkit).toHaveProperty('hasHooks');
  });

  it('handles project root without agentkit setup', async () => {
    mkdirSync(TEST_ROOT, { recursive: true });
    mkdirSync(STATE_DIR, { recursive: true });
    mkdirSync(resolve(TEST_ROOT, '.git'), { recursive: true });
    writeFileSync(resolve(TEST_ROOT, '.agentkit-repo'), 'test-project', 'utf-8');

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const result = await runHealthcheck({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: TEST_ROOT,
      flags: {},
    });

    expect(result.agentkit.hasMarker).toBe(true);
    expect(result.agentkit.hasCommands).toBe(false);
  });
});
