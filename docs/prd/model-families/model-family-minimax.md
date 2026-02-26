# Model Family Dossier: MiniMax

## Snapshot

- Last updated: 2026-02-26
- Scope: coding and agentic workflow benchmark signals
- Intended use: source data for team model guides

## Latest benchmark signals

| Signal | Value | Source | Quality |
| --- | --- | --- | --- |
| Droid harness comparison | M2.5: 79.7 vs Opus 4.6: 78.9 | [MiniMax M2.5 model card](https://huggingface.co/MiniMaxAI/MiniMax-M2.5) | Fetched, vendor claim |
| OpenCode harness comparison | M2.5: 76.1 vs Opus 4.6: 75.9 | [MiniMax M2.5 model card](https://huggingface.co/MiniMaxAI/MiniMax-M2.5) | Fetched, vendor claim |
| SWE-Bench runtime efficiency | 22.8 min vs 31.3 min (M2.1), ~37% faster | [MiniMax M2.5 model card](https://huggingface.co/MiniMaxAI/MiniMax-M2.5) | Fetched, vendor claim |
| SWE-Bench token usage | 3.52M tokens/task vs 3.72M (M2.1) | [MiniMax M2.5 model card](https://huggingface.co/MiniMaxAI/MiniMax-M2.5) | Fetched, vendor claim |
| SWE-rebench note | MiniMax M2.5 reported at ~$0.09 per problem | [SWE-rebench](https://swe-rebench.com/) | Fetched, independent benchmark |

## Operational notes

- MiniMax claims strong coding performance with much lower operating cost than
  top-tier proprietary models.
- Most detailed numbers available today are vendor-reported, so ranking changes
  should wait for independent replication in our harness.

## Guidance for model guides

1. Keep MiniMax in cost-aware tiers for high-volume coding agents.
2. Validate quality deltas in our repos before promoting to top tiers.
3. Track latency and token-per-task, not just pass rates.

## Data gaps to close

- Independent SWE-bench and Aider runs with published harness config.
- Error mode analysis (malformed edits, timeout rates) by provider.
- Stability checks across long, multi-turn agent sessions.
