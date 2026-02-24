/**
 * AgentKit Forge — Tool Manager
 * Handles add/remove/list subcommands for incremental AI tool management.
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';

const ALL_TOOLS = ['claude', 'cursor', 'windsurf', 'copilot', 'gemini', 'codex', 'warp', 'cline', 'roo', 'ai', 'mcp'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadOverlaySettings(agentkitRoot, projectRoot) {
  // Determine overlay name from .agentkit-repo marker
  const markerPath = resolve(projectRoot, '.agentkit-repo');
  if (!existsSync(markerPath)) {
    throw new Error('No .agentkit-repo marker found. Run "agentkit init" first.');
  }
  const repoName = readFileSync(markerPath, 'utf-8').trim();
  const settingsPath = resolve(agentkitRoot, 'overlays', repoName, 'settings.yaml');
  if (!existsSync(settingsPath)) {
    throw new Error(`Overlay settings not found at ${settingsPath}. Run "agentkit init" first.`);
  }
  const settings = yaml.load(readFileSync(settingsPath, 'utf-8')) || {};
  return { repoName, settingsPath, settings };
}

function saveOverlaySettings(settingsPath, settings) {
  writeFileSync(settingsPath, yaml.dump(settings, { lineWidth: 120 }), 'utf-8');
}

// ---------------------------------------------------------------------------
// add
// ---------------------------------------------------------------------------

export async function runAdd({ agentkitRoot, projectRoot, flags }) {
  const tools = parseToolArgs(flags);
  if (tools.length === 0) {
    throw new Error('Usage: agentkit add <tool> [tool2 ...]\nAvailable tools: ' + ALL_TOOLS.join(', '));
  }

  // Validate tool names
  const invalid = tools.filter(t => !ALL_TOOLS.includes(t));
  if (invalid.length > 0) {
    throw new Error(`Unknown tool(s): ${invalid.join(', ')}\nAvailable: ${ALL_TOOLS.join(', ')}`);
  }

  const { repoName, settingsPath, settings } = loadOverlaySettings(agentkitRoot, projectRoot);
  const current = new Set(settings.renderTargets || []);

  const added = [];
  const skipped = [];
  for (const tool of tools) {
    if (current.has(tool)) {
      skipped.push(tool);
    } else {
      current.add(tool);
      added.push(tool);
    }
  }

  if (added.length === 0) {
    console.log(`[agentkit:add] All specified tools already enabled: ${skipped.join(', ')}`);
    return;
  }

  // Update settings
  settings.renderTargets = [...current];
  saveOverlaySettings(settingsPath, settings);
  console.log(`[agentkit:add] Added render target(s): ${added.join(', ')}`);

  if (skipped.length > 0) {
    console.log(`[agentkit:add] Already enabled: ${skipped.join(', ')}`);
  }

  // Run sync for only the new targets
  console.log(`[agentkit:add] Running sync for: ${added.join(', ')}`);
  const { runSync } = await import('./sync.mjs');
  await runSync({ agentkitRoot, projectRoot, flags: { overlay: repoName, only: added.join(',') } });
}

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

export async function runRemove({ agentkitRoot, projectRoot, flags }) {
  const tools = parseToolArgs(flags);
  if (tools.length === 0) {
    throw new Error('Usage: agentkit remove <tool> [--clean]\nAvailable tools: ' + ALL_TOOLS.join(', '));
  }

  const invalid = tools.filter(t => !ALL_TOOLS.includes(t));
  if (invalid.length > 0) {
    throw new Error(`Unknown tool(s): ${invalid.join(', ')}\nAvailable: ${ALL_TOOLS.join(', ')}`);
  }

  const { repoName, settingsPath, settings } = loadOverlaySettings(agentkitRoot, projectRoot);
  const current = new Set(settings.renderTargets || []);

  const removed = [];
  for (const tool of tools) {
    if (current.has(tool)) {
      current.delete(tool);
      removed.push(tool);
    } else {
      console.log(`[agentkit:remove] Tool "${tool}" is not currently enabled.`);
    }
  }

  if (removed.length > 0) {
    settings.renderTargets = [...current];
    saveOverlaySettings(settingsPath, settings);
    console.log(`[agentkit:remove] Removed render target(s): ${removed.join(', ')}`);
  }

  // Clean up generated files if --clean flag is set
  if (flags.clean && removed.length > 0) {
    const cleanedCount = cleanToolFiles(agentkitRoot, projectRoot, removed);
    if (cleanedCount > 0) {
      console.log(`[agentkit:remove] Cleaned ${cleanedCount} generated file(s).`);
    } else {
      console.log('[agentkit:remove] No generated files found to clean.');
    }
  }
}

/**
 * Deletes generated files belonging to specific tools using the manifest.
 * Maps tool names to their output path prefixes.
 */
function cleanToolFiles(agentkitRoot, projectRoot, tools) {
  const manifestPath = resolve(agentkitRoot, '.manifest.json');
  if (!existsSync(manifestPath)) {
    console.warn('[agentkit:remove] No manifest found — cannot determine which files to clean.');
    return 0;
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch {
    console.warn('[agentkit:remove] Corrupt manifest — cannot clean files.');
    return 0;
  }

  // Map tool names to path prefixes they generate
  const toolPrefixes = {
    claude: ['.claude/', 'CLAUDE.md'],
    cursor: ['.cursor/'],
    windsurf: ['.windsurf/'],
    copilot: ['.github/copilot-instructions.md', '.github/instructions/', '.github/prompts/', '.github/agents/', '.github/chatmodes/'],
    gemini: ['GEMINI.md', '.gemini/'],
    codex: ['.agents/'],
    warp: ['WARP.md'],
    cline: ['.clinerules/'],
    roo: ['.roo/'],
    ai: ['.ai/'],
    mcp: ['mcp/'],
  };

  const prefixesToClean = tools.flatMap(t => toolPrefixes[t] || []);
  let cleaned = 0;

  for (const filePath of Object.keys(manifest.files || {})) {
    if (prefixesToClean.some(prefix => filePath.startsWith(prefix) || filePath === prefix.replace(/\/$/, ''))) {
      const fullPath = resolve(projectRoot, filePath);
      if (existsSync(fullPath)) {
        try {
          unlinkSync(fullPath);
          cleaned++;
        } catch { /* skip files we can't delete */ }
      }
    }
  }

  return cleaned;
}

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

export async function runList({ agentkitRoot, projectRoot, flags }) {
  const { settings } = loadOverlaySettings(agentkitRoot, projectRoot);
  const enabled = new Set(settings.renderTargets || []);
  const available = ALL_TOOLS.filter(t => !enabled.has(t));

  console.log(`  Enabled:     ${enabled.size > 0 ? [...enabled].join(', ') : '(none)'}`);
  console.log(`  Available:   ${available.length > 0 ? available.join(', ') : '(all enabled)'}`);
  console.log(`  Always-on:   AGENTS.md, root docs, .github/ infra`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parses tool names from CLI flags.
 * Tools can be positional args (stored in flags._args) or passed directly.
 */
function parseToolArgs(flags) {
  // Tool names come as positional args — stored in _args by the CLI
  if (Array.isArray(flags._args) && flags._args.length > 0) {
    return flags._args;
  }
  return [];
}

export { ALL_TOOLS };
