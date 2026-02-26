# Model Family Dossier: Gemini (Google)

## Snapshot

- Last updated: 2026-02-26
- Scope: coding, agentic, and speed-relevant benchmark signals
- Intended use: source data for team model guides

## Latest benchmark signals

| Signal                        | Value                                                      | Source                                                           | Quality                        |
| ----------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------ |
| SWE-rebench pass@1 comparison | Gemini 3 Flash Preview: 57.6%; Gemini 3 Pro Preview: 56.5% | [SWE-rebench](https://swe-rebench.com/)                          | Fetched, independent benchmark |
| Google launch claim           | Gemini 3 Flash reported at 54.2% on Terminal-Bench 2.0     | [Google Gemini 3](https://blog.google/products/gemini/gemini-3/) | Search snippet (page timeout)  |
| Google launch claim           | Gemini 3 Pro reported at 1487 Elo on WebDev Arena          | [Google Gemini 3](https://blog.google/products/gemini/gemini-3/) | Search snippet (page timeout)  |

## Operational notes

- In currently accessible benchmark data, Gemini Flash can outperform Gemini
  Pro on some coding-agent metrics despite lower model size.
- Official Google pages timed out in this environment, so those data points are
  recorded as search-snippet quality until fetched directly.

## Guidance for model guides

1. Keep Gemini Flash as a serious candidate for speed-sensitive coding flows.
2. Keep Gemini Pro for large-context and complex reasoning tasks.
3. Validate Flash vs Pro in our own harness before changing team defaults.

## Data gaps to close

- Direct fetch of Google benchmark tables (Terminal-Bench, WebDev Arena).
- Independent cost/performance runs for Gemini 3 and Gemini 3.1 variants.
- Regional latency and reliability comparisons vs GPT/Claude.
