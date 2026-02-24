/**
 * AgentKit Forge — Check Command (Quality Gate Runner)
 * Auto-detects tech stacks and runs format, lint, typecheck, test, build in sequence.
 * Outputs a structured results table and logs to events.
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';
import { execCommand, commandExists, formatDuration, isValidCommand } from './runner.mjs';
import { appendEvent } from './orchestrator.mjs';

// ---------------------------------------------------------------------------
// Step definitions per tech stack
// ---------------------------------------------------------------------------

/**
 * Build the check steps for a detected stack.
 * @param {object} stack - Stack config from teams.yaml techStacks
 * @param {object} flags - CLI flags
 * @returns {Array<{ name: string, command: string, fixCommand?: string }>}
 */
function buildSteps(stack, flags) {
  const steps = [];

  if (stack.formatter) {
    if (typeof stack.formatter !== 'string' || !stack.formatter.trim()) {
      console.warn(`[agentkit:check] Skipping non-string formatter value`);
    } else {
      const resolved = resolveFormatter(stack.formatter);
      if (!isValidCommand(stack.formatter) && !isValidCommand(resolved)) {
        console.warn(`[agentkit:check] Skipping invalid formatter command: ${stack.formatter}`);
      } else if (!isAllowedFormatter(resolved)) {
        console.warn(`[agentkit:check] Skipping unrecognized formatter: ${stack.formatter}`);
      } else {
        const fixCmd = flags.fix ? `${resolved} --write .` : null;
        steps.push({
          name: 'format',
          command: `${resolved} --check .`,
          fixCommand: fixCmd,
        });
      }
    }
  }

  if (stack.linter) {
    if (!isValidCommand(stack.linter)) {
      console.warn(`[agentkit:check] Skipping invalid linter command: ${stack.linter}`);
    } else {
      const fixCmd = flags.fix ? `${stack.linter} --fix .` : null;
      steps.push({
        name: 'lint',
        command: `${stack.linter} .`,
        fixCommand: fixCmd,
      });
    }
  }

  if (stack.typecheck) {
    if (!isValidCommand(stack.typecheck)) {
      console.warn(`[agentkit:check] Skipping invalid typecheck command: ${stack.typecheck}`);
    } else {
      steps.push({
        name: 'typecheck',
        command: stack.typecheck,
      });
    }
  }

  if (stack.testCommand) {
    if (!isValidCommand(stack.testCommand)) {
      console.warn(`[agentkit:check] Skipping invalid test command: ${stack.testCommand}`);
    } else {
      steps.push({
        name: 'test',
        command: stack.testCommand,
      });
    }
  }

  if (stack.buildCommand && !flags.fast) {
    if (!isValidCommand(stack.buildCommand)) {
      console.warn(`[agentkit:check] Skipping invalid build command: ${stack.buildCommand}`);
    } else {
      steps.push({
        name: 'build',
        command: stack.buildCommand,
      });
    }
  }

  return steps;
}

// Allowed formatter base executables. Values from the YAML spec must resolve to
// one of these (after resolveFormatter mapping) to prevent a compromised spec
// from executing arbitrary binaries.
const ALLOWED_FORMATTER_BASES = new Set([
  'npx', 'prettier', 'black', 'cargo', 'dotnet', 'gofmt', 'rustfmt',
  'clang-format', 'autopep8', 'yapf', 'isort', 'shfmt', 'stylua',
]);

function resolveFormatter(formatter) {
  // Map shorthand names to full commands
  const map = {
    prettier: 'npx prettier',
    black: 'black',
    'cargo fmt': 'cargo fmt',
    'dotnet format': 'dotnet format',
  };
  return map[formatter] || formatter;
}

/**
 * Check if a resolved formatter command uses an allowed base executable.
 * @param {string} resolved - The resolved formatter command string
 * @returns {boolean}
 */
function isAllowedFormatter(resolved) {
  const base = resolved.split(/\s+/)[0];
  return ALLOWED_FORMATTER_BASES.has(base);
}

// ---------------------------------------------------------------------------
// Stack detection
// ---------------------------------------------------------------------------

/**
 * Detect tech stacks from teams.yaml techStacks config.
 * @param {string} agentkitRoot
 * @param {string} projectRoot
 * @param {string} [filterStack] - Optional stack name to filter to
 * @returns {object[]}
 */
