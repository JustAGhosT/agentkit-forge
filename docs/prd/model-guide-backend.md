# Model Guide: BACKEND Team

## Team Profile

| Attribute     | Value                                                           |
| ------------- | --------------------------------------------------------------- |
| Focus         | API, services, core logic                                       |
| Scope         | `apps/api/**`, `services/**`, `src/server/**`, `controllers/**` |
| Handoff Chain | testing, docs                                                   |

## Weighting Profile

These are the operational backend weights used by the decision engine.

| Metric        | Weight | Rationale                                  |
| ------------- | ------ | ------------------------------------------ |
| Code Quality  | 30%    | Backend correctness and maintainability    |
| Reasoning     | 25%    | Business logic and architecture trade-offs |
| Cost          | 10%    | Cost matters but is not primary            |
| Context       | 25%    | Large services require broad context       |
| Speed         | 5%     | Throughput is secondary to correctness     |
| Compatibility | 5%     | Standard tooling and provider fit          |

## Scoring Contract

- Metric scale: `0-10` where `10` is best.
- Weight sum must equal `100`.
- Formula:

`Weighted Score = (Code*30 + Reasoning*25 + Cost*10 + Context*25 + Speed*5 + Compatibility*5) / 100`

- Optional policy penalties:
  - `lock_in_penalty`: `0.00-0.20`
  - `quirks_penalty`: `0.00-0.15`
- Final score:

`Final Score = max(0, Weighted Score - lock_in_penalty - quirks_penalty)`

- Tie-break order:
  1. Higher Compatibility
  2. Higher Cost score (lower real spend)
  3. Higher Speed

## Model Rankings (Final Scores)

### Tier 1: Recommended (Score >= 9.00)

| Model                 | Score | Key Strengths                       | Notes                                  |
| --------------------- | ----- | ----------------------------------- | -------------------------------------- |
| Claude Opus 4.6       | 9.10  | Top context, strong code generation | Best default for complex backend logic |
| GPT-5.3 Codex High    | 9.10  | High code quality, strong reasoning | Premium option; monitor rate limits    |
| GPT-5.2 High Thinking | 9.05  | Deep architecture reasoning         | Good capability/cost balance           |
| GPT-5.1 High Thinking | 9.00  | Reliable code generation            | Stable alternative                     |

### Tier 2: Strong Alternatives (Score 8.00-8.99)

| Model             | Score | Key Strengths                | Notes                          |
| ----------------- | ----- | ---------------------------- | ------------------------------ |
| Claude Sonnet 4.6 | 8.95  | Lower-cost Opus profile      | Good for routine backend work  |
| SWE-Llama         | 8.35  | Code and test specialization | Strong for test-heavy services |
| Gemini 2.5 Pro    | 8.05  | 1M context support           | Useful for large monorepos     |
| GLM-5             | 8.00  | Multilingual support         | Regional fallback option       |

### Tier 3: Cost-Aware (Score 7.00-7.99)

| Model              | Score | Key Strengths              | Notes                      |
| ------------------ | ----- | -------------------------- | -------------------------- |
| Minimax M2.5       | 7.25  | Lower cost profile         | APAC-friendly option       |
| o3                 | 7.20  | Low cost and stable output | Good for simple CRUD flows |
| Kimi K2.5          | 7.15  | Budget option              | Use for non-critical tasks |
| GPT-5.1-Codex-Mini | 7.10  | Low-cost Codex family      | Boilerplate-heavy work     |

### Tier 4: Experimental (Score < 7.00)

| Model        | Score | Key Strengths   | Notes                          |
| ------------ | ----- | --------------- | ------------------------------ |
| xAI Grok-3   | 6.60  | Fast iteration  | Use behind explicit guardrails |
| GPT-OSS 120B | TBD   | OSS portability | Requires internal validation   |

## Decision Policy

- Primary default: `Claude Opus 4.6`
- Cost-aware alternate: `o3`
- Large-context alternate: `Gemini 2.5 Pro`

Fallback triggers:

- Provider outage or repeated 5xx: route to next highest tier with equal or
  better compatibility.
- 7-day spend exceeds budget by 15%: switch eligible tasks to cost-aware
  alternate.
- P95 latency regression above 25%: prefer a faster model in same tier.
- Model deprecation notice: migrate at next release window with audit entry.

## Override and Audit Example

```yaml
team_defaults:
  backend:
    default_model: claude-opus-4-6
    fallback_model: gpt-5.3-codex-high
    weights:
      code_quality: 30
      reasoning: 25
      cost: 10
      context: 25
      speed: 5
      compatibility: 5
agents:
  api-refactor:
    team: backend
    model_override: gpt-5.2-high-thinking
    reason: "Complex architecture redesign"
audit:
  changed_by: "<owner>"
  changed_at_utc: "2026-02-25T00:00:00Z"
  ticket: "AKF-000"
```

## Data Provenance and Refresh

| Field                      | Value                                               |
| -------------------------- | --------------------------------------------------- |
| Scorecard baseline version | 2026.02                                             |
| Last refreshed             | 2026-02-25                                          |
| Refresh SLA                | Within 24h of major model change                    |
| Data sources               | Provider docs, internal eval runs, cost multipliers |
| Confidence                 | Medium                                              |
| Owner                      | Backend + Platform leads                            |

Note: PRD-003 contains an illustrative matrix. Runtime config and scorecard
data are the source of truth.

## Newly Tracked Models (Pending Full Benchmark Scoring)

These models are now included in intake analysis but are excluded from weighted
ranking tables until benchmark metrics are validated.

| Model                        | Cost Multiplier | Status                                      |
| ---------------------------- | --------------- | ------------------------------------------- |
| Gemini 3 Flash High          | 1.75x           | Added to intake, pending scorecard metrics  |
| Gemini 3 Pro High Thinking   | 2x              | Added to intake, pending scorecard metrics  |
| Gemini 3.1 Pro High Thinking | 1x              | Added to intake, pending scorecard metrics  |
| GLM 4.7 (Beta)               | 0.25x           | Added to intake, beta reliability watch     |
| GLM-5 (New)                  | 1.5x            | Added to intake, replaces prior GLM-5 entry |

## Related Documentation

- PRD-001: LLM Decision Engine
- PRD-002: LLM Selection Scorecard Guide
- PRD-003: Weighted Matrix example
- Model Family Benchmark Dossiers: `docs/prd/model-families/README.md`
