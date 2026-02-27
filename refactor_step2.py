import sys
import os

filepath = '.agentkit/engines/node/src/sync.mjs'

with open(filepath, 'r') as f:
    content = f.read()

# Define the generateTemplates function
generate_templates_func = """
function generateTemplates(agentkitRoot, vars, version, repoName, targets, mergedPermissions, settingsSpec, teamsSpec, commandsSpec, agentsSpec, rulesSpec) {
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
  return tmpDir;
}
"""

# Insert function before loadSyncContext
insert_point = content.find('function loadSyncContext')
if insert_point == -1:
    print("Could not find loadSyncContext")
    sys.exit(1)

# Find runSync again to update step 4
run_sync_idx = content.find('export async function runSync')
step4_start = content.find('// 4. Render templates to temp directory', run_sync_idx)
step5_start = content.find('// 5. Build file list', run_sync_idx)

if step4_start == -1 or step5_start == -1:
    print("Could not find steps in runSync")
    sys.exit(1)

new_run_sync_block = """
  // 4. Render templates to temp directory
  const tmpDir = generateTemplates(agentkitRoot, vars, version, repoName, targets, mergedPermissions, settingsSpec, teamsSpec, commandsSpec, agentsSpec, rulesSpec);

"""

new_content = content[:insert_point] + generate_templates_func + "\n\n" + content[insert_point:step4_start] + new_run_sync_block + content[step5_start:]

with open(filepath, 'w') as f:
    f.write(new_content)

print("File updated successfully")
