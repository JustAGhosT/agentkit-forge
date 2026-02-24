import { describe, it, expect } from 'vitest';
import { validate, validateCrossReferences, validateSpec, validateProjectYaml, PROJECT_ENUMS } from '../spec-validator.mjs';
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

// ---------------------------------------------------------------------------
// validateProjectYaml()
// ---------------------------------------------------------------------------
describe('validateProjectYaml()', () => {
  it('returns no errors for an empty/null project', () => {
    expect(validateProjectYaml(null).errors).toEqual([]);
    expect(validateProjectYaml({}).errors).toEqual([]);
  });

  it('accepts all valid enum values for phase', () => {
    for (const v of PROJECT_ENUMS.phase) {
      expect(validateProjectYaml({ phase: v }).errors).toEqual([]);
    }
  });

  it('rejects invalid phase value', () => {
    const { errors } = validateProjectYaml({ phase: 'unknown-phase' });
    expect(errors.some(e => e.includes('phase'))).toBe(true);
  });

  it('accepts null/undefined optional enum fields without error', () => {
    const { errors } = validateProjectYaml({ phase: null, architecture: { pattern: null } });
    expect(errors).toEqual([]);
  });

  it('rejects empty string for enum fields', () => {
    const { errors } = validateProjectYaml({ phase: '' });
    // empty string should be treated as no value — no error
    expect(errors).toEqual([]);
  });

  it('validates architecture.monorepoTool enum', () => {
    const { errors: ok } = validateProjectYaml({ architecture: { monorepoTool: 'nx' } });
    expect(ok).toEqual([]);

    const { errors: bad } = validateProjectYaml({ architecture: { monorepoTool: 'invalid' } });
    expect(bad.some(e => e.includes('monorepoTool'))).toBe(true);
  });

  it('validates architecture.apiStyle enum', () => {
    const { errors: ok } = validateProjectYaml({ architecture: { apiStyle: 'rest' } });
    expect(ok).toEqual([]);

    const { errors: bad } = validateProjectYaml({ architecture: { apiStyle: 'soap' } });
    expect(bad.some(e => e.includes('apiStyle'))).toBe(true);
  });

  it('validates stack array fields', () => {
    const { errors: ok } = validateProjectYaml({ stack: { languages: ['TypeScript'] } });
    expect(ok).toEqual([]);

    const { errors: bad } = validateProjectYaml({ stack: { languages: 'TypeScript' } });
    expect(bad.some(e => e.includes('stack.languages'))).toBe(true);
  });

  it('validates testing.coverage range (0-100)', () => {
    expect(validateProjectYaml({ testing: { coverage: 80 } }).errors).toEqual([]);
    expect(validateProjectYaml({ testing: { coverage: 0 } }).errors).toEqual([]);
    expect(validateProjectYaml({ testing: { coverage: 100 } }).errors).toEqual([]);

    const { errors: bad } = validateProjectYaml({ testing: { coverage: 150 } });
    expect(bad.some(e => e.includes('coverage'))).toBe(true);

    const { errors: bad2 } = validateProjectYaml({ testing: { coverage: -1 } });
    expect(bad2.some(e => e.includes('coverage'))).toBe(true);
  });

  it('validates testing.coverage must be a number', () => {
    const { errors } = validateProjectYaml({ testing: { coverage: 'eighty' } });
    expect(errors.some(e => e.includes('coverage'))).toBe(true);
  });

  it('validates integrations entries require name and purpose', () => {
    const ok = validateProjectYaml({
      integrations: [{ name: 'Stripe', purpose: 'payments' }],
    });
    expect(ok.errors).toEqual([]);

    const { errors: bad } = validateProjectYaml({ integrations: [{ name: 'Stripe' }] });
    expect(bad.some(e => e.includes('purpose'))).toBe(true);
  });

  it('validates integrations must be an array', () => {
    const { errors } = validateProjectYaml({ integrations: 'stripe' });
    expect(errors.some(e => e.includes('integrations'))).toBe(true);
  });

  it('validates crosscutting logging.framework enum', () => {
    const ok = validateProjectYaml({ crosscutting: { logging: { framework: 'winston' } } });
    expect(ok.errors).toEqual([]);

    const { errors: bad } = validateProjectYaml({
      crosscutting: { logging: { framework: 'unknown-logger' } },
    });
    expect(bad.some(e => e.includes('logging.framework'))).toBe(true);
  });

  it('validates crosscutting authentication enum fields', () => {
    const ok = validateProjectYaml({
      crosscutting: { authentication: { provider: 'auth0', strategy: 'jwt-bearer' } },
    });
    expect(ok.errors).toEqual([]);

    const { errors } = validateProjectYaml({
      crosscutting: { authentication: { provider: 'unknown' } },
    });
    expect(errors.some(e => e.includes('authentication.provider'))).toBe(true);
  });

  it('validates crosscutting caching.provider enum', () => {
    const { errors } = validateProjectYaml({ crosscutting: { caching: { provider: 'badcache' } } });
    expect(errors.some(e => e.includes('caching.provider'))).toBe(true);
  });
});
