# Model Family Dossier: Claude (Anthropic)

## Snapshot

- Last updated: 2026-02-26
- Scope: benchmark signals relevant to coding and agentic workflows
- Intended use: source data for team model guides

## Latest benchmark signals

| Signal                 | Value                                                    | Source                                                               | Quality                        |
| ---------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------ |
| MRCR v2 (8-needle, 1M) | Opus 4.6: 76%; Sonnet 4.5: 18.5%                         | [Anthropic Opus 4.6](https://www.anthropic.com/news/claude-opus-4-6) | Fetched, vendor claim          |
| SWE-bench Verified     | Averaged over 25 trials; 81.42% with prompt modification | [Anthropic Opus 4.6](https://www.anthropic.com/news/claude-opus-4-6) | Fetched, vendor claim          |
| MCP Atlas              | 62.7% at high effort                                     | [Anthropic Opus 4.6](https://www.anthropic.com/news/claude-opus-4-6) | Fetched, vendor claim          |
| BrowseComp             | 86.8% with multi-agent harness                           | [Anthropic Opus 4.6](https://www.anthropic.com/news/claude-opus-4-6) | Fetched, vendor claim          |
| SWE-rebench status     | Claude Opus 4.6 reported at #1; Claude Code best pass@5  | [SWE-rebench](https://swe-rebench.com/)                              | Fetched, independent benchmark |

## Operational notes

- Anthropic also states Opus 4.6 supports 1M context (beta), up to 128k output,
  and pricing uplift beyond 200k prompt tokens.
- Most hard numbers above are vendor-reported and should be cross-checked
  against independent leaderboards before changing default routing.

## Guidance for model guides

1. Keep Claude in top tiers for high-context, high-reliability tasks.
2. For cost-sensitive flows, prefer Sonnet or alternate families until
   independent cost/performance checks are refreshed.
3. Track effort mode assumptions (high vs max) because benchmark outcomes can
   shift meaningfully with effort settings.

## Data gaps to close

- Independent MRCR-like long-context replication in our harness.
- Side-by-side cost-per-success vs GPT, Gemini, and Minimax in our repos.
- Stability under long agent runs with context compaction enabled.
