import { describe, it, expect } from 'vitest';
import { validate, validateCrossReferences, validateSpec } from '../spec-validator.mjs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');

// ---------------------------------------------------------------------------
// validate() — schema validation engine
// ---------------------------------------------------------------------------
describe('validate()', () => {
  it('passes for valid string', () => {
    expect(validate('hello', { type: 'string', required: true }, 'x')).toEqual([]);
  });

  it('fails for missing required field', () => {
    const errors = validate(undefined, { type: 'string', required: true }, 'x');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('required but missing');
  });

  it('passes for missing optional field', () => {
    expect(validate(undefined, { type: 'string' }, 'x')).toEqual([]);
  });

  it('fails for wrong type', () => {
    expect(validate(42, { type: 'string' }, 'x')).toHaveLength(1);
  });

  it('validates array items', () => {
    const schema = { type: 'array', items: { type: 'string' } };
    expect(validate(['a', 'b'], schema, 'x')).toEqual([]);
    expect(validate(['a', 42], schema, 'x')).toHaveLength(1);
  });

  it('validates object properties', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'string', required: true },
        name: { type: 'string', required: true },
      },
    };
    expect(validate({ id: 'a', name: 'b' }, schema, 'x')).toEqual([]);
    expect(validate({ id: 'a' }, schema, 'x')).toHaveLength(1); // missing name
    expect(validate({}, schema, 'x')).toHaveLength(2); // missing both
  });

  it('validates enum', () => {
    const schema = { type: 'string', enum: ['a', 'b', 'c'] };
    expect(validate('a', schema, 'x')).toEqual([]);
    expect(validate('z', schema, 'x')).toHaveLength(1);
  });

  it('validates minLength', () => {
    const schema = { type: 'string', minLength: 3 };
    expect(validate('abc', schema, 'x')).toEqual([]);
    expect(validate('ab', schema, 'x')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// validateCrossReferences()
// ---------------------------------------------------------------------------
describe('validateCrossReferences()', () => {
  it('catches command referencing unknown team', () => {
    const errors = validateCrossReferences({
      teams: { teams: [{ id: 'backend' }] },
      commands: { commands: [{ name: 'team-ghost', type: 'team', team: 'ghost' }] },
      agents: { agents: {} },
      rules: { rules: [] },
    });
    expect(errors.some(e => e.includes('ghost'))).toBe(true);
  });

  it('catches duplicate team IDs', () => {
    const errors = validateCrossReferences({
      teams: { teams: [{ id: 'dup' }, { id: 'dup' }] },
      commands: { commands: [] },
      agents: { agents: {} },
      rules: { rules: [] },
    });
    expect(errors.some(e => e.includes('duplicate team id'))).toBe(true);
  });

  it('catches duplicate command names', () => {
    const errors = validateCrossReferences({
      teams: { teams: [] },
      commands: { commands: [{ name: 'build', type: 'utility' }, { name: 'build', type: 'utility' }] },
      agents: { agents: {} },
      rules: { rules: [] },
    });
    expect(errors.some(e => e.includes('duplicate command name'))).toBe(true);
  });

  it('catches unknown tools in allowed-tools', () => {
    const errors = validateCrossReferences({
      teams: { teams: [] },
      commands: { commands: [{ name: 'x', type: 'utility', 'allowed-tools': ['FakeToolXyz'] }] },
      agents: { agents: {} },
      rules: { rules: [] },
    });
    expect(errors.some(e => e.includes('unknown tool'))).toBe(true);
  });

  it('passes for valid cross-references', () => {
    const errors = validateCrossReferences({
      teams: { teams: [{ id: 'backend' }] },
      commands: { commands: [{ name: 'team-backend', type: 'team', team: 'backend', 'allowed-tools': ['Read', 'Bash'] }] },
      agents: { agents: { engineering: [{ id: 'be' }] } },
      rules: { rules: [{ domain: 'ts', conventions: [{ id: 'ts-lint' }] }] },
    });
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateSpec() — integration test against real spec files
// ---------------------------------------------------------------------------
describe('validateSpec() on real spec files', () => {
  it('validates the actual agentkit spec files without errors', () => {
    const result = validateSpec(AGENTKIT_ROOT);
    // The real spec should pass validation
    if (result.errors.length > 0) {
      console.error('Spec validation errors:', result.errors);
    }
    expect(result.valid).toBe(true);
  });
});
