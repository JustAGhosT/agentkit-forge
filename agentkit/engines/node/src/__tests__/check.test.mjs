import { describe, it, expect } from 'vitest';
import { runCheck } from '../check.mjs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const PROJECT_ROOT = resolve(AGENTKIT_ROOT, '..');

describe('runCheck()', () => {
  it('returns a structured result object', async () => {
    const logs = [];
    const origLog = console.log;
    const origWrite = process.stdout.write;
    console.log = (...args) => logs.push(args.join(' '));
    process.stdout.write = (str) => { logs.push(str); return true; };

    const result = await runCheck({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: PROJECT_ROOT,
      flags: {},
    });

    console.log = origLog;
    process.stdout.write = origWrite;

    // Result should have expected structure
    expect(result).toHaveProperty('stacks');
    expect(result).toHaveProperty('overallStatus');
    expect(result).toHaveProperty('overallPassed');
    expect(Array.isArray(result.stacks)).toBe(true);
  });

  it('respects --fast flag structure', async () => {
    const logs = [];
    const origLog = console.log;
    const origWrite = process.stdout.write;
    console.log = (...args) => logs.push(args.join(' '));
    process.stdout.write = (str) => { logs.push(str); return true; };

    const result = await runCheck({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: PROJECT_ROOT,
      flags: { fast: true },
    });

    console.log = origLog;
    process.stdout.write = origWrite;

    // With --fast, build step should be skipped
    for (const stackResult of result.stacks) {
      const buildStep = stackResult.steps.find(s => s.step === 'build');
      expect(buildStep).toBeUndefined();
    }
  });

  it('handles --stack filter for unknown stacks gracefully', async () => {
    const logs = [];
    const origLog = console.log;
    const origWrite = process.stdout.write;
    console.log = (...args) => logs.push(args.join(' '));
    process.stdout.write = (str) => { logs.push(str); return true; };

    const result = await runCheck({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: PROJECT_ROOT,
      flags: { stack: 'nonexistent-stack' },
    });

    console.log = origLog;
    process.stdout.write = origWrite;

    expect(result.stacks).toEqual([]);
    expect(result.overallStatus).toBe('SKIP');
    expect(result.overallPassed).toBe(true);
  });
});
