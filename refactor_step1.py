import sys
import os

filepath = '.agentkit/engines/node/src/sync.mjs'

with open(filepath, 'r') as f:
    content = f.read()

# Define the loadSyncContext function
load_sync_context_func = """
function loadSyncContext(agentkitRoot, projectRoot, flags, log) {
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

  return {
    version,
    repoName,
    vars,
    targets,
    mergedPermissions,
    teamsSpec,
    commandsSpec,
    rulesSpec,
    settingsSpec,
    agentsSpec,
    projectSpec
  };
}
"""

# Find where to insert the function (before export async function runSync)
insert_point = content.find('export async function runSync')
if insert_point == -1:
    print("Could not find runSync")
    sys.exit(1)

# Modify runSync to use loadSyncContext
# We need to replace the body of runSync up to step 4.

start_marker = "log('[agentkit:sync] Starting sync...');"
end_marker = "// 4. Render templates to temp directory"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Could not find markers in runSync")
    sys.exit(1)

# Adjust start_idx to be after the log call
start_idx += len(start_marker)

new_run_sync_start = """

  // 1-3. Load Context
  const {
    version,
    repoName,
    vars,
    targets,
    mergedPermissions,
    teamsSpec,
    commandsSpec,
    rulesSpec,
    settingsSpec,
    agentsSpec,
    projectSpec
  } = loadSyncContext(agentkitRoot, projectRoot, flags, log);

  """

new_content = content[:insert_point] + load_sync_context_func + "\n\n" + content[insert_point:start_idx] + new_run_sync_start + content[end_idx:]

with open(filepath, 'w') as f:
    f.write(new_content)

print("File updated successfully")
