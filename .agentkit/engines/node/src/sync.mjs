/**
 * AgentKit Forge — Sync Command
 * Reads spec + overlay → renders templates → writes generated outputs
 */
import {
  readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync,
  statSync, renameSync, rmSync, chmodSync, cpSync, unlinkSync
} from 'fs';
import { resolve, join, relative, dirname, extname, basename, sep } from 'path';
import { createHash } from 'crypto';
import yaml from 'js-yaml';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readYaml(filePath) {
  if (!existsSync(filePath)) return null;
  return yaml.load(readFileSync(filePath, 'utf-8'));
}

function readText(filePath) {
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, 'utf-8');
}

/**
 * Renders a template by:
 * 1. Resolving {{#if var}}...{{/if}} conditional blocks
 * 2. Resolving {{#each var}}...{{/each}} iteration blocks
 * 3. Replacing {{key}} placeholders with values from vars
 *
 * - Replaces longest keys first to prevent partial matches (e.g., {{versionInfo}} before {{version}})
 * - Sanitizes string values to prevent shell metacharacter injection
 * - Warns on unresolved placeholders when DEBUG is set
 */
function renderTemplate(template, vars) {
  let result = template;

  // Phase 1: Resolve {{#if var}}...{{/if}} blocks (supports nesting)
  result = resolveConditionals(result, vars);

  // Phase 2: Resolve {{#each var}}...{{/each}} blocks
  result = resolveEachBlocks(result, vars);

  // Phase 3: Replace {{key}} placeholders
  const sortedKeys = Object.keys(vars).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const value = vars[key];
    const placeholder = `{{${key}}}`;
    const safeValue = typeof value === 'string' ? sanitizeTemplateValue(value) : JSON.stringify(value);
    result = result.split(placeholder).join(safeValue);
  }

  // Warn about unresolved placeholders (ignore block syntax remnants, including {{else}})
  const unresolved = result.match(/\{\{(?!#|\/|else\}\})([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g);
  if (unresolved && process.env.DEBUG) {
    const unique = [...new Set(unresolved)];
    console.warn(`[agentkit:sync] Warning: unresolved placeholders: ${unique.join(', ')}`);
  }
  return result;
}

/**
 * Resolves {{#if var}}...{{/if}} conditional blocks.
 * A var is truthy if it exists in vars and is not null, undefined, false, empty string, or empty array.
 * Supports {{#if var}}...{{else}}...{{/if}} syntax.
 * Handles nested conditionals via innermost-first resolution.
 */
function resolveConditionals(template, vars) {
  let result = template;
  // Process innermost #if blocks first (no nested #if inside)
  const ifRegex = /\{\{#if\s+([a-zA-Z_][a-zA-Z0-9_]*)\}\}((?:(?!\{\{#if\s)(?!\{\{\/if\}\})[\s\S])*?)\{\{\/if\}\}/g;
  let safety = 50; // prevent infinite loops on malformed templates
  while (ifRegex.test(result) && safety-- > 0) {
    result = result.replace(ifRegex, (_, varName, body) => {
      const isTruthy = evalTruthy(vars[varName]);
      // Split only on the first {{else}} to avoid matching multiple occurrences
      const elseMarker = '{{else}}';
      const elseIndex = body.indexOf(elseMarker);
      if (elseIndex === -1) {
        return isTruthy ? body : '';
      }
      return isTruthy ? body.slice(0, elseIndex) : body.slice(elseIndex + elseMarker.length);
    });
    ifRegex.lastIndex = 0;
  }
  if (safety <= 0 && process.env.DEBUG) {
    const unresolvedIfRegex = /\{\{#if\s+([a-zA-Z_][a-zA-Z0-9_]*)\}\}/;
    if (unresolvedIfRegex.test(result)) {
      console.warn(
        'AgentKit Forge: unresolved {{#if}} blocks remain after hitting the safety limit. ' +
        'The template may be malformed or excessively nested.'
      );
    }
  }
  return result;
}

/**
 * Resolves {{#each var}}...{{/each}} iteration blocks.
 * Inside the block, {{.}} refers to the current item (for string arrays).
 * For object arrays, {{.name}}, {{.purpose}} etc. access properties.
 */
function resolveEachBlocks(template, vars) {
  const eachRegex = /\{\{#each\s+([a-zA-Z_][a-zA-Z0-9_]*)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  return template.replace(eachRegex, (_, varName, body) => {
    const arr = vars[varName];
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return arr.map((item, index) => {
      let rendered = body;
      // Replace {{.}} with the item itself (for string arrays)
      if (typeof item === 'string') {
        rendered = rendered.split('{{.}}').join(sanitizeTemplateValue(item));
      } else if (typeof item === 'object' && item !== null) {
        // Replace {{.prop}} with item.prop
        rendered = rendered.replace(/\{\{\.([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (__, prop) => {
          const val = item[prop];
          if (val === undefined || val === null) return '';
          return typeof val === 'string' ? sanitizeTemplateValue(val) : JSON.stringify(val);
        });
      }
      // Replace {{@index}} with current index
      rendered = rendered.split('{{@index}}').join(String(index));
      return rendered;
    }).join('');
  });
}

/**
 * Evaluates whether a template variable is "truthy" for {{#if}} blocks.
 * Falsy: undefined, null, false, '', 0, empty array []
 * Truthy: everything else (including 'none' — use explicit checks in templates)
 */
function evalTruthy(value) {
  if (value === undefined || value === null || value === false || value === '' || value === 0) return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * Flattens a project.yaml object into a flat key→value map suitable for template rendering.
 * Nested keys become camelCase: project.stack.languages → stackLanguages = "TypeScript, C#"
 * Boolean fields get has* prefixes: crosscutting.logging.correlationId → hasCorrelationId
 */
function flattenProjectYaml(project) {
  if (!project || typeof project !== 'object') return {};
  const vars = {};

  // Top-level scalars
  if (project.name) vars.projectName = project.name;
  if (project.description) vars.projectDescription = project.description;
  if (project.phase) vars.projectPhase = project.phase;

  // Stack
  // NOTE: For arrays (e.g., languages, database), vars are set to the joined string (or '' for empty).
  // Both undefined and '' are falsy for {{#if}} and produce empty output for {{#each}},
  // so template behaviour is the same whether the field is absent or empty.
  const stack = project.stack || {};
  if (Array.isArray(stack.languages)) vars.stackLanguages = stack.languages.join(', ');
  if (stack.frameworks) {
    const fw = stack.frameworks;
    if (Array.isArray(fw.frontend)) vars.stackFrontendFrameworks = fw.frontend.join(', ');
    if (Array.isArray(fw.backend)) vars.stackBackendFrameworks = fw.backend.join(', ');
    if (Array.isArray(fw.css)) vars.stackCssFrameworks = fw.css.join(', ');
  }
  if (stack.orm) vars.stackOrm = String(stack.orm);
  // `database` and `messaging` are defined as arrays in the spec; non-array values
  // should be caught by validation. These else-if branches are intentional defensive
  // fallbacks for partial/legacy configs where a string was provided instead of an array.
  if (Array.isArray(stack.database)) vars.stackDatabase = stack.database.join(', ');
  else if (stack.database) vars.stackDatabase = String(stack.database);
  if (stack.search) vars.stackSearch = String(stack.search);
  if (Array.isArray(stack.messaging)) vars.stackMessaging = stack.messaging.join(', ');
  else if (stack.messaging) vars.stackMessaging = String(stack.messaging);

  // Architecture
  const arch = project.architecture || {};
  if (arch.pattern) vars.architecturePattern = arch.pattern;
  if (arch.apiStyle) vars.architectureApiStyle = arch.apiStyle;
  vars.monorepo = !!arch.monorepo;
  vars.hasMonorepo = !!arch.monorepo;
  if (arch.monorepoTool) vars.monorepoTool = arch.monorepoTool;

  // Documentation
  const docs = project.documentation || {};
  vars.hasPrd = !!docs.hasPrd;
  if (docs.prdPath) vars.prdPath = docs.prdPath;
  vars.hasAdr = !!docs.hasAdr;
  if (docs.adrPath) vars.adrPath = docs.adrPath;
  vars.hasApiSpec = !!docs.hasApiSpec;
  if (docs.apiSpecPath) vars.apiSpecPath = docs.apiSpecPath;
  vars.hasTechnicalSpec = !!docs.hasTechnicalSpec;
  if (docs.technicalSpecPath) vars.technicalSpecPath = docs.technicalSpecPath;
  vars.hasDesignSystem = !!docs.hasDesignSystem;
  if (docs.designSystemPath) vars.designSystemPath = docs.designSystemPath;
  vars.hasStorybook = !!docs.storybook;
  if (docs.designTokensPath) vars.designTokensPath = docs.designTokensPath;

  // Deployment
  const deploy = project.deployment || {};
  if (deploy.cloudProvider) vars.cloudProvider = deploy.cloudProvider;
  vars.containerized = !!deploy.containerized;
  vars.hasContainerized = !!deploy.containerized;
  if (Array.isArray(deploy.environments)) vars.environments = deploy.environments.join(', ');
  if (deploy.iacTool) vars.iacTool = deploy.iacTool;

  // Process
  const proc = project.process || {};
  if (proc.branchStrategy) vars.branchStrategy = proc.branchStrategy;
  if (proc.commitConvention) vars.commitConvention = proc.commitConvention;
  if (proc.codeReview) vars.codeReview = proc.codeReview;
  if (proc.teamSize) vars.teamSize = proc.teamSize;

  // Testing
  const testing = project.testing || {};
  if (Array.isArray(testing.unit)) vars.testingUnit = testing.unit.join(', ');
  if (Array.isArray(testing.integration)) vars.testingIntegration = testing.integration.join(', ');
  if (Array.isArray(testing.e2e)) vars.testingE2e = testing.e2e.join(', ');
  if (testing.coverage !== undefined && testing.coverage !== null) vars.testingCoverage = String(testing.coverage);

  // Integrations (kept as array for {{#each}})
  if (Array.isArray(project.integrations)) {
    vars.integrations = project.integrations;
    vars.hasIntegrations = project.integrations.length > 0;
  }

  // Cross-cutting concerns
  const cc = project.crosscutting || {};
  flattenCrosscutting(cc, vars);

  return vars;
}

/**
 * Flattens the crosscutting section of project.yaml into template vars.
 */
function flattenCrosscutting(cc, vars) {
  // Logging
  const logging = cc.logging || {};
  if (logging.framework && logging.framework !== 'none') {
    vars.loggingFramework = logging.framework;
    vars.hasLogging = true;
  }
  vars.hasStructuredLogging = !!logging.structured;
  vars.hasCorrelationId = !!logging.correlationId;
  if (logging.level) vars.loggingLevel = logging.level;
  if (Array.isArray(logging.sink)) vars.loggingSinks = logging.sink.join(', ');

  // Error handling
  const errors = cc.errorHandling || {};
  if (errors.strategy && errors.strategy !== 'none') {
    vars.errorStrategy = errors.strategy;
    vars.hasErrorHandling = true;
  }
  vars.hasGlobalHandler = !!errors.globalHandler;
  vars.hasCustomExceptions = !!errors.customExceptions;

  // Authentication
  const auth = cc.authentication || {};
  if (auth.provider && auth.provider !== 'none') {
    vars.authProvider = auth.provider;
    vars.hasAuth = true;
  }
  if (auth.strategy) vars.authStrategy = auth.strategy;
  vars.hasRbac = !!auth.rbac;
  vars.hasMultiTenant = !!auth.multiTenant;

  // Caching
  const cache = cc.caching || {};
  if (cache.provider && cache.provider !== 'none') {
    vars.cachingProvider = cache.provider;
    vars.hasCaching = true;
  }
  if (Array.isArray(cache.patterns)) vars.cachingPatterns = cache.patterns.join(', ');
  vars.hasDistributedCache = !!cache.distributedCache;

  // API
  const api = cc.api || {};
  if (api.versioning && api.versioning !== 'none') {
    vars.apiVersioning = api.versioning;
    vars.hasApiVersioning = true;
  }
  if (api.pagination && api.pagination !== 'none') {
    vars.apiPagination = api.pagination;
    vars.hasApiPagination = true;
  }
  if (api.responseFormat) vars.apiResponseFormat = api.responseFormat;
  vars.hasRateLimiting = !!api.rateLimiting;

  // Database
  const db = cc.database || {};
  if (db.migrations && db.migrations !== 'none') {
    vars.dbMigrations = db.migrations;
    vars.hasDbMigrations = true;
  }
  vars.hasDbSeeding = !!db.seeding;
  if (db.transactionStrategy && db.transactionStrategy !== 'none') {
    vars.dbTransactionStrategy = db.transactionStrategy;
  }
  vars.hasConnectionPooling = !!db.connectionPooling;

  // Performance
  const perf = cc.performance || {};
  vars.hasLazyLoading = !!perf.lazyLoading;
  vars.hasImageOptimization = !!perf.imageOptimization;
  if (perf.bundleBudget) vars.bundleBudget = String(perf.bundleBudget);

  // Feature flags
  const ff = cc.featureFlags || {};
  if (ff.provider && ff.provider !== 'none') {
    vars.featureFlagProvider = ff.provider;
    vars.hasFeatureFlags = true;
  }

  // Environments
  const envs = cc.environments || {};
  if (Array.isArray(envs.naming)) vars.envNames = envs.naming.join(', ');
  if (envs.configStrategy && envs.configStrategy !== 'none') {
    vars.envConfigStrategy = envs.configStrategy;
  }
  if (envs.envFilePattern) vars.envFilePattern = envs.envFilePattern;
}

/**
 * Sanitizes a template variable value to prevent injection.
 * Strips shell metacharacters that could cause command injection if the
 * rendered output is executed in a shell context (e.g., hook scripts).
 */
function sanitizeTemplateValue(value) {
  // Remove characters that enable shell injection: $() `` ; | & etc.
  // Allow common safe characters: alphanumeric, spaces, hyphens, underscores, dots, slashes, @
  return value.replace(/[`$\\;|&<>!{}()]/g, '');
}

function getGeneratedHeader(version, repoName, ext) {
  const comment = getCommentStyle(ext);
  if (!comment) return '';
  return [
    `${comment.start} GENERATED by AgentKit Forge v${version} — DO NOT EDIT ${comment.end}`,
    `${comment.start} Source: .agentkit/spec + .agentkit/overlays/${repoName} ${comment.end}`,
    `${comment.start} Regenerate: pnpm -C .agentkit agentkit:sync ${comment.end}`,
    ''
  ].join('\n');
}

function getCommentStyle(ext) {
  switch (ext) {
    case '.md': case '.mdc': return { start: '<!--', end: '-->' };
    case '.json': case '.template': return null; // JSON / template files don't support comments
    case '.yml': case '.yaml': return { start: '#', end: '' };
    case '.sh': return { start: '#', end: '' };
    case '.ps1': return { start: '#', end: '' };
    case '': return { start: '#', end: '' }; // files like "cursorrules"
    default: return { start: '#', end: '' };
  }
}

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

// Project-owned files: generated once as scaffolds, then owned by the consuming repo.
// Sync will NOT overwrite these if they already exist at the destination.
const SCAFFOLD_ONCE_ROOT_FILES = new Set([
  'AGENT_BACKLOG.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'MIGRATIONS.md',
  'SECURITY.md',
  '.editorconfig',
  '.prettierrc',
  '.markdownlint.json',
]);

const SCAFFOLD_ONCE_DIRS = [
  'docs/',
  '.vscode/',
  '.github/ISSUE_TEMPLATE/',
  '.github/instructions/',
];

// GitHub root files that are scaffold-once (matched by full relative path)
const SCAFFOLD_ONCE_GITHUB_FILES = new Set([
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/copilot-instructions.md',
]);

/**
 * Check if a relative path is a scaffold-once file (project-owned content).
 * These are only written on first sync; subsequent syncs skip them if they exist.
 */
function isScaffoldOnce(relPath) {
  // Normalize Windows backslashes to forward slashes for consistent matching
  const normalized = relPath.replace(/\\/g, '/');
  if (SCAFFOLD_ONCE_ROOT_FILES.has(normalized)) return true;
  if (SCAFFOLD_ONCE_GITHUB_FILES.has(normalized)) return true;
  for (const dir of SCAFFOLD_ONCE_DIRS) {
    if (normalized.startsWith(dir)) return true;
  }
  return false;
}

function writeOutput(filePath, content) {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, 'utf-8');
}

function* walkDir(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(full);
    } else {
      yield full;
    }
  }
}

// ---------------------------------------------------------------------------
// Core sync logic
// ---------------------------------------------------------------------------

export async function runSync({ agentkitRoot, projectRoot, flags }) {
  console.log('[agentkit:sync] Starting sync...');

  // 1. Load spec — version from package.json (primary) with VERSION file as fallback
  let version = '0.0.0';
  try {
    const pkg = JSON.parse(readFileSync(resolve(agentkitRoot, 'package.json'), 'utf-8'));
    version = pkg.version || version;
  } catch {
    version = readText(resolve(agentkitRoot, 'spec', 'VERSION'))?.trim() || version;
  }
  const teamsSpec = readYaml(resolve(agentkitRoot, 'spec', 'teams.yaml')) || {};
  const commandsSpec = readYaml(resolve(agentkitRoot, 'spec', 'commands.yaml')) || {};
  const rulesSpec = readYaml(resolve(agentkitRoot, 'spec', 'rules.yaml')) || {};
  const settingsSpec = readYaml(resolve(agentkitRoot, 'spec', 'settings.yaml')) || {};
  const agentsSpec = readYaml(resolve(agentkitRoot, 'spec', 'agents.yaml')) || {};
  const docsSpec = readYaml(resolve(agentkitRoot, 'spec', 'docs.yaml')) || {};
  const projectSpec = readYaml(resolve(agentkitRoot, 'spec', 'project.yaml'));

  // 2. Detect overlay
  let repoName = flags?.overlay;
  if (!repoName) {
    const markerPath = resolve(projectRoot, '.agentkit-repo');
    if (existsSync(markerPath)) {
      repoName = readText(markerPath).trim();
    }
  }
  if (!repoName) {
    repoName = '__TEMPLATE__';
    console.log('[agentkit:sync] No overlay detected, using __TEMPLATE__');
  }

  // 3. Load overlay
  const overlayDir = resolve(agentkitRoot, 'overlays', repoName);
  const overlaySettings = readYaml(resolve(overlayDir, 'settings.yaml')) || {};

  // Merge settings (data-level: union allow, union deny, deny wins)
  const mergedPermissions = mergePermissions(
    settingsSpec.permissions || {},
    overlaySettings.permissions || {}
  );

  // Template variables — start with project.yaml flat vars, then overlay with core vars
  const projectVars = projectSpec ? flattenProjectYaml(projectSpec) : {};
  const vars = {
    ...projectVars,
    version,
    repoName: overlaySettings.repoName || repoName,
    defaultBranch: overlaySettings.defaultBranch || 'main',
    primaryStack: overlaySettings.primaryStack || 'auto',
  };

  console.log(`[agentkit:sync] Repo: ${vars.repoName}, Version: ${version}`);

  // 4. Render templates to temp directory
  const tmpDir = resolve(agentkitRoot, '.tmp');
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  const templatesDir = resolve(agentkitRoot, 'templates');

  // --- Claude templates ---
  syncDirectCopy(templatesDir, 'claude/hooks', tmpDir, '.claude/hooks', vars, version, repoName);
  syncClaudeSettings(templatesDir, tmpDir, vars, version, mergedPermissions, settingsSpec);
  syncClaudeCommands(templatesDir, tmpDir, vars, version, repoName, teamsSpec, commandsSpec);
  syncClaudeAgents(templatesDir, tmpDir, vars, version, repoName, agentsSpec);
  syncDirectCopy(templatesDir, 'claude/rules', tmpDir, '.claude/rules', vars, version, repoName);
  syncDirectCopy(templatesDir, 'claude/state', tmpDir, '.claude/state', vars, version, repoName);

  // --- Cursor templates ---
  syncDirectCopy(templatesDir, 'cursor/rules', tmpDir, '.cursor/rules', vars, version, repoName);
  syncCursorTeams(tmpDir, vars, version, repoName, teamsSpec);

  // --- Windsurf templates ---
  syncDirectCopy(templatesDir, 'windsurf/rules', tmpDir, '.windsurf/rules', vars, version, repoName);
  syncDirectCopy(templatesDir, 'windsurf/workflows', tmpDir, '.windsurf/workflows', vars, version, repoName);
  syncWindsurfTeams(tmpDir, vars, version, repoName, teamsSpec);

  // --- .ai templates ---
  syncDirectCopy(templatesDir, 'ai', tmpDir, '.ai', vars, version, repoName);

  // --- Copilot templates ---
  syncCopilot(templatesDir, tmpDir, vars, version, repoName);

  // --- MCP templates ---
  syncDirectCopy(templatesDir, 'mcp', tmpDir, 'mcp', vars, version, repoName);

  // --- GitHub templates ---
  syncGitHub(templatesDir, tmpDir, vars, version, repoName);

  // --- Root docs ---
  syncRootDocs(templatesDir, tmpDir, vars, version, repoName);

  // --- Claude.md (special: goes to project root) ---
  syncClaudeMd(templatesDir, tmpDir, vars, version, repoName);

  // --- Docs structure ---
  syncDirectCopy(templatesDir, 'docs', tmpDir, 'docs', vars, version, repoName);

  // --- VS Code + editor configs ---
  syncDirectCopy(templatesDir, 'vscode', tmpDir, '.vscode', vars, version, repoName);
  syncEditorConfigs(templatesDir, tmpDir, vars, version, repoName);

  // 5. Load previous manifest for stale file cleanup
  const manifestPath = resolve(agentkitRoot, '.manifest.json');
  let previousManifest = null;
  try {
    if (existsSync(manifestPath)) {
      previousManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    }
  } catch { /* ignore corrupt manifest */ }

  // 6. Atomic swap: move temp outputs to project root & build new manifest
  console.log('[agentkit:sync] Writing outputs...');
  const resolvedRoot = resolve(projectRoot) + sep;
  let count = 0;
  let skippedScaffold = 0;
  const failedFiles = [];
  const newManifestFiles = {};
  for (const srcFile of walkDir(tmpDir)) {
    const relPath = relative(tmpDir, srcFile);
    const destFile = resolve(projectRoot, relPath);
    // Normalize to forward slashes for consistent manifest keys
    const manifestKey = relPath.replace(/\\/g, '/');

    // Path traversal protection: ensure all output stays within project root
    if (!resolve(destFile).startsWith(resolvedRoot) && resolve(destFile) !== resolve(projectRoot)) {
      console.error(`[agentkit:sync] BLOCKED: path traversal detected — ${relPath}`);
      failedFiles.push({ file: relPath, error: 'path traversal blocked' });
      continue;
    }

    // Compute content hash for manifest
    const fileContent = readFileSync(srcFile);
    const hash = createHash('sha256').update(fileContent).digest('hex').slice(0, 12);
    newManifestFiles[manifestKey] = { hash };

    // Scaffold-once: skip project-owned files that already exist
    if (isScaffoldOnce(relPath) && existsSync(destFile)) {
      skippedScaffold++;
      continue;
    }

    try {
      ensureDir(dirname(destFile));
      cpSync(srcFile, destFile, { force: true });

      // Make .sh files executable
      if (extname(srcFile) === '.sh') {
        try { chmodSync(destFile, 0o755); } catch { /* ignore on Windows */ }
      }
      count++;
    } catch (err) {
      failedFiles.push({ file: relPath, error: err.message });
      console.error(`[agentkit:sync] Failed to write: ${relPath} — ${err.message}`);
    }
  }

  // 7. Stale file cleanup: delete orphaned files from previous sync
  let cleanedCount = 0;
  if (previousManifest?.files) {
    for (const prevFile of Object.keys(previousManifest.files)) {
      if (!newManifestFiles[prevFile]) {
        // File was in previous sync but not in this one — it's orphaned
        const orphanPath = resolve(projectRoot, prevFile);
        if (existsSync(orphanPath)) {
          try {
            unlinkSync(orphanPath);
            cleanedCount++;
            if (process.env.DEBUG) {
              console.log(`[agentkit:sync] Cleaned stale file: ${prevFile}`);
            }
          } catch (err) {
            console.warn(`[agentkit:sync] Warning: could not clean stale file ${prevFile} — ${err.message}`);
          }
        }
      }
    }
  }

  // 8. Write new manifest
  const newManifest = {
    generatedAt: new Date().toISOString(),
    version,
    repoName: vars.repoName,
    files: newManifestFiles,
  };
  try {
    writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '\n', 'utf-8');
  } catch (err) {
    console.warn(`[agentkit:sync] Warning: could not write manifest — ${err.message}`);
  }

  // 9. Cleanup temp
  rmSync(tmpDir, { recursive: true, force: true });

  if (failedFiles.length > 0) {
    console.error(`[agentkit:sync] Error: ${failedFiles.length} file(s) failed to write:`);
    for (const f of failedFiles) {
      console.error(`  - ${f.file}: ${f.error}`);
    }
    throw new Error(`Sync completed with ${failedFiles.length} write failure(s)`);
  }
  if (skippedScaffold > 0) {
    console.log(`[agentkit:sync] Skipped ${skippedScaffold} project-owned file(s) (already exist).`);
  }
  if (cleanedCount > 0) {
    console.log(`[agentkit:sync] Cleaned ${cleanedCount} stale file(s) from previous sync.`);
  }
  console.log(`[agentkit:sync] Done! Generated ${count} files.`);
}

// ---------------------------------------------------------------------------
// Sync helpers
// ---------------------------------------------------------------------------

function mergePermissions(base, overlay) {
  const allow = [...new Set([...(base.allow || []), ...(overlay.allow || [])])];
  const deny = [...new Set([...(base.deny || []), ...(overlay.deny || [])])];
  return { allow, deny };
}

function syncDirectCopy(templatesDir, srcSubdir, tmpDir, destSubdir, vars, version, repoName) {
  const srcDir = resolve(templatesDir, srcSubdir);
  if (!existsSync(srcDir)) return;

  for (const file of walkDir(srcDir)) {
    const relPath = relative(srcDir, file);
    const destPath = resolve(tmpDir, destSubdir, relPath);
    const ext = extname(file);

    let content = readFileSync(file, 'utf-8');
    content = renderTemplate(content, { ...vars, repoName });

    // Add generated header for non-JSON, non-gitkeep files
    if (ext !== '.json' && basename(file) !== '.gitkeep') {
      content = insertHeader(content, ext, version, repoName);
    }

    writeOutput(destPath, content);
  }
}

/**
 * Inserts the GENERATED header into content, respecting shebangs and frontmatter.
 * - .sh/.ps1 files with shebang: header goes after shebang line
 * - .md/.mdc files with YAML frontmatter: header goes after closing ---
 * - Skips if content already contains "GENERATED by AgentKit Forge"
 */
function insertHeader(content, ext, version, repoName) {
  if (content.includes('GENERATED by AgentKit Forge')) return content;
  const header = getGeneratedHeader(version, repoName, ext);
  if (!header) return content;

  // Shell scripts: insert after shebang line
  if ((ext === '.sh' || ext === '.ps1') && content.startsWith('#!')) {
    const firstNewline = content.indexOf('\n');
    if (firstNewline > -1) {
      return content.substring(0, firstNewline + 1) + header + content.substring(firstNewline + 1);
    }
  }

  // Markdown/mdc with YAML frontmatter: insert after closing ---
  if ((ext === '.md' || ext === '.mdc') && content.startsWith('---')) {
    const closingIdx = content.indexOf('\n---', 3);
    if (closingIdx > -1) {
      const endOfFrontmatter = content.indexOf('\n', closingIdx + 4);
      if (endOfFrontmatter > -1) {
        return content.substring(0, endOfFrontmatter + 1) + '\n' + header + content.substring(endOfFrontmatter + 1);
      }
      // Frontmatter closing --- is at EOF — append header after it
      return content + '\n' + header;
    }
  }

  return header + content;
}

function syncClaudeSettings(templatesDir, tmpDir, vars, version, mergedPermissions, settingsSpec) {
  const templatePath = resolve(templatesDir, 'claude', 'settings.json');
  if (!existsSync(templatePath)) {
    console.warn('[agentkit:sync] Warning: claude/settings.json template not found');
    return;
  }

  let template = readFileSync(templatePath, 'utf-8');
  // The settings.json template has placeholder arrays — replace with merged permissions
  const settings = JSON.parse(renderTemplate(template, vars));

  // Override permissions with merged values
  if (settings.permissions) {
    settings.permissions.allow = mergedPermissions.allow;
    settings.permissions.deny = mergedPermissions.deny;
  }

  const destPath = resolve(tmpDir, '.claude', 'settings.json');
  writeOutput(destPath, JSON.stringify(settings, null, 2) + '\n');
}

function syncClaudeCommands(templatesDir, tmpDir, vars, version, repoName, teamsSpec, commandsSpec) {
  const commandsDir = resolve(templatesDir, 'claude', 'commands');
  if (!existsSync(commandsDir)) return;

  // Copy all non-TEMPLATE command files
  const files = readdirSync(commandsDir);
  for (const file of files) {
    if (file === 'team-TEMPLATE.md') continue;
    const srcPath = resolve(commandsDir, file);
    if (statSync(srcPath).isDirectory()) continue;

    let content = readFileSync(srcPath, 'utf-8');
    content = renderTemplate(content, { ...vars, repoName });
    content = insertHeader(content, extname(file), version, repoName);
    writeOutput(resolve(tmpDir, '.claude', 'commands', file), content);
  }

  // Generate team commands from template
  const teamTemplatePath = resolve(commandsDir, 'team-TEMPLATE.md');
  if (existsSync(teamTemplatePath) && teamsSpec.teams) {
    const teamTemplate = readFileSync(teamTemplatePath, 'utf-8');

    for (const team of teamsSpec.teams) {
      const teamVars = {
        ...vars,
        teamId: team.id,
        teamName: team.name,
        teamFocus: team.focus,
        teamScope: Array.isArray(team.scope) ? team.scope.join(', ') : (team.scope || '**/*'),
      };

      let content = renderTemplate(teamTemplate, teamVars);
      content = insertHeader(content, '.md', version, repoName);
      const fileName = `team-${team.id}.md`;
      writeOutput(resolve(tmpDir, '.claude', 'commands', fileName), content);
    }
  }
}

function syncClaudeAgents(templatesDir, tmpDir, vars, version, repoName, agentsSpec) {
  const agentTemplatePath = resolve(templatesDir, 'claude', 'agents', 'TEMPLATE.md');
  if (!existsSync(agentTemplatePath) || !agentsSpec.agents) return;

  const agentTemplate = readFileSync(agentTemplatePath, 'utf-8');

  // agents.yaml has nested structure: agents.engineering: [...], agents.design: [...], etc.
  // Flatten all agents from all categories
  const allAgents = [];
  for (const [category, agents] of Object.entries(agentsSpec.agents)) {
    if (!Array.isArray(agents)) continue;
    for (const agent of agents) {
      allAgents.push({ ...agent, category: agent.category || category });
    }
  }

  for (const agent of allAgents) {
    const focusList = Array.isArray(agent.focus)
      ? agent.focus.map(f => `- \`${f}\``).join('\n') : (agent.focus || '');
    const responsibilitiesList = Array.isArray(agent.responsibilities)
      ? agent.responsibilities.map(r => `- ${r}`).join('\n') : (agent.responsibilities || '');
    const toolsList = Array.isArray(agent['preferred-tools'])
      ? agent['preferred-tools'].map(t => `- ${t}`).join('\n')
      : (Array.isArray(agent.tools) ? agent.tools.map(t => `- ${t}`).join('\n') : '');

    const agentVars = {
      ...vars,
      agentId: agent.id,
      agentCategory: agent.category,
      agentName: agent.name,
      agentRole: agent.role || '',
      agentFocusList: focusList,
      agentResponsibilitiesList: responsibilitiesList,
      agentToolsList: toolsList,
    };

    let content = renderTemplate(agentTemplate, agentVars);
    content = insertHeader(content, '.md', version, repoName);
    const destPath = resolve(tmpDir, '.claude', 'agents', agent.category, `${agent.id}.md`);
    writeOutput(destPath, content);
  }
}

function syncCopilot(templatesDir, tmpDir, vars, version, repoName) {
  // Main copilot instructions
  const mainPath = resolve(templatesDir, 'copilot', 'copilot-instructions.md');
  if (existsSync(mainPath)) {
    let content = readFileSync(mainPath, 'utf-8');
    content = renderTemplate(content, { ...vars, repoName });
    content = insertHeader(content, '.md', version, repoName);
    writeOutput(resolve(tmpDir, '.github', 'copilot-instructions.md'), content);
  }

  // Path-specific instructions
  const instrDir = resolve(templatesDir, 'copilot', 'instructions');
  if (existsSync(instrDir)) {
    syncDirectCopy(templatesDir, 'copilot/instructions', tmpDir, '.github/instructions', vars, version, repoName);
  }
}

function syncGitHub(templatesDir, tmpDir, vars, version, repoName) {
  const githubDir = resolve(templatesDir, 'github');
  if (!existsSync(githubDir)) return;

  // CI workflow
  const ciPath = resolve(githubDir, 'ai-framework-ci.yml');
  if (existsSync(ciPath)) {
    let content = readFileSync(ciPath, 'utf-8');
    content = renderTemplate(content, { ...vars, repoName });
    content = insertHeader(content, '.yml', version, repoName);
    writeOutput(resolve(tmpDir, '.github', 'workflows', 'ai-framework-ci.yml'), content);
  }

  // Issue template
  const issueDir = resolve(githubDir, 'ISSUE_TEMPLATE');
  if (existsSync(issueDir)) {
    syncDirectCopy(templatesDir, 'github/ISSUE_TEMPLATE', tmpDir, '.github/ISSUE_TEMPLATE', vars, version, repoName);
  }

  // PR template
  const prPath = resolve(githubDir, 'PULL_REQUEST_TEMPLATE.md');
  if (existsSync(prPath)) {
    let content = readFileSync(prPath, 'utf-8');
    content = renderTemplate(content, { ...vars, repoName });
    content = insertHeader(content, '.md', version, repoName);
    writeOutput(resolve(tmpDir, '.github', 'PULL_REQUEST_TEMPLATE.md'), content);
  }
}

function syncRootDocs(templatesDir, tmpDir, vars, version, repoName) {
  const rootDir = resolve(templatesDir, 'root');
  if (!existsSync(rootDir)) return;

  const files = readdirSync(rootDir);
  for (const file of files) {
    const srcPath = resolve(rootDir, file);
    if (statSync(srcPath).isDirectory()) continue;

    let content = readFileSync(srcPath, 'utf-8');
    content = renderTemplate(content, { ...vars, repoName });
    const ext = extname(file);
    content = insertHeader(content, ext, version, repoName);
    writeOutput(resolve(tmpDir, file), content);
  }
}

function syncClaudeMd(templatesDir, tmpDir, vars, version, repoName) {
  const claudeMdPath = resolve(templatesDir, 'claude', 'CLAUDE.md');
  if (!existsSync(claudeMdPath)) return;

  let content = readFileSync(claudeMdPath, 'utf-8');
  content = renderTemplate(content, { ...vars, repoName });
  content = insertHeader(content, '.md', version, repoName);
  writeOutput(resolve(tmpDir, 'CLAUDE.md'), content);
}

function syncEditorConfigs(templatesDir, tmpDir, vars, version, repoName) {
  // .editorconfig, .prettierrc, .markdownlint.json — look in templates/root or templates/ root-level
  const configs = [
    { src: 'root/.editorconfig', dest: '.editorconfig' },
    { src: 'root/.prettierrc', dest: '.prettierrc' },
    { src: 'root/.markdownlint.json', dest: '.markdownlint.json' },
  ];

  for (const cfg of configs) {
    const srcPath = resolve(templatesDir, cfg.src);
    if (!existsSync(srcPath)) continue;

    let content = readFileSync(srcPath, 'utf-8');
    content = renderTemplate(content, { ...vars, repoName });
    const ext = extname(cfg.dest);

    // JSON files don't get headers
    if (ext !== '.json') {
      const header = getGeneratedHeader(version, repoName, ext);
      if (header) content = header + content;
    }

    writeOutput(resolve(tmpDir, cfg.dest), content);
  }
}

function syncCursorTeams(tmpDir, vars, version, repoName, teamsSpec) {
  if (!teamsSpec.teams) return;

  for (const team of teamsSpec.teams) {
    const scope = Array.isArray(team.scope) ? team.scope.join(', ') : (team.scope || '**/*');
    const globs = Array.isArray(team.scope) ? team.scope.join(', ') : '';
    let content = [
      '---',
      `description: "Team ${team.name} — ${team.focus}"`,
      `globs: ${globs}`,
      'alwaysApply: false',
      '---',
      `# Team: ${team.name}`,
      '',
      `**Focus**: ${team.focus}`,
      `**Scope**: ${scope}`,
      '',
      '## Responsibilities',
      `- Own all code within scope: ${scope}`,
      '- Follow project conventions and quality gates',
      '- Coordinate with other teams via /orchestrate for cross-cutting changes',
      '',
      '## Workflow',
      '1. Review current backlog in AGENT_BACKLOG.md',
      '2. Implement changes within team scope',
      '3. Run /check before committing',
      '4. Use /handoff when passing work to another team',
      '',
    ].join('\n');

    content = renderTemplate(content, { ...vars, repoName });
    content = insertHeader(content, '.mdc', version, repoName);
    const fileName = `team-${team.id}.mdc`;
    writeOutput(resolve(tmpDir, '.cursor', 'rules', fileName), content);
  }
}

function syncWindsurfTeams(tmpDir, vars, version, repoName, teamsSpec) {
  if (!teamsSpec.teams) return;

  for (const team of teamsSpec.teams) {
    const scope = Array.isArray(team.scope) ? team.scope.join(', ') : (team.scope || '**/*');
    let content = [
      `# Team: ${team.name}`,
      '',
      `**Focus**: ${team.focus}`,
      `**Scope**: ${scope}`,
      '',
      '## Responsibilities',
      `- Own all code within scope: ${scope}`,
      '- Follow project conventions and quality gates',
      '- Coordinate with other teams via /orchestrate for cross-cutting changes',
      '',
      '## Workflow',
      '1. Review current backlog in AGENT_BACKLOG.md',
      '2. Implement changes within team scope',
      '3. Run /check before committing',
      '4. Use /handoff when passing work to another team',
      '',
    ].join('\n');

    content = renderTemplate(content, { ...vars, repoName });
    content = insertHeader(content, '.md', version, repoName);
    const fileName = `team-${team.id}.md`;
    writeOutput(resolve(tmpDir, '.windsurf', 'rules', fileName), content);
  }
}

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------
export {
  renderTemplate, sanitizeTemplateValue, getCommentStyle, getGeneratedHeader,
  mergePermissions, insertHeader, isScaffoldOnce,
  flattenProjectYaml, resolveConditionals, resolveEachBlocks, evalTruthy,
  flattenCrosscutting,
};
