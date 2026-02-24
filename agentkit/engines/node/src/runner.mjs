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
  const regex = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g;
  const parts = [];
  let match;
  while ((match = regex.exec(cmd)) !== null) {
    // Strip quotes from each quoted segment while preserving content.
    // Handles --format="%h %s" → --format=%h %s (not just boundary quotes).
    parts.push(match[0].replace(/"([^"]*)"|'([^']*)'/g, '$1$2'));
  }
  return parts.length > 0 ? parts : [];
}

/**
 * Validate a command string against shell injection patterns.
 * Rejects commands containing shell metacharacters.
 * @param {string} cmd
 * @returns {boolean}
 */
export function isValidCommand(cmd) {
  if (!cmd || typeof cmd !== 'string') return false;
  return !/[$`|;&<>(){}!\\\r\n]/.test(cmd);
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
  const parsed = parseCommand(cmd);
  if (parsed.length === 0) {
    return { exitCode: 1, stdout: '', stderr: 'Empty command', durationMs: 0 };
  }
  const [executable, ...args] = parsed;

  // SECURITY (defense-in-depth): On Windows, shell:true is required to resolve
  // .cmd/.bat executables (e.g. npx.cmd), which means cmd.exe interprets the
  // command. We validate the executable name here to block injection even if a
  // caller forgets to check. Arguments are safe because spawnSync auto-escapes
  // each element of the args array when constructing the cmd.exe command line.
  if (process.platform === 'win32' && /[$`|;&<>(){}!\\\r\n]/.test(executable)) {
    return { exitCode: 1, stdout: '', stderr: `Blocked: executable contains shell metacharacters: ${executable}`, durationMs: 0 };
  }

  const result = spawnSync(executable, args, {
    cwd,
    timeout,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
    // On Windows, shell:true is needed for .cmd/.bat resolution. Executable
    // injection is blocked by the metacharacter guard above; args are
    // auto-escaped by Node's child_process when passed as an array.
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
  if (ms < 60_000) {
    // Truncate (not round) to avoid "60.0s" at the boundary
    const s = Math.floor(ms / 100) / 10;
    return `${s.toFixed(1)}s`;
  }
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
  return isoTimestamp.replace('T', ' ').replace(/(\.\d+)?Z$/, '');
}
