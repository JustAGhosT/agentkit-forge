# Model Family Dossier: Qwen

## Snapshot

- Last updated: 2026-02-26
- Scope: coding benchmark behavior for Qwen3 variants
- Intended use: source data for team model guides

## Latest benchmark signals

| Signal                                              | Value                                                             | Source                                                             | Quality                        |
| --------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------ |
| Qwen3-235B-A22B (VLLM, no_think, whole)             | Pass rate 2: 65.3% (225 tests)                                    | [Aider Qwen3 benchmarks](https://aider.chat/2025/05/08/qwen3.html) | Fetched, independent benchmark |
| Qwen3-235B-A22B (Alibaba API, no_think, whole)      | Pass rate 2: 61.8% (225 tests)                                    | [Aider Qwen3 benchmarks](https://aider.chat/2025/05/08/qwen3.html) | Fetched, independent benchmark |
| Qwen3-235B-A22B (OpenRouter default thinking, diff) | Pass rate 2: 49.8% (225 tests)                                    | [Aider Qwen3 benchmarks](https://aider.chat/2025/05/08/qwen3.html) | Fetched, independent benchmark |
| Qwen3-32B (VLLM, no_think, whole)                   | Pass rate 2: 45.8% (225 tests)                                    | [Aider Qwen3 benchmarks](https://aider.chat/2025/05/08/qwen3.html) | Fetched, independent benchmark |
| SWE-rebench note                                    | Qwen3-Coder-Next reported best pass@5 among OSS and top-2 overall | [SWE-rebench](https://swe-rebench.com/)                            | Fetched, independent benchmark |

## Operational notes

- Qwen results vary heavily by serving path and thinking mode.
- Recommended -/no_think- settings often outperform default thinking routes in
  the published Aider runs.
- Cost and latency can still be attractive even when pass@2 is lower.

## Guidance for model guides

1. Do not treat one Qwen score as universal; pin the serving route and settings.
2. For budget tiers, evaluate Qwen with no_think presets before assigning ranks.
3. Track malformed response rates where diff format is used.

## Data gaps to close

- Add replicated runs for Qwen3.1/Next variants in our own harness.
- Capture provider-level reliability and timeout behavior.
- Add price-normalized pass@2 and pass@5 comparisons vs GLM and Kimi.
