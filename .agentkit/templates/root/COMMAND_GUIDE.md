# Command Guide — When to Use Which

This guide helps you choose the right command for your situation. All commands share the same **locked resources**: `AGENT_BACKLOG.md`, `.claude/state/orchestrator.json`, `.claude/state/events.log`, and `.claude/state/orchestrator.lock`. The orchestrator, planner, and project reviewer all read and write these shared assets.

---

## Workflow Commands — Choosing the Right One

### `/orchestrate` — Full lifecycle coordination

**Use when:**
- You want the system to assess, plan, delegate, validate, and ship in one coordinated flow
- You're starting a new session and need a full assessment
- Work spans multiple teams and needs phased coordination
- You want state persisted across phases (Discovery → Planning → Implementation → Validation → Ship)

**Flags:** `--assess-only`, `--phase N`, `--team <name>`, `--dry-run`, `--status`, `--force-unlock`

**Shared assets:** Reads/writes `orchestrator.json`, `events.log`, `AGENT_BACKLOG.md`. Acquires `orchestrator.lock`.

---

### `/plan` — Structured implementation plan (no code)

**Use when:**
- You need a detailed plan before writing any code
- A backlog item involves more than 2 files or touches shared infra/APIs
- The team is uncertain about the best approach
- The orchestrator has requested a plan before Phase 3 (Implementation)

**Not for:** Quick one-file fixes, trivial config changes.

**Shared assets:** Reads `AGENT_BACKLOG.md`, `orchestrator.json`. Appends to `events.log`. Does not acquire the lock.

---

### `/project-review` — Comprehensive project audit

**Use when:**
- You want a production-grade review of the entire project
- You need systematic analysis of code quality, architecture, security, UX, performance, docs
- You're onboarding or doing a fresh assessment
- You want structured findings with a prioritized roadmap (waves)

**Not for:** Quick code review of a PR (use `/review`), incremental planning (use `/plan`), ongoing coordination (use `/orchestrate`).

**Flags:** `--scope`, `--focus`, `--phase`

**Shared assets:** Reads `orchestrator.json`, `AGENT_BACKLOG.md`. Writes findings to `events.log`. Does not acquire the lock.

---

### `/discover` — Codebase inventory (read-only)

**Use when:**
- You need to understand the repo structure, tech stacks, build tools, CI, tests
- You're starting fresh or the codebase has changed significantly
- You want `AGENT_TEAMS.md` updated with team boundaries

**Shared assets:** Appends to `events.log`. Creates/updates `AGENT_TEAMS.md`.

---

### `/healthcheck` — Build, test, lint validation

**Use when:**
- You want to verify the project builds, tests pass, and lint is clean
- You're about to start work and need a baseline
- You've made changes and want to confirm nothing is broken

**Shared assets:** Appends to `events.log`. May update `orchestrator.json` health details.

---

### `/review` — Code review of changes

**Use when:**
- You're reviewing staged changes, a PR, or a commit range
- You want security, performance, correctness, and style checks
- You need a structured review before merging

**Not for:** Full project audit (use `/project-review`).

---

### `/sync-backlog` — Update AGENT_BACKLOG.md

**Use when:**
- You need to sync the backlog with GitHub Issues or project boards
- Discovery, healthcheck, or review has produced new findings to incorporate
- The orchestrator has completed a phase and backlog should reflect current state

**Shared assets:** Reads `orchestrator.json`, `events.log`. Writes `AGENT_BACKLOG.md`. Appends to `events.log`.

---

## Quick Decision Tree

| Situation | Command |
|-----------|---------|
| New session, full assessment | `/orchestrate` or `/orchestrate --assess-only` |
| Need a plan before coding | `/plan` |
| Full project audit / onboarding | `/project-review` |
| Understand repo structure | `/discover` |
| Verify build/test/lint | `/healthcheck` |
| Review a PR or commit range | `/review` |
| Update backlog from findings | `/sync-backlog` |
| End of session, hand off | `/handoff` |

---

## Shared State Files

| File | Purpose | Used by |
|------|---------|---------|
| `AGENT_BACKLOG.md` | Prioritized work items, team assignments | Orchestrator, Plan, Project-Review, Sync-Backlog, Team commands |
| `.claude/state/orchestrator.json` | Phase, team status, metrics, risks, todo items | Orchestrator, Plan, Project-Review, Handoff, Healthcheck |
| `.claude/state/events.log` | Audit trail of actions | All workflow commands |
| `.claude/state/orchestrator.lock` | Prevents concurrent orchestrator sessions | Orchestrator only |

Always read the latest `AGENT_BACKLOG.md` and `orchestrator.json` before starting work. Append to `events.log` when completing significant actions.
