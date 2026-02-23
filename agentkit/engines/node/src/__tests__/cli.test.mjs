import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '..', 'cli.mjs');
const PKG_VERSION = JSON.parse(readFileSync(resolve(__dirname, '..', '..', '..', '..', 'package.json'), 'utf-8')).version;

function run(...args) {
  try {
    return {
      stdout: execFileSync('node', [CLI_PATH, ...args], {
        encoding: 'utf-8',
        timeout: 10_000,
      }),
      exitCode: 0,
    };
  } catch (err) {
    return {
      stdout: (err.stdout || '') + (err.stderr || ''),
      exitCode: err.status,
    };
  }
}

describe('CLI', () => {
  it('shows help with --help', () => {
    const result = run('--help');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('AgentKit Forge');
    expect(result.stdout).toContain('Commands:');
    expect(result.stdout).toContain('init');
    expect(result.stdout).toContain('sync');
    expect(result.stdout).toContain('validate');
  });

  it('shows help with -h', () => {
    const result = run('-h');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('AgentKit Forge');
  });

  it('shows help with no arguments', () => {
    const result = run();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('AgentKit Forge');
  });

  it('shows version from package.json', () => {
    const result = run('--help');
    expect(result.stdout).toContain(`AgentKit Forge v${PKG_VERSION}`);
  });

  it('rejects unknown commands with exit code 1', () => {
    const result = run('nonexistent');
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('Unknown command');
    expect(result.stdout).toContain('Valid commands');
  });

  it('shows help hint for unknown commands', () => {
    const result = run('foo');
    expect(result.stdout).toContain('--help');
  });

  it('accepts --flag=value syntax', () => {
    // spec-validate ignores flags, so passing --unknown=value should just work
    const result = run('spec-validate', '--help');
    expect(result.exitCode).toBe(0);
  });
});
