/**
 * AgentKit Forge — Process Execution Helper
 * Shared utility for running shell commands with timeout, output capture, and timing.
 */
import { spawnSync } from 'child_process';

/**
 * Parse a command string into [executable, ...args].
 * Handles simple quoted arguments.
 * @param {string} cmd
 * @returns {string[]}
 */
function parseCommand(cmd) {
  const parts = cmd.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [cmd];
  return parts.map(p => p.replace(/^["']|["']$/g, ''));
}

/**
 * Validate a command string against shell injection patterns.
 * Rejects commands containing shell metacharacters.
 * @param {string} cmd
 * @returns {boolean}
 */
export function isValidCommand(cmd) {
  if (!cmd || typeof cmd !== 'string') return false;
  return !/[$`|;&<>(){}!\\]/.test(cmd);
}

/**
 * Execute a command and capture results.
 * Uses spawnSync with argument arrays to avoid shell injection.
 * @param {string} cmd - Command to run
 * @param {object} opts
 * @param {string} opts.cwd - Working directory
 * @param {number} opts.timeout - Timeout in ms (default 300000 = 5 min)
 * @returns {{ exitCode: number, stdout: string, stderr: string, durationMs: number }}
 */
export function execCommand(cmd, { cwd, timeout = 300_000 } = {}) {
  const start = Date.now();
  const [executable, ...args] = parseCommand(cmd);
  const result = spawnSync(executable, args, {
    cwd,
    timeout,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
    // On Windows, use shell to resolve .cmd/.bat executables (e.g. npx.cmd)
    shell: process.platform === 'win32',
  });

  if (result.error) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: result.error.message,
      durationMs: Date.now() - start,
    };
  }

  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    durationMs: Date.now() - start,
  };
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

/**
 * Format an ISO timestamp for display (strips T separator and milliseconds).
 * "2026-02-23T17:30:00.123Z" → "2026-02-23 17:30:00"
 * @param {string} isoTimestamp
 * @returns {string}
 */
export function formatTimestamp(isoTimestamp) {
  return isoTimestamp.replace('T', ' ').replace(/\.\d+Z$/, '');
}
