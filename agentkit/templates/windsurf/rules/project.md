# Project Context

This repository uses the AgentKit Forge unified agent team framework.

## Key References
- UNIFIED_AGENT_TEAMS.md — Team definitions and workflow
- AGENT_TEAMS.md — Repo-specific team mapping
- AGENT_BACKLOG.md — Current work items

## Workflow
1. /discover — Scan codebase structure and conventions
2. /healthcheck — Validate build and test readiness
3. /plan — Create implementation plan with clear acceptance criteria
4. /check — Run quality gates (lint, test, build)
5. /review — Code review against team standards

## Non-negotiables
- Prefer small, reversible changes
- Keep builds and tests green at all times
- Never touch secrets or .env files
- Always include validation commands in task summaries
- Reference UNIFIED_AGENT_TEAMS.md for team assignments and escalation paths
