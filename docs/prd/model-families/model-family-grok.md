# Model Family Dossier: Grok (xAI)

## Snapshot

- Last updated: 2026-02-26
- Scope: coding and agentic benchmark signals for Grok coding models
- Intended use: source data for team model guides

## Latest benchmark signals

| Signal | Value | Source | Quality |
| --- | --- | --- | --- |
| SWE-Bench Verified (full subset) | 70.8% for grok-code-fast-1 | [xAI Grok Code Fast 1](https://x.ai/news/grok-code-fast-1) | Fetched, vendor claim |
| Pricing (input/output/cached input) | $0.20 / $1.50 / $0.02 per 1M tokens | [xAI Grok Code Fast 1](https://x.ai/news/grok-code-fast-1) | Fetched, vendor claim |
| Tool-use positioning | Trained for grep/terminal/file editing workflows | [xAI Grok Code Fast 1](https://x.ai/news/grok-code-fast-1) | Fetched, vendor claim |
| Ecosystem trend note | Grok models added to SWE-rebench leaderboard news stream | [SWE-rebench](https://swe-rebench.com/) | Fetched, independent benchmark |

## Operational notes

- xAI emphasizes end-user coding workflow speed and cost rather than only
  benchmark rank.
- The strongest numeric benchmark currently available in this pass is vendor
  reported, not independently verified.

## Guidance for model guides

1. Keep Grok as a candidate in speed/cost-aware tiers.
2. Require independent harness replication before top-tier promotion.
3. Monitor quality on complex multi-file refactors separately from bugfix tasks.

## Data gaps to close

- Independent SWE-bench and Aider benchmark replication.
- Provider-level reliability and timeout benchmarking.
- Comparative pass@2 and cost-per-success against GPT/Claude/Gemini.
