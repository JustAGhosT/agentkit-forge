/**
 * AgentKit Forge — Spec Validator
 * Validates YAML spec files against expected schemas before sync.
 * Catches malformed configs early — before they produce broken output.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';

// ---------------------------------------------------------------------------
// Schema definitions (lightweight — no external deps needed)
// ---------------------------------------------------------------------------

/**
 * Validates a value against a simple schema descriptor.
 * Returns an array of error strings (empty = valid).
 */
function validate(value, schema, path = '') {
  const errors = [];

  if (schema.required && (value === undefined || value === null)) {
    errors.push(`${path}: required but missing`);
    return errors;
  }
  if (value === undefined || value === null) return errors;

  if (schema.type === 'string' && typeof value !== 'string') {
    errors.push(`${path}: expected string, got ${typeof value}`);
  }
  if (schema.type === 'number' && typeof value !== 'number') {
    errors.push(`${path}: expected number, got ${typeof value}`);
  }
  if (schema.type === 'boolean' && typeof value !== 'boolean') {
    errors.push(`${path}: expected boolean, got ${typeof value}`);
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push(`${path}: expected array, got ${typeof value}`);
    } else if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        errors.push(...validate(value[i], schema.items, `${path}[${i}]`));
      }
    }
  }

  if (schema.type === 'object') {
    if (typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${path}: expected object, got ${Array.isArray(value) ? 'array' : typeof value}`);
    } else if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        errors.push(...validate(value[key], propSchema, `${path}.${key}`));
      }
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: must be one of [${schema.enum.join(', ')}], got "${value}"`);
  }

  if (schema.minLength && typeof value === 'string' && value.length < schema.minLength) {
    errors.push(`${path}: must be at least ${schema.minLength} characters`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Schema: teams.yaml
// ---------------------------------------------------------------------------
const teamSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', required: true, minLength: 1 },
    name: { type: 'string', required: true, minLength: 1 },
    focus: { type: 'string', required: true },
    scope: { type: 'array', required: true, items: { type: 'string' } },
  },
};

const techStackSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', required: true },
    buildCommand: { type: 'string', required: true },
    testCommand: { type: 'string', required: true },
    detect: { type: 'array', required: true, items: { type: 'string' } },
  },
};

// ---------------------------------------------------------------------------
// Schema: agents.yaml
// ---------------------------------------------------------------------------
const agentSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', required: true, minLength: 1 },
    name: { type: 'string', required: true, minLength: 1 },
    role: { type: 'string', required: true },
    focus: { type: 'array', required: true, items: { type: 'string' } },
    responsibilities: { type: 'array', required: true, items: { type: 'string' } },
  },
};

// ---------------------------------------------------------------------------
// Schema: commands.yaml
// ---------------------------------------------------------------------------
const VALID_COMMAND_TYPES = ['workflow', 'team', 'utility'];
const VALID_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'WebSearch', 'WebFetch'];

const commandSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', required: true, minLength: 1 },
    type: { type: 'string', required: true, enum: VALID_COMMAND_TYPES },
    description: { type: 'string', required: true },
  },
};

// ---------------------------------------------------------------------------
// Schema: rules.yaml
// ---------------------------------------------------------------------------
const ruleConventionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', required: true, minLength: 1 },
    rule: { type: 'string', required: true },
    severity: { type: 'string', required: true, enum: ['critical', 'error', 'warning', 'info'] },
  },
};

const ruleDomainSchema = {
  type: 'object',
  properties: {
    domain: { type: 'string', required: true, minLength: 1 },
    description: { type: 'string', required: true },
    'applies-to': { type: 'array', required: true, items: { type: 'string' } },
    conventions: { type: 'array', required: true, items: ruleConventionSchema },
  },
};

// ---------------------------------------------------------------------------
// Schema: settings.yaml
// ---------------------------------------------------------------------------
const settingsSchema = {
  type: 'object',
  properties: {
    permissions: {
      type: 'object',
      required: true,
      properties: {
        allow: { type: 'array', required: true, items: { type: 'string' } },
        deny: { type: 'array', required: true, items: { type: 'string' } },
      },
    },
    hooks: { type: 'object', required: true },
  },
};

// ---------------------------------------------------------------------------
// Cross-spec validation
// ---------------------------------------------------------------------------

