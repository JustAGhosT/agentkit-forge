/**
 * @deprecated Use template-utils.mjs for pure helpers and synchronize.mjs for the runSync command.
 * This re-export shim is kept for backwards compatibility.
 */
export * from './template-utils.mjs';
export { runSync, readYaml, readText, runConcurrent, ensureDir, writeOutput, walkDir, syncDirectCopy } from './synchronize.mjs';
