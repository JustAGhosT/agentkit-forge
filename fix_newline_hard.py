import sys

filepath = '.agentkit/engines/node/src/sync.mjs'

with open(filepath, 'r') as f:
    content = f.read()

# The file still has the newline split.
# Let's replace the EXACT sequence of bytes if possible.

broken_sequence = "writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '\n', 'utf-8');"
correct_sequence = "writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '\\n', 'utf-8');"

# Wait, the cat output shows:
# 657 |    writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '
# 658 |', 'utf-8');

# So we want to join these lines.

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
            next_line = lines[i+1]
            if next_line.strip() == "', 'utf-8');":
                print("Found split writeFileSync at line", i+1)
                # Keep indentation
                indent = line[:line.find("writeFileSync")]
                # Use raw string for replacement to avoid escape confusion
                new_line = indent + r"writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '\n', 'utf-8');"
                new_lines.append(new_line)
                skip = True
                continue

    new_lines.append(line)

with open(filepath, 'w') as f:
    f.write('\n'.join(new_lines))
