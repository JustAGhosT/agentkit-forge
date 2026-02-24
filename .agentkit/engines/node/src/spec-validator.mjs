/**
 * AgentKit Forge — Spec Validator
 * Validates YAML spec files against expected schemas before sync.
 * Catches malformed configs early — before they produce broken output.
 */
import { existsSync, readFileSync } from 'fs';
import yaml from 'js-yaml';
import { resolve } from 'path';

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
// Schema: project.yaml — enum value sets
// ---------------------------------------------------------------------------
const PROJECT_ENUMS = {
  phase: ['greenfield', 'active', 'maintenance', 'legacy'],
  architecturePattern: ['clean', 'hexagonal', 'mvc', 'microservices', 'monolith', 'serverless'],
  apiStyle: ['rest', 'graphql', 'grpc', 'mixed'],
  cloudProvider: ['aws', 'azure', 'gcp', 'vercel', 'netlify', 'self-hosted', 'none'],
  iacTool: ['terraform', 'bicep', 'pulumi', 'cdk', 'terragrunt', 'none'],
  branchStrategy: ['trunk-based', 'github-flow', 'gitflow'],
  commitConvention: ['conventional', 'semantic', 'none'],
  codeReview: ['required-pr', 'optional', 'none'],
  teamSize: ['solo', 'small', 'medium', 'large'],
  loggingFramework: [
    'serilog',
    'winston',
    'pino',
    'bunyan',
    'python-logging',
    'log4net',
    'nlog',
    'none',
  ],
  loggingLevel: ['trace', 'debug', 'information', 'warning', 'error', 'critical'],
  errorStrategy: ['problem-details', 'custom-envelope', 'raw', 'none'],
  authProvider: [
    'azure-ad',
    'azure-ad-b2c',
    'auth0',
    'firebase',
    'cognito',
    'keycloak',
    'custom-jwt',
    'none',
  ],
  authStrategy: ['jwt-bearer', 'cookie', 'session', 'api-key', 'oauth2-code'],
  cachingProvider: ['redis', 'memcached', 'in-memory', 'none'],
  apiVersioning: ['url-segment', 'header', 'query-string', 'media-type', 'none'],
  apiPagination: ['cursor', 'offset', 'keyset', 'none'],
  apiResponseFormat: ['envelope', 'raw', 'json-api', 'hal'],
  dbMigrations: ['code-first', 'sql-scripts', 'auto', 'none'],
  dbTransactionStrategy: ['unit-of-work', 'per-request', 'manual', 'none'],
  featureFlagProvider: [
    'launchdarkly',
    'azure-app-config',
    'unleash',
    'flagsmith',
    'custom',
    'none',
  ],
  envConfigStrategy: ['env-vars', 'config-files', 'vault', 'app-config', 'none'],
  monorepoTool: ['turborepo', 'nx', 'lerna', 'pnpm-workspaces'],
  // Infrastructure
  infraStateBackend: ['azurerm', 's3', 'gcs', 'consul', 'local', 'none'],
  infraLockProvider: ['blob-lease', 'dynamodb', 'consul', 'none'],
  // Observability
  monitoringProvider: [
    'azure-monitor',
    'datadog',
    'prometheus',
    'grafana-cloud',
    'cloudwatch',
    'none',
  ],
  alertingProvider: ['azure-monitor', 'pagerduty', 'opsgenie', 'grafana', 'none'],
  tracingProvider: ['application-insights', 'jaeger', 'zipkin', 'otel-collector', 'none'],
  // Compliance
  complianceFramework: ['soc2', 'iso27001', 'pci-dss', 'hipaa', 'gdpr', 'internal', 'none'],
  backupSchedule: ['daily', 'weekly', 'continuous', 'none'],
  auditEventBus: ['service-bus', 'event-hub', 'sns', 'none'],
};

/**
 * Validates project.yaml against expected schema.
 * All fields are optional — returns errors only for values that are present but invalid.
 * @param {object} project - Parsed project.yaml content
 * @returns {{ errors: string[], warnings: string[] }}
 */
