# Model Family Dossier: IBM Granite

## Snapshot

- Last updated: 2026-02-26
- Scope: Granite 4.0 language model signals for enterprise/governance contexts
- Intended use: source data for team model guides

## Latest benchmark signals

| Signal | Value | Source | Quality |
| --- | --- | --- | --- |
| Capability scope | Granite 4.0 is described as multilingual with coding, FIM, RAG, tool use, and JSON output support | [Granite 4.0 repository](https://github.com/ibm-granite/granite-4.0-language-models) | Fetched, vendor claim |
| Enterprise alignment | IBM describes GRC-oriented data curation and enterprise deployment focus | [Granite 4.0 repository](https://github.com/ibm-granite/granite-4.0-language-models) | Fetched, vendor claim |
| Licensing posture | Granite 4.0 models are documented under Apache 2.0 license | [Granite 4.0 repository](https://github.com/ibm-granite/granite-4.0-language-models) | Fetched, vendor claim |
| Agent readiness signal | Repository includes tool-calling examples for AI agents | [Granite 4.0 repository](https://github.com/ibm-granite/granite-4.0-language-models) | Fetched, vendor claim |

## Operational notes

- Granite is a relevant family for regulated and on-prem enterprise scenarios.
- This pass collected feature evidence, but not independent benchmark values.

## Guidance for model guides

1. Add Granite as intake rows for compliance-sensitive and on-prem pathways.
2. Keep ranked tiers unchanged until independent coding benchmark replication.
3. Validate tool-calling behavior and JSON/FIM quality in your harness.

## Data gaps to close

- Independent coding benchmark results for Granite instruct variants.
- Normalized latency and cost across hosting providers.
- Reliability in long-context, tool-heavy agent workloads.
