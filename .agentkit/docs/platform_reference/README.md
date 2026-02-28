# Platform Reference Guide

Comprehensive reference for every AI coding platform supported by AgentKit Forge.
Each platform has its own detailed document covering native configuration,
what AgentKit Forge generates, gap analysis, and integration recommendations.

> **Tip:** Use `agentkit add <tool>` / `agentkit remove <tool>` to manage which
> platforms are active. See [TOOLS.md](../TOOLS.md) for the quick-reference table.

---

## Supported Platforms

| # | Platform | Type | Render Target | Document |
|---|----------|------|---------------|----------|
| 1 | [AGENTS.md](./01-agents-md.md) | Universal Standard | _(always generated)_ | Universal agent instruction file |
| 2 | [Claude Code](./02-claude-code.md) | IDE Agent | `claude` | Anthropic's AI coding agent |
| 3 | [Cursor IDE](./03-cursor-ide.md) | IDE | `cursor` | AI-native code editor |
| 4 | [Windsurf IDE](./04-windsurf-ide.md) | IDE | `windsurf` | Cascade AI editor |
| 5 | [GitHub Copilot](./05-github-copilot.md) | IDE Extension | `copilot` | Microsoft/GitHub AI assistant |
| 6 | [Google Gemini CLI](./06-google-gemini-cli.md) | CLI | `gemini` | Google's AI coding CLI |
| 7 | [OpenAI Codex](./07-openai-codex.md) | CLI Agent | `codex` | OpenAI's coding agent |
| 8 | [Warp Terminal](./08-warp-terminal.md) | Terminal | `warp` | AI-native terminal |
| 9 | [Cline](./09-cline.md) | VS Code Extension | `cline` | Open-source AI assistant |
| 10 | [Roo Code](./10-roo-code.md) | VS Code Extension | `roo` | Open-source AI assistant (Cline fork) |
| 11 | [Continue](./11-continue.md) | IDE Extension | `ai` | Open-source AI assistant |
| 12 | [Google Jules](./12-google-jules.md) | Cloud Agent | _(via AGENTS.md)_ | Google's autonomous coding agent |
| 13 | [Amazon Q Developer](./13-amazon-q-developer.md) | IDE Extension / CLI | _(via AGENTS.md)_ | AWS AI coding assistant |
| 14 | [Sourcegraph Cody](./14-sourcegraph-cody.md) | IDE Extension | _(via AGENTS.md)_ | Code intelligence AI assistant |
| 15 | [Aider](./15-aider.md) | CLI | _(via AGENTS.md)_ | Open-source AI pair programming |
| 16 | [Amp](./16-amp.md) | CLI Agent | _(via AGENTS.md)_ | Sourcegraph's coding agent |
| 17 | [OpenCode](./17-opencode.md) | CLI | _(via AGENTS.md)_ | Open-source terminal AI |
| 18 | [Factory](./18-factory.md) | Cloud Agent | _(via AGENTS.md)_ | Autonomous coding platform |

---

## Platform Comparison Matrix

| Capability | Claude | Cursor | Windsurf | Copilot | Gemini | Codex | Warp | Cline | Roo | Continue |
|------------|--------|--------|----------|---------|--------|-------|------|-------|-----|----------|
| Root instructions file | CLAUDE.md | — | — | copilot-instructions.md | GEMINI.md | AGENTS.md | WARP.md | — | — | — |
| Rules directory | .claude/rules/ | .cursor/rules/ | .windsurf/rules/ | .github/instructions/ | .gemini/ | — | — | .clinerules/ | .roo/rules/ | .continue/rules/ |
| Commands/prompts | .claude/commands/ | .cursor/commands/ | .windsurf/commands/ | .github/prompts/ | — | — | — | — | — | — |
| Skills | .claude/skills/ | — | — | — | — | .agents/skills/ | — | — | — | — |
| Agents/personas | .claude/agents/ | — | — | .github/agents/ | — | — | — | — | — | — |
| Team modes | team commands | team rules (.mdc) | team rules (.md) | .github/chatmodes/ | — | — | — | — | mode-specific rules | — |
| Hooks/automation | .claude/hooks/ | — | .windsurf/workflows/ | — | — | — | — | — | — | — |
| Settings/config | settings.json | frontmatter | — | — | settings.json + config.yaml | config.toml | Warp UI | Cline UI | profiles | config.json |
| AGENTS.md support | ✓ | ✓ | — | ✓ | — | ✓ (primary) | ✓ (primary) | ✓ | ✓ | — |
| YAML frontmatter | commands, skills | rules (.mdc) | — | prompts, agents, chatmodes | — | skills | — | — | — | rules |
| Glob-based activation | rules | rules | — | instructions | — | — | — | — | mode rules | rules |
| MCP integration | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | ✓ | ✓ | ✓ |

### AGENTS.md Adoption Matrix

| Platform | AGENTS.md Support | How It Reads |
|----------|------------------|--------------|
| OpenAI Codex | ✅ Primary | Reads `AGENTS.md` + `AGENTS.override.md` at every directory level |
| Google Jules | ✅ Native | Reads from repo root before every task |
| GitHub Copilot | ✅ Native | Auto-detects and applies to all chat requests |
| Roo Code | ✅ Native | Loads after mode-specific rules, before generic rules |
| Cline | ✅ Native | Loads alongside `.clinerules/` |
| Cursor | ✅ Recognized | Recognized as part of the AGENTS.md initiative |
| Warp | ✅ Primary | Reads `AGENTS.md` (preferred) or `WARP.md` from repo root |
| Amp | ✅ Native | Native support |
| Factory | ✅ Native | Native support |
| OpenCode | ✅ Native | Native support |
| Amazon Q Developer | ✅ Native | Native support |
| Sourcegraph Cody | ✅ Native | Reads AGENTS.md |
| Aider | ✅ Native | Reads AGENTS.md + conventions file |
| Claude Code | ✅ Reads | Also reads CLAUDE.md as primary |
| Continue | ⚠️ Indirect | Uses own rules system, no direct AGENTS.md support |

---

## Integration Plan

For the phased integration plan to address gaps across all platforms, see
[INTEGRATION_PLAN.md](./INTEGRATION_PLAN.md).

---

## See Also

- [TOOLS.md](../TOOLS.md) — Quick-reference table of what AgentKit Forge generates
- [CUSTOMIZATION.md](../CUSTOMIZATION.md) — How to customize overlays and settings
- [PROJECT_YAML_REFERENCE.md](../PROJECT_YAML_REFERENCE.md) — Project configuration schema
