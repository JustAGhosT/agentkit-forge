# Model Family Dossier: Mistral (incl. Codestral)

## Snapshot

- Last updated: 2026-02-26
- Scope: Codestral coding capabilities and Mistral API feature surface
- Intended use: source data for team model guides

## Latest benchmark signals

| Signal | Value | Source | Quality |
| --- | --- | --- | --- |
| Coding focus | Codestral is positioned as a code-completion model for low-latency, high-frequency coding tasks | [Mistral Codestral docs](https://docs.mistral.ai/models/codestral-25-08) | Fetched, vendor claim |
| FIM support | Codestral supports Fill-in-the-Middle code completion | [Mistral Codestral docs](https://docs.mistral.ai/models/codestral-25-08) | Fetched, vendor claim |
| Agent/tool features | Docs list function calling, agents, and built-in tools support | [Mistral Codestral docs](https://docs.mistral.ai/models/codestral-25-08) | Fetched, vendor claim |

## Operational notes

- This dossier currently uses vendor documentation signals only.
- Independent coding benchmark numbers for current Codestral releases are not
  yet captured in this repo.

## Guidance for model guides

1. Add Mistral/Codestral as intake rows for coding-focused, low-latency paths.
2. Keep weighted rankings unchanged until independent benchmark replication.
3. Validate latency and cost assumptions with provider and region-specific tests.

## Data gaps to close

- Independent Aider polyglot and SWE-bench performance runs.
- Normalized price and latency measurements across providers.
- Reliability and malformed-edit rates in multi-file coding tasks.
