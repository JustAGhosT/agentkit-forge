# PRD-002: AgentKit Forge LLM Selection and Scorecard Guide

## Status

Draft

## Module / Feature Name

AgentKit Forge LLM Model Selection and Scorecard System

## Marketing Name

AgentKit Forge Model Scorecard and Recommender

## Platform / Mesh Layers

- AgentKit Forge orchestration layer
- Agent execution layer
- Model selection engine
- Reporting and telemetry layer

## Primary Personas

- AI and ML engineers integrating coding agents
- Developer platform product managers
- CTOs and engineering managers optimizing cost and performance
- Power users orchestrating custom agent stacks

## Core Value Proposition

Provide a transparent and data-driven system for selecting and configuring
optimal LLMs per coding agent workflow, maximizing quality, speed, and
cost-efficiency.

## Priority

P0 (Critical)

## License Tier

Pro and Enterprise

## Business Outcomes and Success Metrics

- Coding-agent latency reduction of at least 20%
- Code acceptance rate increase of 15%
- Lower API cost per build minute
- Model-mapping feature adoption above 70% among active teams

## Integration Points

- AgentKit Forge model mapping config (YAML and JSON)
- Agent execution APIs
- Reporting and analytics dashboards
- Third-party LLM endpoints

## TL;DR

The scorecard and recommender system gives teams practical model comparisons,
weighted decision logic, and configurable mappings so they can select the
right model per coding agent and continuously adapt as providers change.

## Problem Statement

LLM offerings evolve rapidly and vary widely in coding capability, pricing,
latency, and reliability. Teams struggle to maintain optimal mappings over
time. Suboptimal choices reduce velocity and increase spend.

## Core Challenge

Map each agent type and team context to the best model while balancing:

- code quality,
- reasoning quality,
- context capacity,
- latency,
- cost,
- vendor and integration risk.

## Current State

- Teams rely on defaults or outdated benchmarks.
- Model switching is manual and weakly documented.
- Scorecard data is often fragmented across tools.
- Reliability and quality vary between repos and teams.

## Why Now

Major model families are updated frequently. Teams need stable governance and
faster adaptation loops to stay competitive on delivery speed and cost.

## Goals and Objectives

### Business Goals

- Make Forge the leading mesh-native platform for coding-agent orchestration.
- Reduce customer model-operation cost by 20% in 12 months.
- Increase enterprise adoption through transparent model comparisons.

### User Goals

- Understand practical model trade-offs for coding use cases.
- Reassign agents to better models with low effort.
- Improve predictability in agent-driven pipelines.

### Non-Goals

- Non-coding LLM recommendation coverage in v1.
- Full support for private non-API models.
- Fine-tuned model recommendation outside supported families.

## Measurable Objectives

| Metric                   | Baseline | Target | Timeline |
| ------------------------ | -------- | ------ | -------- |
| Agent latency reduction  | N/A      | -20%   | 3 months |
| Code acceptance rate     | 65%      | 80%    | 6 months |
| Model reassignment usage | <10%     | >70%   | 6 months |
| API cost per build       | $0.13    | <$0.10 | 6 months |

## Stakeholders

- Product Manager, AI Platform
- Lead ML Engineer
- Forge Integrations Lead
- Solutions Architect
- Support Lead

## User Personas and Stories

### ML Infra Engineer

Needs reliable recommendations and fast update cycles to optimize performance
and cost.

User story:

As an ML infra engineer, I want a dynamic scorecard so I can compare models
quickly for my coding workflows.

### Developer Team Lead

Needs to improve velocity and quality without manual model testing overhead.

User story:

As a team lead, I want to map bug-fixing agents to best-fit models so merge
throughput improves.

### Platform Admin

Needs policy control and visibility across many teams and projects.

User story:

As a platform admin, I want configurable global model preferences and team
overrides via YAML and JSON.

## Use Cases and Core Flows

### Primary Use Cases

- Compare scorecards across supported model families.
- Assign models by team and agent type.
- Tune metric weights and refresh recommendations.
- Audit mappings and detect drift.

### Primary User Flow

1. User opens scorecard dashboard or config file.
2. User reviews model recommendations by agent context.
3. User edits weights or accepts defaults.
4. Forge applies mapping to runtime orchestration.
5. Telemetry updates quality and cost trends.

