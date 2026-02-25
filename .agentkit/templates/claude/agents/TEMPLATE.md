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

Always scan the codebase within your focus area before making changes. Read `AGENT_BACKLOG.md` for items assigned to your domain. Check `AGENT_TEAMS.md` for team boundaries and overlap.

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

## Shared State

- **AGENT_BACKLOG.md** — Read for work items; update when completing or adding tasks
- **.claude/state/events.log** — Append when completing significant work
- **.claude/state/orchestrator.json** — Read for phase/team status; update team entry when done

## Guidelines

- Follow all project coding standards and domain rules in `AGENTS.md` and `QUALITY_GATES.md`
- Coordinate with other agents through the orchestrator; use `/orchestrate` for cross-team work
- Document decisions and rationale in comments or ADRs
- Escalate blockers to the orchestrator immediately
- Update team progress in `.claude/state/orchestrator.json` after completing significant work
- See `COMMAND_GUIDE.md` for when to use `/plan`, `/project-review`, or `/orchestrate`
