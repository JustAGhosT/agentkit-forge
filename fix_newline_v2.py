import sys

filepath = '.agentkit/engines/node/src/sync.mjs'

with open(filepath, 'r') as f:
    content = f.read()

lines = content.splitlines()
new_lines = []
skip_next = False

for i, line in enumerate(lines):
    if skip_next:
        skip_next = False
        continue

    # Check for split writeFileSync (likely at line 649 now)
    if "writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '" in line and line.strip().endswith("'"):
        # Found the split line
        # line content is: writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '
        # next line is: ', 'utf-8');
        new_lines.append("    writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '\n', 'utf-8');")
        skip_next = True
        print(f"Fixed split writeFileSync at line {i+1}")

    # Check for split log(diffOut.split('...'))
    elif "diffOut" in line and ".split('" in line and line.strip().endswith("'"):
        # 753 |            log(
        # 754 |              diffOut
        # 755 |                .split('
        # 756 |  ')
        new_lines.append("                .split('\n')")
        skip_next = True
        print(f"Fixed split diffOut at line {i+1}")

    elif ".join('" in line and line.strip().endswith("'"):
        # 757 |                .map((l) => `    ${l}`)
        # 758 |                .join('
        # 759 |  ')
        new_lines.append("                .join('\n')")
        skip_next = True
        print(f"Fixed split join at line {i+1}")

    else:
        new_lines.append(line)

with open(filepath, 'w') as f:
    f.write('\n'.join(new_lines))
