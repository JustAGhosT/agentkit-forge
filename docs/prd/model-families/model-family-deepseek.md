# Model Family Dossier: DeepSeek

## Snapshot

- Last updated: 2026-02-26
- Scope: DeepSeek API model modes and coding-agent capability signals
- Intended use: source data for team model guides

## Latest benchmark signals

| Signal | Value | Source | Quality |
| --- | --- | --- | --- |
| API model mapping | `deepseek-chat` = non-thinking mode of DeepSeek-V3.2 | [DeepSeek API quick start](https://api-docs.deepseek.com/) | Fetched, vendor claim |
| API model mapping | `deepseek-reasoner` = thinking mode of DeepSeek-V3.2 | [DeepSeek API quick start](https://api-docs.deepseek.com/) | Fetched, vendor claim |
| Context limit | DeepSeek-V3.2 API modes listed with 128K context limit | [DeepSeek API quick start](https://api-docs.deepseek.com/) | Fetched, vendor claim |
| Tool-use behavior | V3.2 supports tool use in both thinking and non-thinking modes | [DeepSeek V3.2 release](https://api-docs.deepseek.com/news/news251201) | Fetched, vendor claim |
| Release coverage | V3.2 and V3.2-Speciale documented as current release line | [DeepSeek V3.2 release](https://api-docs.deepseek.com/news/news251201) | Fetched, vendor claim |

## Operational notes

- Current evidence in this dossier is vendor documentation.
- We do not yet have independent Aider or SWE-bench replication data in this
  repo for DeepSeek entries.

## Guidance for model guides

1. Add DeepSeek as intake rows only until independent benchmark coverage is
   captured.
2. Use `deepseek-chat` for non-thinking cost/speed paths and
   `deepseek-reasoner` for reasoning-heavy tasks.
3. Keep pricing, latency, and reliability assumptions as TBD until validated.

## Data gaps to close

- Independent coding benchmark results (Aider polyglot and SWE-bench harness).
- Verified API pricing snapshots and normalized cost multipliers.
- Internal pass/fail and latency telemetry across representative repos.
