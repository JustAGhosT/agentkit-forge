# PRD-001: AgentKit Forge LLM Decision Engine

## Status

Draft

## Module / Feature Name

Multi-LLM Agent Model Optimization and Routing in AgentKit Forge

## Marketing Name

AgentKit Forge LLM Decision Engine

## Platform / Mesh Layers

- Forge core orchestration layer (config and app mesh)
- Agent routing layer (agent and team to model mapping)
- AI provider integrations (OpenAI, Anthropic, Google, OSS)
- Cross-platform execution (API, CLI, overlays)

## Primary Personas

- DevOps Engineers
- Infrastructure and Platform Engineers
- Team Leads for code and test automation
- Product Engineers
- Core contributors and OSS adopters

## Core Value Proposition

Deliver optimal model selection per coding agent and team using a
configurable, metrics-driven engine that improves code quality,
productivity, and developer experience with minimal config overhead.

## Priority

P0 (Critical)

## License Tier

- Free: core routing and config matching logic
- Enterprise (future): custom mapping controls and audit extensions

## Readiness

Draft, prepared for review before spec and implementation.

## TL;DR

Build a developer-friendly decision engine that picks the best coding LLM
per agent or team using a configurable weighted matrix and an updatable
knowledge base (scorecards, quirks, features, rationale).

## Problem Statement

LLM options and versions are expanding quickly, each with different
trade-offs in quality, context length, speed, cost, and integration
behavior. Manual per-agent model selection is error-prone and does not
scale.

Without a reliable, updatable mapping system, teams suffer from:

- suboptimal output quality,
- wasted spend,
- configuration drift, and
- lower productivity.

## Core Challenge

Make model selection effortless and accurate for developers by matching
agents to the best-fit LLM for their stack and task while balancing:

- quality,
- cost,
- speed,
- reasoning depth,
- context window,
- compatibility and risk.

## Current State

- Teams hard-code model choices in config files.
- Newest or most popular models are chosen by default.
- Config surfaces fragment over time as tools expand.
- There is no central, trusted model knowledge base.

## Why Now

Model capability and pricing change rapidly. Automated selection is now a
competitive advantage for team productivity, governance, and cost control.

## Goals and Objectives

### Business Goals

- Streamline model routing and mapping for teams.
- Increase AgentKit Forge adoption.
- Improve output quality and delivery speed.
- Establish Forge as a mesh-native source of truth for model selection.

### User Goals

- Use best-fit models per agent with low manual overhead.
- Keep mappings up to date and avoid drift.
- Understand why each model was chosen.

### Non-Goals (Out of Scope)

- Universal LLM marketplace or benchmark hub.
- Full non-coding model ranking in v1.

## Measurable Objectives

| Objective | Baseline | Target | Timeline |
| --- | --- | --- | --- |
| Model-agent optimality | Manual | 90% mapped in 1 week | 1-2 sprints post-GA |
| Config update frequency | Low | +25% in v1 | 1 month |
| Code quality (lint/tests) | TBA | +10% | 1 quarter |

## Stakeholders

- Product Owner: Jurie
- Forge engineering team
- LLM integration leads
- DevOps and QA leads
- Early adopter maintainers

## User Personas and Stories

### DevOps Engineer

As a DevOps engineer, I want Forge to recommend and update models for
every coding agent, so pipelines use best-fit models with minimal manual
work.

Acceptance criteria:

- Config proposes a model per agent from stack and team metrics.
- Changes are trackable and reversible.

### Team Lead

As a team lead, I want to prioritize cost for regression suites and quality
for code review agents, with visible rationale.

Acceptance criteria:

- I can tune scoring weights per team and use case.
- The selected model includes a transparent rationale.

### Product Engineer

As a developer, I want confidence in what model an agent uses and why.

Acceptance criteria:

- Docs are clear and actionable.
- Config is editable and safe to change.
- Gotchas and warnings are visible.

## Use Cases and Core Flows

### Primary Use Cases

- Default mapping on initial setup.
- Custom weighting by quality, cost, speed, and context.
- Seamless model switch during outages or upgrades.
- Scorecard review before accepting changes.
- Mapping audit and rollback.

### Core Flow

1. User runs -agentkit init-.
2. Forge detects stack, agents, and available models.
3. Forge proposes mappings with rationale and warnings.
4. User accepts or edits metric weights.
5. Mapping is committed in -.agentkit/spec-.
6. Runtime hooks route tasks by mapping.
7. Changes are auditable via overlay and git diff.

### Edge Cases

- Model unavailable: route to next best compatible model.
- Performance degradation: alert and recommend failover.
- New agents detected: propose default mapping.
- Fast model version churn: mark mappings stale for review.
- Missing data: show uncertainty and allow explicit override.

## Functional Requirements

