import sys

filepath = '.agentkit/engines/node/src/sync.mjs'

with open(filepath, 'r') as f:
    content = f.read()

# Define correct applySync function
correct_apply_sync = """function applySync(
  agentkitRoot,
  projectRoot,
  tmpDir,
  newManifestFiles,
  flags,
  vars,
  version,
  logVerbose
) {
  const noClean = flags?.['no-clean'] || false;
  const manifestPath = resolve(agentkitRoot, '.manifest.json');
  let previousManifest = null;
  try {
    if (existsSync(manifestPath)) {
      previousManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    }
  } catch {
    /* ignore corrupt manifest */
  }

  const resolvedRoot = resolve(projectRoot) + sep;
  let count = 0;
  let skippedScaffold = 0;
  const failedFiles = [];

  for (const srcFile of walkDir(tmpDir)) {
    if (!existsSync(srcFile)) continue;
    const relPath = relative(tmpDir, srcFile);
    const destFile = resolve(projectRoot, relPath);

    // Path traversal protection
    if (!resolve(destFile).startsWith(resolvedRoot) && resolve(destFile) !== resolve(projectRoot)) {
      console.error(`[agentkit:sync] BLOCKED: path traversal detected — ${relPath}`);
      failedFiles.push({ file: relPath, error: 'path traversal blocked' });
      continue;
    }

    const overwrite = flags?.overwrite || flags?.force;
    if (!overwrite && isScaffoldOnce(relPath) && existsSync(destFile)) {
      skippedScaffold++;
      continue;
    }

    try {
      ensureDir(dirname(destFile));
      cpSync(srcFile, destFile, { force: true });
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

  // Stale file cleanup
  let cleanedCount = 0;
  if (!noClean && previousManifest?.files) {
    for (const prevFile of Object.keys(previousManifest.files)) {
      if (!newManifestFiles[prevFile]) {
        const orphanPath = resolve(projectRoot, prevFile);
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

  // Write new manifest
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

  rmSync(tmpDir, { recursive: true, force: true });

  return { count, skippedScaffold, cleanedCount };
}"""

# Find and replace the function
start_marker = "function applySync("
end_marker = "function handleDryRunOrDiff"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Could not find function boundaries")
    sys.exit(1)

new_content = content[:start_idx] + correct_apply_sync + "\n\n\n" + content[end_idx:]

with open(filepath, 'w') as f:
    f.write(new_content)

print("Replaced applySync")
