# Model Family Dossier: Meta Llama (3.x / 4)

## Snapshot

- Last updated: 2026-02-26
- Scope: Llama 4 open-weight baseline signals for self-hosted decisions
- Intended use: source data for team model guides

## Latest benchmark signals

| Signal | Value | Source | Quality |
| --- | --- | --- | --- |
| Open model stance | Llama 4 is positioned for commercial and research use under Llama Community License | [Llama 4 Scout model card](https://huggingface.co/meta-llama/Llama-4-Scout-17B-16E) | Fetched, vendor claim |
| Multimodal positioning | Instruction-tuned Llama 4 is described for assistant chat and visual reasoning | [Llama 4 Scout model card](https://huggingface.co/meta-llama/Llama-4-Scout-17B-16E) | Fetched, vendor claim |
| Training scale signal | Llama 4 Scout pretraining reported at ~40T tokens with Aug 2024 data cutoff | [Llama 4 Scout model card](https://huggingface.co/meta-llama/Llama-4-Scout-17B-16E) | Fetched, vendor claim |

## Operational notes

- This family is key for open-weight, self-hosted, and on-prem planning.
- Public benchmark tables are present in model cards, but this pass did not
  retrieve robust metric values for direct ranking use.

## Guidance for model guides

1. Add Llama as intake baseline for self-hosted/on-prem comparisons.
2. Keep default ranking unchanged until independent coding benchmark runs exist.
3. Validate tool use and long-context behavior in local harnesses.

## Data gaps to close

- Independent coding benchmark runs for Llama 3.x and Llama 4 variants.
- Cost-per-success metrics on your target inference stack.
- Stability and latency under long agent trajectories.
