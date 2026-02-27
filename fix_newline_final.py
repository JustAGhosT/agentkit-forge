import sys

filepath = '.agentkit/engines/node/src/sync.mjs'

with open(filepath, 'r') as f:
    content = f.read()

# The issue persists. The previous script logic might not have matched the EXACT indentation or something.
# Let's be very aggressive. We will use replace() on the whole content but we need to match the newlines.

target_block = "writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '\n', 'utf-8');"
broken_block = "writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '\n', 'utf-8');"

# Wait, the grep output showed:
# 649 |      writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '
# 650 |  ', 'utf-8');

# So we need to replace:
# writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '
# ', 'utf-8');

# with:
# writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '\n', 'utf-8');

# Let's try direct replacement of the string block
broken_segment = "writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '\n', 'utf-8');"
# Python string literal handling makes matching newlines hard.

lines = content.splitlines()
output_lines = []
skip = False

for i in range(len(lines)):
    if skip:
        skip = False
        continue

    line = lines[i]
    if "writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '" in line:
        # Check next line
        if i+1 < len(lines) and lines[i+1].strip() == "', 'utf-8');":
            print("Found broken writeFileSync at line", i+1)
            output_lines.append("    writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '\n', 'utf-8');")
            skip = True
            continue

    output_lines.append(line)

with open(filepath, 'w') as f:
    f.write('\n'.join(output_lines))
