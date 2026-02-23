import { describe, it, expect, vi, afterEach } from 'vitest';
import { runCheck } from '../check.mjs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const PROJECT_ROOT = resolve(AGENTKIT_ROOT, '..');

describe('runCheck()', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns a structured result object', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const result = await runCheck({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: PROJECT_ROOT,
      flags: {},
    });

    // Result should have expected structure
    expect(result).toHaveProperty('stacks');
    expect(result).toHaveProperty('overallStatus');
    expect(result).toHaveProperty('overallPassed');
    expect(Array.isArray(result.stacks)).toBe(true);
  });

  it('respects --fast flag structure', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const result = await runCheck({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: PROJECT_ROOT,
      flags: { fast: true },
    });

    // With --fast, build step should be skipped
    for (const stackResult of result.stacks) {
      const buildStep = stackResult.steps.find(s => s.step === 'build');
      expect(buildStep).toBeUndefined();
    }
  });

  it('handles --stack filter for unknown stacks gracefully', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const result = await runCheck({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: PROJECT_ROOT,
      flags: { stack: 'nonexistent-stack' },
    });

    expect(result.stacks).toEqual([]);
    expect(result.overallStatus).toBe('SKIP');
    expect(result.overallPassed).toBe(true);
  });
});
