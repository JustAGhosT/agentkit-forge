# {{repoName}} — Claude Code Instructions

## Project Overview

This repository uses **AgentKit Forge** to manage AI agent team workflows across multiple tools (Claude Code, Cursor, Windsurf, Copilot, Continue).

- **Repository**: {{repoName}}
- **Default Branch**: {{defaultBranch}}
- **Framework Version**: {{version}}

## Quick Reference

| Command | Purpose |
|---------|---------|
| `/orchestrate` | Master coordinator — assess, plan, delegate |
| `/discover` | Scan codebase, detect tech stacks |
| `/healthcheck` | Pre-flight validation |
| `/review` | Code review with quality gates |
| `/check` | Universal quality gate (lint + test + build) |
| `/plan` | Structured planning before implementation |
| `/build` | Build project (auto-detects stack) |
| `/test` | Run tests (auto-detects stack) |
| `/format` | Format code (auto-detects stack) |
| `/deploy` | Deployment automation |
| `/security` | Security audit |
| `/sync-backlog` | Update AGENT_BACKLOG.md |
| `/handoff` | Session handoff summary |

## Team Commands

| Command | Team | Focus |
|---------|------|-------|
| `/team-backend` | Backend (T1) | API, services, core logic |
| `/team-frontend` | Frontend (T2) | UI, components, PWA |
| `/team-data` | Data (T3) | DB, models, migrations |
| `/team-infra` | Infrastructure (T4) | IaC, cloud resources |
| `/team-devops` | DevOps (T5) | CI/CD, containers |
| `/team-testing` | Testing (T6) | Quality, coverage |
| `/team-security` | Security (T7) | Auth, compliance |
| `/team-docs` | Documentation (T8) | Docs, guides |
| `/team-product` | Product (T9) | Features, PRDs |
| `/team-quality` | Quality (T10) | Review, refactor |

## Workflow

### 5-Phase Lifecycle

1. **Discovery** — Understand requirements, scan codebase (`/discover`)
2. **Planning** — Design solution, create ADRs (`/plan`)
3. **Implementation** — Write code, add tests (team commands)
4. **Validation** — Verify quality, run gates (`/check`, `/review`)
5. **Ship** — Deploy, document, hand off (`/deploy`, `/handoff`)

### Standard Session Flow

```
/orchestrate --assess     → Understand current state
/plan                     → Design implementation
/team-<name>              → Execute with appropriate team
/check                    → Verify quality gates
/review                   → Code review
/handoff                  → Document session for continuity
```

## Architecture

- **Agents**: `.claude/agents/` — Specialized AI agents by category
- **Commands**: `.claude/commands/` — Slash command definitions
- **Rules**: `.claude/rules/` — Domain-specific coding rules
- **Hooks**: `.claude/hooks/` — Lifecycle hooks (session-start, protect-sensitive, etc.)
- **State**: `.claude/state/` — Orchestrator state and session tracking

## Documentation

All project documentation follows the unified 8-category structure in `docs/`:

| Category | Purpose |
|----------|---------|
| `01_product/` | Product requirements, user stories, roadmap |
| `02_specs/` | Functional and technical specifications |
| `03_architecture/` | System design, diagrams, ADRs |
| `04_api/` | API reference, authentication, examples |
| `05_operations/` | Deployment, monitoring, incident response |
| `06_engineering/` | Setup, coding standards, testing |
| `07_integrations/` | External APIs, webhooks, SDK |
| `08_reference/` | Glossary, FAQ, changelog, contributing |

## Safety Rules

1. **Never** commit secrets, API keys, or credentials
2. **Never** force-push to main/master
3. **Never** run destructive commands without confirmation
4. **Always** run `/check` before creating a PR
5. **Always** document breaking changes in ADRs
6. **Always** write tests for new functionality

## References

- [UNIFIED_AGENT_TEAMS.md](./UNIFIED_AGENT_TEAMS.md) — Full team specification
- [AGENT_BACKLOG.md](./AGENT_BACKLOG.md) — Current backlog
- [QUALITY_GATES.md](./QUALITY_GATES.md) — Definition of done per phase
- [RUNBOOK_AI.md](./RUNBOOK_AI.md) — Recovery procedures