### Edge Cases

- Endpoint unavailable: use fallback model from policy.
- New model release mid-sprint: prompt review, avoid forced switch.
- Model EOL: show warning and migration recommendation.

## Functional Requirements

- Keep scorecards updated for supported model families.
- Allow mapping override by agent and by team.
- Weighted scoring with configurable priorities.
- Runtime fallback for outages and deprecations.
- Read and write mapping APIs.
- Integration with reporting and telemetry.

## Non-Functional Requirements

- Scorecard freshness target: updates within 24 hours of major changes.
- Availability target: >99.9% for orchestration path.
- Secure access controls for mapping edits.
- Scale target: 500+ teams.

## Mesh Layer Mapping

| Layer         | Responsibility                                     |
| ------------- | -------------------------------------------------- |
| Orchestration | Scorecard refresh, assignment, fallback automation |
| Execution     | Runtime model invocation and call tracking         |
| Reporting     | Cost, quality, and drift analytics                 |

## APIs and Integrations

### Required APIs

- `/api/forge/models/list`
- `/api/forge/agents/assign`
- `/api/forge/scorecards/get`

### External Dependencies

- Hosted LLM vendors
- Usage and cost telemetry APIs
- Internal quality and reporting plugins

## Data Models

- ModelScorecard: metrics and traits per model
- AgentAssignment: model mapping plus weights per agent and team
- PerformanceSnapshot: historical outcomes per mapping

## UX and Entry Points

### Onboarding Flow

1. Prompt user to review scorecards during agent setup.
2. Provide guided mapping wizard with sample configs.
3. Offer auto-update mode or manual override mode.

### Primary UX Flows

- Dashboard for side-by-side model comparison.
- YAML and JSON editor with inline validation.
- Clear error messaging for deprecated or unreachable models.

## Accessibility

- WCAG 2.1 AA targets
- Keyboard navigation support
- Screen reader compatibility
- Sufficient color contrast for scorecard visuals

## Success Metrics

### Leading Indicators

- Custom mapping adoption rate
- Scorecard page views and dwell time
- Fallback events resolved successfully
- Post-release mapping update frequency

### Lagging Indicators

- Long-term velocity improvements
- Sustained API cost reduction
- Increased PR acceptance rates from agent contributions

## Measurement Plan

- Track telemetry in Forge analytics storage.
- Publish monthly KPI summaries.
- Alert weekly on drift and fallback spikes.

## Timeline and Milestones

| Phase             | Status      | Dates    | Scope                               | Dependencies                |
| ----------------- | ----------- | -------- | ----------------------------------- | --------------------------- |
| Scorecard launch  | Complete    | Apr 2024 | Model families, dashboard, config   | Model and telemetry data    |
| Mapping API       | Complete    | May 2024 | Read and write APIs, fallback logic | Backend and security review |
| Analytics rollout | Complete    | Jun 2024 | KPI tracking and alerting           | BI integration              |
| Ongoing updates   | In Progress | Monthly  | Continuous scorecard refresh        | Vendor feeds                |

## Constraints and Dependencies

### Technical Constraints

- Token and context differences across models
- Provider-specific rate limits
- Region restrictions for selected models

### Business Constraints

- Vendor SLA variability
- Budget controls for premium model usage
- Limited support for unsupported private model stacks

## Risks and Mitigations

| Risk                        | Impact | Probability | Mitigation                          |
| --------------------------- | ------ | ----------- | ----------------------------------- |
| Hallucination on code tasks | High   | Medium      | Re-score models and gate beta usage |
| Version drift               | Medium | High        | Alerting and rapid refresh cycles   |
| Rate limit or cost spikes   | Medium | Low         | Fallback and budget guardrails      |
| Plugin incompatibility      | Low    | Medium      | Compatibility matrix and docs       |

## Open Questions

| Question                                        | Owner           | Target Date | Resolution | Impact if Unresolved       |
| ----------------------------------------------- | --------------- | ----------- | ---------- | -------------------------- |
| Can custom fine-tuned models be plug-and-play?  | Product Manager | Jul 2024    | Deferred   | Lower extensibility        |
| Will vendors provide early deprecation signals? | ML Engineer     | Jun 2024    | Resolved   | Unexpected fallback events |
| What telemetry granularity is sufficient?       | BI Analyst      | May 2024    | Resolved   | Lower metric confidence    |