function detectStacks(agentkitRoot, projectRoot, filterStack) {
  const teamsPath = resolve(agentkitRoot, 'spec', 'teams.yaml');
  if (!existsSync(teamsPath)) return [];

  const spec = yaml.load(readFileSync(teamsPath, 'utf-8'));
  const stacks = spec.techStacks || [];

  return stacks.filter(stack => {
    if (filterStack && stack.name !== filterStack) return false;
    // Check if any detect markers exist in the project
    return (stack.detect || []).some(marker => {
      if (marker.startsWith('*')) {
        // Wildcard: check for files with this extension at root
        const ext = marker.replace('*', '');
        try {
          return readdirSync(projectRoot).some(f => f.endsWith(ext));
        } catch { return false; }
      }
      return existsSync(resolve(projectRoot, marker));
    });
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

/**
 * Run quality gate checks.
 * @param {object} opts
 * @param {string} opts.agentkitRoot
 * @param {string} opts.projectRoot
 * @param {object} opts.flags - --fix, --fast, --stack
 * @returns {object} results
 */
export async function runCheck({ agentkitRoot, projectRoot, flags = {} }) {
  console.log('[agentkit:check] Running quality gates...');
  console.log('');

  const detectedStacks = detectStacks(agentkitRoot, projectRoot, flags.stack);

  if (detectedStacks.length === 0) {
    console.log('[agentkit:check] No tech stacks detected. Nothing to check.');
    console.log('Tip: Ensure your project has marker files (package.json, Cargo.toml, etc.)');
    return { stacks: [], overallStatus: 'SKIP', overallPassed: true };
  }

  const allResults = [];

  for (const stack of detectedStacks) {
    console.log(`--- Stack: ${stack.name} ---`);
    const steps = buildSteps(stack, flags);
    const stackResults = [];

    for (const step of steps) {
      process.stdout.write(`  ${step.name.padEnd(12)} `);

      // Check if the base command exists
      const parts = step.command.split(' ').filter(Boolean);
      const isNpx = parts[0] === 'npx';
      const baseCmd = isNpx ? (parts[1] || '') : parts[0];

      let result;
      if (!isNpx && baseCmd && !commandExists(baseCmd)) {
        result = { exitCode: -1, stdout: '', stderr: `Command not found: ${baseCmd}`, durationMs: 0 };
        console.log(`SKIP (${baseCmd} not found)`);
      } else {
        // If --fix and we have a fix command, run that first
        if (flags.fix && step.fixCommand) {
          const fixResult = execCommand(step.fixCommand, { cwd: projectRoot });
          if (fixResult.exitCode !== 0) {
            console.warn(`  fix command failed (exit ${fixResult.exitCode})`);
          }
        }
        result = execCommand(step.command, { cwd: projectRoot });
        const status = result.exitCode === 0 ? 'PASS' : 'FAIL';
        console.log(`${status}  (${formatDuration(result.durationMs)})`);
      }

      stackResults.push({
        step: step.name,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        status: result.exitCode === 0 ? 'PASS' : result.exitCode === -1 ? 'SKIP' : 'FAIL',
        stdout: result.stdout.slice(0, 500),
        stderr: result.stderr.slice(0, 500),
      });

      // If --bail flag (future), stop on first failure
      if (flags.bail && result.exitCode > 0) break;
    }

    allResults.push({ stack: stack.name, steps: stackResults });
    console.log('');
  }

  // --- Summary ---
  const overallPassed = allResults.every(s =>
    s.steps.every(step => step.status === 'PASS' || step.status === 'SKIP')
  );
  const overallStatus = overallPassed ? 'PASS' : 'FAIL';

  console.log(`=== Quality Gate: ${overallStatus} ===`);
  console.log('');

  // Results table
  console.log('Step         Status  Duration');
  console.log('───────────  ──────  ────────');
  for (const stackResult of allResults) {
    for (const step of stackResult.steps) {
      const name = `${stackResult.stack}:${step.step}`.padEnd(11);
      const status = step.status.padEnd(6);
      console.log(`${name}  ${status}  ${formatDuration(step.durationMs)}`);
    }
  }

  // Log event
  try {
    appendEvent(projectRoot, 'check_completed', {
      overallStatus,
      stacks: allResults.map(s => ({
        stack: s.stack,
        steps: s.steps.map(st => ({ step: st.step, status: st.status, durationMs: st.durationMs })),
      })),
      flags: { fix: !!flags.fix, fast: !!flags.fast, stack: flags.stack || null },
    });
  } catch { /* event logging is best-effort */ }

  return { stacks: allResults, overallStatus, overallPassed };
}
