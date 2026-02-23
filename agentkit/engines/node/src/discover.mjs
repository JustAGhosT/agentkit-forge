/**
 * AgentKit Forge — Discover Command
 * Scans the repository to detect tech stacks, project structure, team boundaries,
 * and build a structured discovery report.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join, basename, extname, relative } from 'path';
import yaml from 'js-yaml';

// ---------------------------------------------------------------------------
// Tech stack detection patterns
// ---------------------------------------------------------------------------

const STACK_DETECTORS = [
  {
    name: 'node',
    label: 'Node.js / TypeScript',
    markers: ['package.json'],
    filePatterns: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts'],
    configFiles: ['tsconfig.json', '.eslintrc.json', '.eslintrc.js', '.prettierrc', 'vitest.config.ts', 'jest.config.ts'],
  },
  {
    name: 'dotnet',
    label: '.NET / C#',
    markers: ['*.sln', '*.csproj', 'Directory.Build.props'],
    filePatterns: ['.cs', '.csproj', '.sln'],
    configFiles: ['global.json', 'Directory.Build.props', 'nuget.config'],
  },
  {
    name: 'rust',
    label: 'Rust',
    markers: ['Cargo.toml'],
    filePatterns: ['.rs'],
    configFiles: ['Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml'],
  },
  {
    name: 'python',
    label: 'Python',
    markers: ['pyproject.toml', 'setup.py', 'requirements.txt'],
    filePatterns: ['.py'],
    configFiles: ['pyproject.toml', 'setup.cfg', 'tox.ini', '.flake8', 'mypy.ini'],
  },
  {
    name: 'go',
    label: 'Go',
    markers: ['go.mod'],
    filePatterns: ['.go'],
    configFiles: ['go.mod', 'go.sum'],
  },
  {
    name: 'ruby',
    label: 'Ruby',
    markers: ['Gemfile'],
    filePatterns: ['.rb', '.erb'],
    configFiles: ['Gemfile', '.rubocop.yml'],
  },
  {
    name: 'java',
    label: 'Java / Kotlin',
    markers: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    filePatterns: ['.java', '.kt', '.kts'],
    configFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle'],
  },
];

// ---------------------------------------------------------------------------
// Infrastructure detection
// ---------------------------------------------------------------------------

const INFRA_DETECTORS = [
  { name: 'docker', markers: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'] },
  { name: 'kubernetes', markers: ['k8s/', 'helm/', '*.k8s.yml'] },
  { name: 'terraform', markers: ['terraform/', '*.tf'] },
  { name: 'bicep', markers: ['bicep/', '*.bicep'] },
  { name: 'pulumi', markers: ['Pulumi.yaml'] },
  { name: 'github-actions', markers: ['.github/workflows/'] },
];

// ---------------------------------------------------------------------------
// CI/CD detection
// ---------------------------------------------------------------------------

const CI_DETECTORS = [
  { name: 'github-actions', markers: ['.github/workflows/'] },
  { name: 'azure-devops', markers: ['azure-pipelines.yml'] },
  { name: 'gitlab-ci', markers: ['.gitlab-ci.yml'] },
  { name: 'circleci', markers: ['.circleci/config.yml'] },
  { name: 'jenkins', markers: ['Jenkinsfile'] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileExists(projectRoot, pattern) {
  // Handle glob-like patterns simply
  if (pattern.endsWith('/')) {
    return existsSync(resolve(projectRoot, pattern.slice(0, -1)));
  }
  if (pattern.startsWith('*')) {
    // Check for any file matching the extension
    const ext = pattern.replace('*', '');
    try {
      return readdirSync(projectRoot).some(f => f.endsWith(ext));
    } catch { return false; }
  }
  return existsSync(resolve(projectRoot, pattern));
}

function countFilesByExt(dir, extensions, depth = 4, maxFiles = 5000) {
  let count = 0;
  function walk(currentDir, currentDepth) {
    if (currentDepth > depth || count > maxFiles) return;
    if (!existsSync(currentDir)) return;
    try {
      for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build' || entry.name === '.git') continue;
        const full = join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(full, currentDepth + 1);
        } else if (extensions.includes(extname(entry.name))) {
          count++;
        }
      }
    } catch { /* permission errors */ }
  }
  walk(dir, 0);
  return count;
}