- Maintain scorecards for supported coding models.
- Weighted decision matrix with configurable metric priorities.
- YAML or JSON mapping config for agent to model assignment.
- CLI support for map and scorecard workflows.
- Knowledge base support for features, quirks, and rationale.
- Audit trail for mapping decisions and model switches.

### Scoring Inputs (Default Weights)

- Code generation quality: 5
- Reasoning ability: 4
- Context window: 3
- Cost per 1k tokens: 3
- Speed and throughput: 2
- Compatibility, lock-in, quirks: 1 each

## Non-Functional Requirements

- Config load and reload under 1 second.
- Support 50+ agents per project.
- Safe edit controls for mapping changes.
- Non-blocking fallback if data feeds fail.
- Full change history with rationale.

## Mesh Layer Mapping

| Forge Layer | Role |
| --- | --- |
| Config Mapping Layer | Stores and loads agent-model specs |
| Orchestration Layer | Routes tasks by mapping at runtime |
| Docs and Overlay Layer | Surfaces scorecards and warnings |

## APIs and Integrations

### Required APIs

- Internal config API for reading and writing mapping files.
- CLI commands for mapping and scorecards.
- Model metadata endpoints for latest capability and cost data.

### External Dependencies

- LLM providers (OpenAI, Anthropic, Google, OSS)
- Benchmark or scoring data feeds
- Code quality analysis plugins

## Data Model Example

```yaml
agents:
  - name: codebot
    llm: claude-3
    rationale: Best for code generation and large context tasks.
    weights:
      quality: 5
      cost: 3
      speed: 2
      context: 3
      quirks: 1
    audit_trail:
      - version: v1.2
        changed_by: jurie
        date: 2024-06-12
```

## UX and Entry Points

- CLI: -agentkit init-, -agentkit llm map-, -agentkit llm scorecard-
- Documentation: -docs/LLMs.md- and PRD references
- Overlay and UI support planned in v2+

## Accessibility

- Plaintext-first documentation output
- Colorblind-friendly scorecard tables
- WCAG 2.1 AA alignment where applicable

## Success Metrics

### Leading Indicators

- Default proposal acceptance rate
- Custom mapping frequency
- Time to first optimal mapping

### Lagging Indicators

- Lint and test quality improvements
- Average model cost per task
- Developer satisfaction and NPS
- Reduction in config-related support tickets

## Measurement Plan

- CLI event logs and mapping commit stats
- Quality and cost telemetry via plugins
- Dashboards for adoption, drift, and issue trends
- Review cadence: biweekly and quarterly

## Timeline and Milestones

| Phase | Scope | Target |
| --- | --- | --- |
| v1 | Scorecards, static config, docs | +4 weeks |
| v2 | Dynamic mapping, feedback loop, optional UI | +8 weeks |
| v3+ | Marketplace and expanded benchmarks | Q4+ |

## Constraints and Dependencies

### Technical Constraints

- API rate limits and provider availability
- YAML and JSON parser reliability
- Token and context behavior variability
- Data caching and refresh behavior

### Business Constraints

- FOSS core must remain viable
- Zero-config onboarding must remain available
- Benchmark update budget required

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| LLM churn and instability | Medium | High | Automated scorecard refresh loops |
| Stale metrics | High | Medium | Scheduled review and manual override |
| Team weight misalignment | Medium | Medium | Editable weights and rationale docs |
| Vendor lock-in | High | Low | Polyglot support and fallback routing |

## Open Questions

| Question | Owner | Target Resolution | Impact if Unresolved |
| --- | --- | --- | --- |
| How should scorecards auto-refresh? | Product Lead | v1-v2 planning | Lower trust in recommendations |
| Are stack-specific biases material? | Engineering Lead | v2 | Suboptimal model choices |

## Appendix

### Competitive Positioning

| Product | Centralized Mapping | Coding Scorecards | Drift Detection | Gotcha Docs |
| --- | --- | --- | --- | --- |
| AgentKit Forge | Yes | Yes | Planned | Yes |
| LangChain | No | Partial | No | No |
| OSS Agent Bundles | No | No | No | No |
| Enterprise RAG Platforms | Yes | Partial | Yes | Partial |

### Example Coding Scorecard Snapshot

| Model | Code Quality | Reasoning | Context | Cost | Speed | Compatibility | Quirks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GPT-4o | 9.5 | 9.3 | 128K | $$ | 9.2 | High | Rate-limit spikes |
| Claude 3 Opus | 9.7 | 9.0 | 200K | $$$ | 8.5 | High | Very verbose near high context |
| Gemini Ultra | 8.7 | 8.6 | 32K | $$ | 8.9 | Medium | API quota constraints |
| OSS Code LLaMA | 8.0 | 7.8 | 16K | Free | 8.5 | Medium | Endpoint and hallucination tuning |

### Recommendations

- Keep scorecards current and coding-focused.
- Document switching criteria with rationale.
- Track gotchas for defaults and fallback behavior.
- Maintain compact SWOT snapshots for major model families.
