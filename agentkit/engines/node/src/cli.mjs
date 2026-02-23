#!/usr/bin/env node
/**
 * AgentKit Forge CLI Router
 * Routes subcommands to their handlers: init, sync, validate
 */
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..');
const PROJECT_ROOT = resolve(AGENTKIT_ROOT, '..');

// Read version from package.json (single source of truth)
let VERSION = '0.0.0';
try {
  const pkg = JSON.parse(readFileSync(resolve(AGENTKIT_ROOT, 'package.json'), 'utf-8'));
  VERSION = pkg.version || VERSION;
} catch { /* fallback to 0.0.0 */ }

const VALID_COMMANDS = ['init', 'sync', 'validate'];

const VALID_FLAGS = {
  init: ['repoName', 'force', 'help'],
  sync: ['overlay', 'help'],
  validate: ['help'],
};

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

function showHelp() {
  console.log(`
AgentKit Forge v${VERSION}

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

  All commands:
    --help              Show this help message

Environment:
  DEBUG=1              Show stack traces on errors
`);
}

async function main() {
  if (!command || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }

  if (!VALID_COMMANDS.includes(command)) {
    console.error(`Unknown command: "${command}"`);
    console.error(`Valid commands: ${VALID_COMMANDS.join(', ')}`);
    console.error('Run with --help for usage information.');
    process.exit(1);
  }

  const flags = parseFlags(commandArgs);

  // Show command-specific help
  if (flags.help) {
    showHelp();
    process.exit(0);
  }

  // Warn on unrecognised flags
  const validForCommand = VALID_FLAGS[command] || [];
  for (const key of Object.keys(flags)) {
    if (!validForCommand.includes(key)) {
      console.warn(`[agentkit:${command}] Warning: unrecognised flag --${key} (ignored)`);
    }
  }

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
    }
  } catch (err) {
    console.error(`[agentkit:${command}] Error: ${err.message}`);
    if (process.env.DEBUG) {
      console.error(err.stack);
    } else {
      console.error('  (set DEBUG=1 for full stack trace)');
    }
    process.exit(1);
  }
}

main();
