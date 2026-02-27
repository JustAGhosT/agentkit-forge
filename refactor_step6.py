import sys
import os

filepath = '.agentkit/engines/node/src/sync.mjs'

with open(filepath, 'r') as f:
    content = f.read()

# Modify runSync to be clean and minimal
run_sync_idx = content.find('export async function runSync')
if run_sync_idx == -1:
    print("Could not find runSync")
    sys.exit(1)

# Find end of runSync (approximate by finding next function export or similar)
# Actually, we can just replace the whole body since we have defined helpers.
# But we need to be careful with imports and exports.

# Let's just verify the content of runSync is correct based on previous steps.
# Step 1: loadSyncContext called
# Step 4: generateTemplates called
# Step 5: computeManifest called
# Dry run check called
# Step 6-10: applySync called
# Step 11: Summary

# It looks like the previous steps incrementally updated runSync.
# Let's inspect the current state of runSync to see if it needs cleanup.

start_marker = "export async function runSync"
end_marker = "// ---------------------------------------------------------------------------"

# Find the end of runSync. It ends before "Sync helpers" section.
helpers_start = content.find("// Sync helpers", run_sync_idx)
if helpers_start == -1:
    print("Could not find Sync helpers section")
    sys.exit(1)

run_sync_body = content[run_sync_idx:helpers_start]

# We want to replace the body with the clean version
clean_run_sync = """export async function runSync({ agentkitRoot, projectRoot, flags }) {
  const quiet = flags?.quiet || false;
  const verbose = flags?.verbose || false;

  const log = (...args) => {
    if (!quiet) console.log(...args);
  };
  const logVerbose = (...args) => {
    if (verbose && !quiet) console.log(...args);
  };

  log('[agentkit:sync] Starting sync...');

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

  // 4. Render templates to temp directory
  const tmpDir = generateTemplates(
    agentkitRoot,
    vars,
    version,
    repoName,
    targets,
    mergedPermissions,
    settingsSpec,
    teamsSpec,
    commandsSpec,
    agentsSpec,
    rulesSpec
  );

  // 5. Build file list from temp and compute summary
  const { newManifestFiles, fileSummary } = computeManifest(tmpDir);

  if (
    handleDryRunOrDiff(
      tmpDir,
      projectRoot,
      flags,
      newManifestFiles,
      fileSummary,
      targets,
      log,
      logVerbose
    )
  ) {
    return;
  }

  // 6-10. Atomic swap: move temp outputs to project root & build new manifest
  log('[agentkit:sync] Writing outputs...');
  const { count, skippedScaffold, cleanedCount } = applySync(
    agentkitRoot,
    projectRoot,
    tmpDir,
    newManifestFiles,
    flags,
    vars,
    version,
    logVerbose
  );

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

"""

# Replace the runSync function
new_content = content[:run_sync_idx] + clean_run_sync + content[helpers_start:]

with open(filepath, 'w') as f:
    f.write(new_content)

print("File updated successfully")
