import sys

filepath = '.agentkit/engines/node/src/sync.mjs'

with open(filepath, 'r') as f:
    content = f.read()

# It seems my previous script didn't actually persist the change or the indices shifted unexpectedly.
# The error is persistent at line 649.

# Let's read, fix, and write using a simpler approach.
# We will look for lines ending with " + '" and next line starting with "', 'utf-8');"

lines = content.splitlines()
new_lines = []
i = 0
while i < len(lines):
    line = lines[i]

    # Target: writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '
    if "writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '" in line and line.strip().endswith("'"):
        # Check next line
        if i + 1 < len(lines):
            next_line = lines[i+1]
            if next_line.strip() == "', 'utf-8');":
                # Merge
                print(f"Fixing writeFileSync at line {i+1}")
                new_lines.append("    writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '\n', 'utf-8');")
                i += 2
                continue

    # Target: .split('
    if ".split('" in line and line.strip().endswith("'"):
        if i + 1 < len(lines):
            next_line = lines[i+1]
            if next_line.strip() == "')":
                print(f"Fixing split at line {i+1}")
                indent = line[:line.find(".split")]
                new_lines.append(f"{indent}.split('\n')")
                i += 2
                continue

    # Target: .join('
    if ".join('" in line and line.strip().endswith("'"):
        if i + 1 < len(lines):
            next_line = lines[i+1]
            if next_line.strip() == "')":
                print(f"Fixing join at line {i+1}")
                indent = line[:line.find(".join")]
                new_lines.append(f"{indent}.join('\n')")
                i += 2
                continue

    # If no match, keep line
    new_lines.append(line)
    i += 1

with open(filepath, 'w') as f:
    f.write('\n'.join(new_lines))
