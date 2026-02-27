import sys

filepath = '.agentkit/engines/node/src/sync.mjs'

with open(filepath, 'r') as f:
    content = f.read()

# Fix newline issue in writeFileSync
# We have a literal newline in the string concatenation which is valid JS template literal but might be causing issues if quotes are messed up.
# The previous grep showed:
# 713 |      writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '
# 714 |  ', 'utf-8');

# We should replace this with explicit \n

broken_str = "JSON.stringify(newManifest, null, 2) + '\n', 'utf-8');"
# Wait, the file actually has a literal newline.
# Let's search for the multi-line pattern and replace it.

start_marker = "writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '"
# The next char is likely newline

if start_marker in content:
    # This is a bit tricky with raw strings.
    # Let's look for the specific lines.
    lines = content.splitlines()
    for i, line in enumerate(lines):
        if start_marker in line and line.strip().endswith("'"):
             # This looks like the start of the split line
             # Check next line
             if i+1 < len(lines) and lines[i+1].startswith("', 'utf-8');"):
                 # Merge them
                 lines[i] = line.replace(" + '", " + '\n', 'utf-8');")
                 lines[i+1] = "" # Delete next line
                 print(f"Fixed line {i+1}")

    new_content = "\n".join([l for l in lines if l is not ""])
    with open(filepath, 'w') as f:
        f.write(new_content)
    print("Fixed newline")
else:
    # Maybe it matches exactly?
    target = "JSON.stringify(newManifest, null, 2) + '\n', 'utf-8');"
    # No, based on grep it was split.

    # Let's try replacing the specific broken sequence that resulted from python script previously
    # In refactor_step5.py I wrote:
    # writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '\n', 'utf-8');
    # But because it was in a multiline python string, \n might have become a literal newline if not escaped enough.

    # Let's just find the  call and rewrite it cleanly.

    import re
    # Pattern: writeFileSync\(manifestPath, JSON.stringify\(newManifest, null, 2\) \+ '[\r\n]+', 'utf-8'\);
    # This might match the broken state.

    fixed_content = re.sub(
        r"writeFileSync\(manifestPath, JSON\.stringify\(newManifest, null, 2\) \+ '[\r\n]+', 'utf-8'\);",
        "writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '\\n', 'utf-8');",
        content,
        flags=re.MULTILINE
    )

    if fixed_content != content:
        with open(filepath, 'w') as f:
            f.write(fixed_content)
        print("Fixed via regex")
    else:
        print("Regex didn't match, trying manual line reconstruction")
        # Re-read lines
        lines = content.splitlines()
        new_lines = []
        skip_next = False
        for i, line in enumerate(lines):
            if skip_next:
                skip_next = False
                continue

            if "writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '" in line and line.strip().endswith("'"):
                # Found the split line
                new_lines.append("    writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '\n', 'utf-8');")
                skip_next = True # Skip the next line which contains the closing quote
                print(f"Fixed split line at {i+1}")

            elif "diffOut" in line and ".split('" in line:
                 # Also fix the diffOut split seen in grep earlier?
                 # 753 |            log(
                 # 754 |              diffOut
                 # 755 |                .split('
                 # 756 |  ')
                 pass # Let's handle one error at a time or see if this logic catches others
                 new_lines.append(line)
            else:
                new_lines.append(line)

        with open(filepath, 'w') as f:
            f.write('\n'.join(new_lines))
