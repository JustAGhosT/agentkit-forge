# Model Family Dossier: Amazon Nova

## Snapshot

- Last updated: 2026-02-26
- Scope: Nova family signals relevant to AWS-first deployments
- Intended use: source data for team model guides

## Latest benchmark signals

| Signal | Value | Source | Quality |
| --- | --- | --- | --- |
| Family categories | Nova is grouped into understanding, creative, and speech model categories | [Amazon Nova overview](https://docs.aws.amazon.com/nova/latest/userguide/what-is-nova.html) | Fetched, vendor claim |
| Understanding lineup | Nova Premier, Pro, Lite, and Micro are documented for multimodal/text understanding tasks | [Amazon Nova overview](https://docs.aws.amazon.com/nova/latest/userguide/what-is-nova.html) | Fetched, vendor claim |
| Use-case positioning | AWS lists RAG systems and agentic applications across Nova understanding models | [Amazon Nova overview](https://docs.aws.amazon.com/nova/latest/userguide/what-is-nova.html) | Fetched, vendor claim |
| Region/governance signal | Regional availability and GovCloud support are explicitly documented | [Amazon Nova overview](https://docs.aws.amazon.com/nova/latest/userguide/what-is-nova.html) | Fetched, vendor claim |

## Operational notes

- Nova should be assessed as a strategic option in AWS-heavy environments.
- Independent coding benchmark evidence is not yet captured in this repo.

## Guidance for model guides

1. Add Nova as intake rows where AWS governance and regional controls matter.
2. Hold weighted ranking changes until independent coding evals are available.
3. Validate cost/latency in target Bedrock regions and quotas.

## Data gaps to close

- Independent coding benchmark runs for Nova understanding models.
- Cost-per-success comparisons against OpenAI/Claude/Gemini in AWS contexts.
- Reliability and throughput in long-running agent pipelines.