## Appendix

## How to Use This Guide

Use this guide with Forge automated mapping defaults. Keep agent-model config
files updated as team priorities change. Reassess weights quarterly.

## General Model Selection Principles (Coding)

Prioritize:

- code generation quality,
- reasoning depth,
- context support,
- latency,
- cost,
- compatibility.

Quality usually dominates, but high-throughput teams may shift weight toward
cost and latency for selected agents.

## Model Family Highlights

### Claude (Anthropic)

- Strong long-context coding performance
- Safety-oriented behavior
- Tends toward conservative or verbose outputs

### GPT (OpenAI)

- Strong baseline coding and reasoning performance
- Broad plugin and tool compatibility
- Fast family iteration can introduce drift

### Gemini (Google)

- Competitive multilingual coding support
- Good cloud ecosystem integration
- API behavior may shift across versions

### Kimi, Minimax, GLM

- Often cost-efficient in specific regions
- Useful for multilingual or regional deployments
- Watch API, compliance, and rate-limit specifics

### Grok, SWE, o3

- Useful for experimentation and open workflows
- Strong innovation pace
- Maturity and enterprise support vary

## Example Scorecard (Coding Context)

> **Note:** This scorecard provides a baseline reference. Detailed weighted scores for each team are in PRD-003.

| Model           | Code | Reasoning | Context        | Speed  | Cost | Compatibility | Notes                                             |
| --------------- | ---- | --------- | -------------- | ------ | ---- | ------------- | ------------------------------------------------- |
| Claude Opus 4.6 | 5.0  | 4.5       | 200K (1M beta) | Medium | $$$  | Native        | Conservative in speculative code                  |
| GPT-4o          | 5.0  | 5.0       | 128K           | High   | $$$  | Full          | Stable baseline snapshot                          |
| Gemini 1.5 Pro  | 4.7  | 4.7       | 1M             | High   | $$   | Beta          | Upgradeable context, structured output edge cases |
| Kimi-Plus       | 4.1  | 4.3       | 128K           | High   | $    | Partial       | Regional latency variance                         |
| Grok-3          | 3.9  | 4.1       | 128K           | Medium | $    | Experimental  | Rapid iteration behavior                          |

## Agent Mapping Example

```yaml
agents:
  - name: bug_fixer
    model: gpt-4o
    weights:
      code_quality: 0.5
      reasoning: 0.3
      context: 0.1
      cost: 0.1
  - name: doc_generator
    model: gemini-1.5-pro
    weights:
      code_quality: 0.4
      context: 0.4
      cost: 0.1
      speed: 0.1
team_defaults:
  backend: claude-opus-4-6
  frontend: gpt-4o-mini
fallback_model: gpt-4o-mini
```

## Decision Matrix Mechanics

Forge calculates weighted scores per model and context. Defaults can be
overridden by admins per agent or team. If a model fails health checks or is
deprecated, Forge routes to the next compatible score winner.

## Migration and Switching Guidance

- Plan upgrades with canary or shadow runs.
- Track version drift against invoked runtime models.
- Define fallback policy before major migrations.
- Re-run scorecard comparisons after provider pricing changes.

## Model Lore (Team-Friendly Trivia)

- Claude references Claude Shannon.
- GPT-4o uses -o- for -omni-.
- Grok comes from science fiction and means deep understanding.

Use scorecards as guidance, then tune by team outcome data.

## Appendix: IDE Model/Capability Matrix

### Cursor + Windsurf — Model/Capability Matrix

> **Note:** For Cursor, the screenshot source does not expose cost multipliers, context windows, max output, tool/vision support, or determinism knobs → marked TBD. For Windsurf, multipliers are from user-provided list + banner promos. Capability columns inferred from public model specs where available.

#### Cursor Models

