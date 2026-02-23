/**
 * AgentKit Forge — Process Execution Helper
 * Shared utility for running shell commands with timeout, output capture, and timing.
 */
import { execSync, spawnSync } from 'child_process';

/**
 * Execute a shell command and capture results.
 * @param {string} cmd - Command to run
 * @param {object} opts
 * @param {string} opts.cwd - Working directory
 * @param {number} opts.timeout - Timeout in ms (default 300000 = 5 min)
 * @returns {{ exitCode: number, stdout: string, stderr: string, durationMs: number }}
 */
export function execCommand(cmd, { cwd, timeout = 300_000 } = {}) {
  const start = Date.now();
  try {
    const stdout = execSync(cmd, {
      cwd,
      timeout,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    return {
      exitCode: 0,
      stdout: stdout || '',
      stderr: '',
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      exitCode: err.status ?? 1,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Check if a command exists on the system PATH.
 * @param {string} cmd - Command name (e.g. 'pnpm', 'cargo')
 * @returns {boolean}
 */
export function commandExists(cmd) {
  const bin = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(bin, [cmd], { encoding: 'utf-8', stdio: 'pipe' });
  return result.status === 0;
}

/**
 * Format milliseconds into a human-readable duration string.
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const s = (ms / 1000).toFixed(1);
  if (ms < 60_000) return `${s}s`;
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const remainS = totalSeconds % 60;
  return `${m}m ${remainS}s`;
}
