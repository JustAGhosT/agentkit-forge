# Model Family Dossier: OpenAI (GPT/Codex)

## Snapshot

- Last updated: 2026-02-26
- Scope: coding and agentic benchmark signals for GPT/Codex family
- Intended use: source data for team model guides

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
2. Use cost controls for high-effort variants due potentially large run cost.
3. Prefer Codex variants when agentic tool calls dominate the workflow.

## Data gaps to close

- Pull official OpenAI benchmark tables directly when access permits.
- Add SWE-bench Verified values from an independently replicated harness.
- Build cost-per-accepted-change metric from internal CI telemetry.