| Model                          | Reasoning | Cost Tier | Cost Multiplier | Context Window | Max Output | Tool Use | Vision | Latency  | Reliability |
| ------------------------------ | --------- | --------- | --------------- | -------------- | ---------- | -------- | ------ | -------- | ----------- |
| Composer 1.5                   | TBD       | TBD       | TBD             | TBD            | TBD        | TBD      | TBD    | TBD      | TBD         |
| Opus 4.6                       | Y         | TBD       | TBD             | 200K (1M beta) | 128K       | Yes      | Yes    | Standard | High        |
| Sonnet 4.6                     | Y         | TBD       | TBD             | 200K (1M beta) | 128K       | Yes      | Yes    | Standard | High        |
| GPT-5.3 Codex                  | TBD       | TBD       | TBD             | TBD            | TBD        | TBD      | TBD    | TBD      | TBD         |
| GPT-5.3 Codex Extra High       | TBD       | TBD       | TBD             | TBD            | TBD        | TBD      | TBD    | TBD      | TBD         |
| GPT-5.3 Codex Spark            | TBD       | TBD       | TBD             | TBD            | TBD        | TBD      | TBD    | TBD      | TBD         |
| GPT-5.3 Codex Spark Extra High | TBD       | TBD       | TBD             | TBD            | TBD        | TBD      | TBD    | TBD      | TBD         |
| GPT-5.2                        | TBD       | TBD       | TBD             | TBD            | TBD        | TBD      | TBD    | TBD      | TBD         |

#### Windsurf Models

