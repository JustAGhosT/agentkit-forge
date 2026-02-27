import sys

filepath = '.agentkit/engines/node/src/sync.mjs'

with open(filepath, 'r') as f:
    content = f.read()

# I suspect my previous attempt failed because of how I was running it or file buffering.
# Or maybe the indentation I added wasn't matching EXACTLY.

# Let's read lines, find the broken split, join them, then write back.

lines = content.split('\n')
new_lines = []
skip = False

for i in range(len(lines)):
    if skip:
        skip = False
        continue

    line = lines[i]
    # Be more flexible with whitespace matching
    if "writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '" in line:
        if i+1 < len(lines):
            next_line = lines[i+1].strip()
            if next_line == "', 'utf-8');":
                print("Found it at line", i+1)
                # Keep indentation
                indent = line[:line.find("writeFileSync")]
                new_lines.append(indent + "writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '\n', 'utf-8');")
                skip = True
                continue

    new_lines.append(line)

with open(filepath, 'w') as f:
    f.write('\n'.join(new_lines))