function validateCrossReferences(specs) {
  const errors = [];

  const { teams, commands, agents } = specs;

  // Verify team commands reference valid team IDs
  const teamIds = new Set((teams?.teams || []).map(t => t.id));
  for (const cmd of (commands?.commands || [])) {
    if (cmd.type === 'team' && cmd.team && !teamIds.has(cmd.team)) {
      errors.push(`commands.yaml: command "${cmd.name}" references team "${cmd.team}" which is not defined in teams.yaml`);
    }
  }

  // Check for duplicate team IDs
  const seenTeamIds = new Set();
  for (const team of (teams?.teams || [])) {
    if (seenTeamIds.has(team.id)) {
      errors.push(`teams.yaml: duplicate team id "${team.id}"`);
    }
    seenTeamIds.add(team.id);
  }

  // Check for duplicate command names
  const seenCommandNames = new Set();
  for (const cmd of (commands?.commands || [])) {
    if (seenCommandNames.has(cmd.name)) {
      errors.push(`commands.yaml: duplicate command name "${cmd.name}"`);
    }
    seenCommandNames.add(cmd.name);
  }

  // Check for duplicate agent IDs (across all categories)
  const seenAgentIds = new Set();
  if (agents?.agents) {
    for (const [category, agentList] of Object.entries(agents.agents)) {
      if (!Array.isArray(agentList)) continue;
      for (const agent of agentList) {
        if (seenAgentIds.has(agent.id)) {
          errors.push(`agents.yaml: duplicate agent id "${agent.id}" (in category "${category}")`);
        }
        seenAgentIds.add(agent.id);
      }
    }
  }

  // Check for duplicate rule convention IDs
  const seenRuleIds = new Set();
  for (const domain of (specs.rules?.rules || [])) {
    for (const conv of (domain.conventions || [])) {
      if (seenRuleIds.has(conv.id)) {
        errors.push(`rules.yaml: duplicate convention id "${conv.id}" (in domain "${domain.domain}")`);
      }
      seenRuleIds.add(conv.id);
    }
  }

  // Validate that allowed-tools in commands only reference known tools
  for (const cmd of (commands?.commands || [])) {
    for (const tool of (cmd['allowed-tools'] || [])) {
      if (!VALID_TOOLS.includes(tool)) {
        errors.push(`commands.yaml: command "${cmd.name}" references unknown tool "${tool}"`);
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates all spec YAML files and returns a structured result.
 * @param {string} agentkitRoot - Path to the agentkit/ directory
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateSpec(agentkitRoot) {
  const errors = [];
  const warnings = [];
  const specDir = resolve(agentkitRoot, 'spec');

  // Helper to load and validate a YAML file
  function loadYaml(filename) {
    const filePath = resolve(specDir, filename);
    if (!existsSync(filePath)) {
      errors.push(`${filename}: file not found at ${filePath}`);
      return null;
    }
    try {
      return yaml.load(readFileSync(filePath, 'utf-8'));
    } catch (err) {
      errors.push(`${filename}: YAML parse error — ${err.message}`);
      return null;
    }
  }

  // Load all spec files
  const teams = loadYaml('teams.yaml');
  const agents = loadYaml('agents.yaml');
  const commands = loadYaml('commands.yaml');
  const rules = loadYaml('rules.yaml');
  const settings = loadYaml('settings.yaml');
  const aliases = loadYaml('aliases.yaml');
  const docs = loadYaml('docs.yaml');

  // Validate teams.yaml
  if (teams) {
    if (!teams.teams || !Array.isArray(teams.teams)) {
      errors.push('teams.yaml: missing or invalid "teams" array');
    } else {
      for (let i = 0; i < teams.teams.length; i++) {
        errors.push(...validate(teams.teams[i], teamSchema, `teams.yaml.teams[${i}]`));
      }
    }
    if (teams.techStacks) {
      if (!Array.isArray(teams.techStacks)) {
        errors.push('teams.yaml: "techStacks" must be an array');
      } else {
        for (let i = 0; i < teams.techStacks.length; i++) {
          errors.push(...validate(teams.techStacks[i], techStackSchema, `teams.yaml.techStacks[${i}]`));
        }
      }
    }
  }

  // Validate agents.yaml
  if (agents) {
    if (!agents.agents || typeof agents.agents !== 'object') {
      errors.push('agents.yaml: missing or invalid "agents" object');
    } else {
      for (const [category, agentList] of Object.entries(agents.agents)) {
        if (!Array.isArray(agentList)) {
          errors.push(`agents.yaml.agents.${category}: expected array, got ${typeof agentList}`);
          continue;
        }
        for (let i = 0; i < agentList.length; i++) {
          errors.push(...validate(agentList[i], agentSchema, `agents.yaml.agents.${category}[${i}]`));
        }
      }
    }
  }

  // Validate commands.yaml
  if (commands) {
    if (!commands.commands || !Array.isArray(commands.commands)) {
      errors.push('commands.yaml: missing or invalid "commands" array');
    } else {
      for (let i = 0; i < commands.commands.length; i++) {
        errors.push(...validate(commands.commands[i], commandSchema, `commands.yaml.commands[${i}]`));
      }
    }
  }

  // Validate rules.yaml
  if (rules) {
    if (!rules.rules || !Array.isArray(rules.rules)) {
      errors.push('rules.yaml: missing or invalid "rules" array');
    } else {
      for (let i = 0; i < rules.rules.length; i++) {
        errors.push(...validate(rules.rules[i], ruleDomainSchema, `rules.yaml.rules[${i}]`));
      }
    }
  }

  // Validate settings.yaml
  if (settings) {
    errors.push(...validate(settings, settingsSchema, 'settings.yaml'));
  }

  // Validate aliases.yaml
  if (aliases) {
    if (!aliases.aliases || typeof aliases.aliases !== 'object') {
      errors.push('aliases.yaml: missing or invalid "aliases" object');
    } else {
      const commandNames = new Set((commands?.commands || []).map(c => `/${c.name}`));
      for (const [alias, target] of Object.entries(aliases.aliases)) {
        // Extract base command from target (e.g., "/orchestrate --assess-only" → "/orchestrate")
        const baseTarget = target.split(' ')[0];
        if (!commandNames.has(baseTarget)) {
          warnings.push(`aliases.yaml: alias "${alias}" targets "${baseTarget}" which is not a known command`);
        }
      }
    }
  }

  // Cross-spec validation
  if (teams && commands && agents && rules) {
    errors.push(...validateCrossReferences({ teams, commands, agents, rules }));
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * CLI-friendly runner — prints results and exits with appropriate code.
 */
export function runSpecValidation(agentkitRoot) {
  console.log('[agentkit:spec-validate] Validating spec files...');
  const result = validateSpec(agentkitRoot);

  for (const err of result.errors) {
    console.error(`  FAIL: ${err}`);
  }
  for (const warn of result.warnings) {
    console.warn(`  WARN: ${warn}`);
  }

  if (result.valid) {
    console.log(`[agentkit:spec-validate] PASSED (${result.warnings.length} warning(s))`);
  } else {
    console.error(`[agentkit:spec-validate] FAILED: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
  }

  return result;
}

// Export validate for testing
export { validate, validateCrossReferences };
