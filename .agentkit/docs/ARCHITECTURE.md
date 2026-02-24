# AgentKit Forge -- Architecture

This document describes the internal architecture of AgentKit Forge: how YAML
specs and templates are transformed into multi-tool AI agent configurations,
how the CLI routes commands, how the orchestrator manages the 5-phase lifecycle,
and how validation ensures correctness at every stage.

---

## 1. System Overview

AgentKit Forge is a build-time framework that generates configuration files for
multiple AI coding tools (Claude Code, Cursor, Windsurf, GitHub Copilot, and
generic `.ai` configs) from a single set of YAML specifications. It provides:

- A **spec system** defining teams, agents, commands, rules, and settings.
- A **sync engine** that renders templates using spec data and per-repo overlays.
- An **orchestrator** implementing a 5-phase project lifecycle state machine.
- A **validation pipeline** checking specs before sync and outputs after sync.
- A **quality gate runner** that auto-detects tech stacks and runs format, lint,
  typecheck, test, and build steps.

---

## 2. Directory Structure

```
.agentkit/
  spec/                          Canonical YAML definitions (source of truth)
    teams.yaml                     Team definitions + tech stack configs
    agents.yaml                    Agent personas grouped by category
    commands.yaml                  Slash command definitions with flags
    rules.yaml                     Coding rule domains and conventions
    settings.yaml                  Permissions, hooks, cost tracking
    aliases.yaml                   Command aliases
    docs.yaml                      Documentation structure definition
    VERSION                        Fallback version number

  overlays/                      Per-repo customization layers
    __TEMPLATE__/                  Default overlay (starting point for new repos)
      settings.yaml                  repoName, defaultBranch, primaryStack
      commands.yaml                  Command overrides
      rules.yaml                     Rule overrides

  templates/                     Mustache-style source templates
    claude/                        Commands, agents, hooks, rules, state, settings
    cursor/                        .mdc rule files
    windsurf/                      Rules, workflows
    copilot/                       GitHub Copilot instructions
    ai/                            Generic AI configs (cursorrules, etc.)
    mcp/                           MCP servers, A2A protocol
    docs/                          8-category documentation scaffold
    github/                        CI workflows, issue/PR templates
    root/                          Root-level files (AGENT_BACKLOG.md, etc.)
    vscode/                        VS Code settings and extensions

  engines/node/src/              Runtime engine (Node.js, ESM)
    cli.mjs                        CLI router and entry point
    sync.mjs                       Sync engine core
    orchestrator.mjs               5-phase state machine
    spec-validator.mjs             YAML spec schema validation
    validate.mjs                   Post-sync output validation
    check.mjs                      Quality gate runner
    runner.mjs                     Process execution utilities
    (+ review-runner, plan-runner, handoff, healthcheck, discover,
       cost-tracker, init)
```

---

## 3. Sync Engine

The sync engine (`sync.mjs`) is the core build step. It reads specs, applies
overlays, renders templates, and writes the final output.

### Execution Steps

1. **Load specs.** Read all YAML from `.agentkit/spec/`. Version from
   `package.json` (primary) or `spec/VERSION` (fallback).
2. **Detect overlay.** Priority: `--overlay` flag, `.agentkit-repo` marker file,
   then `__TEMPLATE__` default.
3. **Load overlay.** Read `settings.yaml` from `.agentkit/overlays/<name>/`.
4. **Merge settings.** Union base + overlay permission lists (deny wins at
   runtime).
5. **Build template variables.** Construct `vars`: `version`, `repoName`,
   `defaultBranch`, `primaryStack`.
6. **Render to staging.** Process all templates into `.agentkit/.tmp/`. Dedicated
   sync functions handle each category: `syncClaudeCommands` generates per-team
   commands from `team-TEMPLATE.md`, `syncClaudeAgents` generates per-agent files
   from `TEMPLATE.md`, `syncCursorTeams`/`syncWindsurfTeams` produce per-team
   rule files, and `syncDirectCopy` handles generic directory rendering.
7. **Atomic swap.** Copy `.tmp/` contents to project root with path traversal
   protection. Shell scripts get `chmod 755`.