function validateProjectYaml(project) {
  const errors = [];
  const warnings = [];
  if (!project || typeof project !== 'object') return { errors, warnings };

  // Helper: check enum value
  function checkEnum(value, fieldPath, enumName) {
    if (value === null || value === undefined || value === '') return;
    const allowed = PROJECT_ENUMS[enumName];
    if (!allowed.includes(value)) {
      errors.push(
        `project.yaml: ${fieldPath} must be one of [${allowed.join(', ')}], got "${value}"`
      );
    }
  }

  // Helper: check array of strings
  function checkStringArray(value, fieldPath) {
    if (value === null || value === undefined) return;
    if (!Array.isArray(value)) {
      errors.push(`project.yaml: ${fieldPath} must be an array`);
    }
  }

  // Top-level
  checkEnum(project.phase, 'phase', 'phase');

  // Stack
  const stack = project.stack;
  if (stack && typeof stack === 'object') {
    checkStringArray(stack.languages, 'stack.languages');
    if (stack.frameworks && typeof stack.frameworks === 'object') {
      checkStringArray(stack.frameworks.frontend, 'stack.frameworks.frontend');
      checkStringArray(stack.frameworks.backend, 'stack.frameworks.backend');
      checkStringArray(stack.frameworks.css, 'stack.frameworks.css');
    }
    checkStringArray(stack.database, 'stack.database');
    checkStringArray(stack.messaging, 'stack.messaging');
  }

  // Architecture
  const arch = project.architecture;
  if (arch && typeof arch === 'object') {
    checkEnum(arch.pattern, 'architecture.pattern', 'architecturePattern');
    checkEnum(arch.apiStyle, 'architecture.apiStyle', 'apiStyle');
    checkEnum(arch.monorepoTool, 'architecture.monorepoTool', 'monorepoTool');
  }

  // Deployment
  const deploy = project.deployment;
  if (deploy && typeof deploy === 'object') {
    checkEnum(deploy.cloudProvider, 'deployment.cloudProvider', 'cloudProvider');
    checkStringArray(deploy.environments, 'deployment.environments');
    checkEnum(deploy.iacTool, 'deployment.iacTool', 'iacTool');
  }

  // Infrastructure
  const infra = project.infrastructure;
  if (infra && typeof infra === 'object') {
    checkStringArray(infra.iacToolchain, 'infrastructure.iacToolchain');
    checkEnum(infra.stateBackend, 'infrastructure.stateBackend', 'infraStateBackend');
    checkEnum(infra.lockProvider, 'infrastructure.lockProvider', 'infraLockProvider');
    if (infra.tagging && typeof infra.tagging === 'object') {
      checkStringArray(infra.tagging.mandatory, 'infrastructure.tagging.mandatory');
      checkStringArray(infra.tagging.optional, 'infrastructure.tagging.optional');
    }
  }

  // Observability
  const obs = project.observability;
  if (obs && typeof obs === 'object') {
    if (obs.monitoring && typeof obs.monitoring === 'object') {
      checkEnum(obs.monitoring.provider, 'observability.monitoring.provider', 'monitoringProvider');
    }
    if (obs.alerting && typeof obs.alerting === 'object') {
      checkEnum(obs.alerting.provider, 'observability.alerting.provider', 'alertingProvider');
      checkStringArray(obs.alerting.channels, 'observability.alerting.channels');
    }
    if (obs.tracing && typeof obs.tracing === 'object') {
      checkEnum(obs.tracing.provider, 'observability.tracing.provider', 'tracingProvider');
      if (obs.tracing.samplingRate !== null && obs.tracing.samplingRate !== undefined) {
        if (typeof obs.tracing.samplingRate !== 'number') {
          errors.push('project.yaml: observability.tracing.samplingRate must be a number');
        } else if (obs.tracing.samplingRate < 0 || obs.tracing.samplingRate > 1) {
          errors.push(
            `project.yaml: observability.tracing.samplingRate must be 0.0-1.0, got ${obs.tracing.samplingRate}`
          );
        }
      }
    }
    if (obs.logging && typeof obs.logging === 'object') {
      if (obs.logging.retentionDays !== null && obs.logging.retentionDays !== undefined) {
        if (typeof obs.logging.retentionDays !== 'number') {
          errors.push('project.yaml: observability.logging.retentionDays must be a number');
        } else if (obs.logging.retentionDays < 1) {
          errors.push(
            `project.yaml: observability.logging.retentionDays must be >= 1, got ${obs.logging.retentionDays}`
          );
        }
      }
    }
  }

  // Compliance
  const comp = project.compliance;
  if (comp && typeof comp === 'object') {
    checkEnum(comp.framework, 'compliance.framework', 'complianceFramework');
    if (comp.disasterRecovery && typeof comp.disasterRecovery === 'object') {
      const dr = comp.disasterRecovery;
      if (dr.rpoHours !== null && dr.rpoHours !== undefined && typeof dr.rpoHours !== 'number') {
        errors.push('project.yaml: compliance.disasterRecovery.rpoHours must be a number');
      }
      if (dr.rtoHours !== null && dr.rtoHours !== undefined && typeof dr.rtoHours !== 'number') {
        errors.push('project.yaml: compliance.disasterRecovery.rtoHours must be a number');
      }
      checkEnum(dr.backupSchedule, 'compliance.disasterRecovery.backupSchedule', 'backupSchedule');
    }
    if (comp.audit && typeof comp.audit === 'object') {
      checkEnum(comp.audit.eventBus, 'compliance.audit.eventBus', 'auditEventBus');
    }
  }

  // Process
  const proc = project.process;
  if (proc && typeof proc === 'object') {
    checkEnum(proc.branchStrategy, 'process.branchStrategy', 'branchStrategy');
    checkEnum(proc.commitConvention, 'process.commitConvention', 'commitConvention');
    checkEnum(proc.codeReview, 'process.codeReview', 'codeReview');
    checkEnum(proc.teamSize, 'process.teamSize', 'teamSize');
  }

  // Testing
  const testing = project.testing;
  if (testing && typeof testing === 'object') {
    checkStringArray(testing.unit, 'testing.unit');
    checkStringArray(testing.integration, 'testing.integration');
    checkStringArray(testing.e2e, 'testing.e2e');
    if (testing.coverage !== null && testing.coverage !== undefined) {
      if (typeof testing.coverage !== 'number') {
        errors.push('project.yaml: testing.coverage must be a number');
      } else if (testing.coverage < 0 || testing.coverage > 100) {
        errors.push(`project.yaml: testing.coverage must be 0-100, got ${testing.coverage}`);
      }
    }
  }

  // Integrations
  if (project.integrations !== null && project.integrations !== undefined) {
    if (!Array.isArray(project.integrations)) {
      errors.push('project.yaml: integrations must be an array');
    } else {
      for (let i = 0; i < project.integrations.length; i++) {
        const integ = project.integrations[i];
        if (!integ || typeof integ !== 'object') {
          errors.push(`project.yaml: integrations[${i}] must be an object`);
          continue;
        }
        if (!integ.name) errors.push(`project.yaml: integrations[${i}].name is required`);
        if (!integ.purpose) errors.push(`project.yaml: integrations[${i}].purpose is required`);
      }
    }
  }

  // Cross-cutting concerns
  const cc = project.crosscutting;
  if (cc && typeof cc === 'object') {
    if (cc.logging && typeof cc.logging === 'object') {
      checkEnum(cc.logging.framework, 'crosscutting.logging.framework', 'loggingFramework');
      checkEnum(cc.logging.level, 'crosscutting.logging.level', 'loggingLevel');
      checkStringArray(cc.logging.sink, 'crosscutting.logging.sink');
    }
    if (cc.errorHandling && typeof cc.errorHandling === 'object') {
      checkEnum(cc.errorHandling.strategy, 'crosscutting.errorHandling.strategy', 'errorStrategy');
    }
    if (cc.authentication && typeof cc.authentication === 'object') {
      checkEnum(cc.authentication.provider, 'crosscutting.authentication.provider', 'authProvider');
      checkEnum(cc.authentication.strategy, 'crosscutting.authentication.strategy', 'authStrategy');
    }
    if (cc.caching && typeof cc.caching === 'object') {
      checkEnum(cc.caching.provider, 'crosscutting.caching.provider', 'cachingProvider');
      checkStringArray(cc.caching.patterns, 'crosscutting.caching.patterns');
    }
    if (cc.api && typeof cc.api === 'object') {
      checkEnum(cc.api.versioning, 'crosscutting.api.versioning', 'apiVersioning');
      checkEnum(cc.api.pagination, 'crosscutting.api.pagination', 'apiPagination');
      checkEnum(cc.api.responseFormat, 'crosscutting.api.responseFormat', 'apiResponseFormat');
    }
    if (cc.database && typeof cc.database === 'object') {
      checkEnum(cc.database.migrations, 'crosscutting.database.migrations', 'dbMigrations');
      checkEnum(
        cc.database.transactionStrategy,
        'crosscutting.database.transactionStrategy',
        'dbTransactionStrategy'
      );
    }
    if (cc.featureFlags && typeof cc.featureFlags === 'object') {
      checkEnum(
        cc.featureFlags.provider,
        'crosscutting.featureFlags.provider',
        'featureFlagProvider'
      );
    }
    if (cc.environments && typeof cc.environments === 'object') {
      checkStringArray(cc.environments.naming, 'crosscutting.environments.naming');
      checkEnum(
        cc.environments.configStrategy,
        'crosscutting.environments.configStrategy',
        'envConfigStrategy'
      );
    }
  }

  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Cross-spec validation
// ---------------------------------------------------------------------------

function validateCrossReferences(specs) {
  const errors = [];

  const { teams, commands, agents } = specs;

  // Verify team commands reference valid team IDs
  const teamIds = new Set((teams?.teams || []).map((t) => t.id));
  for (const cmd of commands?.commands || []) {
    if (cmd.type === 'team' && cmd.team && !teamIds.has(cmd.team)) {
      errors.push(
        `commands.yaml: command "${cmd.name}" references team "${cmd.team}" which is not defined in teams.yaml`
      );
    }
  }

  // Check for duplicate team IDs
  const seenTeamIds = new Set();
  for (const team of teams?.teams || []) {
    if (seenTeamIds.has(team.id)) {
      errors.push(`teams.yaml: duplicate team id "${team.id}"`);
    }
    seenTeamIds.add(team.id);
  }

  // Check for duplicate command names
  const seenCommandNames = new Set();
  for (const cmd of commands?.commands || []) {
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
  for (const domain of specs.rules?.rules || []) {
    for (const conv of domain.conventions || []) {
      if (seenRuleIds.has(conv.id)) {
        errors.push(
          `rules.yaml: duplicate convention id "${conv.id}" (in domain "${domain.domain}")`
        );
      }
      seenRuleIds.add(conv.id);
    }
  }

  // Validate that allowed-tools in commands only reference known tools
  for (const cmd of commands?.commands || []) {
    for (const tool of cmd['allowed-tools'] || []) {
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
 * @param {string} agentkitRoot - Path to the .agentkit/ directory
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

  // project.yaml is optional — only validate if present
  const projectPath = resolve(specDir, 'project.yaml');
  if (existsSync(projectPath)) {
    try {
      const project = yaml.load(readFileSync(projectPath, 'utf-8'));
      if (project && typeof project === 'object') {
        const projectResult = validateProjectYaml(project);
        errors.push(...projectResult.errors);
        warnings.push(...projectResult.warnings);
      }
    } catch (err) {
      errors.push(`project.yaml: YAML parse error — ${err.message}`);
    }
  }

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
          errors.push(
            ...validate(teams.techStacks[i], techStackSchema, `teams.yaml.techStacks[${i}]`)
          );
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
          errors.push(
            ...validate(agentList[i], agentSchema, `agents.yaml.agents.${category}[${i}]`)
          );
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
        errors.push(
          ...validate(commands.commands[i], commandSchema, `commands.yaml.commands[${i}]`)
        );
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
      const commandNames = new Set((commands?.commands || []).map((c) => `/${c.name}`));
      for (const [alias, target] of Object.entries(aliases.aliases)) {
        // Extract base command from target (e.g., "/orchestrate --assess-only" → "/orchestrate")
        const baseTarget = target.split(' ')[0];
        if (!commandNames.has(baseTarget)) {
          warnings.push(
            `aliases.yaml: alias "${alias}" targets "${baseTarget}" which is not a known command`
          );
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
    console.error(
      `[agentkit:spec-validate] FAILED: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`
    );
  }

  return result;
}

// Export validate for testing
export { PROJECT_ENUMS, validate, validateCrossReferences, validateProjectYaml };
