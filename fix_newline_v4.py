import sys

filepath = '.agentkit/engines/node/src/sync.mjs'

with open(filepath, 'r') as f:
    content = f.read()

lines = content.splitlines()
new_lines = []
skip = False

for i in range(len(lines)):
    if skip:
        skip = False
        continue

    line = lines[i]
    if "writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '" in line:
        if i+1 < len(lines):
            next_line = lines[i+1].strip()
            if next_line == "', 'utf-8');":
                print("Found split writeFileSync at line", i+1)
                # Keep indentation
                indent = line[:line.find("writeFileSync")]
                new_lines.append(indent + "writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '\n', 'utf-8');")
                skip = True
                continue

    new_lines.append(line)

with open(filepath, 'w') as f:
    f.write('\n'.join(new_lines))
