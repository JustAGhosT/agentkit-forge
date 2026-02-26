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

## Category

{{agentCategory}}

## Focus Areas

{{agentFocusList}}

## Responsibilities

{{agentResponsibilitiesList}}

## Preferred Tools

{{agentToolsList}}

{{#if hasAgentDomainRules}}

## Domain Rules

{{agentDomainRules}}
{{/if}}

{{#if hasAgentConventions}}

## Conventions

{{agentConventions}}
{{/if}}

{{#if hasAgentExamples}}

## Examples

{{agentExamples}}
{{/if}}

{{#if hasAgentAntiPatterns}}

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
