# AgentKit Forge

A Windows-first, polyglot AI-orchestration template repository. Provides a unified agent team framework supporting Claude Code, Cursor, Windsurf, Copilot, and Continue — with MCP/A2A protocol support.

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9+
- PowerShell 7+ (recommended on Windows) or Bash (Linux/macOS)
- Optional: .NET SDK 8+, Python 3.11+, Rust/Cargo

### Windows

```powershell
# 1. Install agentkit runtime
pnpm -C agentkit install

# 2. Initialize for your repo
.\agentkit\bin\init.ps1 -RepoName MyProject

# 3. Generate all AI tool configs
.\agentkit\bin\sync.ps1
```

### Linux / macOS

```bash
# 1. Install agentkit runtime
pnpm -C agentkit install

# 2. Initialize for your repo
node agentkit/engines/node/src/cli.mjs init --repoName MyProject

# 3. Generate all AI tool configs
node agentkit/engines/node/src/cli.mjs sync
```

---

## Adoption Guide: New Repos

Use this path when starting a project from scratch.

### Step 1 — Create your repo from the template

Click **"Use this template"** on GitHub (or clone directly):

```bash
gh repo create my-org/my-project --template my-org/agentkit-forge --private --clone
cd my-project
```

### Step 2 — Install and initialize

```bash
pnpm -C agentkit install
```

**Windows:**
```powershell
.\agentkit\bin\init.ps1 -RepoName my-project
```

**Linux/macOS:**
```bash
node agentkit/engines/node/src/cli.mjs init --repoName my-project
```

This does three things:
1. Copies `agentkit/overlays/__TEMPLATE__/` to `agentkit/overlays/my-project/`
2. Sets `repoName: my-project` in your overlay's `settings.yaml`
3. Runs `sync` to generate all AI tool configs

### Step 3 — Customize your overlay

Edit `agentkit/overlays/my-project/settings.yaml`:

```yaml
repoName: my-project
defaultBranch: main
primaryStack: node          # node | dotnet | rust | python | auto
windowsFirst: true
renderTargets:
  - claude
  - cursor
  - windsurf
  - copilot
  - ai
```

Remove render targets you don't need. For example, a team using only Claude Code and Cursor:

```yaml
renderTargets:
  - claude
  - cursor
```

### Step 4 — Add repo-specific rules or commands

Override or extend any spec definition in your overlay files:

- `agentkit/overlays/my-project/commands.yaml` — add project-specific slash commands
- `agentkit/overlays/my-project/rules.yaml` — add project-specific coding rules

### Step 5 — Start working

```bash
# Discover the codebase
/discover

# Run a health check
/healthcheck

# Start orchestrated development
/orchestrate
```

### Step 6 — Commit the right files

The `agentkit/` directory is your source of truth — commit it. Generated outputs (`.claude/`, `.cursor/`, `.windsurf/`, `docs/`, etc.) are gitignored. Each developer runs `sync` locally after cloning.

```bash
git add agentkit/ .gitignore .gitattributes README.md LICENSE
git commit -m "feat: initialize agentkit-forge scaffold"
```

---

## Adoption Guide: Existing Repos

Use this path to add AgentKit Forge to a project that already has code.

### Step 1 — Add the agentkit directory

Copy or merge the `agentkit/` directory into your repo root. If using git:

```bash
# Add agentkit-forge as a remote
git remote add agentkit-forge https://github.com/my-org/agentkit-forge.git
git fetch agentkit-forge

# Bring in just the agentkit/ directory (and root config files)
git checkout agentkit-forge/main -- agentkit/ .gitattributes
```

Or simply copy the folder manually.

### Step 2 — Merge the .gitignore

Append the AgentKit Forge ignore rules to your existing `.gitignore`. The key entries:

```gitignore
# AgentKit Forge — generated outputs (regenerate with: pnpm -C agentkit agentkit:sync)
/.claude/
/.cursor/
/.windsurf/
/.ai/
/.github/copilot-instructions.md
/.github/instructions/
/.github/workflows/ai-framework-ci.yml
/.github/ISSUE_TEMPLATE/
/.github/PULL_REQUEST_TEMPLATE.md
/mcp/
/CLAUDE.md
/UNIFIED_AGENT_TEAMS.md
/AGENT_TEAMS.md
/AGENT_BACKLOG.md
/QUALITY_GATES.md
/docs/
/.vscode/
/.editorconfig
/.prettierrc
/.markdownlint.json
```

> **Important:** Use leading `/` on each pattern so they only match at the repo root — not inside `agentkit/templates/`.

If your repo already has a `docs/` directory, either:
- Rename the existing docs (e.g., `documentation/`) and let AgentKit Forge generate `docs/`
- Remove `/docs/` from `.gitignore` and skip the docs render target in your overlay

If your repo already has a `.vscode/` directory you want to keep, remove `/.vscode/` from `.gitignore` and manually merge AgentKit's recommended settings.

### Step 3 — Install and initialize

```bash
pnpm -C agentkit install
```

**Windows:**
```powershell
.\agentkit\bin\init.ps1 -RepoName my-existing-project
```

**Linux/macOS:**
```bash
node agentkit/engines/node/src/cli.mjs init --repoName my-existing-project
```

### Step 4 — Tune the overlay for your stack

Edit `agentkit/overlays/my-existing-project/settings.yaml`:

```yaml
repoName: my-existing-project
defaultBranch: main            # or develop, trunk, etc.
primaryStack: auto             # auto-detects from Cargo.toml, package.json, etc.
windowsFirst: false            # set to true for Windows-primary teams
renderTargets:
  - claude                     # only enable tools your team uses
  - cursor
```

### Step 5 — Handle conflicts with existing configs

| Existing file | Resolution |
|---|---|
| `.claude/` directory | Back up, then let `sync` regenerate. Merge any custom commands into your overlay's `commands.yaml` |
| `.cursor/rules/` | Back up custom rules. Add them to `agentkit/overlays/<repo>/rules.yaml` to have them rendered automatically |
| `.github/PULL_REQUEST_TEMPLATE.md` | Merge your template content with AgentKit's generated template, or remove it from `.gitignore` to keep yours |
| `.editorconfig` | Compare and merge; AgentKit's template is minimal and additive |
| `CLAUDE.md` | Move custom instructions into your overlay or into `agentkit/spec/` |

### Step 6 — Run sync and verify

```bash
# Regenerate all configs
node agentkit/engines/node/src/cli.mjs sync

# Verify generated output
ls -la .claude/ .cursor/ docs/
```

### Step 7 — Validate

```bash
node agentkit/engines/node/src/cli.mjs validate
```

This checks that all spec files parse correctly and overlay references are valid.

### Step 8 — Commit

```bash
git add agentkit/ .gitignore .gitattributes
git commit -m "feat: adopt agentkit-forge for AI orchestration"
```

---

## Documentation

Comprehensive guides for using AgentKit Forge:

| Guide | Description |
|-------|-------------|
| **[Quick Start](agentkit/docs/QUICK_START.md)** | Your first 15 minutes — setup, first session, command overview |
| **[Command Reference](agentkit/docs/COMMAND_REFERENCE.md)** | All 23 commands with examples, flags, and expected outputs |
| **[Workflows](agentkit/docs/WORKFLOWS.md)** | Worked examples: feature dev, bug fix, project audit, multi-session |
| **[Team Guide](agentkit/docs/TEAM_GUIDE.md)** | When to use which team, decision matrix, handoff patterns |
| **[State & Sessions](agentkit/docs/STATE_AND_SESSIONS.md)** | Orchestrator state, events log, session continuity, lock files |
| **[Customization](agentkit/docs/CUSTOMIZATION.md)** | Overlays, settings reference, adding commands/rules/teams |
| **[Troubleshooting](agentkit/docs/TROUBLESHOOTING.md)** | Common errors, recovery procedures, FAQ |
| **[Onboarding](agentkit/docs/ONBOARDING.md)** | Full adoption guide with CI integration |
| **[Cost Tracking](agentkit/docs/COST_TRACKING.md)** | Session tracking, usage reports, optimization tips |