8. **Cleanup.** Remove staging directory.

### Template Rendering

`renderTemplate()` replaces `{{key}}` placeholders with values. Keys are sorted
longest-first to prevent partial collisions. String values are sanitized by
`sanitizeTemplateValue()` which strips shell metacharacters to prevent injection
in rendered hook scripts. Unresolved placeholders are warned on with `DEBUG=1`.

### Generated Headers

Every output file (except JSON and `.gitkeep`) receives a header comment
indicating its origin. Comment style adapts to the file extension.
`insertHeader()` respects shebangs and YAML frontmatter, inserting after these
preambles.

---

## 4. CLI Architecture

The CLI router (`cli.mjs`) dispatches all commands.

| Category   | Commands                                                    |
|------------|-------------------------------------------------------------|
| Core       | `init`, `sync`, `validate`, `discover`, `spec-validate`    |
| Workflow   | `orchestrate`, `plan`, `check`, `review`, `handoff`, `healthcheck` |
| Utility    | `cost`                                                      |
| Slash-only | `project-review` (AI tool only, no CLI handler)             |

### Dispatch Flow

1. Extract subcommand from `process.argv[2]`.
2. Validate against `VALID_COMMANDS`; reject unknown commands.
3. Parse flags via `parseFlags()` (supports `--flag value` and `--flag=value`).
4. Warn on unrecognized flags per the `VALID_FLAGS` map.
5. Dynamic-import the handler and call its entry function with
   `{ agentkitRoot, projectRoot, flags }`.

Errors are caught at the top level; `DEBUG=1` enables stack traces.

---

## 5. Orchestrator

The orchestrator (`orchestrator.mjs`) implements a state machine for the
5-phase project lifecycle.

### Phases

| Phase | Name           | Action                                        |
|-------|----------------|-----------------------------------------------|
| 1     | Discovery      | `/discover` -- scan repo, detect stacks       |
| 2     | Planning       | `/plan` -- create implementation plans        |
| 3     | Implementation | `/team-*` -- delegate to team agents          |
| 4     | Validation     | `/check` -- run quality gates                 |
| 5     | Ship           | `/review` + `/deploy` -- final review, deploy |

### State Persistence

State lives in `.claude/state/orchestrator.json`, written atomically (write
`.tmp`, then rename). Tracks: schema version, repo ID, git branch, session ID,
current phase, per-team progress (`idle`/`in_progress`/`blocked`/`done`), todo
items, and recent results.

### Session Locking

File-based exclusive locking (`orchestrator.lock` with `wx` create flag)
prevents concurrent corruption. Stale locks (>30 min) are auto-reclaimed.
`--force-unlock` removes the lock unconditionally.

### Event Logging

Actions are appended to `.claude/state/events.log` as NDJSON. Each event
records a timestamp, action name, and context data. `readEvents()` retrieves
recent entries for the status display.

---

## 6. Spec System

YAML files in `.agentkit/spec/` serve as the single source of truth.

| File | Defines |
|------|---------|
| `teams.yaml` | 10 team scopes (id, name, focus, scope globs) + `techStacks` (build/test/lint/format/typecheck commands, detect markers) |
| `agents.yaml` | Agent personas by category (engineering, design, marketing, operations, product, testing, project-management) with role, focus globs, responsibilities, preferred tools |
| `commands.yaml` | Slash commands with type (`workflow`/`team`/`utility`), description, flags, allowed-tools |
| `settings.yaml` | Permission allow/deny lists, lifecycle hooks (sessionStart, preToolUse, postToolUse, stop), cost tracking, dependency management config |
| `rules.yaml` | Coding convention domains (TypeScript, Rust, Python, .NET, security, blockchain) with severity-tagged rules |
| `aliases.yaml` | Command aliases mapping short forms to full commands |

---

## 7. Validation Pipeline

### Spec Validation (`spec-validate`)

`spec-validator.mjs` checks YAML files against lightweight schemas before sync:

- **Per-file schemas** -- validates required fields, types, enums, minimum
  lengths for teams, agents, commands, rules, settings, and aliases.
