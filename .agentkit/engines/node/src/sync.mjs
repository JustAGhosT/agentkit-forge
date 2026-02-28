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
import {
  chmod,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  unlink,
  writeFile,
} from 'fs/promises';
import yaml from 'js-yaml';
import { basename, dirname, extname, join, relative, resolve, sep } from 'path';
import { VALID_TASK_TYPES } from './task-types.mjs';
import { PROJECT_MAPPING, get, transform, check } from './sync.refactor.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function readYaml(filePath) {
  if (!existsSync(filePath)) return null;
  return yaml.load(readFileSync(filePath, 'utf-8'));
}

export function readText(filePath) {
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, 'utf-8');
}

export async function runConcurrent(items, fn, concurrency = 50) {
  const chunks = [];
  for (let i = 0; i < items.length; i += concurrency) {
    chunks.push(items.slice(i, i + concurrency));
  }
  for (const chunk of chunks) {
    await Promise.all(chunk.map(fn));
  }
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
export function renderTemplate(template, vars, targetPath = '') {
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
export function resolveConditionals(template, vars) {
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
export function resolveEachBlocks(template, vars) {
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
export function evalTruthy(value) {
  if (value === undefined || value === null || value === false || value === '' || value === 0)
    return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * Flattens a project.yaml object into a flat key→value map suitable for template rendering.
 * Uses a declarative mapping configuration for cleaner code.
 */
export function flattenProjectYaml(project, docsSpec = null) {
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
export function flattenCrosscutting(cc, vars) {
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
export function sanitizeTemplateValue(value) {
  let s = value;
  s = s.replace(/\$\([^)]*\)/g, (m) => m.slice(2, -1));
  s = s.replace(/[`$\\;|&<>!{}]/g, '');
  return s;
}

export function formatCommandFlags(flags) {
  if (!Array.isArray(flags) || flags.length === 0) return '';
  const rows = flags.map(
    (f) =>
      `| \`${f.name || ''}\` | ${(f.description || '').replace(/\|/g, '\\|')} | ${f.default !== undefined && f.default !== null ? String(f.default) : '—'} |`
  );
  return ['| Flag | Description | Default |', '|------|-------------|---------|', ...rows].join(
    '\n'
  );
}

export function getGeneratedHeader(version, repoName, ext) {
  const comment = getCommentStyle(ext);
  if (!comment) return '';
  return [
    `${comment.start} GENERATED by AgentKit Forge v${version} — DO NOT EDIT ${comment.end}`,
    `${comment.start} Source: .agentkit/spec + .agentkit/overlays/${repoName} ${comment.end}`,
    `${comment.start} Regenerate: pnpm -C .agentkit agentkit:sync ${comment.end}`,
    '',
  ].join('\n');
}

export function getCommentStyle(ext) {
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

export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
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
export function isScaffoldOnce(relPath) {
  // Normalize Windows backslashes to forward slashes for consistent matching
  const normalized = relPath.replace(/\\/g, '/');
  if (SCAFFOLD_ONCE_ROOT_FILES.has(normalized)) return true;
  if (SCAFFOLD_ONCE_GITHUB_FILES.has(normalized)) return true;
  for (const dir of SCAFFOLD_ONCE_DIRS) {
    if (normalized.startsWith(dir)) return true;
  }
  return false;
}

export async function writeOutput(filePath, content) {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, content, 'utf-8');
}

export async function* walkDir(dir) {
  if (!existsSync(dir)) return;
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
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

export function simpleDiff(a, b) {
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

// ---------------------------------------------------------------------------
// New utility functions
// ---------------------------------------------------------------------------

/**
 * Merges two permissions objects. Each has `allow` and `deny` arrays.
 * Union both lists with deduplication.
 */
export function mergePermissions(base, overlay) {
  const allow = [...new Set([...(base.allow || []), ...(overlay.allow || [])])];
  const deny = [...new Set([...(base.deny || []), ...(overlay.deny || [])])];
  return { allow, deny };
}

/**
 * Inserts a generated header into file content.
 * - Skip if already has header
 * - Insert after shebang for .sh/.ps1 files
 * - Insert after frontmatter (---...---) for .md/.mdc files
 * - Return unchanged for .json/.template files
 */
export function insertHeader(content, ext, version, repoName) {
  const header = getGeneratedHeader(version, repoName, ext);
  if (!header) return content; // JSON / template — no comment syntax
  if (content.includes('GENERATED by AgentKit Forge')) return content; // already present

  const normalizedExt = ext.toLowerCase();

  if (normalizedExt === '.sh' || normalizedExt === '.ps1') {
    // Insert after shebang line
    if (content.startsWith('#!')) {
      const newlineIdx = content.indexOf('\n');
      if (newlineIdx !== -1) {
        return content.slice(0, newlineIdx + 1) + header + content.slice(newlineIdx + 1);
      }
    }
    return header + content;
  }

  if (normalizedExt === '.md' || normalizedExt === '.mdc') {
    // Insert after frontmatter if present
    if (content.startsWith('---')) {
      const closingMarker = '\n---';
      const endFrontmatter = content.indexOf(closingMarker, 3);
      if (endFrontmatter !== -1) {
        const afterClose = endFrontmatter + closingMarker.length;
        // Skip a trailing newline after ---
        const insertPos =
          content[afterClose] === '\n' ? afterClose + 1 : afterClose;
        return content.slice(0, insertPos) + header + content.slice(insertPos);
      }
    }
    return header + content;
  }

  return header + content;
}

/**
 * All available render targets.
 */
export const ALL_RENDER_TARGETS = [
  'claude', 'cursor', 'windsurf', 'ai', 'copilot', 'gemini', 'codex',
  'warp', 'cline', 'roo', 'mcp',
];

/**
 * Resolves which render targets to generate.
 * - If flags?.only is set, split by comma, trim, filter empty.
 * - If overlayTargets is a non-empty array, return Set(overlayTargets).
 * - Otherwise return Set(ALL_RENDER_TARGETS).
 */
export function resolveRenderTargets(overlayTargets, flags) {
  if (flags?.only) {
    return new Set(
      flags.only
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    );
  }
  if (Array.isArray(overlayTargets) && overlayTargets.length > 0) {
    return new Set(overlayTargets);
  }
  return new Set(ALL_RENDER_TARGETS);
}

/**
 * Categorizes a file by its path prefix.
 */
export function categorizeFile(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  if (norm.startsWith('.claude/')) return 'claude';
  if (norm.startsWith('.cursor/')) return 'cursor';
  if (norm.startsWith('.windsurf/')) return 'windsurf';
  if (norm.startsWith('.github/')) return 'github';
  if (norm.startsWith('.gemini/')) return 'gemini';
  if (norm.startsWith('.agents/')) return 'codex';
  if (norm.startsWith('.clinerules/')) return 'cline';
  if (norm.startsWith('.roo/')) return 'roo';
  if (norm.startsWith('.ai/')) return 'ai';
  if (norm.startsWith('.mcp/')) return 'mcp';
  if (norm.startsWith('docs/')) return 'docs';
  if (norm.startsWith('.vscode/')) return 'vscode';
  if (norm === 'GEMINI.md') return 'gemini';
  if (norm === 'WARP.md') return 'warp';
  if (norm === 'CLAUDE.md') return 'claude';
  return 'root';
}

/**
 * Prints a sync summary to console. Skip if opts.quiet.
 */
export function printSyncSummary(fileSummary, targets, opts) {
  if (opts?.quiet) return;
  const total = Object.values(fileSummary).reduce((s, c) => s + c, 0);
  console.log(`[agentkit:sync] Summary: ${total} file(s) across ${[...targets].join(', ')}`);
  for (const [cat, count] of Object.entries(fileSummary).sort()) {
    console.log(`  ${cat}: ${count}`);
  }
}

/**
 * Computes project.yaml completeness.
 * Returns { total, present, percent, missing }.
 */
export function computeProjectCompleteness(projectSpec) {
  if (!projectSpec || typeof projectSpec !== 'object') {
    return { total: 0, present: 0, percent: 0, missing: [] };
  }
  const fields = [
    'name',
    'description',
    'phase',
    'stack.languages',
    'stack.database',
    'architecture.pattern',
    'architecture.apiStyle',
    'deployment.cloudProvider',
    'deployment.environments',
    'testing.coverage',
  ];
  const missing = [];
  let present = 0;
  for (const field of fields) {
    const parts = field.split('.');
    let val = projectSpec;
    for (const p of parts) val = val?.[p];
    const isEmpty =
      val === undefined ||
      val === null ||
      val === '' ||
      (Array.isArray(val) && val.length === 0);
    if (!isEmpty) {
      present++;
    } else {
      missing.push(field);
    }
  }
  const percent = Math.round((present / fields.length) * 100);
  return { total: fields.length, present, percent, missing };
}

// ---------------------------------------------------------------------------
// Sync helper — generic directory copy with template rendering
// ---------------------------------------------------------------------------

/**
 * Copies template files from templatesDir/sourceSubdir to tmpDir/destSubdir.
 * Renders each file as a template and inserts a generated header.
 * If source dir does not exist, returns without error (no-op).
 */
async function syncDirectCopy(
  templatesDir,
  sourceSubdir,
  tmpDir,
  destSubdir,
  vars,
  version,
  repoName
) {
  const sourceDir = join(templatesDir, sourceSubdir);
  if (!existsSync(sourceDir)) return;
  for await (const srcFile of walkDir(sourceDir)) {
    const relPath = relative(sourceDir, srcFile);
    const destFile =
      destSubdir === '.'
        ? join(tmpDir, relPath)
        : join(tmpDir, destSubdir, relPath);
    const ext = extname(srcFile).toLowerCase();
    let content;
    try {
      content = await readFile(srcFile, 'utf-8');
    } catch {
      // Binary or unreadable — copy as-is
      await ensureDir(dirname(destFile));
      try {
        await cp(srcFile, destFile, { force: true });
      } catch {
        /* ignore */
      }
      continue;
    }
    const rendered = renderTemplate(content, vars, srcFile);
    const withHeader = insertHeader(rendered, ext, version, repoName);
    await writeOutput(destFile, withHeader);
  }
}

// ---------------------------------------------------------------------------
// Always-on sync helpers
// ---------------------------------------------------------------------------

/**
 * Copies templates/root to tmpDir root — AGENTS.md and other always-on files.
 */
async function syncAgentsMd(templatesDir, tmpDir, vars, version, repoName) {
  await syncDirectCopy(templatesDir, 'root', tmpDir, '.', vars, version, repoName);
}

/**
 * Root-level docs sync.
 * All templates/root files are already handled by syncAgentsMd.
 * This function exists as a named hook for future per-overlay root-doc customisation.
 */
async function syncRootDocs(_templatesDir, _tmpDir, _vars, _version, _repoName) {
  // Intentionally empty — templates/root is fully handled by syncAgentsMd.
  // Reserved for future overlay-specific root-doc generation.
}

/**
 * Copies templates/github to tmpDir/.github.
 */
async function syncGitHub(templatesDir, tmpDir, vars, version, repoName) {
  await syncDirectCopy(templatesDir, 'github', tmpDir, '.github', vars, version, repoName);
}

/**
 * Copies templates/renovate to tmpDir root.
 */
async function syncEditorConfigs(templatesDir, tmpDir, vars, version, repoName) {
  await syncDirectCopy(templatesDir, 'renovate', tmpDir, '.', vars, version, repoName);
}

// ---------------------------------------------------------------------------
// Claude sync helpers
// ---------------------------------------------------------------------------

/**
 * Generates .claude/settings.json from templates/claude/settings.json
 * merged with the resolved permissions.
 */
async function syncClaudeSettings(
  templatesDir,
  tmpDir,
  vars,
  version,
  mergedPermissions,
  _settingsSpec
) {
  const tplPath = join(templatesDir, 'claude', 'settings.json');
  if (!existsSync(tplPath)) return;
  let settings;
  try {
    settings = JSON.parse(await readFile(tplPath, 'utf-8'));
  } catch {
    return;
  }
  // Override permissions with merged set
  settings.permissions = mergedPermissions;
  const destFile = join(tmpDir, '.claude', 'settings.json');
  await writeOutput(destFile, JSON.stringify(settings, null, 2) + '\n');
}

/**
 * Copies individual command templates and generates team commands.
 * Skips team-TEMPLATE.md; uses it as the generator for team commands.
 */
async function syncClaudeCommands(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  teamsSpec,
  commandsSpec
) {
  const commandsDir = join(templatesDir, 'claude', 'commands');
  if (!existsSync(commandsDir)) return;

  // Copy non-template command files
  for await (const srcFile of walkDir(commandsDir)) {
    const fname = basename(srcFile);
    if (fname === 'team-TEMPLATE.md') continue; // skip template
    const ext = extname(srcFile).toLowerCase();
    const content = await readFile(srcFile, 'utf-8');
    const rendered = renderTemplate(content, vars, srcFile);
    const withHeader = insertHeader(rendered, ext, version, repoName);
    await writeOutput(join(tmpDir, '.claude', 'commands', fname), withHeader);
  }

  // Generate team commands from team-TEMPLATE.md
  const teamTemplatePath = join(commandsDir, 'team-TEMPLATE.md');
  if (!existsSync(teamTemplatePath)) return;
  const teamTemplate = await readFile(teamTemplatePath, 'utf-8');
  for (const team of teamsSpec.teams || []) {
    const teamVars = {
      ...vars,
      teamName: team.name || team.id,
      teamId: team.id,
      teamFocus: team.focus || '',
      teamScope: Array.isArray(team.scope) ? team.scope.join(', ') : (team.scope || ''),
    };
    const rendered = renderTemplate(teamTemplate, teamVars, teamTemplatePath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, '.claude', 'commands', `team-${team.id}.md`), withHeader);
  }
}

/**
 * Generates .claude/agents/<id>.md for each agent in agentsSpec.
 */
async function syncClaudeAgents(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  agentsSpec,
  _rulesSpec
) {
  const tplPath = join(templatesDir, 'claude', 'agents', 'TEMPLATE.md');
  if (!existsSync(tplPath)) return;
  const template = await readFile(tplPath, 'utf-8');

  for (const [category, agents] of Object.entries(agentsSpec.agents || {})) {
    for (const agent of agents) {
      const agentVars = buildAgentVars(agent, category, vars);
      const rendered = renderTemplate(template, agentVars, tplPath);
      const withHeader = insertHeader(rendered, '.md', version, repoName);
      await writeOutput(join(tmpDir, '.claude', 'agents', `${agent.id}.md`), withHeader);
    }
  }
}

/**
 * Copies templates/claude/CLAUDE.md to tmpDir/CLAUDE.md.
 */
async function syncClaudeMd(templatesDir, tmpDir, vars, version, repoName) {
  const tplPath = join(templatesDir, 'claude', 'CLAUDE.md');
  if (!existsSync(tplPath)) return;
  const content = await readFile(tplPath, 'utf-8');
  const rendered = renderTemplate(content, vars, tplPath);
  const withHeader = insertHeader(rendered, '.md', version, repoName);
  await writeOutput(join(tmpDir, 'CLAUDE.md'), withHeader);
}

/**
 * Generates .claude/skills/<name>/SKILL.md for each non-team command.
 */
async function syncClaudeSkills(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  commandsSpec
) {
  const tplPath = join(templatesDir, 'claude', 'skills', 'TEMPLATE', 'SKILL.md');
  if (!existsSync(tplPath)) return;
  const template = await readFile(tplPath, 'utf-8');

  for (const cmd of commandsSpec.commands || []) {
    if (cmd.type === 'team') continue;
    const cmdVars = buildCommandVars(cmd, vars);
    const rendered = renderTemplate(template, cmdVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, '.claude', 'skills', cmd.name, 'SKILL.md'), withHeader);
  }
}

// ---------------------------------------------------------------------------
// Cursor sync helpers
// ---------------------------------------------------------------------------

/**
 * Generates .cursor/rules/team-<id>.mdc for each team.
 */
async function syncCursorTeams(tmpDir, vars, version, repoName, teamsSpec) {
  // Use a simple inline template for cursor team rules
  const teamTemplate = `---
description: "Team {{teamName}} — {{teamFocus}}"
globs: []
alwaysApply: false
---
# Team: {{teamName}}

**Focus**: {{teamFocus}}
**Scope**: {{teamScope}}

## Persona

You are a member of the {{teamName}} team. Your expertise is {{teamFocus}}.
Scope all operations to the team's owned paths.

## Scope

{{teamScope}}
`;
  for (const team of teamsSpec.teams || []) {
    const teamVars = {
      ...vars,
      teamName: team.name || team.id,
      teamId: team.id,
      teamFocus: team.focus || '',
      teamScope: Array.isArray(team.scope) ? team.scope.join(', ') : (team.scope || ''),
    };
    const rendered = renderTemplate(teamTemplate, teamVars);
    const withHeader = insertHeader(rendered, '.mdc', version, repoName);
    await writeOutput(join(tmpDir, '.cursor', 'rules', `team-${team.id}.mdc`), withHeader);
  }
}

/**
 * Generates .cursor/commands/<name>.md for each non-team command.
 */
async function syncCursorCommands(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  commandsSpec
) {
  const tplPath = join(templatesDir, 'cursor', 'commands', 'TEMPLATE.md');
  if (!existsSync(tplPath)) return;
  const template = await readFile(tplPath, 'utf-8');

  for (const cmd of commandsSpec.commands || []) {
    if (cmd.type === 'team') continue;
    const cmdVars = buildCommandVars(cmd, vars);
    const rendered = renderTemplate(template, cmdVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, '.cursor', 'commands', `${cmd.name}.md`), withHeader);
  }
}

// ---------------------------------------------------------------------------
// Windsurf sync helpers
// ---------------------------------------------------------------------------

/**
 * Generates .windsurf/rules/team-<id>.md for each team.
 */
async function syncWindsurfTeams(tmpDir, vars, version, repoName, teamsSpec) {
  const teamTemplate = `# Team: {{teamName}}

**Focus**: {{teamFocus}}
**Scope**: {{teamScope}}

## Persona

You are a member of the {{teamName}} team. Your expertise is {{teamFocus}}.
Scope all operations to the team's owned paths.
`;
  for (const team of teamsSpec.teams || []) {
    const teamVars = {
      ...vars,
      teamName: team.name || team.id,
      teamId: team.id,
      teamFocus: team.focus || '',
      teamScope: Array.isArray(team.scope) ? team.scope.join(', ') : (team.scope || ''),
    };
    const rendered = renderTemplate(teamTemplate, teamVars);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, '.windsurf', 'rules', `team-${team.id}.md`), withHeader);
  }
}

/**
 * Generates .windsurf/commands/<name>.md for each non-team command.
 */
async function syncWindsurfCommands(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  commandsSpec
) {
  const tplPath = join(templatesDir, 'windsurf', 'templates', 'command.md');
  if (!existsSync(tplPath)) return;
  const template = await readFile(tplPath, 'utf-8');

  for (const cmd of commandsSpec.commands || []) {
    if (cmd.type === 'team') continue;
    const cmdVars = buildCommandVars(cmd, vars);
    const rendered = renderTemplate(template, cmdVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, '.windsurf', 'commands', `${cmd.name}.md`), withHeader);
  }
}

// ---------------------------------------------------------------------------
// Copilot sync helpers
// ---------------------------------------------------------------------------

/**
 * Copies copilot-instructions.md and instructions/ directory.
 */
async function syncCopilot(templatesDir, tmpDir, vars, version, repoName) {
  // copilot-instructions.md → .github/copilot-instructions.md
  const instrPath = join(templatesDir, 'copilot', 'copilot-instructions.md');
  if (existsSync(instrPath)) {
    const content = await readFile(instrPath, 'utf-8');
    const rendered = renderTemplate(content, vars, instrPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, '.github', 'copilot-instructions.md'), withHeader);
  }
  // instructions/ → .github/instructions/
  await syncDirectCopy(
    templatesDir,
    'copilot/instructions',
    tmpDir,
    '.github/instructions',
    vars,
    version,
    repoName
  );
}

/**
 * Generates .github/prompts/<name>.prompt.md for each non-team command.
 */
async function syncCopilotPrompts(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  commandsSpec
) {
  const tplPath = join(templatesDir, 'copilot', 'prompts', 'TEMPLATE.prompt.md');
  if (!existsSync(tplPath)) return;
  const template = await readFile(tplPath, 'utf-8');

  for (const cmd of commandsSpec.commands || []) {
    if (cmd.type === 'team') continue;
    const cmdVars = buildCommandVars(cmd, vars);
    const rendered = renderTemplate(template, cmdVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(
      join(tmpDir, '.github', 'prompts', `${cmd.name}.prompt.md`),
      withHeader
    );
  }
}

/**
 * Generates .github/agents/<id>.agent.md from agents in agentsSpec.
 */
async function syncCopilotAgents(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  agentsSpec,
  _rulesSpec
) {
  const tplPath = join(templatesDir, 'copilot', 'agents', 'TEMPLATE.agent.md');
  if (!existsSync(tplPath)) return;
  const template = await readFile(tplPath, 'utf-8');

  for (const [category, agents] of Object.entries(agentsSpec.agents || {})) {
    for (const agent of agents) {
      const agentVars = buildAgentVars(agent, category, vars);
      const rendered = renderTemplate(template, agentVars, tplPath);
      const withHeader = insertHeader(rendered, '.md', version, repoName);
      await writeOutput(join(tmpDir, '.github', 'agents', `${agent.id}.agent.md`), withHeader);
    }
  }
}

/**
 * Generates .github/chatmodes/team-<id>.chatmode.md for each team.
 */
async function syncCopilotChatModes(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  teamsSpec
) {
  const tplPath = join(templatesDir, 'copilot', 'chatmodes', 'TEMPLATE.chatmode.md');
  if (!existsSync(tplPath)) return;
  const template = await readFile(tplPath, 'utf-8');

  for (const team of teamsSpec.teams || []) {
    const teamVars = {
      ...vars,
      teamName: team.name || team.id,
      teamId: team.id,
      teamFocus: team.focus || '',
      teamScope: Array.isArray(team.scope) ? team.scope.join(', ') : (team.scope || ''),
    };
    const rendered = renderTemplate(template, teamVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(
      join(tmpDir, '.github', 'chatmodes', `team-${team.id}.chatmode.md`),
      withHeader
    );
  }
}

// ---------------------------------------------------------------------------
// Gemini sync helper
// ---------------------------------------------------------------------------

/**
 * Copies templates/gemini/GEMINI.md → tmpDir/GEMINI.md
 * and templates/gemini/* → tmpDir/.gemini/
 */
async function syncGemini(templatesDir, tmpDir, vars, version, repoName) {
  const geminiDir = join(templatesDir, 'gemini');
  if (!existsSync(geminiDir)) return;

  for await (const srcFile of walkDir(geminiDir)) {
    const fname = basename(srcFile);
    const ext = extname(srcFile).toLowerCase();
    const content = await readFile(srcFile, 'utf-8');
    const rendered = renderTemplate(content, vars, srcFile);
    const withHeader = insertHeader(rendered, ext, version, repoName);

    if (fname === 'GEMINI.md') {
      // Root-level GEMINI.md
      await writeOutput(join(tmpDir, 'GEMINI.md'), withHeader);
    } else {
      // All other files go into .gemini/
      const relPath = relative(geminiDir, srcFile);
      await writeOutput(join(tmpDir, '.gemini', relPath), withHeader);
    }
  }
}

// ---------------------------------------------------------------------------
// Codex sync helper
// ---------------------------------------------------------------------------

/**
 * Generates .agents/skills/<name>/SKILL.md for each non-team command.
 */
async function syncCodexSkills(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  commandsSpec
) {
  const tplPath = join(templatesDir, 'codex', 'skills', 'TEMPLATE', 'SKILL.md');
  if (!existsSync(tplPath)) return;
  const template = await readFile(tplPath, 'utf-8');

  for (const cmd of commandsSpec.commands || []) {
    if (cmd.type === 'team') continue;
    const cmdVars = buildCommandVars(cmd, vars);
    const rendered = renderTemplate(template, cmdVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, '.agents', 'skills', cmd.name, 'SKILL.md'), withHeader);
  }
}

// ---------------------------------------------------------------------------
// Warp sync helper
// ---------------------------------------------------------------------------

/**
 * Copies templates/warp/WARP.md → tmpDir/WARP.md.
 */
async function syncWarp(templatesDir, tmpDir, vars, version, repoName) {
  const tplPath = join(templatesDir, 'warp', 'WARP.md');
  if (!existsSync(tplPath)) return;
  const content = await readFile(tplPath, 'utf-8');
  const rendered = renderTemplate(content, vars, tplPath);
  const withHeader = insertHeader(rendered, '.md', version, repoName);
  await writeOutput(join(tmpDir, 'WARP.md'), withHeader);
}

// ---------------------------------------------------------------------------
// Cline sync helper
// ---------------------------------------------------------------------------

/**
 * Generates .clinerules/<domain>.md for each rule domain.
 */
async function syncClineRules(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  rulesSpec
) {
  const tplPath = join(templatesDir, 'cline', 'clinerules', 'TEMPLATE.md');
  if (!existsSync(tplPath)) return;
  const template = await readFile(tplPath, 'utf-8');

  for (const rule of rulesSpec.rules || []) {
    const ruleVars = buildRuleVars(rule, vars);
    const rendered = renderTemplate(template, ruleVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, '.clinerules', `${rule.domain}.md`), withHeader);
  }
}

// ---------------------------------------------------------------------------
// Roo sync helper
// ---------------------------------------------------------------------------

/**
 * Generates .roo/rules/<domain>.md for each rule domain.
 */
async function syncRooRules(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  rulesSpec
) {
  const tplPath = join(templatesDir, 'roo', 'rules', 'TEMPLATE.md');
  if (!existsSync(tplPath)) return;
  const template = await readFile(tplPath, 'utf-8');

  for (const rule of rulesSpec.rules || []) {
    const ruleVars = buildRuleVars(rule, vars);
    const rendered = renderTemplate(template, ruleVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, '.roo', 'rules', `${rule.domain}.md`), withHeader);
  }
}

// ---------------------------------------------------------------------------
// MCP / A2A sync helper
// ---------------------------------------------------------------------------

/**
 * Copies templates/mcp/ → tmpDir/.mcp/
 */
/**
 * Copies templates/mcp/ → tmpDir/.mcp/
 * agentsSpec and teamsSpec are accepted for API symmetry and future use.
 */
async function syncA2aConfig(tmpDir, vars, version, repoName, _agentsSpec, _teamsSpec, templatesDir) {
  await _syncA2aConfig(templatesDir, tmpDir, vars, version, repoName);
}

async function _syncA2aConfig(templatesDir, tmpDir, vars, version, repoName) {
  const mcpDir = join(templatesDir, 'mcp');
  if (!existsSync(mcpDir)) return;
  for await (const srcFile of walkDir(mcpDir)) {
    const relPath = relative(mcpDir, srcFile);
    const ext = extname(srcFile).toLowerCase();
    let content;
    try {
      content = await readFile(srcFile, 'utf-8');
    } catch {
      const destFile = join(tmpDir, '.mcp', relPath);
      await ensureDir(dirname(destFile));
      await cp(srcFile, destFile, { force: true });
      continue;
    }
    const rendered = renderTemplate(content, vars, srcFile);
    const withHeader = insertHeader(rendered, ext, version, repoName);
    await writeOutput(join(tmpDir, '.mcp', relPath), withHeader);
  }
}

// ---------------------------------------------------------------------------
// Variable builder helpers
// ---------------------------------------------------------------------------

function buildCommandVars(cmd, vars) {
  return {
    ...vars,
    commandName: cmd.name,
    commandDescription:
      typeof cmd.description === 'string' ? cmd.description.trim() : (cmd.description || ''),
    commandFlags: formatCommandFlags(cmd.flags),
  };
}

function buildAgentVars(agent, category, vars) {
  const focus = agent.focus || [];
  const responsibilities = agent.responsibilities || [];
  const tools = agent['preferred-tools'] || agent.tools || [];
  const conventions = agent.conventions || [];
  const examples = agent.examples || [];
  const antiPatterns = agent['anti-patterns'] || [];

  return {
    ...vars,
    agentName: agent.name,
    agentId: agent.id,
    agentCategory: category,
    agentRole: typeof agent.role === 'string' ? agent.role.trim() : (agent.role || ''),
    agentFocusList: focus.map((f) => `- ${f}`).join('\n'),
    agentResponsibilitiesList: responsibilities.map((r) => `- ${r}`).join('\n'),
    agentToolsList: tools.map((t) => `- ${t}`).join('\n'),
    agentConventions: conventions.length > 0 ? conventions.map((c) => `- ${c}`).join('\n') : '',
    agentExamples:
      examples.length > 0
        ? examples
            .map(
              (e) =>
                `### ${e.title || 'Example'}\n\`\`\`\n${(e.code || '').trim()}\n\`\`\``
            )
            .join('\n\n')
        : '',
    agentAntiPatterns:
      antiPatterns.length > 0 ? antiPatterns.map((a) => `- ${a}`).join('\n') : '',
    agentDomainRules: '',
  };
}

function buildRuleVars(rule, vars) {
  const appliesTo = rule['applies-to'] || [];
  const conventions = rule.conventions || [];
  return {
    ...vars,
    ruleDomain: rule.domain,
    ruleDescription:
      typeof rule.description === 'string' ? rule.description.trim() : (rule.description || ''),
    ruleAppliesTo: appliesTo.join('\n'),
    ruleConventions: conventions
      .map((c) => (typeof c === 'string' ? `- ${c}` : `- **[${c.id || ''}]** ${c.rule || ''}`))
      .join('\n'),
  };
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
  await rm(tmpDir, { recursive: true, force: true });
  await mkdir(tmpDir, { recursive: true });

  const templatesDir = resolve(agentkitRoot, 'templates');

  // --- Always-on outputs (not gated by renderTargets) ---
  await Promise.all([
    syncAgentsMd(templatesDir, tmpDir, vars, version, repoName),
    syncRootDocs(templatesDir, tmpDir, vars, version, repoName),
    syncGitHub(templatesDir, tmpDir, vars, version, repoName),
    syncDirectCopy(templatesDir, 'docs', tmpDir, 'docs', vars, version, repoName),
    syncDirectCopy(templatesDir, 'vscode', tmpDir, '.vscode', vars, version, repoName),
    syncEditorConfigs(templatesDir, tmpDir, vars, version, repoName)
  ]);

  // --- Gated by renderTargets ---
  const gatedTasks = [];

  if (targets.has('claude')) {
    gatedTasks.push(
      syncDirectCopy(templatesDir, 'claude/hooks', tmpDir, '.claude/hooks', vars, version, repoName),
      syncClaudeSettings(templatesDir, tmpDir, vars, version, mergedPermissions, settingsSpec),
      syncClaudeCommands(templatesDir, tmpDir, vars, version, repoName, teamsSpec, commandsSpec),
      syncClaudeAgents(templatesDir, tmpDir, vars, version, repoName, agentsSpec, rulesSpec),
      syncDirectCopy(templatesDir, 'claude/rules', tmpDir, '.claude/rules', vars, version, repoName),
      syncDirectCopy(templatesDir, 'claude/state', tmpDir, '.claude/state', vars, version, repoName),
      syncClaudeMd(templatesDir, tmpDir, vars, version, repoName),
      syncClaudeSkills(templatesDir, tmpDir, vars, version, repoName, commandsSpec)
    );
  }

  if (targets.has('cursor')) {
    gatedTasks.push(
      syncDirectCopy(templatesDir, 'cursor/rules', tmpDir, '.cursor/rules', vars, version, repoName),
      syncCursorTeams(tmpDir, vars, version, repoName, teamsSpec),
      syncCursorCommands(templatesDir, tmpDir, vars, version, repoName, commandsSpec)
    );
  }

  if (targets.has('windsurf')) {
    gatedTasks.push(
      syncDirectCopy(
        templatesDir,
        'windsurf/rules',
        tmpDir,
        '.windsurf/rules',
        vars,
        version,
        repoName
      ),
      syncWindsurfCommands(templatesDir, tmpDir, vars, version, repoName, commandsSpec),
      syncDirectCopy(
        templatesDir,
        'windsurf/workflows',
        tmpDir,
        '.windsurf/workflows',
        vars,
        version,
        repoName
      ),
      syncWindsurfTeams(tmpDir, vars, version, repoName, teamsSpec)
    );
  }

  if (targets.has('ai')) {
    gatedTasks.push(
      syncDirectCopy(templatesDir, 'ai', tmpDir, '.ai', vars, version, repoName)
    );
  }

  if (targets.has('copilot')) {
    gatedTasks.push(
      syncCopilot(templatesDir, tmpDir, vars, version, repoName),
      syncCopilotPrompts(templatesDir, tmpDir, vars, version, repoName, commandsSpec),
      syncCopilotAgents(templatesDir, tmpDir, vars, version, repoName, agentsSpec, rulesSpec),
      syncCopilotChatModes(templatesDir, tmpDir, vars, version, repoName, teamsSpec)
    );
  }

  if (targets.has('gemini')) {
    gatedTasks.push(syncGemini(templatesDir, tmpDir, vars, version, repoName));
  }

  if (targets.has('codex')) {
    gatedTasks.push(syncCodexSkills(templatesDir, tmpDir, vars, version, repoName, commandsSpec));
  }

  if (targets.has('warp')) {
    gatedTasks.push(syncWarp(templatesDir, tmpDir, vars, version, repoName));
  }

  if (targets.has('cline')) {
    gatedTasks.push(syncClineRules(templatesDir, tmpDir, vars, version, repoName, rulesSpec));
  }

  if (targets.has('roo')) {
    gatedTasks.push(syncRooRules(templatesDir, tmpDir, vars, version, repoName, rulesSpec));
  }

  if (targets.has('mcp')) {
    gatedTasks.push(syncA2aConfig(tmpDir, vars, version, repoName, agentsSpec, teamsSpec, templatesDir));
  }

  await Promise.all(gatedTasks);

  // 5. Build file list from temp and compute summary
  const newManifestFiles = {};
  const fileSummary = {}; // category → count
  const allTmpFiles = [];

  for await (const srcFile of walkDir(tmpDir)) {
    allTmpFiles.push(srcFile);
  }

  // Process files concurrently
  await runConcurrent(allTmpFiles, async (srcFile) => {
    if (!existsSync(srcFile)) return; // Should exist, but safety check
    const relPath = relative(tmpDir, srcFile);
    const manifestKey = relPath.replace(/\\/g, '/');
    let fileContent;
    try {
      fileContent = await readFile(srcFile);
    } catch (err) {
      if (err?.code === 'ENOENT') return;
      throw err;
    }
    const hash = createHash('sha256').update(fileContent).digest('hex').slice(0, 12);

    // JS object assignment is atomic enough for keys
    newManifestFiles[manifestKey] = { hash };
  });

  // Re-compute summary sequentially to avoid race condition on counters
  for (const manifestKey of Object.keys(newManifestFiles)) {
     const cat = categorizeFile(manifestKey);
     fileSummary[cat] = (fileSummary[cat] || 0) + 1;
  }

  // --- Dry-run: print summary and exit without writing ---
  if (dryRun) {
    await rm(tmpDir, { recursive: true, force: true });
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

    // Concurrency for diff? Diff output to console might interleave.
    // We should collect logs and print them or just run sequentially.
    // Sequential is fine for diff as it's interactive-ish.
    for (const srcFile of allTmpFiles) {
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
        newContent = await readFile(srcFile, 'utf-8');
      } catch (err) {
        if (err?.code === 'ENOENT') continue;
        throw err;
      }
      if (!existsSync(destFile)) {
        createCount++;
        log(`  create ${normPath}`);
      } else {
        const oldContent = await readFile(destFile, 'utf-8');
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
    await rm(tmpDir, { recursive: true, force: true });
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
      previousManifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
    }
  } catch {
    /* ignore corrupt manifest */
  }

  // 7. Atomic swap: move temp outputs to project root & build new manifest
  log('[agentkit:sync] Writing outputs...');
  const resolvedRoot = resolve(projectRoot) + sep;

  // Use a shared counter and error list
  let count = 0;
  let skippedScaffold = 0;
  const failedFiles = [];

  await runConcurrent(allTmpFiles, async (srcFile) => {
    if (!existsSync(srcFile)) return;
    const relPath = relative(tmpDir, srcFile);
    const destFile = resolve(projectRoot, relPath);

    // Path traversal protection: ensure all output stays within project root
    if (!resolve(destFile).startsWith(resolvedRoot) && resolve(destFile) !== resolve(projectRoot)) {
      console.error(`[agentkit:sync] BLOCKED: path traversal detected — ${relPath}`);
      failedFiles.push({ file: relPath, error: 'path traversal blocked' });
      return;
    }

    // Scaffold-once: skip project-owned files that already exist (unless --overwrite)
    const overwrite = flags?.overwrite || flags?.force;
    if (!overwrite && isScaffoldOnce(relPath) && existsSync(destFile)) {
      skippedScaffold++;
      return;
    }

    try {
      await ensureDir(dirname(destFile));
      // Use fs/promises cp, but we want force: true behavior (overwrite).
      // fs.promises.cp is recursive by default only for directories.
      // But we are copying files here.
      // copyFile is better for single files.
      // But chmod handling? cp handles it if mode is preserved.
      // Let's use copyFile.
      // Wait, node 16.7.0+ has cp.
      // We are on >=22.0.0.
      await cp(srcFile, destFile, { force: true, recursive: false });

      // Make .sh files executable
      if (extname(srcFile) === '.sh') {
        try {
          await chmod(destFile, 0o755);
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
  });

  if (failedFiles.length > 0) {
    await rm(tmpDir, { recursive: true, force: true });
    console.error(`[agentkit:sync] Error: ${failedFiles.length} file(s) failed to write:`);
    for (const f of failedFiles) {
      console.error(`  - ${f.file}: ${f.error}`);
    }
    throw new Error(`Sync completed with ${failedFiles.length} write failure(s)`);
  }

  // 8. Stale file cleanup: delete orphaned files from previous sync (unless --no-clean)
  let cleanedCount = 0;
  if (!noClean && previousManifest?.files) {
    // Parallelize cleanup?
    const staleFiles = [];
    for (const prevFile of Object.keys(previousManifest.files)) {
      if (!newManifestFiles[prevFile]) {
        staleFiles.push(prevFile);
      }
    }

    await runConcurrent(staleFiles, async (prevFile) => {
        const orphanPath = resolve(projectRoot, prevFile);
        // Path traversal protection: ensure orphan path stays within project root
        if (!orphanPath.startsWith(resolvedRoot) && orphanPath !== resolve(projectRoot)) {
          console.warn(`[agentkit:sync] BLOCKED: path traversal in manifest — ${prevFile}`);
          return;
        }
        if (existsSync(orphanPath)) {
          try {
            await unlink(orphanPath);
            cleanedCount++;
            logVerbose(`[agentkit:sync] Cleaned stale file: ${prevFile}`);
          } catch (err) {
            console.warn(
              `[agentkit:sync] Warning: could not clean stale file ${prevFile} — ${err.message}`
            );
          }
        }
    });
  }

  // 9. Write new manifest
  const newManifest = {
    generatedAt: new Date().toISOString(),
    version,
    repoName: vars.repoName,
    files: newManifestFiles,
  };
  try {
    await writeFile(manifestPath, JSON.stringify(newManifest, null, 2) + '\n', 'utf-8');
  } catch (err) {
    console.warn(`[agentkit:sync] Warning: could not write manifest — ${err.message}`);
  }

  // 10. Cleanup temp
  await rm(tmpDir, { recursive: true, force: true });

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
