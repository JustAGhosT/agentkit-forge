import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, cpSync, rmSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';

const AGENTKIT_SRC = resolve(import.meta.dirname, '..', '..', '..', '..');
const CLI_PATH = resolve(AGENTKIT_SRC, 'engines', 'node', 'src', 'cli.mjs');

function makeTmpProject() {
  const dir = resolve(tmpdir(), `agentkit-fresh-install-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function copyAgentkitWithoutNodeModules(dest) {
  cpSync(AGENTKIT_SRC, dest, { recursive: true, force: true });
  const nodeModules = join(dest, 'node_modules');
  if (existsSync(nodeModules)) {
    rmSync(nodeModules, { recursive: true, force: true });
  }
}

describe('fresh install (no node_modules)', () => {
  let projectRoot;

  beforeEach(() => {
    projectRoot = makeTmpProject();
    mkdirSync(join(projectRoot, '.agentkit'), { recursive: true });
    copyAgentkitWithoutNodeModules(join(projectRoot, '.agentkit'));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('auto-installs dependencies and runs sync --dry-run', { skip: process.platform === 'win32' }, () => {
    const cliPath = join(projectRoot, '.agentkit', 'engines', 'node', 'src', 'cli.mjs');
    const result = execFileSync('node', [cliPath, 'sync', '--dry-run'], {
      encoding: 'utf-8',
      cwd: projectRoot,
      timeout: 120_000,
    });
    expect(result).toContain('[agentkit:sync]');
    expect(result).toContain('Dry-run');
    expect(existsSync(join(projectRoot, '.agentkit', 'node_modules', 'js-yaml', 'package.json'))).toBe(true);
  }, 130_000);
});
