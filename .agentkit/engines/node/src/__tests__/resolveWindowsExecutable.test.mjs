import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { resolveWindowsExecutable } from '../runner.mjs';

describe('resolveWindowsExecutable()', () => {
  const originalPlatform = process.platform;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Default PATHEXT for testing
    process.env.PATHEXT = '.COM;.EXE;.BAT;.CMD';

    // Mock platform to win32
    Object.defineProperty(process, 'platform', {
      value: 'win32'
    });

    vi.spyOn(fs, 'existsSync').mockImplementation(() => false);
    vi.spyOn(fs, 'statSync').mockImplementation(() => ({ isFile: () => false }));
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform
    });
    vi.restoreAllMocks();
  });

  it('returns original command if not on Windows', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    expect(resolveWindowsExecutable('ls')).toBe('ls');
  });

  it('resolves absolute path with extension', () => {
    // Use path.join to get OS-specific separators for the absolute path simulation
    const absPath = path.resolve('/bin/tool.exe');

    vi.spyOn(path, 'isAbsolute').mockReturnValue(true);
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === absPath);
    vi.spyOn(fs, 'statSync').mockImplementation((p) => ({ isFile: () => p === absPath }));

    expect(resolveWindowsExecutable(absPath)).toBe(absPath);
  });

  it('resolves absolute path by appending extension', () => {
    const inputPath = path.resolve('/bin/tool');
    const resolvedPath = path.resolve('/bin/tool.CMD');

    vi.spyOn(path, 'isAbsolute').mockReturnValue(true);
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === resolvedPath);
    vi.spyOn(fs, 'statSync').mockImplementation((p) => ({ isFile: () => p === resolvedPath }));

    expect(resolveWindowsExecutable(inputPath)).toBe(resolvedPath);
  });

  it('resolves command in CWD', () => {
    const cwd = path.resolve('/project');
    const cmd = 'script';
    const resolvedPath = path.join(cwd, 'script.BAT');

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === resolvedPath);
    vi.spyOn(fs, 'statSync').mockImplementation((p) => ({ isFile: () => p === resolvedPath }));

    expect(resolveWindowsExecutable(cmd, cwd)).toBe(resolvedPath);
  });

  it('resolves command in PATH', () => {
    const binDir = path.resolve('/bin');
    process.env.PATH = `${path.resolve('/windows')}${path.delimiter}${binDir}`;
    const cmd = 'npm';
    const resolvedPath = path.join(binDir, 'npm.CMD');

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === resolvedPath);
    vi.spyOn(fs, 'statSync').mockImplementation((p) => ({ isFile: () => p === resolvedPath }));

    expect(resolveWindowsExecutable(cmd)).toBe(resolvedPath);
  });

  it('returns original command if not found', () => {
    process.env.PATH = path.resolve('/windows');
    expect(resolveWindowsExecutable('missing-tool')).toBe('missing-tool');
  });

  it('prioritizes CWD over PATH', () => {
    const cwd = path.resolve('/project');
    const cmd = 'tool';
    const cwdPath = path.join(cwd, 'tool.EXE');
    const pathPath = path.join(path.resolve('/bin'), 'tool.EXE');
    process.env.PATH = path.resolve('/bin');

    // Both exist
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === cwdPath || p === pathPath);
    vi.spyOn(fs, 'statSync').mockImplementation(() => ({ isFile: () => true }));

    expect(resolveWindowsExecutable(cmd, cwd)).toBe(cwdPath);
  });
});
