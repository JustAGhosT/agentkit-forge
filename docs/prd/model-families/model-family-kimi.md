# Model Family Dossier: Kimi

## Snapshot

- Last updated: 2026-02-26
- Scope: benchmark signals for Kimi coding and reasoning variants
- Intended use: source data for team model guides

## Latest benchmark signals

| Signal | Value | Source | Quality |
| --- | --- | --- | --- |
| Open-source pass@1 leadership note | Kimi K2 Thinking reported as best pass@1 this month | [SWE-rebench](https://swe-rebench.com/) | Fetched, independent benchmark |
| K2 Thinking vs K2.5 | 43.8% vs 37.9% on SWE-rebench metric cited in news text | [SWE-rebench](https://swe-rebench.com/) | Fetched, independent benchmark |
| Deployment tradeoff note | Better quality may come with different token/latency profile | [SWE-rebench](https://swe-rebench.com/) | Fetched, independent benchmark |

## Operational notes

- Kimi currently shows a strong split between thinking and non-thinking modes.
- Variant choice should be tied to time-to-solution and token budget limits.

## Guidance for model guides

1. Keep Kimi Thinking variants for quality-first budget tiers.
2. Keep base Kimi variants for lower-cost fallback tiers.
3. Track latency and token-use deltas before role-wide promotions.

## Data gaps to close

- Independent side-by-side Kimi runs on Aider polyglot and SWE-bench.
- Provider-level reliability and malformed output rates.
- Price-normalized quality comparisons against Minimax and GLM.
