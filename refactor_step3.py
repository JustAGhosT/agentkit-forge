import sys
import os

filepath = '.agentkit/engines/node/src/sync.mjs'

with open(filepath, 'r') as f:
    content = f.read()

# Define the computeManifest function
compute_manifest_func = """
function computeManifest(tmpDir) {
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
  return { newManifestFiles, fileSummary };
}
"""

# Insert function before generateTemplates
insert_point = content.find('function generateTemplates')
if insert_point == -1:
    print("Could not find generateTemplates")
    sys.exit(1)

# Find runSync again to update step 5
run_sync_idx = content.find('export async function runSync')
step5_start = content.find('// 5. Build file list', run_sync_idx)
dry_run_start = content.find('// --- Dry-run: print summary', run_sync_idx)

if step5_start == -1 or dry_run_start == -1:
    print("Could not find steps in runSync")
    sys.exit(1)

new_run_sync_block = """
  // 5. Build file list from temp and compute summary
  const { newManifestFiles, fileSummary } = computeManifest(tmpDir);

"""

new_content = content[:insert_point] + compute_manifest_func + "\n\n" + content[insert_point:step5_start] + new_run_sync_block + content[dry_run_start:]

with open(filepath, 'w') as f:
    f.write(new_content)

print("File updated successfully")
