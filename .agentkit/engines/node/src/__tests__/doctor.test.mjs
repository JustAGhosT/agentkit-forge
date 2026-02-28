import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runDoctor } from '../doctor.mjs';
import * as fs from 'fs';
import { validateSpec } from '../spec-validator.mjs';

vi.mock('fs');
vi.mock('../spec-validator.mjs');

describe('runDoctor', () => {
  const mockAgentkitRoot = '/mock/agentkit';
  const mockProjectRoot = '/mock/project';

  beforeEach(() => {
    vi.resetAllMocks();
    // Default: spec passes with no errors or warnings
    validateSpec.mockReturnValue({ valid: true, errors: [], warnings: [] });
    // Default fs mocks
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('');
    // console spy
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getConsoleOutput = () =>
    console.log.mock.calls.map((args) => args.join(' ')).join('\n');

  it('should report error if spec validation throws', async () => {
    validateSpec.mockImplementation(() => {
      throw new Error('Validation exploded');
    });

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('FAIL');
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('Spec validation failed: Validation exploded'),
        }),
      ])
    );
  });

  it('should report error if spec is invalid', async () => {
    validateSpec.mockReturnValue({
      valid: false,
      errors: ['Invalid field X'],
      warnings: [],
    });

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('FAIL');
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'error', message: expect.stringContaining('Spec validation failed') }),
        expect.objectContaining({ severity: 'error', message: 'Invalid field X' }),
      ])
    );
  });

  it('should pass spec validation if valid', async () => {
    validateSpec.mockReturnValue({
      valid: true,
      errors: [],
      warnings: ['Deprecation warning'],
    });

    vi.spyOn(fs, 'readFileSync').mockImplementation((path) => {
      if (path.includes('overlays') && path.includes('settings.yaml')) {
        return 'renderTargets: ["claude"]';
      }
      return '';
    });

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'info', message: expect.stringContaining('Spec validation passed') }),
        expect.objectContaining({ severity: 'warning', message: 'Deprecation warning' }),
      ])
    );
  });

  it('should report warning if overlay settings file is missing', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      if (typeof p === 'string' && p.includes('overlays') && p.includes('settings.yaml')) return false;
      return true;
    });

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'warning', message: expect.stringContaining('No renderTargets defined') }),
      ])
    );
  });

  it('should report error if overlay settings file is invalid yaml', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
      if (typeof p === 'string' && p.includes('overlays') && p.includes('settings.yaml')) {
        return ': invalid yaml';
      }
      return '';
    });

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    expect(result.ok).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'error', message: expect.stringContaining('Failed to parse overlay settings') }),
      ])
    );
  });

  it('should report warning if no renderTargets are defined', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
      if (typeof p === 'string' && p.includes('overlays') && p.includes('settings.yaml')) {
        return 'renderTargets: []';
      }
      return '';
    });

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'warning', message: expect.stringContaining('No renderTargets defined') }),
      ])
    );
  });

  it('should check for missing template roots', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
      if (typeof p === 'string' && p.includes('overlays') && p.includes('settings.yaml')) {
        return 'renderTargets: ["claude", "cursor"]';
      }
      return '';
    });

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      if (typeof p === 'string') {
        if (p.includes('templates/claude')) return true;
        if (p.includes('templates/cursor')) return false;
        return true;
      }
      return true;
    });

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    expect(result.ok).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'error', message: expect.stringContaining("Missing template root for target 'cursor'") }),
      ])
    );
  });

  it('should report success when all template roots exist', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
      if (typeof p === 'string' && p.includes('overlays') && p.includes('settings.yaml')) {
        return 'renderTargets: ["claude", "cursor"]';
      }
      return '';
    });

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'info',
          message: expect.stringContaining('Template roots present for all'),
        }),
      ])
    );
  });

  it('should silently ignore unknown render targets', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
      if (typeof p === 'string' && p.includes('overlays') && p.includes('settings.yaml')) {
        return 'renderTargets: ["claude", "unknown-target"]';
      }
      return '';
    });

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    const unknownTargetFinding = result.findings?.find(
      (f) => typeof f.message === 'string' && f.message.includes('unknown-target'),
    );
    expect(unknownTargetFinding).toBeUndefined();
  });

  it('should validate project.yaml completeness and report missing fields', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
      if (typeof p === 'string') {
        if (p.includes('overlays') && p.includes('settings.yaml')) {
          return 'renderTargets: ["claude"]';
        }
        if (p.endsWith('project.yaml')) {
          return `
name: Test Project
description: A test
phase: active
stack:
  languages: [javascript]
`;
        }
      }
      return '';
    });

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'info', message: expect.stringContaining('project.yaml completeness') }),
        expect.objectContaining({ severity: 'warning', message: expect.stringContaining('Top missing high-impact fields') }),
      ])
    );
  });

  it('should report error if project.yaml is invalid YAML', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
      if (typeof p === 'string' && p.endsWith('project.yaml')) {
        return '::invalid: [ yaml';
      }
      if (typeof p === 'string' && p.includes('overlays') && p.includes('settings.yaml')) {
        return 'renderTargets: ["claude"]';
      }
      return '';
    });

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('project.yaml'),
        }),
      ])
    );
  });

  it('should report warning if project.yaml is missing', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
      if (typeof p === 'string' && p.includes('overlays') && p.includes('settings.yaml')) return 'renderTargets: ["claude"]';
      return '';
    });

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      if (typeof p === 'string' && p.endsWith('project.yaml')) return false;
      return true;
    });

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'warning', message: expect.stringContaining('project.yaml not found') }),
      ])
    );
  });

  it('should print verbose suggestions for FAIL status', async () => {
    validateSpec.mockReturnValue({
      valid: false,
      errors: [{ message: 'Test error' }],
      warnings: [],
    });

    await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot, flags: { verbose: true } });

    const output = getConsoleOutput();
    expect(output).toContain('FAIL');
    expect(output).toMatch(/next actions/i);
  });

  it('should print verbose suggestions for WARN status', async () => {
    validateSpec.mockReturnValue({ valid: true, errors: [], warnings: [] });

    vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
      if (typeof p === 'string' && p.includes('overlays') && p.includes('settings.yaml')) {
        return 'renderTargets: []';
      }
      return '';
    });

    await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot, flags: { verbose: true } });

    const output = getConsoleOutput();
    expect(output).toContain('WARN');
    expect(output).toMatch(/next actions/i);
  });

  it('should print verbose suggestions for PASS status', async () => {
    validateSpec.mockReturnValue({ valid: true, errors: [], warnings: [] });

    vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
      if (typeof p === 'string' && p.includes('overlays') && p.includes('settings.yaml')) {
        return 'renderTargets: ["claude"]';
      }
      if (typeof p === 'string' && p.endsWith('project.yaml')) {
        return 'name: Test\ndescription: Test\nphase: active\nstack:\n  languages: [javascript]\n  database: postgresql\narchitecture:\n  pattern: monolith\ndeployment:\n  cloudProvider: aws\n  iacTool: terraform\ninfrastructure:\n  namingConvention: kebab\n  defaultRegion: us-east-1\n  org: acme\nobservability:\n  monitoring:\n    provider: datadog\n  alerting:\n    provider: pagerduty\n  tracing:\n    provider: jaeger\ncompliance:\n  framework: soc2\n  disasterRecovery:\n    rpoHours: 4\n    rtoHours: 8\n  audit:\n    eventBus: sns\n';
      }
      return '';
    });

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot, flags: { verbose: true } });

    const output = getConsoleOutput();
    expect(output).toContain('PASS');
    expect(output).toMatch(/next actions/i);
  });
});
