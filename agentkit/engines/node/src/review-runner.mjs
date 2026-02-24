/**
 * AgentKit Forge — Review Runner
 * Automated pre-review checks: secret scanning, large file detection,
 * TODO/FIXME scanning, and lint on changed files.
 * This is NOT the AI review — that's the /review slash command.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { resolve, relative, extname, sep } from 'path';
import { execCommand, formatDuration } from './runner.mjs';
import { appendEvent } from './orchestrator.mjs';

// ---------------------------------------------------------------------------
// Secret patterns — compiled once at module level to avoid per-call overhead.
// The /g flag is safe with String.prototype.match() which resets lastIndex.
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
  { name: 'AWS Key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'Private Key', pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/g },
  { name: 'Generic Secret', pattern: /(password|secret|api_key|apikey|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
  { name: 'Connection String', pattern: /mongodb(\+srv)?:\/\/[^\s'"]+/g },
  { name: 'JWT', pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
];

// ---------------------------------------------------------------------------
// Diff scope detection
// ---------------------------------------------------------------------------

function getChangedFiles(projectRoot, flags) {
  if (flags.range) {
    // Validate range to prevent shell injection — only allow commit-range notation.
    // Intentionally restrictive: blocks @{...} reflog syntax and special chars that
    // could be interpreted by cmd.exe on Windows (where shell:true is used).
    // Allowed: alphanumeric, dots, dashes, slashes, colons, carets, tildes, and .. / ... range operators.
    // Max 256 chars to prevent abuse via extremely long inputs.
    if (
      flags.range.length > 256 ||
      !/^[a-zA-Z0-9._\-/:^~@]+(?:\.{2,3}[a-zA-Z0-9._\-/:^~@]+)?$/.test(flags.range) ||
      /[@][{]/.test(flags.range)
    ) {
      throw new Error(`Invalid --range value: ${flags.range}`);
    }
    const r = execCommand(`git diff --name-only ${flags.range}`, { cwd: projectRoot });
    return r.exitCode === 0 ? r.stdout.trim().split('\n').filter(Boolean) : [];
  }

  if (flags.file) {
    // Constrain to project root to prevent path traversal
    const abs = resolve(projectRoot, flags.file);
    if (!abs.startsWith(resolve(projectRoot) + sep) && abs !== resolve(projectRoot)) {
      throw new Error(`--file must be within the project root: ${flags.file}`);
    }
    return [flags.file];
  }

  // Default: uncommitted changes (staged + unstaged)
  const r = execCommand('git diff --name-only HEAD', { cwd: projectRoot });
  if (r.exitCode !== 0) {
    // Fallback to unstaged only
    const r2 = execCommand('git diff --name-only', { cwd: projectRoot });
    return r2.exitCode === 0 ? r2.stdout.trim().split('\n').filter(Boolean) : [];
  }
  return r.stdout.trim().split('\n').filter(Boolean);
}

// ---------------------------------------------------------------------------
// Check functions
// ---------------------------------------------------------------------------

function scanSecrets(projectRoot, files) {
  const findings = [];
  for (const file of files) {
    const fullPath = resolve(projectRoot, file);
    if (!existsSync(fullPath)) continue;

    // Skip binary and large files
    try {
      const stat = statSync(fullPath);
      if (stat.size > 1_000_000) continue; // Skip files > 1MB
    } catch { continue; }

    const ext = extname(file).toLowerCase();
    if (['.png', '.jpg', '.gif', '.ico', '.woff', '.ttf', '.eot', '.zip', '.tar', '.gz'].includes(ext)) continue;

    try {
      const content = readFileSync(fullPath, 'utf-8');
      for (const secret of SECRET_PATTERNS) {
        const matches = content.match(secret.pattern);
        if (matches) {
          findings.push({
            type: 'secret',
            severity: 'HIGH',
            file,
            pattern: secret.name,
            count: matches.length,
          });
        }
      }
    } catch { /* skip unreadable files */ }
  }
  return findings;
}

function scanLargeFiles(projectRoot, files, threshold = 500_000) {
  const findings = [];
  for (const file of files) {
    const fullPath = resolve(projectRoot, file);
    try {
      const stat = statSync(fullPath);
      if (stat.size > threshold) {
        findings.push({
          type: 'large_file',
          severity: 'MEDIUM',
          file,
          sizeBytes: stat.size,
          sizeMB: (stat.size / 1_000_000).toFixed(1),
        });
      }
    } catch { /* skip */ }
  }
  return findings;
}

