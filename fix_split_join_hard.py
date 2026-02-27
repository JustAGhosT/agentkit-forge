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

    # Target: .split('
    if ".split('" in line:
        if i + 1 < len(lines):
            next_line = lines[i+1].strip()
            if next_line == "')":
                print(f"Fixing split at line {i+1}")
                indent = line[:line.find(".split")]
                new_lines.append(indent + r".split('\n')")
                skip = True
                continue

    # Target: .join('
    elif ".join('" in line:
        if i + 1 < len(lines):
            next_line = lines[i+1].strip()
            if next_line == "')":
                print(f"Fixing join at line {i+1}")
                indent = line[:line.find(".join")]
                new_lines.append(indent + r".join('\n')")
                skip = True
                continue

    new_lines.append(line)

with open(filepath, 'w') as f:
    f.write('\n'.join(new_lines))
