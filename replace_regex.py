import sys

filepath = '.agentkit/engines/node/src/sync.mjs'

with open(filepath, 'r') as f:
    content = f.read()

# Replace all broken regex for backslash matching
# We want to replace .replace(/\/g, '/') with .replace(/\\/g, '/')
# But since we are writing JS code, we need to be careful with escaping.

# We will use string replacement again, but more aggressively targeting the exact broken syntax.

broken = ".replace(/\/g, '/')"
fixed = ".replace(/\\\\/g, '/')"

new_content = content.replace(broken, fixed)

with open(filepath, 'w') as f:
    f.write(new_content)

print("Replaced regex")
