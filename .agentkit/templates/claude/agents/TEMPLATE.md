# {{agentName}}

## Role

{{agentRole}}

## Repository Context

{{#if stackLanguages}}- **Tech stack:** {{stackLanguages}}{{/if}}
{{#if stackFrontendFrameworks}}- **Frontend:** {{stackFrontendFrameworks}}{{/if}}
{{#if stackBackendFrameworks}}- **Backend:** {{stackBackendFrameworks}}{{/if}}
{{#if stackDatabase}}- **Database:** {{stackDatabase}}{{/if}}
{{#if architecturePattern}}- **Architecture:** {{architecturePattern}}{{/if}}
{{#if defaultBranch}}- **Default branch:** {{defaultBranch}}{{/if}}

Always scan the codebase within your focus area before making changes.

## Shared State

- **`AGENT_BACKLOG.md`** — Read for existing items; update when completing or
  adding tasks in your scope.
- **`AGENT_TEAMS.md`** — Read for team boundaries and ownership.
- **`.claude/state/events.log`** — Append findings and significant work updates.
- **`.claude/state/orchestrator.json`** — Read for project context; update your
  team status entry after meaningful progress.
- **Do NOT** acquire `.claude/state/orchestrator.lock` — the orchestrator owns
  the lock.

### Concurrency Controls

Shared files are accessed by multiple agents. To prevent race conditions:

1. **Per-resource file locks**: Use `.lock` files with atomic file creation (O_EXCL or equivalent) for writes
2. **Orchestrator-mediated updates**: For critical state changes, route through orchestrator API
3. **Append-only operations**: Use line-based newline-terminated appends for events.log
4. **Lock ownership**: orchestrator.lock remains solely owned by the orchestrator

**Lock Acquisition Protocol:**
- Attempt atomic creation of `.lock` file with 30s timeout
- Retry every 1s up to 3 attempts with exponential backoff
- Treat locks older than 5 minutes as stale (log and remove before retry)
- Always release locks in a finally block
- On repeated failure, escalate to orchestrator via `/orchestrate` endpoint

**Special Cases:**
- `orchestrator.lock` remains exclusively owned by orchestrator
- Append-only `events.log` writes should still acquire lock before appending

Protocol: Acquire lock → modify → release lock in finally. Never write directly without coordination.

## Category

{{agentCategory}}

## Focus Areas

{{agentFocusList}}

## Responsibilities

{{agentResponsibilitiesList}}

## Preferred Tools

{{agentToolsList}}

{{#if agentDomainRules}}

## Domain Rules

{{agentDomainRules}}
{{/if}}

{{#if agentConventions}}

## Conventions

{{agentConventions}}
{{/if}}

{{#if agentExamples}}

## Examples

{{agentExamples}}
{{/if}}

{{#if agentAntiPatterns}}

## Anti-Patterns

{{agentAntiPatterns}}
{{/if}}

## Guidelines

- Follow all project coding standards and domain rules in `AGENTS.md` and `QUALITY_GATES.md`
- Coordinate with other agents through the orchestrator; use `/orchestrate` for cross-team work
- Document decisions and rationale in comments or ADRs
- Escalate blockers to the orchestrator immediately
- Update team progress in `.claude/state/orchestrator.json` after completing significant work
- See `COMMAND_GUIDE.md` for when to use `/plan`, `/project-review`, or `/orchestrate`
