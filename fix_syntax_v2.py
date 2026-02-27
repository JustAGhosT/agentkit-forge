import sys

filepath = '.agentkit/engines/node/src/sync.mjs'

with open(filepath, 'r') as f:
    lines = f.readlines()

# Manually checking lines 664, 718, 757 based on grep output and previous context
# The issue is likely that python string replacement in previous steps didn't escape backslashes correctly for writing to file.

# We want: .replace(/\\/g, '/')
# We have: .replace(/\/g, '/')  <-- This is invalid JS regex syntax for backslash

target_bad = ".replace(/\/g, '/')"
target_good = ".replace(/\\\\/g, '/')"

for i, line in enumerate(lines):
    if target_bad in line:
        lines[i] = line.replace(target_bad, target_good)
        print(f"Fixed line {i+1}")

with open(filepath, 'w') as f:
    f.writelines(lines)

print("Syntax fixed v2")
