/**
 * AgentKit Forge — Sync Command
 * Reads spec + overlay → renders templates → writes generated outputs
 */
import { createHash } from 'crypto';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import yaml from 'js-yaml';
import { basename, dirname, extname, join, relative, resolve, sep } from 'path';
import { VALID_TASK_TYPES } from './task-types.mjs';
import { PROJECT_MAPPING, get, transform, check } from './sync.refactor.mjs';

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

const RAW_TEMPLATE_VARS = new Set(['commandFlags']);

function isShellScriptTarget(targetPath) {
  const ext = extname(targetPath || '').toLowerCase();
  return ext === '.sh' || ext === '.ps1';
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
function renderTemplate(template, vars, targetPath = '') {
  let result = template;
  const allowRawVars = isShellScriptTarget(targetPath);

  // Phase 1: Resolve {{#if var}}...{{/if}} blocks (supports nesting)
  result = resolveConditionals(result, vars);

  // Phase 2: Resolve {{#each var}}...{{/each}} blocks
  result = resolveEachBlocks(result, vars);

  // Phase 3: Replace {{key}} placeholders
  const sortedKeys = Object.keys(vars).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const value = vars[key];
    const placeholder = `{{${key}}}`;
    const safeValue =
      typeof value === 'string'
        ? allowRawVars && RAW_TEMPLATE_VARS.has(key)
          ? value
          : sanitizeTemplateValue(value)
        : JSON.stringify(value);
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
  const ifRegex =
    /\{\{#if\s+([a-zA-Z_][a-zA-Z0-9_]*)\}\}((?:(?!\{\{#if\s)(?!\{\{\/if\}\})[\s\S])*?)\{\{\/if\}\}/g;
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
  // Warn if safety limit was hit and there are still unresolved {{#if}} blocks
  if (safety <= 0) {
    ifRegex.lastIndex = 0;
    if (ifRegex.test(result)) {
      console.warn(
        'resolveConditionals: safety limit reached while processing template. ' +
          'Template may contain malformed or deeply nested {{#if}} blocks; output may be partially rendered.'
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
    return arr
      .map((item, index) => {
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
      })
      .join('');
  });
}

/**
 * Evaluates whether a template variable is "truthy" for {{#if}} blocks.
 * Falsy: undefined, null, false, '', 0, empty array []
 * Truthy: everything else (including 'none' — use explicit checks in templates)
 */
function evalTruthy(value) {
  if (value === undefined || value === null || value === false || value === '' || value === 0)
    return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * Flattens a project.yaml object into a flat key→value map suitable for template rendering.
 * Uses a declarative mapping configuration for cleaner code.
 */
function flattenProjectYaml(project, docsSpec = null) {
  if (!project || typeof project !== 'object') return {};
  const vars = {};

  // Apply declarative mappings
  for (const mapping of PROJECT_MAPPING) {
    const value = get(project, mapping.src);
    if (check(value, mapping.check)) {
      const transformed = transform(value, mapping.type);
      if (transformed !== undefined) {
        vars[mapping.dest] = transformed;
      }
    }
  }

  // --- Post-processing / Complex derivations ---

  // hasAnyPattern
  vars.hasAnyPattern =
    vars.hasPatternRepository ||
    vars.hasPatternCqrs ||
    vars.hasPatternEventSourcing ||
    vars.hasPatternMediator ||
    vars.hasPatternUnitOfWork;

  // docsSpec overlay for PRD
  const prdSpec = docsSpec?.specialDirectories?.find((d) => d.id === 'prd');
  if (prdSpec) {
    vars.hasPrd = true;
    if (!vars.prdPath) vars.prdPath = prdSpec.path;
  }

  // hasAnyInfraConfig
  vars.hasAnyInfraConfig =
    !!vars.infraNamingConvention ||
    !!vars.infraDefaultRegion ||
    !!vars.infraOrg ||
    !!vars.infraIacToolchain ||
    !!vars.infraStateBackend ||
    !!vars.infraMandatoryTags;

  // hasAnyMonitoring
  vars.hasAnyMonitoring =
    !!vars.monitoringProvider ||
    !!vars.alertingProvider ||
    !!vars.tracingProvider ||
    !!vars.hasCentralisedLogging;

  // hasDr
  vars.hasDr =
    !!vars.drRpoHours ||
    !!vars.drRtoHours ||
    !!vars.drBackupSchedule ||
    vars.hasGeoRedundancy;

  // hasAnyComplianceConfig
  vars.hasAnyComplianceConfig =
    !!vars.complianceFramework ||
    !!vars.drRpoHours ||
    !!vars.drRtoHours ||
    !!vars.drBackupSchedule ||
    !!vars.drTestSchedule ||
    !!vars.auditEventBus;

  // Integrations (kept as array for {{#each}})
  if (Array.isArray(project.integrations)) {
    vars.integrations = project.integrations;
    vars.hasIntegrations = project.integrations.length > 0;
  }

  return vars;
}

/**
 * Flattens the crosscutting section of project.yaml into template vars.
 * @deprecated - Merged into flattenProjectYaml via declarative mappings.
 * Kept exported for test compatibility if any tests import it directly.
 */
function flattenCrosscutting(cc, vars) {
  // Delegate to main flatten function by wrapping cc in a project-like structure
  // This is a backward compatibility shim.
  const tempProject = { crosscutting: cc };
  const mapped = flattenProjectYaml(tempProject);

  // Copy mapped crosscutting vars into the target vars object
  // Filter out keys that don't belong to crosscutting to avoid noise
  for (const [key, val] of Object.entries(mapped)) {
    if (key !== 'hasAnyPattern' &&
        key !== 'hasAnyInfraConfig' &&
        key !== 'hasAnyMonitoring' &&
        key !== 'hasDr' &&
        key !== 'hasAnyComplianceConfig') {
      vars[key] = val;
    }
  }
}

/**
 * Sanitizes a template variable value to prevent injection.
 * Strips shell metacharacters that could cause command injection if the
 * rendered output is executed in a shell context (e.g., hook scripts).
 */
function sanitizeTemplateValue(value) {
  let s = value;
  s = s.replace(/\$\([^)]*\)/g, (m) => m.slice(2, -1));
  s = s.replace(/[`$\\;|&<>!{}]/g, '');
  return s;
}

function formatCommandFlags(flags) {
  if (!Array.isArray(flags) || flags.length === 0) return '';
  const rows = flags.map(
    (f) =>
      `| \`${f.name || ''}\` | ${(f.description || '').replace(/\|/g, '\\|')} | ${f.default !== undefined && f.default !== null ? String(f.default) : '—'} |`
  );
  return ['| Flag | Description | Default |', '|------|-------------|---------|', ...rows].join(
    '\n'
  );
}

function getGeneratedHeader(version, repoName, ext) {
  const comment = getCommentStyle(ext);
  if (!comment) return '';
  return [
    `${comment.start} GENERATED by AgentKit Forge v${version} — DO NOT EDIT ${comment.end}`,
    `${comment.start} Source: .agentkit/spec + .agentkit/overlays/${repoName} ${comment.end}`,
    `${comment.start} Regenerate: pnpm -C .agentkit agentkit:sync ${comment.end}`,
    '',
  ].join('\n');
}

function getCommentStyle(ext) {
  switch (ext) {
    case '.md':
    case '.mdc':
      return { start: '<!--', end: '-->' };
    case '.json':
    case '.template':
      return null; // JSON / template files don't support comments
    case '.yml':
    case '.yaml':
      return { start: '#', end: '' };
    case '.sh':
      return { start: '#', end: '' };
    case '.ps1':
      return { start: '#', end: '' };
    case '':
      return { start: '#', end: '' }; // files like "cursorrules"
    default:
      return { start: '#', end: '' };
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
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') return;
    throw err;
  }
  for (const entry of entries) {
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

function simpleDiff(a, b) {
  const aLines = a.split(/\r?\n/);
  const bLines = b.split(/\r?\n/);
  const out = [];
  const maxLen = Math.max(aLines.length, bLines.length);
  for (let i = 0; i < maxLen; i++) {
    const al = aLines[i];
    const bl = bLines[i];
    if (al === undefined) out.push(`+ ${bl || ''}`);
    else if (bl === undefined) out.push(`- ${al}`);
    else if (al !== bl) {
      out.push(`- ${al}`);
      out.push(`+ ${bl}`);
    }
  }
  return out.slice(0, 20).join('\n') + (out.length > 20 ? '\n...' : '');
}

export async function runSync({ agentkitRoot, projectRoot, flags }) {
  const dryRun = flags?.['dry-run'] || false;
  const diff = flags?.diff || false;
  const quiet = flags?.quiet || false;
  const verbose = flags?.verbose || false;
  const noClean = flags?.['no-clean'] || false;

  const log = (...args) => {
    if (!quiet) console.log(...args);
  };
  const logVerbose = (...args) => {
    if (verbose && !quiet) console.log(...args);
  };

  if (dryRun) {
    log('[agentkit:sync] Dry-run mode — no files will be written.');
  }
  if (diff) {
    log('[agentkit:sync] Diff mode — showing what would change.');
  }
  log('[agentkit:sync] Starting sync...');

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
    log('[agentkit:sync] No overlay detected, using __TEMPLATE__');
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
  const projectVars = projectSpec ? flattenProjectYaml(projectSpec, docsSpec) : {};
  const vars = {
    ...projectVars,
    version,
    repoName: (overlaySettings.repoName === '__TEMPLATE__' && projectSpec?.name) || overlaySettings.repoName || repoName,
    defaultBranch: overlaySettings.defaultBranch || 'main',
    primaryStack: overlaySettings.primaryStack || 'auto',
  };

  // Resolve render targets — determines which tool outputs to generate
  let targets = resolveRenderTargets(overlaySettings.renderTargets, flags);

  log(`[agentkit:sync] Repo: ${vars.repoName}, Version: ${version}`);
  if (flags?.only) {
    log(`[agentkit:sync] Syncing only: ${[...targets].join(', ')}`);
  }

  // 4. Render templates to temp directory
  const tmpDir = resolve(agentkitRoot, '.tmp');
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  const templatesDir = resolve(agentkitRoot, 'templates');

  // --- Always-on outputs (not gated by renderTargets) ---
  syncAgentsMd(templatesDir, tmpDir, vars, version, repoName);
  syncRootDocs(templatesDir, tmpDir, vars, version, repoName);
  syncGitHub(templatesDir, tmpDir, vars, version, repoName);
  syncDirectCopy(templatesDir, 'docs', tmpDir, 'docs', vars, version, repoName);
  syncDirectCopy(templatesDir, 'vscode', tmpDir, '.vscode', vars, version, repoName);
  syncEditorConfigs(templatesDir, tmpDir, vars, version, repoName);

  // --- Gated by renderTargets ---
  if (targets.has('claude')) {
    syncDirectCopy(templatesDir, 'claude/hooks', tmpDir, '.claude/hooks', vars, version, repoName);
    syncClaudeSettings(templatesDir, tmpDir, vars, version, mergedPermissions, settingsSpec);
    syncClaudeCommands(templatesDir, tmpDir, vars, version, repoName, teamsSpec, commandsSpec);
    syncClaudeAgents(templatesDir, tmpDir, vars, version, repoName, agentsSpec, rulesSpec);
    syncDirectCopy(templatesDir, 'claude/rules', tmpDir, '.claude/rules', vars, version, repoName);
    syncDirectCopy(templatesDir, 'claude/state', tmpDir, '.claude/state', vars, version, repoName);
    syncClaudeMd(templatesDir, tmpDir, vars, version, repoName);
    syncClaudeSkills(templatesDir, tmpDir, vars, version, repoName, commandsSpec);
  }

  if (targets.has('cursor')) {
    syncDirectCopy(templatesDir, 'cursor/rules', tmpDir, '.cursor/rules', vars, version, repoName);
    syncCursorTeams(tmpDir, vars, version, repoName, teamsSpec);
    syncCursorCommands(templatesDir, tmpDir, vars, version, repoName, commandsSpec);
  }

  if (targets.has('windsurf')) {
    syncDirectCopy(
      templatesDir,
      'windsurf/rules',
      tmpDir,
      '.windsurf/rules',
      vars,
      version,
      repoName
    );
    syncWindsurfCommands(templatesDir, tmpDir, vars, version, repoName, commandsSpec);
    syncDirectCopy(
      templatesDir,
      'windsurf/workflows',
      tmpDir,
      '.windsurf/workflows',
      vars,
      version,
      repoName
    );
    syncWindsurfTeams(tmpDir, vars, version, repoName, teamsSpec);
  }

  if (targets.has('ai')) {
    syncDirectCopy(templatesDir, 'ai', tmpDir, '.ai', vars, version, repoName);
  }

  if (targets.has('copilot')) {
    syncCopilot(templatesDir, tmpDir, vars, version, repoName);
    syncCopilotPrompts(templatesDir, tmpDir, vars, version, repoName, commandsSpec);
    syncCopilotAgents(templatesDir, tmpDir, vars, version, repoName, agentsSpec, rulesSpec);
    syncCopilotChatModes(templatesDir, tmpDir, vars, version, repoName, teamsSpec);
  }

  if (targets.has('gemini')) {
    syncGemini(templatesDir, tmpDir, vars, version, repoName);
  }

  if (targets.has('codex')) {
    syncCodexSkills(templatesDir, tmpDir, vars, version, repoName, commandsSpec);
  }

  if (targets.has('warp')) {
    syncWarp(templatesDir, tmpDir, vars, version, repoName);
  }

  if (targets.has('cline')) {
    syncClineRules(templatesDir, tmpDir, vars, version, repoName, rulesSpec);
  }

  if (targets.has('roo')) {
    syncRooRules(templatesDir, tmpDir, vars, version, repoName, rulesSpec);
  }

  if (targets.has('mcp')) {
    syncA2aConfig(tmpDir, vars, version, repoName, agentsSpec, teamsSpec);
  }

  // 5. Build file list from temp and compute summary
  const newManifestFiles = {};
  const fileSummary = {}; // category → count
  for (const srcFile of walkDir(tmpDir)) {
    if (!existsSync(srcFile)) continue;
    const relPath = relative(tmpDir, srcFile);
    const manifestKey = relPath.replace(/\\/g, '/');
    let fileContent;
    try {
      fileContent = readFileSync(srcFile);
    } catch (err) {
      if (err?.code === 'ENOENT') continue;
      throw err;
    }
    const hash = createHash('sha256').update(fileContent).digest('hex').slice(0, 12);
    newManifestFiles[manifestKey] = { hash };

    // Categorize for summary
    const cat = categorizeFile(manifestKey);
    fileSummary[cat] = (fileSummary[cat] || 0) + 1;
  }

  // --- Dry-run: print summary and exit without writing ---
  if (dryRun) {
    rmSync(tmpDir, { recursive: true, force: true });
    const total = Object.keys(newManifestFiles).length;
    log(`[agentkit:sync] Dry-run: would generate ${total} file(s):`);
    printSyncSummary(fileSummary, targets, { quiet });
    return;
  }

  // --- Diff: show what would change and exit without writing ---
  if (diff) {
    const resolvedRoot = resolve(projectRoot) + sep;
    const overwrite = flags?.overwrite || flags?.force;
    let createCount = 0;
    let updateCount = 0;
    let skipCount = 0;
    for (const srcFile of walkDir(tmpDir)) {
      if (!existsSync(srcFile)) continue;
      const relPath = relative(tmpDir, srcFile);
      const destFile = resolve(projectRoot, relPath);
      const normPath = relPath.replace(/\\/g, '/');
      if (!resolve(destFile).startsWith(resolvedRoot) && resolve(destFile) !== resolve(projectRoot))
        continue;
      const wouldSkip = !overwrite && isScaffoldOnce(normPath) && existsSync(destFile);
      if (wouldSkip) {
        skipCount++;
        logVerbose(`  skip ${normPath} (project-owned, exists)`);
        continue;
      }
      let newContent;
      try {
        newContent = readFileSync(srcFile, 'utf-8');
      } catch (err) {
        if (err?.code === 'ENOENT') continue;
        throw err;
      }
      if (!existsSync(destFile)) {
        createCount++;
        log(`  create ${normPath}`);
      } else {
        const oldContent = readFileSync(destFile, 'utf-8');
        if (oldContent !== newContent) {
          updateCount++;
          log(`  update ${normPath}`);
          const diffOut = simpleDiff(oldContent, newContent);
          if (diffOut)
            log(
              diffOut
                .split('\n')
                .map((l) => `    ${l}`)
                .join('\n')
            );
        } else {
          skipCount++;
          logVerbose(`  unchanged ${normPath}`);
        }
      }
    }
    rmSync(tmpDir, { recursive: true, force: true });
    log(
      `[agentkit:sync] Diff: ${createCount} create, ${updateCount} update, ${skipCount} unchanged/skip`
    );
    return;
  }

  // 6. Load previous manifest for stale file cleanup
  const manifestPath = resolve(agentkitRoot, '.manifest.json');
  let previousManifest = null;
  try {
    if (existsSync(manifestPath)) {
      previousManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    }
  } catch {
    /* ignore corrupt manifest */
  }

  // 7. Atomic swap: move temp outputs to project root & build new manifest
  log('[agentkit:sync] Writing outputs...');
  const resolvedRoot = resolve(projectRoot) + sep;
  let count = 0;
  let skippedScaffold = 0;
  const failedFiles = [];
  for (const srcFile of walkDir(tmpDir)) {
    if (!existsSync(srcFile)) continue;
    const relPath = relative(tmpDir, srcFile);
    const destFile = resolve(projectRoot, relPath);

    // Path traversal protection: ensure all output stays within project root
    if (!resolve(destFile).startsWith(resolvedRoot) && resolve(destFile) !== resolve(projectRoot)) {
      console.error(`[agentkit:sync] BLOCKED: path traversal detected — ${relPath}`);
      failedFiles.push({ file: relPath, error: 'path traversal blocked' });
      continue;
    }

    // Scaffold-once: skip project-owned files that already exist (unless --overwrite)
    const overwrite = flags?.overwrite || flags?.force;
    if (!overwrite && isScaffoldOnce(relPath) && existsSync(destFile)) {
      skippedScaffold++;
      continue;
    }

    try {
      ensureDir(dirname(destFile));
      cpSync(srcFile, destFile, { force: true });

      // Make .sh files executable
      if (extname(srcFile) === '.sh') {
        try {
          chmodSync(destFile, 0o755);
        } catch {
          /* ignore on Windows */
        }
      }
      count++;
      logVerbose(`  wrote ${relPath.replace(/\\/g, '/')}`);
    } catch (err) {
      failedFiles.push({ file: relPath, error: err.message });
      console.error(`[agentkit:sync] Failed to write: ${relPath} — ${err.message}`);
    }
  }

  if (failedFiles.length > 0) {
    rmSync(tmpDir, { recursive: true, force: true });
    console.error(`[agentkit:sync] Error: ${failedFiles.length} file(s) failed to write:`);
    for (const f of failedFiles) {
      console.error(`  - ${f.file}: ${f.error}`);
    }
    throw new Error(`Sync completed with ${failedFiles.length} write failure(s)`);
  }

  // 8. Stale file cleanup: delete orphaned files from previous sync (unless --no-clean)
  let cleanedCount = 0;
  if (!noClean && previousManifest?.files) {
    for (const prevFile of Object.keys(previousManifest.files)) {
      if (!newManifestFiles[prevFile]) {
        // File was in previous sync but not in this one — it's orphaned
        const orphanPath = resolve(projectRoot, prevFile);
        // Path traversal protection: ensure orphan path stays within project root
        if (!orphanPath.startsWith(resolvedRoot) && orphanPath !== resolve(projectRoot)) {
          console.warn(`[agentkit:sync] BLOCKED: path traversal in manifest — ${prevFile}`);
          continue;
        }
        if (existsSync(orphanPath)) {
          try {
            unlinkSync(orphanPath);
            cleanedCount++;
            logVerbose(`[agentkit:sync] Cleaned stale file: ${prevFile}`);
          } catch (err) {
            console.warn(
              `[agentkit:sync] Warning: could not clean stale file ${prevFile} — ${err.message}`
            );
          }
        }
      }
    }
  }

  // 9. Write new manifest
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

  // 10. Cleanup temp
  rmSync(tmpDir, { recursive: true, force: true });

  if (skippedScaffold > 0) {
    log(`[agentkit:sync] Skipped ${skippedScaffold} project-owned file(s) (already exist).`);
  }
  if (cleanedCount > 0) {
    log(`[agentkit:sync] Cleaned ${cleanedCount} stale file(s) from previous sync.`);
  }

  // 11. Post-sync summary
  printSyncSummary(fileSummary, targets, { quiet });
  const completeness = computeProjectCompleteness(projectSpec);
  if (completeness.total > 0) {
    log(
      `[agentkit:sync] project.yaml completeness: ${completeness.percent}% (${completeness.present}/${completeness.total} fields populated)`
    );
    if (completeness.missing.length > 0) {
      log(`[agentkit:sync] Top missing fields: ${completeness.missing.slice(0, 5).join(', ')}`);
    }
  }
  log(`[agentkit:sync] Done! Generated ${count} files.`);

  // 12. First-sync hint (when not called from init)
  if (!flags?.overlay) {
    const markerPath = resolve(projectRoot, '.agentkit-repo');
    if (!existsSync(markerPath)) {
      log('');
      log('  Tip: Run "agentkit init" to customize which AI tools you generate configs for.');
      log('       Run "agentkit add <tool>" to add tools incrementally.');
    }
  }
}

// ---------------------------------------------------------------------------
// Sync helpers
// ---------------------------------------------------------------------------

/** All known render target names. */
const ALL_RENDER_TARGETS = [
  'claude',
  'cursor',
  'windsurf',
  'copilot',
  'gemini',
  'codex',
  'warp',
  'cline',
  'roo',
  'ai',
  'mcp',
];

/** Tool display names for summary output. */
const TOOL_LABELS = {
  claude: 'Claude Code',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
  copilot: 'GitHub Copilot',
  gemini: 'Gemini',
  codex: 'Codex',
  warp: 'Warp',
  cline: 'Cline',
  roo: 'Roo Code',
  ai: 'Continue/AI',
  mcp: 'MCP',
  docs: 'Docs',
  github: 'GitHub',
  universal: 'Universal',
  editor: 'Editor configs',
};

/**
 * Categorizes a generated file path into a tool/category name for summary.
 */
function categorizeFile(manifestKey) {
  if (manifestKey === 'AGENTS.md') return 'universal';
  if (manifestKey === 'CLAUDE.md' || manifestKey.startsWith('.claude/')) return 'claude';
  if (manifestKey.startsWith('.cursor/')) return 'cursor';
  if (manifestKey.startsWith('.windsurf/')) return 'windsurf';
  if (manifestKey.startsWith('.ai/')) return 'ai';
  if (manifestKey.startsWith('mcp/')) return 'mcp';
  if (manifestKey === 'GEMINI.md' || manifestKey.startsWith('.gemini/')) return 'gemini';
  if (manifestKey === 'WARP.md') return 'warp';
  if (manifestKey.startsWith('.agents/')) return 'codex';
  if (manifestKey.startsWith('.clinerules/')) return 'cline';
  if (manifestKey.startsWith('.roo/')) return 'roo';
  if (
    manifestKey.startsWith('.github/copilot') ||
    manifestKey.startsWith('.github/instructions') ||
    manifestKey.startsWith('.github/prompts') ||
    manifestKey.startsWith('.github/agents') ||
    manifestKey.startsWith('.github/chatmodes')
  )
    return 'copilot';
  if (manifestKey.startsWith('.github/')) return 'github';
  if (manifestKey.startsWith('docs/')) return 'docs';
  if (
    manifestKey.startsWith('.vscode/') ||
    manifestKey === '.editorconfig' ||
    manifestKey === '.prettierrc' ||
    manifestKey === '.markdownlint.json'
  )
    return 'editor';
  return 'universal';
}

/**
 * Prints a grouped post-sync summary.
 */
function printSyncSummary(fileSummary, targets, opts = {}) {
  if (opts.quiet) return;
  const toolEntries = [];
  const otherEntries = [];
  for (const [cat, count] of Object.entries(fileSummary)) {
    const label = TOOL_LABELS[cat] || cat;
    if (ALL_RENDER_TARGETS.includes(cat)) {
      toolEntries.push(`  ${label}: ${count} file(s)`);
    } else {
      otherEntries.push(`  ${label}: ${count} file(s)`);
    }
  }
  if (toolEntries.length > 0 || otherEntries.length > 0) {
    const enabledNames = [...targets].map((t) => TOOL_LABELS[t] || t).join(', ');
    console.log(`[agentkit:sync] Summary for: ${enabledNames}`);
    for (const line of toolEntries) console.log(line);
    for (const line of otherEntries) console.log(line);
  }
}

/**
 * Resolves the active render targets from overlay settings + CLI flags.
 * - If --only flag is set, use only those targets (comma-separated)
 * - If renderTargets is defined and non-empty in overlay, use those
 * - If renderTargets is missing/empty, default to ALL (backward compat)
 */
function resolveRenderTargets(overlayTargets, flags) {
  // --only flag overrides everything
  if (flags?.only) {
    const onlyTargets = String(flags.only)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const unknown = onlyTargets.filter((t) => !ALL_RENDER_TARGETS.includes(t));
    if (unknown.length > 0) {
      console.warn(
        `[agentkit:sync] Warning: unknown render target(s): ${unknown.join(', ')}. Valid: ${ALL_RENDER_TARGETS.join(', ')}`
      );
    }
    return new Set(onlyTargets);
  }
  // Overlay renderTargets
  if (Array.isArray(overlayTargets) && overlayTargets.length > 0) {
    return new Set(overlayTargets);
  }
  // Default: generate everything (backward compatibility)
  return new Set(ALL_RENDER_TARGETS);
}

function mergePermissions(base, overlay) {
  const allow = [...new Set([...(base.allow || []), ...(overlay.allow || [])])];
  const deny = [...new Set([...(base.deny || []), ...(overlay.deny || [])])];
  return { allow, deny };
}

function computeProjectCompleteness(project) {
  if (!project || typeof project !== 'object') {
    return { percent: 0, present: 0, total: 0, missing: [] };
  }

  const fields = [
    'name',
    'description',
    'phase',
    'stack.languages',
    'stack.database',
    'architecture.pattern',
    'deployment.cloudProvider',
    'deployment.iacTool',
    'infrastructure.namingConvention',
    'infrastructure.defaultRegion',
    'infrastructure.org',
    'observability.monitoring.provider',
    'observability.alerting.provider',
    'observability.tracing.provider',
    'compliance.framework',
    'compliance.disasterRecovery.rpoHours',
    'compliance.disasterRecovery.rtoHours',
    'compliance.audit.eventBus',
    'patterns.repository',
    'patterns.cqrs',
    'patterns.eventSourcing',
    'patterns.mediator',
    'patterns.unitOfWork',
  ];

  const get = (obj, path) =>
    path
      .split('.')
      .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);

  const missing = [];
  let present = 0;

  for (const field of fields) {
    const value = get(project, field);
    if (
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    ) {
      missing.push(field);
    } else {
      present += 1;
    }
  }

  return {
    percent: Math.round((present / fields.length) * 100),
    present,
    total: fields.length,
    missing,
  };
}

function syncDirectCopy(templatesDir, srcSubdir, tmpDir, destSubdir, vars, version, repoName) {
  const srcDir = resolve(templatesDir, srcSubdir);
  if (!existsSync(srcDir)) return;

  for (const file of walkDir(srcDir)) {
    const relPath = relative(srcDir, file);
    const destPath = resolve(tmpDir, destSubdir, relPath);
    const ext = extname(file);

    let content = readFileSync(file, 'utf-8');
    content = renderTemplate(content, { ...vars, repoName }, file);

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
        return (
          content.substring(0, endOfFrontmatter + 1) +
          '\n' +
          header +
          content.substring(endOfFrontmatter + 1)
        );
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

function syncClaudeCommands(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  teamsSpec,
  commandsSpec
) {
  const commandsDir = resolve(templatesDir, 'claude', 'commands');
  if (!existsSync(commandsDir)) return;

  const commandsByName = new Map();
  for (const cmd of commandsSpec.commands || []) {
    if (cmd.name) commandsByName.set(cmd.name, cmd);
  }

  const files = readdirSync(commandsDir);
  for (const file of files) {
    if (file === 'team-TEMPLATE.md') continue;
    const srcPath = resolve(commandsDir, file);
    if (statSync(srcPath).isDirectory()) continue;

    const baseName = file.replace(/\.md$/, '');
    const cmdSpec = commandsByName.get(baseName);
    const cmdVars = { ...vars };
    if (cmdSpec) {
      cmdVars.commandDescription =
        typeof cmdSpec.description === 'string'
          ? cmdSpec.description.trim()
          : cmdSpec.description || '';
      cmdVars.commandFlags = formatCommandFlags(cmdSpec.flags);
      cmdVars.commandType = cmdSpec.type || 'utility';
    }

    let content = readFileSync(srcPath, 'utf-8');
    content = renderTemplate(content, cmdVars);
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
        teamScope: Array.isArray(team.scope) ? team.scope.join(', ') : team.scope || '**/*',
        teamAccepts: Array.isArray(team.accepts) ? team.accepts.join(', ') : '',
        teamHandoffChain: Array.isArray(team['handoff-chain'])
          ? team['handoff-chain'].join(', ')
          : '',
      };

      let content = renderTemplate(teamTemplate, teamVars);
      content = insertHeader(content, '.md', version, repoName);
      const fileName = `team-${team.id}.md`;
      writeOutput(resolve(tmpDir, '.claude', 'commands', fileName), content);
    }
  }
}

function normalizeGlobStem(glob) {
  if (typeof glob !== 'string' || !glob.trim()) return '';
  const raw = glob.trim().replace(/\\/g, '/');
  if (raw === '*' || raw === '**' || raw === '**/*' || raw === '*/**') return '__WILDCARD_ALL__';
  return raw
    .replace(/^\.\//, '')
    .replace(/\*\*\/\*/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\.(ts|tsx|js|jsx|mjs|mts|cs|py|rs|tf|md|json|yaml|yml)$/i, '')
    .replace(/^\/+|\/+$/g, '');
}

function hasGlobOverlap(a, b) {
  const aa = normalizeGlobStem(a);
  const bb = normalizeGlobStem(b);
  if (!aa || !bb) return false;
  if (aa === '__WILDCARD_ALL__' || bb === '__WILDCARD_ALL__') return true;
  if (aa === bb) return true;
  const aSegments = aa.split('/').filter(Boolean);
  const bSegments = bb.split('/').filter(Boolean);
  const minLen = Math.min(aSegments.length, bSegments.length);
  for (let i = 0; i < minLen; i += 1) {
    if (aSegments[i] !== bSegments[i]) return false;
  }
  return true;
}

function buildAgentDomainRulesMarkdown(agent, rulesSpec) {
  if (!rulesSpec?.rules || !Array.isArray(agent?.focus)) return '';
  const matched = [];

  for (const ruleSet of rulesSpec.rules) {
    if (!Array.isArray(ruleSet['applies-to'])) continue;
    const overlaps = ruleSet['applies-to'].some((ruleGlob) =>
      agent.focus.some((focusGlob) => hasGlobOverlap(focusGlob, ruleGlob))
    );
    if (!overlaps) continue;

    const conventions = Array.isArray(ruleSet.conventions)
      ? ruleSet.conventions
          .map((c) => {
            const severity = c.severity ? ` [${c.severity}]` : '';
            const ruleText =
              typeof c.rule === 'string' ? c.rule.trim() : JSON.stringify(c.rule || null);
            return `- **${c.id}**${severity}: ${ruleText}`;
          })
          .join('\n')
      : '';

    if (conventions) {
      matched.push(`### ${ruleSet.domain}\n\n${conventions}`);
    }
  }

  return matched.join('\n\n');
}

function syncClaudeAgents(templatesDir, tmpDir, vars, version, repoName, agentsSpec, rulesSpec) {
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
      ? agent.focus.map((f) => `- \`${f}\``).join('\n')
      : agent.focus || '';
    const responsibilitiesList = Array.isArray(agent.responsibilities)
      ? agent.responsibilities.map((r) => `- ${r}`).join('\n')
      : agent.responsibilities || '';
    const toolsList = Array.isArray(agent['preferred-tools'])
      ? agent['preferred-tools'].map((t) => `- ${t}`).join('\n')
      : Array.isArray(agent.tools)
        ? agent.tools.map((t) => `- ${t}`).join('\n')
        : '';
    const domainRules = buildAgentDomainRulesMarkdown(agent, rulesSpec);
    const conventionsList = Array.isArray(agent.conventions)
      ? agent.conventions.map((c) => `- ${c}`).join('\n')
      : '';
    const antiPatternsList = Array.isArray(agent['anti-patterns'])
      ? agent['anti-patterns'].map((a) => `- ${a}`).join('\n')
      : '';
    const examplesList = Array.isArray(agent.examples)
      ? agent.examples
          .map((ex) => {
            const title = ex?.title || 'Example';
            const code = ex?.code || '';
            // Find the longest run of backticks in the code
            const maxBackticks = (code.match(/`+/g) || []).reduce(
              (max, match) => Math.max(max, match.length),
              0
            );
            const fence = '`'.repeat(Math.max(maxBackticks + 1, 4));
            return `### ${title}\n\n${fence}\n${code}\n${fence}`;
          })
          .join('\n\n')
      : '';

    const agentVars = {
      ...vars,
      agentId: agent.id,
      agentCategory: agent.category,
      agentName: agent.name,
      agentRole: agent.role || '',
      agentFocusList: focusList,
      agentResponsibilitiesList: responsibilitiesList,
      agentToolsList: toolsList,
      hasAgentDomainRules: !!domainRules,
      agentDomainRules: domainRules,
      hasAgentExamples: !!examplesList,
      agentExamples: examplesList,
      hasAgentAntiPatterns: !!antiPatternsList,
      agentAntiPatterns: antiPatternsList,
      hasAgentConventions: !!conventionsList,
      agentConventions: conventionsList,
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
    syncDirectCopy(
      templatesDir,
      'copilot/instructions',
      tmpDir,
      '.github/instructions',
      vars,
      version,
      repoName
    );
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
    syncDirectCopy(
      templatesDir,
      'github/ISSUE_TEMPLATE',
      tmpDir,
      '.github/ISSUE_TEMPLATE',
      vars,
      version,
      repoName
    );
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

function syncAgentsMd(templatesDir, tmpDir, vars, version, repoName) {
  const agentsMdPath = resolve(templatesDir, 'root', 'AGENTS.md');
  if (!existsSync(agentsMdPath)) return;

  let content = readFileSync(agentsMdPath, 'utf-8');
  content = renderTemplate(content, { ...vars, repoName });
  // Clean up blank lines left by unresolved conditionals
  content = content.replace(/(\r?\n){3,}/g, '\n\n');
  content = insertHeader(content, '.md', version, repoName);
  writeOutput(resolve(tmpDir, 'AGENTS.md'), content);
}

function syncClaudeMd(templatesDir, tmpDir, vars, version, repoName) {
  const claudeMdPath = resolve(templatesDir, 'claude', 'CLAUDE.md');
  if (!existsSync(claudeMdPath)) return;

  let content = readFileSync(claudeMdPath, 'utf-8');
  content = renderTemplate(content, { ...vars, repoName });
  // Clean up blank lines left by unresolved conditionals
  content = content.replace(/(\r?\n){3,}/g, '\n\n');
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
    const scope = Array.isArray(team.scope) ? team.scope.join(', ') : team.scope || '**/*';
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

function syncCopilotPrompts(templatesDir, tmpDir, vars, version, repoName, commandsSpec) {
  const templatePath = resolve(templatesDir, 'copilot', 'prompts', 'TEMPLATE.prompt.md');
  if (!existsSync(templatePath) || !commandsSpec.commands) return;

  const template = readFileSync(templatePath, 'utf-8');

  for (const cmd of commandsSpec.commands) {
    // Skip team commands — they map to chat modes instead
    if (cmd.type === 'team') continue;

    const desc =
      typeof cmd.description === 'string' ? cmd.description.trim() : cmd.description || '';
    const cmdVars = {
      ...vars,
      commandName: cmd.name,
      commandDescription: desc,
    };

    let content = renderTemplate(template, cmdVars);
    content = insertHeader(content, '.md', version, repoName);
    writeOutput(resolve(tmpDir, '.github', 'prompts', `${cmd.name}.prompt.md`), content);
  }
}

function syncCopilotAgents(templatesDir, tmpDir, vars, version, repoName, agentsSpec, rulesSpec) {
  const templatePath = resolve(templatesDir, 'copilot', 'agents', 'TEMPLATE.agent.md');
  if (!existsSync(templatePath) || !agentsSpec.agents) return;

  const template = readFileSync(templatePath, 'utf-8');

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
      ? agent.focus.map((f) => `- \`${f}\``).join('\n')
      : agent.focus || '';
    const responsibilitiesList = Array.isArray(agent.responsibilities)
      ? agent.responsibilities.map((r) => `- ${r}`).join('\n')
      : agent.responsibilities || '';
    const toolsList = Array.isArray(agent['preferred-tools'])
      ? agent['preferred-tools'].map((t) => `- ${t}`).join('\n')
      : Array.isArray(agent.tools)
        ? agent.tools.map((t) => `- ${t}`).join('\n')
        : '';
    const domainRules = buildAgentDomainRulesMarkdown(agent, rulesSpec);
    const conventionsList = Array.isArray(agent.conventions)
      ? agent.conventions.map((c) => `- ${c}`).join('\n')
      : '';

    const agentVars = {
      ...vars,
      agentId: agent.id,
      agentCategory: agent.category,
      agentName: agent.name,
      agentRole: typeof agent.role === 'string' ? agent.role.trim() : agent.role || '',
      agentFocusList: focusList,
      agentResponsibilitiesList: responsibilitiesList,
      agentToolsList: toolsList,
      hasAgentDomainRules: !!domainRules,
      agentDomainRules: domainRules,
      hasAgentConventions: !!conventionsList,
      agentConventions: conventionsList,
    };

    let content = renderTemplate(template, agentVars);
    content = insertHeader(content, '.md', version, repoName);
    writeOutput(resolve(tmpDir, '.github', 'agents', `${agent.id}.agent.md`), content);
  }
}

function syncCopilotChatModes(templatesDir, tmpDir, vars, version, repoName, teamsSpec) {
  const templatePath = resolve(templatesDir, 'copilot', 'chatmodes', 'TEMPLATE.chatmode.md');
  if (!existsSync(templatePath) || !teamsSpec.teams) return;

  const template = readFileSync(templatePath, 'utf-8');

  for (const team of teamsSpec.teams) {
    const scope = Array.isArray(team.scope) ? team.scope.join(', ') : team.scope || '**/*';
    const teamVars = {
      ...vars,
      teamId: team.id,
      teamName: team.name,
      teamFocus: team.focus,
      teamScope: scope,
      teamAccepts: Array.isArray(team.accepts) ? team.accepts.join(', ') : '',
      teamHandoffChain: Array.isArray(team['handoff-chain'])
        ? team['handoff-chain'].join(', ')
        : '',
    };

    let content = renderTemplate(template, teamVars);
    content = insertHeader(content, '.md', version, repoName);
    writeOutput(resolve(tmpDir, '.github', 'chatmodes', `team-${team.id}.chatmode.md`), content);
  }
}

function syncGemini(templatesDir, tmpDir, vars, version, repoName) {
  // GEMINI.md
  const geminiMdPath = resolve(templatesDir, 'gemini', 'GEMINI.md');
  if (existsSync(geminiMdPath)) {
    let content = readFileSync(geminiMdPath, 'utf-8');
    content = renderTemplate(content, { ...vars, repoName });
    content = content.replace(/(\r?\n){3,}/g, '\n\n');
    content = insertHeader(content, '.md', version, repoName);
    writeOutput(resolve(tmpDir, 'GEMINI.md'), content);
  }

  // .gemini/styleguide.md
  const stylePath = resolve(templatesDir, 'gemini', 'styleguide.md');
  if (existsSync(stylePath)) {
    let content = readFileSync(stylePath, 'utf-8');
    content = renderTemplate(content, { ...vars, repoName });
    content = content.replace(/(\r?\n){3,}/g, '\n\n');
    content = insertHeader(content, '.md', version, repoName);
    writeOutput(resolve(tmpDir, '.gemini', 'styleguide.md'), content);
  }

  // .gemini/config.yaml
  const configPath = resolve(templatesDir, 'gemini', 'config.yaml');
  if (existsSync(configPath)) {
    let content = readFileSync(configPath, 'utf-8');
    content = renderTemplate(content, { ...vars, repoName });
    content = insertHeader(content, '.yaml', version, repoName);
    writeOutput(resolve(tmpDir, '.gemini', 'config.yaml'), content);
  }
}

function syncWarp(templatesDir, tmpDir, vars, version, repoName) {
  const warpMdPath = resolve(templatesDir, 'warp', 'WARP.md');
  if (!existsSync(warpMdPath)) return;

  let content = readFileSync(warpMdPath, 'utf-8');
  content = renderTemplate(content, { ...vars, repoName });
  content = content.replace(/(\r?\n){3,}/g, '\n\n');
  content = insertHeader(content, '.md', version, repoName);
  writeOutput(resolve(tmpDir, 'WARP.md'), content);
}

function syncCursorCommands(templatesDir, tmpDir, vars, version, repoName, commandsSpec) {
  const templatePath = resolve(templatesDir, 'cursor', 'commands', 'TEMPLATE.md');
  if (!existsSync(templatePath) || !commandsSpec.commands) return;

  const template = readFileSync(templatePath, 'utf-8');

  for (const cmd of commandsSpec.commands) {
    if (cmd.type === 'team') continue;

    const desc =
      typeof cmd.description === 'string' ? cmd.description.trim() : cmd.description || '';
    const cmdVars = {
      ...vars,
      commandName: cmd.name,
      commandDescription: desc,
    };

    let content = renderTemplate(template, cmdVars);
    content = insertHeader(content, '.md', version, repoName);
    writeOutput(resolve(tmpDir, '.cursor', 'commands', `${cmd.name}.md`), content);
  }
}

function syncSkills(templatesDir, tmpDir, vars, version, repoName, commandsSpec, outputPrefix) {
  // Shared logic for Codex (.agents/skills/) and Claude (.claude/skills/)
  // outputPrefix is either '.agents' or '.claude'
  const templateDir =
    outputPrefix === '.agents'
      ? resolve(templatesDir, 'codex', 'skills', 'TEMPLATE', 'SKILL.md')
      : resolve(templatesDir, 'claude', 'skills', 'TEMPLATE', 'SKILL.md');
  if (!existsSync(templateDir) || !commandsSpec.commands) return;

  const template = readFileSync(templateDir, 'utf-8');

  for (const cmd of commandsSpec.commands) {
    if (cmd.type === 'team') continue;

    const desc =
      typeof cmd.description === 'string' ? cmd.description.trim() : cmd.description || '';
    const cmdVars = {
      ...vars,
      commandName: cmd.name,
      commandDescription: desc,
    };

    let content = renderTemplate(template, cmdVars);
    content = insertHeader(content, '.md', version, repoName);
    writeOutput(resolve(tmpDir, outputPrefix, 'skills', cmd.name, 'SKILL.md'), content);
  }
}

function syncCodexSkills(templatesDir, tmpDir, vars, version, repoName, commandsSpec) {
  syncSkills(templatesDir, tmpDir, vars, version, repoName, commandsSpec, '.agents');
}

function syncClaudeSkills(templatesDir, tmpDir, vars, version, repoName, commandsSpec) {
  syncSkills(templatesDir, tmpDir, vars, version, repoName, commandsSpec, '.claude');
}

function syncClineRules(templatesDir, tmpDir, vars, version, repoName, rulesSpec) {
  const templatePath = resolve(templatesDir, 'cline', 'clinerules', 'TEMPLATE.md');
  if (!existsSync(templatePath) || !rulesSpec.rules) return;

  const template = readFileSync(templatePath, 'utf-8');

  for (const ruleSet of rulesSpec.rules) {
    const appliesTo = Array.isArray(ruleSet['applies-to'])
      ? ruleSet['applies-to'].map((p) => `- \`${p}\``).join('\n')
      : '';
    const conventions = Array.isArray(ruleSet.conventions)
      ? ruleSet.conventions
          .map((c) => {
            const severity = c.severity ? ` [${c.severity}]` : '';
            return `- **${c.id}**${severity}: ${typeof c.rule === 'string' ? c.rule.trim() : c.rule}`;
          })
          .join('\n')
      : '';

    const ruleVars = {
      ...vars,
      ruleDomain: ruleSet.domain,
      ruleDescription:
        typeof ruleSet.description === 'string'
          ? ruleSet.description.trim()
          : ruleSet.description || '',
      ruleAppliesTo: appliesTo,
      ruleConventions: conventions,
    };

    let content = renderTemplate(template, ruleVars);
    content = insertHeader(content, '.md', version, repoName);
    writeOutput(resolve(tmpDir, '.clinerules', `${ruleSet.domain}.md`), content);
  }
}

function syncA2aConfig(tmpDir, vars, version, repoName, agentsSpec, teamsSpec) {
  const agents = [
    { id: 'orchestrator', role: 'coordinator', capabilities: ['delegate', 'aggregate', 'monitor'] },
  ];

  // Build agent entries from agents.yaml
  if (agentsSpec?.agents) {
    for (const [category, agentList] of Object.entries(agentsSpec.agents)) {
      if (!Array.isArray(agentList)) continue;
      for (const agent of agentList) {
        agents.push({
          id: agent.id,
          role: 'executor',
          category,
          domain: Array.isArray(agent.focus)
            ? agent.focus.join(', ')
            : agent.focus
              ? String(agent.focus)
              : '',
          capabilities: agent.accepts || ['implement', 'review'],
          dependsOn: agent['depends-on'] || [],
          notifies: agent.notifies || [],
        });
      }
    }
  }

  // Build handoff chains from teams.yaml
  const handoffChains = {};
  if (teamsSpec?.teams) {
    for (const team of teamsSpec.teams) {
      const chain = team['handoff-chain'];
      if (Array.isArray(chain) && chain.length > 0) {
        handoffChains[team.id] = chain;
      }
    }
  }

  const config = {
    a2a: {
      enabled: true,
      protocol_version: '1.0.0',
      task_format: 'json',
      task_location: '.claude/state/tasks/',
      context_transfer: 'file',
      result_aggregation: 'orchestrator',
      agents,
      handoffChains,
      messageTypes: ['delegate', 'report', 'query', 'broadcast'],
      taskStates: [
        'submitted',
        'accepted',
        'working',
        'input-required',
        'completed',
        'failed',
        'rejected',
        'canceled',
      ],
      taskTypes: VALID_TASK_TYPES,
    },
  };

  const destPath = resolve(tmpDir, 'mcp', 'a2a-config.json');
  writeOutput(destPath, JSON.stringify(config, null, 2) + '\n');
}

function syncRooRules(templatesDir, tmpDir, vars, version, repoName, rulesSpec) {
  const templatePath = resolve(templatesDir, 'roo', 'rules', 'TEMPLATE.md');
  if (!existsSync(templatePath) || !rulesSpec.rules) return;

  const template = readFileSync(templatePath, 'utf-8');

  for (const ruleSet of rulesSpec.rules) {
    const appliesTo = Array.isArray(ruleSet['applies-to'])
      ? ruleSet['applies-to'].map((p) => `- \`${p}\``).join('\n')
      : '';
    const conventions = Array.isArray(ruleSet.conventions)
      ? ruleSet.conventions
          .map((c) => {
            const severity = c.severity ? ` [${c.severity}]` : '';
            return `- **${c.id}**${severity}: ${typeof c.rule === 'string' ? c.rule.trim() : c.rule}`;
          })
          .join('\n')
      : '';

    const ruleVars = {
      ...vars,
      ruleDomain: ruleSet.domain,
      ruleDescription:
        typeof ruleSet.description === 'string'
          ? ruleSet.description.trim()
          : ruleSet.description || '',
      ruleAppliesTo: appliesTo,
      ruleConventions: conventions,
    };

    let content = renderTemplate(template, ruleVars);
    content = insertHeader(content, '.md', version, repoName);
    writeOutput(resolve(tmpDir, '.roo', 'rules', `${ruleSet.domain}.md`), content);
  }
}

function syncWindsurfCommands(templatesDir, tmpDir, vars, version, repoName, commandsSpec) {
  const templatePath = resolve(templatesDir, 'windsurf', 'templates', 'command.md');
  if (!existsSync(templatePath) || !commandsSpec.commands) return;

  const template = readFileSync(templatePath, 'utf-8');

  for (const cmd of commandsSpec.commands) {
    if (cmd.type === 'team') continue;
    const desc =
      typeof cmd.description === 'string' ? cmd.description.trim() : cmd.description || '';
    const cmdVars = {
      ...vars,
      repoName,
      commandName: cmd.name,
      commandDescription: desc,
    };

    let content = renderTemplate(template, cmdVars);
    content = insertHeader(content, '.md', version, repoName);
    writeOutput(resolve(tmpDir, '.windsurf', 'rules', `command-${cmd.name}.md`), content);
  }
}

function syncWindsurfTeams(tmpDir, vars, version, repoName, teamsSpec) {
  if (!teamsSpec.teams) return;

  for (const team of teamsSpec.teams) {
    const scope = Array.isArray(team.scope) ? team.scope.join(', ') : team.scope || '**/*';
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
  ALL_RENDER_TARGETS,
  evalTruthy,
  flattenCrosscutting,
  flattenProjectYaml,
  getCommentStyle,
  getGeneratedHeader,
  insertHeader,
  isScaffoldOnce,
  mergePermissions,
  renderTemplate,
  resolveConditionals,
  resolveEachBlocks,
  resolveRenderTargets,
  sanitizeTemplateValue,
};
