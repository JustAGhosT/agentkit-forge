# Model Family Dossier: OpenAI (GPT/Codex)

## Snapshot

- Last updated: 2026-02-26
- Scope: coding and agentic benchmark signals for GPT/Codex family
- Intended use: source data for team model guides

## At a Glance

| Attribute          | Value                                                          |
| ------------------ | -------------------------------------------------------------- |
| **Provider**       | OpenAI (San Francisco, USA)                                    |
| **Founded**        | 2015                                                           |
| **Architecture**   | Dense transformer + MoE variants                               |
| **Latest model**   | GPT-5.2 Codex                                                  |
| **Context window** | 128K-200K tokens                                               |
| **Output limit**   | 100K tokens                                                    |
| **License**        | Proprietary (API only)                                         |
| **Notable**        | Invented transformer architecture, Codex powers GitHub Copilot |

## Hugging Face Resources

| Resource        | Model ID                  | Notes                                   |
| --------------- | ------------------------- | --------------------------------------- |
| Distilled GPT-4 | Various community uploads | Multiple quantized variants             |
| Codex via API   | N/A                       | Access via OpenAI API (`gpt-5.2-codex`) |

> **Note:** OpenAI does not publish official model weights on Hugging Face. Access GPT and Codex models via OpenAI API. Community distilled versions exist but are not official.

## Latest benchmark signals

| Signal                           | Value                                                                   | Source                                                                                    | Quality                             |
| -------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------- |
| Aider polyglot (GPT-5 high)      | Pass rate 1: 52.0; Pass rate 2: 88.0 on 225 cases                       | [Aider leaderboard](https://aider.chat/docs/leaderboards/)                                | Fetched, independent benchmark      |
| Aider run cost/time (GPT-5 high) | Total cost: 29.0829; seconds per case: 194.0                            | [Aider leaderboard](https://aider.chat/docs/leaderboards/)                                | Fetched, independent benchmark      |
| SWE-rebench efficiency note      | gpt-5.2-codex called out as very token-efficient                        | [SWE-rebench](https://swe-rebench.com/)                                                   | Fetched, independent benchmark      |
| OpenAI launch claim              | GPT-5 reported at 74.9% on SWE-bench Verified and 88% on Aider polyglot | [OpenAI GPT-5 for developers](https://openai.com/index/introducing-gpt-5-for-developers/) | Search snippet (page fetch blocked) |

## Operational notes

- OpenAI pages were not directly retrievable from this environment (HTTP
  forbidden), so official numbers from OpenAI are currently from search
  snippets only.
- Independent Aider metrics are available and should be weighted higher than
  unverified vendor launch claims.

## Guidance for model guides

1. Keep GPT/Codex in high tiers for coding-heavy teams where pass@2 and
   tool-usage quality matter most.
2. Use cost controls for high-effort variants due to the potentially large run cost.
3. Prefer Codex variants when agentic tool calls dominate the workflow.

## Data gaps to close

- Pull official OpenAI benchmark tables directly when access permits.
- Add SWE-bench Verified values from an independently replicated harness.
- Build cost-per-accepted-change metric from internal CI telemetry.