| Model                             | Reasoning | Cost Tier | Cost Multiplier | Context Window | Max Output | Tool Use | Vision | Latency  | Reliability |
| --------------------------------- | --------- | --------- | --------------- | -------------- | ---------- | -------- | ------ | -------- | ----------- |
| Claude Opus 4.6                   | Y         | Paid      | 6               | 200K (1M beta) | 128K       | Yes      | Yes    | Standard | High        |
| Claude Sonnet 4.6 (No thinking)   | N         | Paid      | 2               | 200K (1M beta) | 128K       | Yes      | Yes    | Standard | High        |
| Claude Sonnet 4.6 (With thinking) | Y         | Paid      | 3               | 200K (1M beta) | 128K       | Yes      | Yes    | Standard | High        |
| GPT-5-Codex                       | N/?       | Paid      | 0.5             | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| GPT-5.1                           | N/?       | Paid      | 0.5             | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| GPT-5.1 Fast                      | N/?       | Paid      | 1               | 200K           | ~100K      | Yes      | Yes    | Fast     | High        |
| GPT-5.1 High Thinking             | Y         | Paid      | 2               | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| GPT-5.1 High Thinking Fast        | Y         | Paid      | 4               | 200K           | ~100K      | Yes      | Yes    | Fast     | High        |
| GPT-5.1 Low Thinking              | Y         | Paid      | 0.5             | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| GPT-5.1 Low Thinking Fast         | Y         | Paid      | 1               | 200K           | ~100K      | Yes      | Yes    | Fast     | High        |
| GPT-5.1 Medium Thinking Fast      | Y         | Paid      | 2               | 200K           | ~100K      | Yes      | Yes    | Fast     | High        |
| GPT-5.1-Codex                     | N/?       | Free      | 0               | 200K           | ~100K      | Yes      | Yes    | Standard | Medium      |
| GPT-5.1-Codex Low                 | N/?       | Free      | 0               | 200K           | ~100K      | Yes      | Yes    | Standard | Medium      |
| GPT-5.1-Codex Max High            | N/?       | Paid      | 1               | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| GPT-5.1-Codex Max Medium          | N/?       | Paid      | 0.5             | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| GPT-5.1-Codex Max Low             | N/?       | Free      | 0               | 200K           | ~100K      | Yes      | Yes    | Standard | Medium      |
| GPT-5.1-Codex-Mini                | N/?       | Free      | 0               | 200K           | ~100K      | Yes      | Yes    | Standard | Medium      |
| GPT-5.1-Codex-Mini Low            | N/?       | Free      | 0               | 200K           | ~100K      | Yes      | Yes    | Standard | Medium      |
| GPT-5.2                           | N/?       | Paid      | 1               | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| GPT-5.2 Fast                      | N/?       | Paid      | 2               | 200K           | ~100K      | Yes      | Yes    | Fast     | High        |
| GPT-5.2 Low Thinking              | Y         | Paid      | 1               | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| GPT-5.2 Low Thinking Fast         | Y         | Paid      | 2               | 200K           | ~100K      | Yes      | Yes    | Fast     | High        |
| GPT-5.2 Medium Thinking           | Y         | Paid      | 2               | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| GPT-5.2 Medium Thinking Fast      | Y         | Paid      | 4               | 200K           | ~100K      | Yes      | Yes    | Fast     | High        |
| GPT-5.2 High Thinking             | Y         | Paid      | 8               | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| GPT-5.2 High Thinking Fast        | Y         | Paid      | 6               | 200K           | ~100K      | Yes      | Yes    | Fast     | High        |
| GPT-5.2 XHigh Thinking            | Y         | Paid      | 8               | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| GPT-5.2 XHigh Thinking Fast       | Y         | Paid      | 16              | 200K           | ~100K      | Yes      | Yes    | Fast     | High        |
| GPT-5.2-Codex Low                 | N/?       | Paid      | 1               | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| GPT-5.2-Codex Low Fast            | N/?       | Paid      | 2               | 200K           | ~100K      | Yes      | Yes    | Fast     | High        |
| GPT-5.2-Codex High                | N/?       | Paid      | 2               | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| GPT-5.2-Codex High Fast           | N/?       | Paid      | 4               | 200K           | ~100K      | Yes      | Yes    | Fast     | High        |
| GPT-5.2-Codex Medium              | N/?       | Paid      | 1               | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| GPT-5.2-Codex Medium Fast         | N/?       | Paid      | 2               | 200K           | ~100K      | Yes      | Yes    | Fast     | High        |
| GPT-5.2-Codex XHigh               | N/?       | Paid      | 3               | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| GPT-5.2-Codex XHigh Fast          | N/?       | Paid      | 6               | 200K           | ~100K      | Yes      | Yes    | Fast     | High        |
| GPT-5.3-Codex Low                 | N/?       | Paid      | 1.5             | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| GPT-5.3-Codex Low Fast            | N/?       | Paid      | 3               | 200K           | ~100K      | Yes      | Yes    | Fast     | High        |
| GPT-5.3-Codex Medium              | N/?       | Paid      | 2               | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| GPT-5.3-Codex Medium Fast         | N/?       | Paid      | 4               | 200K           | ~100K      | Yes      | Yes    | Fast     | High        |
| GPT-5.3-Codex High                | N/?       | Paid      | 2.5             | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| GPT-5.3-Codex High Fast           | N/?       | Paid      | 5               | 200K           | ~100K      | Yes      | Yes    | Fast     | High        |
| GPT-5.3-Codex X-High              | N/?       | Paid      | 8               | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| GPT-5.3-Codex XHigh Fast          | N/?       | Paid      | 6               | 200K           | ~100K      | Yes      | Yes    | Fast     | High        |
| o3                                | Y/?       | Paid      | 1               | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| o3 High Reasoning                 | Y         | Paid      | 1               | 200K           | ~100K      | Yes      | Yes    | Standard | High        |
| Gemini 3 Flash High               | Y/?       | Paid      | 1.75            | TBD            | TBD        | Yes      | Yes    | Fast     | Medium      |
| Gemini 3 Pro High Thinking        | Y         | Paid      | 2               | TBD            | TBD        | Yes      | Yes    | Standard | Medium      |
| Gemini 3.1 Pro High Thinking      | Y         | Paid      | 1               | TBD            | TBD        | Yes      | Yes    | Standard | Medium      |
| SWE-1.5                           | ?         | Free      | 0               | TBD            | TBD        | Yes      | Yes    | Fast     | Medium      |
| SWE-1.5 Fast                      | ?         | Paid      | 0.5             | TBD            | TBD        | Yes      | Yes    | Fast     | High        |
| GLM 4.7 (Beta)                    | ?         | Paid      | 0.25            | TBD            | TBD        | TBD      | TBD    | TBD      | Low         |
| GLM-5 (New)                       | ?         | Paid      | 1.5             | TBD            | TBD        | TBD      | TBD    | TBD      | Medium      |
| DeepSeek Chat (V3.2 non-thinking) | N         | Paid      | TBD             | 128K           | TBD        | Yes      | TBD    | TBD      | TBD         |
| DeepSeek Reasoner (V3.2 thinking) | Y         | Paid      | TBD             | 128K           | TBD        | Yes      | TBD    | TBD      | TBD         |
| Codestral 25.08                   | ?         | Paid      | TBD             | TBD            | TBD        | Yes      | TBD    | TBD      | TBD         |
| Llama 4 Scout                     | ?         | ?         | TBD             | TBD            | TBD        | TBD      | Yes    | TBD      | TBD         |
| Cohere Command A                  | ?         | Paid      | TBD             | TBD            | TBD        | Yes      | TBD    | TBD      | TBD         |
| Amazon Nova Pro                   | ?         | Paid      | TBD             | TBD            | TBD        | TBD      | Yes    | TBD      | TBD         |
| IBM Granite 4.0 (Instruct)        | ?         | ?         | TBD             | TBD            | TBD        | Yes      | TBD    | TBD      | TBD         |
| Minimax M2.1 (Beta)               | ?         | Paid      | 0.5             | TBD            | TBD        | TBD      | TBD    | TBD      | Low         |
| Minimax M2.5 (New)                | ?         | Paid      | 0.25            | TBD            | TBD        | TBD      | TBD    | TBD      | Medium      |
| Grok-3                            | ?         | Paid      | 1               | 131K           | 32K        | Yes      | Yes    | Standard | Medium      |
| Grok Code Fast 1                  | ?         | Free      | 0               | 131K           | 32K        | Yes      | Yes    | Fast     | Medium      |
| GPT-OSS 120B Medium Thinking      | Y         | Paid      | 0.25            | 32K            | 8K         | Partial  | No     | Standard | Low         |
| Kimi K2                           | ?         | Paid      | 0.5             | 128K           | 32K        | Yes      | Yes    | Standard | Medium      |
| Kimi K2.5 (New)                   | ?         | Paid      | 1               | 128K           | 32K        | Yes      | Yes    | Standard | Medium      |