function scanTodos(projectRoot, files) {
  const findings = [];
  const todoPattern = /\b(TODO|FIXME|HACK|XXX|TEMP)\b.*$/gm;

  for (const file of files) {
    const fullPath = resolve(projectRoot, file);
    if (!existsSync(fullPath)) continue;

    const ext = extname(file).toLowerCase();
    if (['.png', '.jpg', '.gif', '.ico', '.woff', '.ttf'].includes(ext)) continue;

    try {
      const stat = statSync(fullPath);
      if (stat.size > 1_000_000) continue;

      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const matches = lines[i].match(todoPattern);
        if (matches) {
          findings.push({
            type: 'todo',
            severity: 'LOW',
            file,
            line: i + 1,
            text: matches[0].trim().slice(0, 100),
          });
        }
      }
    } catch { /* skip */ }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

/**
 * Run automated review checks.
 * @param {object} opts
 * @param {string} opts.agentkitRoot
 * @param {string} opts.projectRoot
 * @param {object} opts.flags - --range, --file
 * @returns {object}
 */
export async function runReview({ agentkitRoot, projectRoot, flags = {} }) {
  console.log('[agentkit:review] Running automated review checks...');
  console.log('');

  const changedFiles = getChangedFiles(projectRoot, flags);

  if (changedFiles.length === 0) {
    console.log('[agentkit:review] No changed files found.');
    console.log('Tip: Commit some changes or use --range <commit>..<commit> to specify a range.');
    return { files: 0, findings: [], status: 'SKIP' };
  }

  console.log(`Files to review: ${changedFiles.length}`);
  for (const f of changedFiles.slice(0, 20)) {
    console.log(`  ${f}`);
  }
  if (changedFiles.length > 20) {
    console.log(`  ... and ${changedFiles.length - 20} more`);
  }
  console.log('');

  // Run checks
  const allFindings = [];

  console.log('--- Secret Scan ---');
  const secrets = scanSecrets(projectRoot, changedFiles);
  allFindings.push(...secrets);
  if (secrets.length > 0) {
    for (const f of secrets) {
      console.log(`  ⚠ ${f.severity} ${f.pattern} in ${f.file} (${f.count} match${f.count > 1 ? 'es' : ''})`);
    }
  } else {
    console.log('  ✓ No secrets detected');
  }
  console.log('');

  console.log('--- Large File Detection ---');
  const largeFiles = scanLargeFiles(projectRoot, changedFiles);
  allFindings.push(...largeFiles);
  if (largeFiles.length > 0) {
    for (const f of largeFiles) {
      console.log(`  ⚠ ${f.file} (${f.sizeMB} MB)`);
    }
  } else {
    console.log('  ✓ No oversized files');
  }
  console.log('');

  console.log('--- TODO/FIXME Scan ---');
  const todos = scanTodos(projectRoot, changedFiles);
  allFindings.push(...todos);
  if (todos.length > 0) {
    for (const f of todos.slice(0, 10)) {
      console.log(`  · ${f.file}:${f.line} — ${f.text}`);
    }
    if (todos.length > 10) {
      console.log(`  ... and ${todos.length - 10} more`);
    }
  } else {
    console.log('  ✓ No TODOs found in changed files');
  }
  console.log('');

  // Summary
  const hasHighSeverity = allFindings.some(f => f.severity === 'HIGH');
  const status = hasHighSeverity ? 'FAIL' : 'PASS';

  console.log(`=== Review: ${status} ===`);
  console.log(`Files: ${changedFiles.length} | Findings: ${allFindings.length} (${secrets.length} secrets, ${largeFiles.length} large files, ${todos.length} TODOs)`);

  // Log event
  try {
    appendEvent(projectRoot, 'review_completed', {
      filesReviewed: changedFiles.length,
      totalFindings: allFindings.length,
      secretFindings: secrets.length,
      status,
    });
  } catch { /* best-effort */ }

  return {
    files: changedFiles.length,
    findings: allFindings,
    secrets: secrets.length,
    largeFiles: largeFiles.length,
    todos: todos.length,
    status,
  };
}
