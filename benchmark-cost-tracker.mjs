import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import { recordCommand, initSession, endSession } from './.agentkit/engines/node/src/cost-tracker.mjs';

const TEST_ROOT = resolve('.benchmark-test');
const AGENTKIT_ROOT = resolve(TEST_ROOT, '.agentkit');
const PROJECT_ROOT = resolve(TEST_ROOT, 'project');

// Setup
if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
mkdirSync(resolve(AGENTKIT_ROOT, 'logs', 'sessions'), { recursive: true });
mkdirSync(PROJECT_ROOT, { recursive: true });
writeFileSync(resolve(PROJECT_ROOT, '.agentkit-repo'), 'bench-repo');

console.log('Generating 1000 closed sessions...');
for (let i = 0; i < 1000; i++) {
  const session = initSession({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT });
  // Manually close it by writing 'completed' status directly to avoid git overhead in endSession
  // or just use endSession if we don't mind the overhead during setup.
  // Let's just create files directly to be faster.
  const path = resolve(AGENTKIT_ROOT, 'logs', 'sessions', `session-${session.sessionId}.json`);
  const data = JSON.parse(JSON.stringify(session));
  data.status = 'completed';
  writeFileSync(path, JSON.stringify(data));
}

console.log('Benchmarking recordCommand with 1000 closed sessions (Worst Case)...');

const start = process.hrtime.bigint();
const ITERATIONS = 100;

for (let i = 0; i < ITERATIONS; i++) {
  // This will scan all 1000 files and find nothing active
  recordCommand(AGENTKIT_ROOT, 'bench-cmd');
}

const end = process.hrtime.bigint();
const duration = Number(end - start) / 1e6; // ms
const avg = duration / ITERATIONS;

console.log(`Total time for ${ITERATIONS} iterations: ${duration.toFixed(2)}ms`);
console.log(`Average time per call: ${avg.toFixed(2)}ms`);

// Cleanup
rmSync(TEST_ROOT, { recursive: true });
