import { execFileSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const AGENTKIT_SRC = resolve(import.meta.dirname, '..', '..', '..', '..');
const CLI_PATH = resolve(AGENTKIT_SRC, 'engines', 'node', 'src', 'cli.mjs');

function makeTmpProject() {
  const dir = resolve(
    tmpdir(),
    `agentkit-fresh-install-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function copyAgentkitWithoutNodeModules(dest) {
  cpSync(AGENTKIT_SRC, dest, { recursive: true, force: true });
  const stack = [dest];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (!entry.isDirectory()) continue;
      if (entry.name === 'node_modules') {
        rmSync(fullPath, { recursive: true, force: true });
        continue;
      }
      stack.push(fullPath);
    }
  }
}

function hasNestedNodeModules(root) {
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'node_modules') return true;
      stack.push(join(current, entry.name));
    }
  }
  return false;
}

describe('fresh install (no node_modules)', () => {
  let projectRoot;

  beforeEach(() => {
    projectRoot = makeTmpProject();
    mkdirSync(join(projectRoot, '.agentkit'), { recursive: true });
    copyAgentkitWithoutNodeModules(join(projectRoot, '.agentkit'));
    expect(hasNestedNodeModules(join(projectRoot, '.agentkit'))).toBe(false);
  });

  afterEach(() => {
    if (projectRoot && existsSync(projectRoot)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
    projectRoot = undefined;
  });

  it(
    'auto-installs dependencies and runs sync --dry-run',
    { skip: process.platform === 'win32' },
    () => {
      const cliPath = join(projectRoot, '.agentkit', 'engines', 'node', 'src', 'cli.mjs');
      const result = execFileSync('node', [cliPath, 'sync', '--dry-run'], {
        encoding: 'utf-8',
        cwd: projectRoot,
        timeout: 120_000,
      });
      expect(result).toContain('[agentkit:sync]');
      expect(result).toContain('Dry-run');
      expect(
        existsSync(join(projectRoot, '.agentkit', 'node_modules', 'js-yaml', 'package.json'))
      ).toBe(true);
    },
    130_000
  );
});