### Notes

- **Cost multiplier normalization:** Free is stored as 0 in the multiplier column for arithmetic convenience.
- **Claude Sonnet 4.6 promo:** Represented as two rows to make the multiplier unambiguous (No thinking vs With thinking).
- **Minimax M2.5 promo:** Set to 0.25x as per banner (overrides earlier 1x).
- **Gemini 3 / GLM intake (2026-02-26):** Added from current IDE model-picker snapshot. Capability columns remain TBD until validated against provider docs and internal benchmarks.
- **GLM-5 update:** `GLM-5 (New)` now uses 1.5x multiplier in this matrix.
- **DeepSeek intake (2026-02-26):** Added `DeepSeek Chat (V3.2 non-thinking)` and `DeepSeek Reasoner (V3.2 thinking)` from DeepSeek API docs. Source quality: Fetched, vendor claim. Cost multiplier, latency, reliability, and max output remain TBD pending independent benchmark replication.
- **Mistral/Llama/Cohere/Nova/Granite intake (2026-02-26):** Added representative intake rows (`Codestral 25.08`, `Llama 4 Scout`, `Cohere Command A`, `Amazon Nova Pro`, `IBM Granite 4.0 (Instruct)`) from provider/model-card documentation. Source quality: Fetched, vendor claim. Weighted scoring remains blocked pending independent benchmark replication and normalized pricing.
- **Context Window:** Claude 4.6 models support 1M token context in beta (200K standard). GPT-5.x models typically support 200K.
- **Max Output:** Claude 4.6 = 128K tokens. GPT-5.x = ~100K tokens (varies by tier).
- **Tool Use:** Codex models are optimized for coding + tool use. Standard GPT models have tool use capability.
- **Reliability:** High = production-ready, stable. Medium = some limitations. Low = experimental/beta.

### Best For Guidance

| Model Family            | Best For                                          |
| ----------------------- | ------------------------------------------------- |
| Claude Opus 4.6         | Complex refactoring, architecture, deep reasoning |
| Claude Sonnet 4.6       | Balanced coding tasks, general purpose            |
| GPT-5.2/5.3 Codex       | Agentic coding, terminal use, long-running tasks  |
| GPT-5.x Thinking (High) | Complex reasoning, debugging, architecture        |
| GPT-5.x Thinking (Low)  | Quick reasoning tasks, cost-sensitive             |
| SWE-1.5                 | Fast agentic coding, free tier usage              |
| Grok Code Fast          | Quick code generation, free tier                  |
| GLM-5 / Minimax         | Cost-sensitive, multilingual workloads            |
