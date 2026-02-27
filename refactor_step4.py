import sys
import os

filepath = '.agentkit/engines/node/src/sync.mjs'

with open(filepath, 'r') as f:
    content = f.read()

# Define handleDryRunOrDiff function
handle_dry_run_or_diff_func = """
function handleDryRunOrDiff(tmpDir, projectRoot, flags, newManifestFiles, fileSummary, targets, log, logVerbose) {
  const dryRun = flags?.['dry-run'] || false;
  const diff = flags?.diff || false;
  const quiet = flags?.quiet || false;

  // --- Dry-run: print summary and exit without writing ---
  if (dryRun) {
    rmSync(tmpDir, { recursive: true, force: true });
    const total = Object.keys(newManifestFiles).length;
    log(`[agentkit:sync] Dry-run: would generate ${total} file(s):`);
    printSyncSummary(fileSummary, targets, { quiet });
    return true; // handled
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
    return true; // handled
  }

  return false; // not handled
}
"""

# Insert function before computeManifest
insert_point = content.find('function computeManifest')
if insert_point == -1:
    print("Could not find computeManifest")
    sys.exit(1)

# Find runSync again
run_sync_idx = content.find('export async function runSync')
dry_run_start = content.find('// --- Dry-run: print summary', run_sync_idx)
step6_start = content.find('// 6. Load previous manifest', run_sync_idx)

if dry_run_start == -1 or step6_start == -1:
    print("Could not find steps in runSync")
    sys.exit(1)

new_run_sync_block = """
  if (handleDryRunOrDiff(tmpDir, projectRoot, flags, newManifestFiles, fileSummary, targets, log, logVerbose)) {
    return;
  }

"""

new_content = content[:insert_point] + handle_dry_run_or_diff_func + "\n\n" + content[insert_point:dry_run_start] + new_run_sync_block + content[step6_start:]

with open(filepath, 'w') as f:
    f.write(new_content)

print("File updated successfully")
