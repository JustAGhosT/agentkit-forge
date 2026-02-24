#!/usr/bin/env node
/**
 * AgentKit Forge CLI Router
 * Routes subcommands to their handlers.
 */
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
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

const VALID_COMMANDS = ['init', 'sync', 'validate', 'discover', 'spec-validate',
  'orchestrate', 'plan', 'check', 'review', 'handoff', 'healthcheck', 'cost',
  'project-review'];

// Workflow commands with runtime handlers
const WORKFLOW_COMMANDS = ['orchestrate', 'plan', 'check', 'review', 'handoff', 'healthcheck'];

// Commands that are slash-command-only (no CLI handler)
const SLASH_ONLY_COMMANDS = ['project-review'];

const VALID_FLAGS = {
  init: ['repoName', 'force', 'help'],
  sync: ['overlay', 'help'],
  validate: ['help'],
  discover: ['output', 'depth', 'include-deps', 'help'],
  'spec-validate': ['help'],
  orchestrate: ['assess-only', 'scope', 'dry-run', 'team', 'phase', 'status', 'force-unlock', 'help'],
  plan: ['issue', 'output', 'depth', 'help'],
  check: ['fix', 'fast', 'stack', 'bail', 'help'],
  review: ['pr', 'range', 'file', 'focus', 'severity', 'help'],
  handoff: ['format', 'include-diff', 'tag', 'save', 'help'],
  healthcheck: ['stack', 'fix', 'verbose', 'help'],
  cost: ['summary', 'sessions', 'report', 'month', 'format', 'last', 'help'],
  'project-review': ['scope', 'focus', 'phase', 'help'],
};

const args = process.argv.slice(2);
const command = args[0];
const commandArgs = args.slice(1);

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const raw = arg.slice(2);
      // Support --flag=value syntax
      const eqIdx = raw.indexOf('=');
      if (eqIdx !== -1) {
        flags[raw.slice(0, eqIdx)] = raw.slice(eqIdx + 1);
      } else {
        const next = args[i + 1];
        if (next && !next.startsWith('--')) {
          flags[raw] = next;
          i++;
        } else {
          flags[raw] = true;
        }
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
  init            Initialize repo overlay from template
  sync            Render all AI tool configs from spec + overlay
  validate        Validate generated outputs
  discover        Scan repo to detect tech stacks and structure
  spec-validate   Validate YAML spec files for schema correctness

Workflow Commands:
  orchestrate     Multi-team coordination workflow (state machine)
  plan            Show plan status and recommendations
  check           Run quality gates (format, lint, typecheck, test, build)
  review          Run automated review checks (secrets, large files, TODOs)
  handoff         Generate session handoff document
  healthcheck     Pre-flight validation of repo health

Utility Commands:
  cost            Session cost and usage tracking

Slash-Command Only:
  project-review  Comprehensive project audit (use as /project-review in AI tool)

Options:
  orchestrate:
    --status            Show current orchestrator state
    --force-unlock      Clear stale session lock
    --phase <1-5>       Jump to specific phase

  check:
    --fix               Auto-fix issues where possible
    --fast              Skip build step
    --stack <name>      Limit to specific tech stack
    --bail              Stop on first failure

  review:
    --range <range>     Git commit range (e.g. HEAD~3..HEAD)
    --file <path>       Review a specific file

  handoff:
    --save              Save handoff to docs/ai_handoffs/

  cost:
    --summary           Show recent session summary
    --sessions          List recent sessions
    --report            Generate aggregate report
    --month <YYYY-MM>   Month for report
    --format <fmt>      Export format: json, csv (default: table)
    --last <period>     Time period (e.g. 7d, 30d)

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
      case 'discover': {
        const { runDiscover } = await import('./discover.mjs');
        await runDiscover({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'spec-validate': {
        const { runSpecValidation } = await import('./spec-validator.mjs');
        const result = runSpecValidation(AGENTKIT_ROOT);
        if (!result.valid) process.exit(1);
        break;
      }
      case 'orchestrate': {
        const { runOrchestrate } = await import('./orchestrator.mjs');
        await runOrchestrate({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'check': {
        const { runCheck } = await import('./check.mjs');
        const result = await runCheck({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        if (!result.overallPassed) process.exit(1);
        break;
      }
      case 'review': {
        const { runReview } = await import('./review-runner.mjs');
        const result = await runReview({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        if (result.status === 'FAIL') process.exit(1);
        break;
      }
      case 'plan': {
        const { runPlan } = await import('./plan-runner.mjs');
        await runPlan({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'handoff': {
        const { runHandoff } = await import('./handoff.mjs');
        await runHandoff({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'healthcheck': {
        const { runHealthcheck } = await import('./healthcheck.mjs');
        await runHealthcheck({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'cost': {
        const { runCost } = await import('./cost-tracker.mjs');
        await runCost({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      default: {
        if (SLASH_ONLY_COMMANDS.includes(command)) {
          const cmdFile = resolve(PROJECT_ROOT, '.claude', 'commands', `${command}.md`);
          console.log(`[agentkit:${command}] Slash command: /${command}`);
          console.log();
          console.log(`This is an AI agent slash command. Use it within your AI tool:`);
          console.log(`  Claude Code:  /${command}`);
          console.log(`  Cursor:       @${command}`);
          console.log();
          if (existsSync(cmdFile)) {
            console.log(`Command definition: .claude/commands/${command}.md`);
          } else {
            console.log('Run "agentkit sync" first to generate command files.');
          }
          break;
        }
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
