import sys

filepath = '.agentkit/engines/node/src/sync.mjs'

with open(filepath, 'r') as f:
    lines = f.readlines()

# Fix line 664: logVerbose(`  wrote ${relPath.replace(/\/g, '/')}`); -> logVerbose(`  wrote ${relPath.replace(/\\/g, '/')}`);
# Actually, the error might be because of how I wrote the file in previous steps.
# The error says: Invalid JS syntax.
# 664 |        logVerbose(`  wrote ${relPath.replace(/\/g, '/')}`);
# It seems the backslash escape for regex was lost or malformed.

# We need to replace it with proper regex for backslash: /\\/g

for i, line in enumerate(lines):
    if "logVerbose();" in line:
        lines[i] = line.replace("relPath.replace(/\/g, '/')", "relPath.replace(/\\/g, '/')")
        print(f"Fixed line {i+1}")

    # Also fix line 718 (similar pattern likely exists in handleDryRunOrDiff)
    if "const normPath = relPath.replace(/\/g, '/');" in line:
        lines[i] = line.replace("relPath.replace(/\/g, '/')", "relPath.replace(/\\/g, '/')")
        print(f"Fixed line {i+1}")

    # And line 757 (computeManifest)
    if "const manifestKey = relPath.replace(/\/g, '/');" in line:
        lines[i] = line.replace("relPath.replace(/\/g, '/')", "relPath.replace(/\\/g, '/')")
        print(f"Fixed line {i+1}")

with open(filepath, 'w') as f:
    f.writelines(lines)

print("Syntax fixed")
