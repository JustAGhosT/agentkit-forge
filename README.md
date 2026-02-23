# AgentKit Forge

A Windows-first, polyglot AI-orchestration template repository. Provides a unified agent team framework supporting Claude Code, Cursor, Windsurf, Copilot, and Continue — with MCP/A2A protocol support.

## Quick Start

### Prerequisites

- Node.js 20+
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

## Using as a Template

1. Click **"Use this template"** on GitHub to create a new repo
2. Clone your new repo
3. Run `pnpm -C agentkit install`
4. Run `init` with your repo name
5. Run `sync` to generate all configs
6. Start working with `/discover` → `/healthcheck` → `/orchestrate`

## License

MIT