- **Cross-spec references** -- team commands must reference valid team IDs, no
  duplicate IDs across any spec, `allowed-tools` must use known tool names.

### Output Validation (`validate`)

`validate.mjs` runs 8 post-sync phases:

1. Spec validation (calls spec-validator).
2. Required directory existence (`.claude/commands`, `.cursor/rules`, etc.).
3. JSON file validity (`settings.json`, `servers.json`, `a2a-config.json`).
4. Command file presence (all expected `.md` files).
5. Hook file presence (`.sh` + `.ps1` variants).
6. Generated header spot-checks.
7. Settings structure validation (hooks format, permissions non-empty).
8. Secret scanning (API keys, tokens, passwords; code blocks stripped to reduce
   false positives).

---

## 8. Quality Gates

The check runner (`check.mjs`) auto-detects tech stacks and runs steps in
sequence. Invoked via `/check` or `agentkit check`.

### Stack Detection

Reads `techStacks` from `teams.yaml` and checks for marker files (`package.json`
for Node, `Cargo.toml` for Rust, `*.csproj` for .NET, `pyproject.toml` for
Python).

### Steps Per Stack

| Step      | Source               | Notes                          |
|-----------|----------------------|--------------------------------|
| format    | `stack.formatter`    | `--check` mode; `--fix` writes |
| lint      | `stack.linter`       | `--fix` auto-fixes             |
| typecheck | `stack.typecheck`    | e.g., `tsc --noEmit`           |
| test      | `stack.testCommand`  | e.g., `pnpm test`              |
| build     | `stack.buildCommand` | Skipped with `--fast`          |

Commands are validated by `isValidCommand()` (rejects shell metacharacters) and
checked for PATH availability via `commandExists()`. Missing tools are skipped
gracefully. Results are logged as orchestrator events. Flags: `--fix`, `--fast`,
`--stack <name>`, `--bail`.

---

## 9. Data Flow Diagram

```
+---------------------------+     +---------------------------+
|   .agentkit/spec/*.yaml    |     | .agentkit/overlays/<repo>/ |
|                           |     |   settings.yaml           |
|  teams, agents, commands, |     |   commands.yaml           |
|  rules, settings, docs    |     |   rules.yaml              |
+-----------+---------------+     +------------+--------------+
            |                                  |
            +----------------+-----------------+
                             |
                             v
              +--------------+--------------+
              |    Sync Engine (sync.mjs)   |
              |                             |
              |  Load specs + overlay       |
              |  Merge permissions          |
              |  Build template vars        |
              +--------------+--------------+
                             |
                             v
              +--------------+--------------+
              | .agentkit/templates/**/*     |
              |                             |
              | {{variable}} substitution   |
              | + generated header insert   |
              +--------------+--------------+
                             |
                             v
              +--------------+--------------+
              |   .agentkit/.tmp/ (staging)  |
              |                             |
              |  Atomic copy to project     |
              |  Path traversal protection  |
              +--------------+--------------+
                             |
                             v
              +--------------+--------------+
              |   Project Root (output)     |
              |                             |
              | .claude/  .cursor/          |
              | .windsurf/ .github/         |
              | .ai/  mcp/  docs/           |
              | CLAUDE.md                   |
              +--------------+--------------+
                             |
                             v
              +--------------+--------------+
              | Validation (validate.mjs)   |
              |                             |
              | spec-validate: schemas +    |
              |   cross-refs               |
              | validate: dirs, JSON,       |
              |   commands, hooks, headers, |
              |   settings, secrets         |
              +-----------------------------+
```

---

## References

- [COMMAND_REFERENCE.md](./COMMAND_REFERENCE.md) -- Full command documentation
- [WORKFLOWS.md](./WORKFLOWS.md) -- Standard workflow patterns
- [CUSTOMIZATION.md](./CUSTOMIZATION.md) -- Overlay and spec customization
- [STATE_AND_SESSIONS.md](./STATE_AND_SESSIONS.md) -- Orchestrator state details
- [TEAM_GUIDE.md](./TEAM_GUIDE.md) -- Team definitions and delegation
