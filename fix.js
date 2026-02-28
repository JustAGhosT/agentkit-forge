const fs = require('fs');
const path = '.agentkit/engines/node/src/task-protocol.mjs';
let content = fs.readFileSync(path, 'utf8');

// Remove import
content = content.replace(/import\s+\{\s*randomBytes\s*\}\s+from\s+['"]crypto['"];\s*\n/, '');

// Replace function body
const oldBody = `function generateRandomSuffix() {
  return randomBytes(3).toString('hex');
}`;
const newBody = `function generateRandomSuffix() {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('hex');
}`;

content = content.replace(oldBody, newBody);

fs.writeFileSync(path, content, 'utf8');
console.log('File updated successfully!');