---

## What Gets Generated

After running `sync`, these directories are created (all gitignored — regenerate with `sync`):

| Directory | Purpose |
|-----------|---------|
| `.claude/` | Claude Code: commands, hooks, agents, rules, state |
| `.cursor/` | Cursor IDE: rules (.mdc format) |
| `.windsurf/` | Windsurf IDE: rules + workflows |
| `.ai/` | Portable multi-IDE rules (Continue, Cursor, Windsurf) |
| `.github/instructions/` | GitHub Copilot path-specific instructions |
| `mcp/` | MCP server + A2A protocol configurations |
| `docs/` | Full 8-category documentation structure |
| `CLAUDE.md` | Root Claude Code instructions |
| `UNIFIED_AGENT_TEAMS.md` | Team definitions and routing |
| `QUALITY_GATES.md` | Quality gate checks per stack |
| `AGENT_BACKLOG.md` | Backlog tracking for agent work |

## Core Commands

| Command | Purpose |
|---------|---------|
| `/orchestrate` | Master coordinator with state persistence |
| `/discover` | Codebase scanner |
| `/plan` | Structured plan before writing code |
| `/check` | Universal quality gate (format → lint → typecheck → test) |
| `/review` | Structured code review |
| `/handoff` | Session handoff summary |
| `/sync-backlog` | Update AGENT_BACKLOG.md |

## Teams

| ID | Team | Focus |
|----|------|-------|
| T1 | BACKEND | API, services, core logic |
| T2 | FRONTEND | UI, components, PWA |
| T3 | DATA | Database, models, migrations |
| T4 | INFRA | IaC, cloud, Terraform/Bicep |
| T5 | DEVOPS | CI/CD, pipelines, automation |
| T6 | TESTING | Unit, E2E, integration tests |
| T7 | SECURITY | Auth, compliance, audit |
| T8 | DOCUMENTATION | Docs, ADRs, guides |
| T9 | PRODUCT | Features, PRDs, roadmap |
| T10 | QUALITY | Code review, refactoring, bugs |

## Architecture

```
agentkit/           ← Canonical source of truth (committed)
├── spec/           ← Team, command, rule definitions (YAML)
├── templates/      ← Output templates per tool
├── overlays/       ← Per-repo customizations
├── engines/node/   ← Sync engine (Node.js)
└── bin/            ← Windows-first command surface (.ps1 + .cmd)

.claude/            ← Generated (not committed)
.cursor/            ← Generated (not committed)
.windsurf/          ← Generated (not committed)
```

## Overlay System

Each repo gets its own overlay directory under `agentkit/overlays/<repo-name>/`. Overlays let you:

- **Override commands** — Add project-specific slash commands or modify built-in ones
- **Override rules** — Add coding standards specific to your project
- **Configure settings** — Choose which tools to generate configs for, set your default branch, select your primary tech stack

Overlay values take precedence over `agentkit/spec/` defaults. This means the same `agentkit/` directory can power multiple repos with different configurations.

## Keeping Up to Date

When the upstream AgentKit Forge template gets updates:

```bash
# If you used "Use this template" (no git history link)
git remote add agentkit-forge https://github.com/my-org/agentkit-forge.git
git fetch agentkit-forge
git merge agentkit-forge/main --allow-unrelated-histories

# If you forked
git fetch upstream
git merge upstream/main
```

After merging, re-run sync to regenerate outputs:

```bash
pnpm -C agentkit install
node agentkit/engines/node/src/cli.mjs sync
```

## License

MIT
