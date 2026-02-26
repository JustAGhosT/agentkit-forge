# Model Family Dossier: GLM

## Snapshot

- Last updated: 2026-02-26
- Scope: benchmark signals for GLM 4.7 and GLM-5 in coding contexts
- Intended use: source data for team model guides

## Latest benchmark signals

| Signal | Value | Source | Quality |
| --- | --- | --- | --- |
| Open-source leaderboard status | GLM-5 listed as minimum tokens/problem in current month | [SWE-rebench](https://swe-rebench.com/) | Fetched, independent benchmark |
| Open-source ranking note | GLM-4.7 described as strongest OSS model on leaderboard | [SWE-rebench](https://swe-rebench.com/) | Fetched, independent benchmark |
| Throughput/latency snapshot | GLM-5 summary cites 61.2 t/s and 1.37s TTFT | [Artificial Analysis model summary](https://artificialanalysis.ai/models/glm-5) | Search snippet only |

## Operational notes

- GLM appears strong on efficiency-oriented coding benchmarks in independent
  leaderboard commentary.
- Detailed GLM-5 model page could not be fetched directly in this environment,
  so throughput/latency figures are currently snippet-quality only.

## Guidance for model guides

1. Keep GLM models in cost-aware and multilingual candidate tiers.
2. Prefer GLM for scenarios where token efficiency is a top objective.
3. Do not raise GLM to top tier without direct benchmark table ingestion.

## Data gaps to close

- Direct pull of GLM model cards and benchmark tables.
- Independent replication of GLM-5 coding pass rates in our harness.
- Regional provider quality and reliability comparison (APAC vs global).
