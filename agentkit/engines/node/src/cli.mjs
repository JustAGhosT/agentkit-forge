#!/usr/bin/env node
/**
 * AgentKit Forge CLI Router
 * Routes subcommands to their handlers: init, sync, validate
 */
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..');
const PROJECT_ROOT = resolve(AGENTKIT_ROOT, '..');

const args = process.argv.slice(2);
const command = args[0];
const commandArgs = args.slice(1);

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

async function main() {
  if (!command || command === '--help' || command === '-h') {
    console.log(`
AgentKit Forge v0.1.0

Usage: node cli.mjs <command> [options]

Commands:
  init       Initialize repo overlay from template
  sync       Render all AI tool configs from spec + overlay
  validate   Validate generated outputs

Options:
  init:
    --repoName <name>   Repository name (default: parent folder name)
    --force             Overwrite existing overlay

  sync:
    --overlay <name>    Override overlay name (default: from .agentkit-repo)

  validate:
    (no options)
`);
    process.exit(0);
  }

  const flags = parseFlags(commandArgs);

  try {
    switch (command) {
      case 'init': {
        const { runInit } = await import('./init.mjs');
        await runInit({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'sync': {
        const { runSync } = await import('./sync.mjs');
        await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'validate': {
        const { runValidate } = await import('./validate.mjs');
        await runValidate({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run with --help for usage information.');
        process.exit(1);
    }
  } catch (err) {
    console.error(`[agentkit:${command}] Error:`, err.message);
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

main();