function getTopLevelDirs(projectRoot) {
  try {
    return readdirSync(projectRoot, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
      .map(e => e.name);
  } catch { return []; }
}

function detectMonorepo(projectRoot) {
  const indicators = [];

  // pnpm workspaces
  if (existsSync(resolve(projectRoot, 'pnpm-workspace.yaml'))) {
    indicators.push('pnpm-workspace');
  }
  // npm/yarn workspaces
  if (existsSync(resolve(projectRoot, 'package.json'))) {
    try {
      const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf-8'));
      if (pkg.workspaces) indicators.push('npm-workspaces');
    } catch { /* ignore */ }
  }
  // Nx
  if (existsSync(resolve(projectRoot, 'nx.json'))) {
    indicators.push('nx');
  }
  // Turbo
  if (existsSync(resolve(projectRoot, 'turbo.json'))) {
    indicators.push('turborepo');
  }
  // Lerna
  if (existsSync(resolve(projectRoot, 'lerna.json'))) {
    indicators.push('lerna');
  }
  // Cargo workspace
  if (existsSync(resolve(projectRoot, 'Cargo.toml'))) {
    try {
      const cargo = readFileSync(resolve(projectRoot, 'Cargo.toml'), 'utf-8');
      if (cargo.includes('[workspace]')) indicators.push('cargo-workspace');
    } catch { /* ignore */ }
  }

  return indicators;
}

// ---------------------------------------------------------------------------
// Core discovery logic
// ---------------------------------------------------------------------------

export async function runDiscover({ agentkitRoot, projectRoot, flags }) {
  console.log('[agentkit:discover] Scanning repository...');

  const report = {
    generatedAt: new Date().toISOString(),
    projectRoot: projectRoot,
    repository: {},
    techStacks: [],
    infrastructure: [],
    cicd: [],
    monorepo: { detected: false, tools: [] },
    structure: { topLevelDirs: [], estimatedFileCount: {} },
    recommendations: [],
  };

  // --- Repository info ---
  report.repository.name = basename(projectRoot);
  if (existsSync(resolve(projectRoot, '.git'))) {
    report.repository.isGit = true;
  }
  if (existsSync(resolve(projectRoot, '.agentkit-repo'))) {
    report.repository.agentkitOverlay = readFileSync(resolve(projectRoot, '.agentkit-repo'), 'utf-8').trim();
  }

  // --- Tech stack detection ---
  for (const detector of STACK_DETECTORS) {
    const markerFound = detector.markers.some(m => fileExists(projectRoot, m));
    if (markerFound) {
      const fileCount = countFilesByExt(projectRoot, detector.filePatterns);
      const configsFound = detector.configFiles.filter(c => existsSync(resolve(projectRoot, c)));
      report.techStacks.push({
        name: detector.name,
        label: detector.label,
        fileCount,
        configFiles: configsFound,
      });
    }
  }

  // --- Determine primary stack ---
  if (report.techStacks.length > 0) {
    const primary = report.techStacks.reduce((a, b) => a.fileCount > b.fileCount ? a : b);
    report.primaryStack = primary.name;
  }

  // --- Infrastructure detection ---
  for (const detector of INFRA_DETECTORS) {
    const found = detector.markers.some(m => fileExists(projectRoot, m));
    if (found) {
      report.infrastructure.push(detector.name);
    }
  }

  // --- CI/CD detection ---
  for (const detector of CI_DETECTORS) {
    const found = detector.markers.some(m => fileExists(projectRoot, m));
    if (found) {
      report.cicd.push(detector.name);
    }
  }

  // --- Monorepo detection ---
  const monorepoTools = detectMonorepo(projectRoot);
  if (monorepoTools.length > 0) {
    report.monorepo = { detected: true, tools: monorepoTools };
  }

  // --- Project structure ---
  report.structure.topLevelDirs = getTopLevelDirs(projectRoot);
  for (const stack of report.techStacks) {
    report.structure.estimatedFileCount[stack.name] = stack.fileCount;
  }

  // --- Recommendations ---
  if (report.techStacks.length === 0) {
    report.recommendations.push('No recognised tech stacks detected. Add marker files (package.json, Cargo.toml, etc.) or configure primaryStack manually.');
  }
  if (report.cicd.length === 0) {
    report.recommendations.push('No CI/CD configuration detected. Consider adding GitHub Actions or another CI pipeline.');
  }
  if (!report.repository.agentkitOverlay) {
    report.recommendations.push('No .agentkit-repo marker found. Run "agentkit init" to set up an overlay.');
  }

  // --- Output ---
  const format = flags?.output || 'yaml';
  let output;
  if (format === 'json') {
    output = JSON.stringify(report, null, 2);
  } else if (format === 'markdown') {
    output = formatMarkdown(report);
  } else {
    output = yaml.dump(report, { lineWidth: 120, noRefs: true });
  }

  console.log('');
  console.log(output);
  console.log(`[agentkit:discover] Found ${report.techStacks.length} tech stack(s), ${report.infrastructure.length} infra tool(s), ${report.cicd.length} CI/CD system(s).`);

  return report;
}

function formatMarkdown(report) {
  const lines = [
    `# Discovery Report`,
    ``,
    `**Repository:** ${report.repository.name}`,
    `**Generated:** ${report.generatedAt}`,
    `**Primary Stack:** ${report.primaryStack || 'unknown'}`,
    ``,
    `## Tech Stacks`,
    ``,
  ];

  if (report.techStacks.length === 0) {
    lines.push('No recognised tech stacks detected.');
  } else {
    for (const stack of report.techStacks) {
      lines.push(`### ${stack.label}`);
      lines.push(`- **Files:** ~${stack.fileCount}`);
      if (stack.configFiles.length > 0) {
        lines.push(`- **Config:** ${stack.configFiles.join(', ')}`);
      }
      lines.push('');
    }
  }

  if (report.monorepo.detected) {
    lines.push(`## Monorepo`, ``, `Tools: ${report.monorepo.tools.join(', ')}`, ``);
  }

  if (report.infrastructure.length > 0) {
    lines.push(`## Infrastructure`, ``, report.infrastructure.map(i => `- ${i}`).join('\n'), ``);
  }

  if (report.cicd.length > 0) {
    lines.push(`## CI/CD`, ``, report.cicd.map(c => `- ${c}`).join('\n'), ``);
  }

  lines.push(`## Project Structure`, ``, `Top-level directories:`, ``);
  for (const dir of report.structure.topLevelDirs) {
    lines.push(`- \`${dir}/\``);
  }

  if (report.recommendations.length > 0) {
    lines.push(``, `## Recommendations`, ``);
    for (const rec of report.recommendations) {
      lines.push(`- ${rec}`);
    }
  }

  return lines.join('\n');
}
