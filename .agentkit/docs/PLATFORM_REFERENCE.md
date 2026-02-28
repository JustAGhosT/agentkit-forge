# Platform Reference Guide

Comprehensive reference for every AI coding platform supported by AgentKit Forge.
Each section documents the platform's native configuration system, what AgentKit
Forge generates, and links to official documentation.

> **Tip:** Use `agentkit add <tool>` / `agentkit remove <tool>` to manage which
> platforms are active. See [TOOLS.md](./TOOLS.md) for the quick-reference table.

---

## Table of Contents

1. [AGENTS.md (Universal Standard)](#agentsmd-universal-standard)
2. [Claude Code](#claude-code)
3. [Cursor IDE](#cursor-ide)
4. [Windsurf IDE](#windsurf-ide)
5. [GitHub Copilot](#github-copilot)
6. [Google Gemini CLI](#google-gemini-cli)
7. [OpenAI Codex](#openai-codex)
8. [Warp Terminal](#warp-terminal)
9. [Cline](#cline)
10. [Roo Code](#roo-code)
11. [Continue](#continue)
12. [Platform Comparison Matrix](#platform-comparison-matrix)

---

## AGENTS.md (Universal Standard)

**Always generated** — not gated by `renderTargets`.

### What Is It?

`AGENTS.md` is the open industry standard for AI agent instruction files,
stewarded by the Agentic AI Foundation under the Linux Foundation. It provides
a single, tool-agnostic way to communicate project context, conventions, and
workflows to any AI coding agent.

### Native Support

| Tool | How It Reads AGENTS.md |
|------|----------------------|
| OpenAI Codex | Reads `AGENTS.md` + `AGENTS.override.md` at every directory level |
| Google Jules | Reads from repo root before every task |
| GitHub Copilot | Auto-detects and applies to all chat requests |
| Roo Code | Loads after mode-specific rules, before generic rules |
| Cline | Loads alongside `.clinerules/` |
| Cursor | Recognized as part of the AGENTS.md initiative |
| Warp | Reads `AGENTS.md` (preferred) or `WARP.md` from repo root |
| Amp, Factory, OpenCode | Native support |
| Amazon Q Developer | Native support |
| Sourcegraph Cody | Reads AGENTS.md |
| Aider | Reads AGENTS.md + conventions file |

### What AgentKit Forge Generates

| Output | Path |
|--------|------|
| Agent instructions | `AGENTS.md` |

Content is generated from `project.yaml` (tech stack, architecture, conventions,
testing, integrations, documentation pointers) and the core spec files.

### References

- [AGENTS.md open standard](https://agents.md/)
- [Instruction Files for AI Coding Assistants: An Overview](https://aruniyer.github.io/blog/agents-md-instruction-files.html)

---

## Claude Code

**Render target:** `claude`

### Platform Overview

Claude Code (by Anthropic) is the most feature-rich AI coding agent integration.
It supports a full directory hierarchy under `.claude/` with commands, skills,
agents, rules, hooks, settings, and orchestrator state.

### Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Root instructions | `CLAUDE.md` (repo root) | Plain Markdown |
| Commands | `.claude/commands/*.md` | YAML frontmatter + Markdown |
| Skills | `.claude/skills/*/SKILL.md` | YAML frontmatter + Markdown |
| Agents | `.claude/agents/*.md` | Plain Markdown with persona/scope |
| Rules | `.claude/rules/*.md` | Plain Markdown (optional YAML frontmatter for path targeting) |
| Hooks | `.claude/hooks/*.sh`, `*.ps1` | Shell/PowerShell scripts |
| Settings | `.claude/settings.json` | JSON (permissions, deny lists) |
| State | `.claude/state/` | JSON (orchestrator state, session tracking) |

**Key capabilities:**

- **CLAUDE.md** is loaded automatically at session start. Supports hierarchical
  placement (`./CLAUDE.md`, `.claude/CLAUDE.md`, `~/.claude/CLAUDE.md`).
- **Commands** are slash-invoked (`/build`, `/test`, etc.) with `allowed-tools`
  in YAML frontmatter for sandboxing.
- **Skills** are the modern replacement for commands — modular folders with
  `SKILL.md` containing instructions, plus optional scripts, templates,
  and references.
- **Rules** support path-filtered activation using globs in frontmatter.
- **Hooks** are deterministic script automations triggered by lifecycle events
  (UserPromptSubmit, PreToolUse, PostToolUse, Notification, Stop).
- **Settings** define tool permissions, deny lists, and project-level config.
- **Agents/subagents** run with isolated context for parallel, modular work.

### What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Root instructions | `CLAUDE.md` | `templates/claude/CLAUDE.md` + `project.yaml` |
| Commands (28) | `.claude/commands/*.md` | `commands.yaml` + team commands from `teams.yaml` |
| Skills (19) | `.claude/skills/*/SKILL.md` | `commands.yaml` (non-team commands) |
| Agents (19) | `.claude/agents/*.md` | `agents.yaml` |
| Rules (6) | `.claude/rules/*.md` | `templates/claude/rules/` |
| Hooks (10) | `.claude/hooks/*.sh`, `*.ps1` | `templates/claude/hooks/` |
| State schema | `.claude/state/` | Orchestrator state schema |
| Settings | `.claude/settings.json` | Permissions from `settings.yaml` |

### References

- [Claude Code official documentation — Extending Claude](https://code.claude.com/docs/en/features-overview)
- [CLAUDE.md memory system](https://docs.anthropic.com/en/docs/claude-code/memory#claudemd)
- [Complete guide to CLAUDE.md structure](https://www.claudedirectory.org/blog/claude-md-guide)
- [Claude Code customization guide — skills, subagents](https://alexop.dev/posts/claude-code-customization-guide-claudemd-skills-subagents/)
- [Rules directory — modular instructions](https://claudefa.st/blog/guide/mechanics/rules-directory)
- [Config file locations](https://inventivehq.com/knowledge-base/claude/where-configuration-files-are-stored)
- [Hooks and event automation](https://dev.to/holasoymalva/the-ultimate-claude-code-guide-every-hidden-trick-hack-and-power-feature-you-need-to-know-2l45)
- [Creating the perfect CLAUDE.md](https://dometrain.com/blog/creating-the-perfect-claudemd-for-claude-code/)

---

## Cursor IDE

**Render target:** `cursor`

### Platform Overview

Cursor IDE uses `.cursor/rules/` for persistent project rules and
`.cursor/commands/` for custom slash commands. Rules use the `.mdc` format
(Markdown with YAML frontmatter) and support context-aware activation.

### Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Rules | `.cursor/rules/*.mdc` | MDC (YAML frontmatter + Markdown) |
| Commands | `.cursor/commands/*.md` | Plain Markdown |
| Legacy rules | `.cursorrules` (deprecated) | Plain text |

**Key capabilities:**

- **Rich activation controls** in YAML frontmatter: `description`, `globs`,
  `alwaysApply`.
- **Auto context loading**: Rules are loaded into AI context for relevant
  files or scenarios based on glob patterns.
- **Manual and on-demand**: Reference rule names with `@rule-name` in chat.
- **Folder scoping**: `.cursor/rules/` can appear in subfolders for
  monorepo/microservice layouts.
- **Composability**: Split large policy sets into multiple modular rule files.
- **Commands (Cursor 1.6+)**: `.cursor/commands/*.md` for slash commands,
  analogous to Claude commands.

### What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Project context rule | `.cursor/rules/project-context.mdc` | `templates/cursor/rules/` |
| Security rule | `.cursor/rules/security.mdc` | `templates/cursor/rules/` |
| Orchestrate rule | `.cursor/rules/orchestrate.mdc` | `templates/cursor/rules/` |
| Team rules (10) | `.cursor/rules/team-*.mdc` | `teams.yaml` |
| Commands (19) | `.cursor/commands/*.md` | `commands.yaml` (non-team commands) |

### References

- [Cursor official documentation — Rules](https://cursor.com/docs/context/rules)
- [Cursor Rules Guide — design.dev](https://design.dev/guides/cursor-rules/)
- [Setting Up Cursor Rules — DEV Community](https://dev.to/stamigos/setting-up-cursor-rules-the-complete-guide-to-ai-enhanced-development-24cg)
- [Cursor IDE Rules Deep Dive — Mervin Praison](https://mer.vin/2025/12/cursor-ide-rules-deep-dive/)
- [Using Cursor Rules Effectively — cursor.fan](https://cursor.fan/tutorial/HowTo/using-cursor-rules-effectively/)
- [AI Rules and Configuration — DeepWiki](https://deepwiki.com/getcursor/docs/4.3-ai-rules-and-configuration)

---

## Windsurf IDE

**Render target:** `windsurf`

### Platform Overview

Windsurf IDE (Cascade AI) uses `.windsurf/rules/` for project rules,
`.windsurf/commands/` for custom commands, and `.windsurf/workflows/` for
multi-step automation sequences.

### Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Rules | `.windsurf/rules/*.md` | Plain Markdown |
| Commands | `.windsurf/commands/*.md` | Plain Markdown |
| Workflows | `.windsurf/workflows/*.yml` | YAML |
| Legacy rules | `.windsurfrules` (deprecated) | Plain text |

**Key capabilities:**

- **Global and workspace scoping**: Project-level `.windsurf/rules/` or
  `~/.config/windsurf/` for global rules.
- **Activation modes**: Always, manually, by file globs, or model decision.
- **Coding style enforcement**: Linter integration, line length, naming,
  formatting tools.
- **AI behavior directives**: Explain decisions, check existing code,
  propose strategy before writing.
- **Workflows and Memories**: Predefined multi-step sequences (build, test,
  deploy) and context auto-learned from usage.
- **70+ language support** out of the box.
- **MCP integration** for external tool connections.

### What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Project context rule | `.windsurf/rules/project.md` | `templates/windsurf/rules/` |
| Security rule | `.windsurf/rules/security.md` | `templates/windsurf/rules/` |
| Orchestrate rule | `.windsurf/rules/orchestrate.md` | `templates/windsurf/rules/` |
| Team rules (10) | `.windsurf/rules/team-*.md` | `teams.yaml` |
| Commands (19) | `.windsurf/commands/*.md` | `commands.yaml` (non-team commands) |
| Workflows (2) | `.windsurf/workflows/*.yml` | `templates/windsurf/workflows/` |

### References

- [Windsurf Cascade documentation](https://docs.windsurf.com/windsurf/cascade)
- [Windsurf Rules Guide — design.dev](https://design.dev/guides/windsurf-rules/)
- [Windsurf Rules & Workflows best practices](https://www.paulmduvall.com/using-windsurf-rules-workflows-and-memories/)
- [AI Coding Assistant Rules for Windsurf and Cursor](https://deeplearning.fr/ai-coding-assistant-rules-for-windsurf-and-cursor/)
- [Windsurf AI Rules: A Guide to Prompting](https://uibakery.io/blog/windsurf-ai-rules)
- [Community-contributed rule sets](https://www.dotwindsurfrules.com/)
- [Real-world configuration examples](https://github.com/anthony-hopkins/windsurf_rules)

---

## GitHub Copilot

**Render target:** `copilot`

### Platform Overview

GitHub Copilot supports a layered customization system: repository-wide
instructions, path-specific instructions, reusable prompt files, custom agents,
and team-scoped chat modes.

### Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Repo-wide instructions | `.github/copilot-instructions.md` | Plain Markdown |
| Path-specific instructions | `.github/instructions/*.instructions.md` | Markdown with frontmatter |
| Prompt files (slash commands) | `.github/prompts/*.prompt.md` | YAML frontmatter + Markdown |
| Custom agents | `.github/agents/*.agent.md` | YAML frontmatter + Markdown |
| Chat modes | `.github/chatmodes/*.chatmode.md` | YAML frontmatter + Markdown |
| Agent instructions | `AGENTS.md` | Plain Markdown |
| Personal instructions | `$HOME/.copilot/copilot-instructions.md` | Plain Markdown |

**Key capabilities:**

- **Repository-wide instructions** in `.github/copilot-instructions.md` are
  automatically used by all Copilot sessions in the repo.
- **Path-specific instructions** apply to files/folders matching patterns —
  great for language- or layer-specific standards.
- **Prompt files** define reusable slash commands (e.g., `/spell-check`).
- **Custom agents** define specialist personas with tools and scope.
- **Chat modes** tailor Copilot's interaction style per team or task.
- **Supported in**: Copilot Chat (VS Code, Visual Studio, GitHub.com),
  Copilot Coding Agent, Copilot Code Review, inline completions.

### What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Main instructions | `.github/copilot-instructions.md` | `templates/copilot/copilot-instructions.md` |
| Path instructions (4) | `.github/instructions/*.md` | `templates/copilot/instructions/` |
| Prompt files (19) | `.github/prompts/*.prompt.md` | `commands.yaml` (non-team commands) |
| Custom agents (19) | `.github/agents/*.agent.md` | `agents.yaml` |
| Chat modes (10) | `.github/chatmodes/*.chatmode.md` | `teams.yaml` |

### References

- [Use custom instructions in VS Code](https://code.visualstudio.com/docs/copilot/customization/custom-instructions)
- [Adding repository custom instructions for GitHub Copilot](https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot)
- [Copilot coding agent supports AGENTS.md](https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions/)
- [GitHub Copilot Customization: Instructions, Prompts, Agents and Skills](https://blog.cloud-eng.nl/2025/12/22/copilot-customization/)
- [Copilot DevOps Excellence: Prompt Files vs Instructions vs Chat Modes](https://azurewithaj.com/github-copilot-prompt-instructions-chatmodes/)
- [All About GitHub Copilot Custom Instructions](https://www.nathannellans.com/post/all-about-github-copilot-custom-instructions)
- [GitHub Copilot Instructions Guide — design.dev](https://design.dev/guides/copilot-instructions/)
- [Awesome GitHub Copilot Customizations repo](https://developer.microsoft.com/blog/introducing-awesome-github-copilot-customizations-repo)

---

## Google Gemini CLI

**Render target:** `gemini`

### Platform Overview

Google Gemini CLI and Gemini Code Assist use `GEMINI.md` for project context
and the `.gemini/` directory for configuration, style guides, and code review
settings.

### Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project context | `GEMINI.md` (repo root) | Plain Markdown |
| Style guide | `.gemini/styleguide.md` | Plain Markdown |
| Settings | `.gemini/settings.json` | JSON |
| Config | `.gemini/config.yaml` | YAML |
| Ignore patterns | `.gemini/.geminiignore` | Gitignore-style patterns |

**Key capabilities:**

- **GEMINI.md** files supply persistent, reusable context. Can be placed
  globally (`~/.gemini/GEMINI.md`), at workspace level, or per-directory.
- **Hierarchical context**: CLI concatenates all relevant `GEMINI.md` files.
- **Settings hierarchy**: Global → Project → Environment variables → CLI args.
- **Supported settings**: theme, vimMode, autoAccept, sandbox mode,
  includeDirectories, checkpointing, model, temperature, maxTokens.
- **MCP integration**: Custom tool integrations via Model Context Protocol.
- **Slash commands**: `/stats`, `/tools`, `/memory` for workflow automation.

### What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Root instructions | `GEMINI.md` | `templates/gemini/GEMINI.md` + `project.yaml` |
| Style guide | `.gemini/styleguide.md` | `templates/gemini/styleguide.md` + `project.yaml` |
| Config | `.gemini/config.yaml` | Code review settings |

### References

- [Gemini CLI official configuration docs](https://google-gemini.github.io/gemini-cli/docs/get-started/configuration.html)
- [GEMINI.md usage — GitHub](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/gemini-md.md)
- [Gemini CLI configuration reference](https://geminicli.com/docs/reference/configuration/)
- [Google Gemini CLI Cheatsheet](https://www.philschmid.de/gemini-cli-cheatsheet)
- [settings.json configuration breakdown — DeepWiki](https://deepwiki.com/addyosmani/gemini-cli-tips/5.2-settings.json-configuration)
- [Google Cloud Gemini CLI reference](https://docs.cloud.google.com/gemini/docs/codeassist/gemini-cli)

---

## OpenAI Codex

**Render target:** `codex`

### Platform Overview

OpenAI Codex uses `AGENTS.md` for project instructions and `.agents/skills/`
(or `.codex/skills/`) for modular, repeatable workflow definitions.

### Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project instructions | `AGENTS.md` (repo root) | Plain Markdown |
| Directory instructions | `<subdir>/AGENTS.md` | Plain Markdown |
| Override instructions | `AGENTS.override.md` | Plain Markdown |
| Skills | `.agents/skills/*/SKILL.md` or `.codex/skills/*/SKILL.md` | YAML frontmatter + Markdown |
| Global instructions | `~/.codex/AGENTS.md` | Plain Markdown |
| Config | `~/.codex/config.toml` | TOML |

**Key capabilities:**

- **Hierarchical AGENTS.md**: Global → root → subdirectory, most-specific wins.
- **Skills** are modular folders with `SKILL.md` (required) plus optional
  `scripts/`, `templates/`, `references/` directories.
- **SKILL.md** contains YAML frontmatter (`name`, `description`, triggers)
  and step-by-step instructions.
- **Config.toml** controls model version, approval policy, sandbox mode,
  web search, reasoning effort, and agent privileges.
- **Skills are lazy-loaded**: Full instructions load only when context triggers
  the skill, reducing memory bloat.

### What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Skills (19) | `.agents/skills/*/SKILL.md` | `commands.yaml` (non-team commands) |

Codex also reads `AGENTS.md` (always generated) for project-level context.

### References

- [OpenAI Codex — Custom instructions with AGENTS.md](https://developers.openai.com/codex/guides/agents-md)
- [How to Use AGENTS.md in OpenAI Codex](https://agentsmd.io/how-to-use-agents-md-in-codex)
- [How to Build Custom Agent Skills for Codex](https://skilllm.com/blog/custom-agent-skills-openai-codex)
- [Codex CLI Cheatsheet](https://shipyard.build/blog/codex-cli-cheat-sheet/)
- [Skills Catalog for Codex — GitHub](https://github.com/openai/skills)
- [Codex App Skills: Safe and Reusable Agent Workflows](https://www.verdent.ai/guides/codex-app-skills-guide)
- [OpenAI launches Skills in Codex](https://dataconomy.com/2025/12/24/openai-launches-skills-in-codex-to-supercharge-agentic-coding/)

---

## Warp Terminal

**Render target:** `warp`

### Platform Overview

Warp is an AI-native terminal (Agentic Development Environment) that reads
`WARP.md` or `AGENTS.md` for project rules and supports multi-agent workflows,
natural language commands, and integrated code review.

### Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project rules | `AGENTS.md` (preferred) or `WARP.md` | Plain Markdown |
| Subdirectory rules | `<subdir>/AGENTS.md` | Plain Markdown |
| Global rules | Warp settings UI | Warp config |

**Key capabilities:**

- **Hierarchical rules**: Subdirectory rules override root, which override
  global. Most-specific context always wins.
- **Multi-agent support**: Run several AI agents concurrently, each for
  distinct roles (coding, review, DevOps, data analysis).
- **Natural language to command**: Describe a goal and the AI generates the
  command.
- **Contextual awareness**: Uses project rules, repo context, terminal history,
  and external systems via MCP.
- **Agent autonomy levels**: Configure whether agents propose or execute
  automatically.
- **Warp Drive**: Syncs commands, environments, and shared agent prompts
  for team productivity.
- **Block-based output**: Every command/response is a selectable block.
- **Migration**: `WARP.md` is still recognized but `AGENTS.md` is recommended.

### What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Root instructions | `WARP.md` | `templates/warp/WARP.md` + `project.yaml` |

### References

- [Warp — Rules documentation](https://docs.warp.dev/agent-platform/capabilities/rules)
- [Warp Code in Practice — Prompt to Production](https://www.vibesparking.com/en/blog/ai/warp/2025-09-04-warp-code-prompt-to-production-playbook/)
- [Warp Terminal Guide — DeployHQ](https://www.deployhq.com/guides/warp)
- [Complete WARP Terminal AI Rules System — GitHub](https://github.com/Janzen-KMC/WarpAI-Rules-System)
- [Complete Guide to Warp — AI-Based Development Environment](https://www.bluudit.com/blogs/complete-guide-to-warp-tool-ai-based-development-environment-for-2025)
- [Warp 2.0 — AI Agents and Team Collaboration](https://itsfoss.com/news/warp-terminal-2-0/)

---

## Cline

**Render target:** `cline`

### Platform Overview

Cline is a VS Code extension with a robust `.clinerules/` directory system for
defining project-specific rules, coding standards, and AI behavior. It also
supports cross-tool compatibility with `.cursorrules`, `.windsurfrules`, and
`AGENTS.md`.

### Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project rules | `.clinerules/*.md` | Markdown or plain text |
| Global rules | `~/Documents/Cline/Rules/` | Markdown or plain text |
| Cross-tool rules | `.cursorrules`, `.windsurfrules`, `AGENTS.md` | Auto-detected |

**Key capabilities:**

- **Workspace rules** in `.clinerules/` are version-controlled and shared
  with the team.
- **Global rules** for personal standards across all projects.
- **Rule precedence**: Project rules override global rules.
- **Cross-tool compatibility**: Detects rules from Cursor, Windsurf, AGENTS.md.
- **Toggleable rules**: Enable/disable via Cline's UI per project or globally.
- **Modularity**: Organize by topic (`01-coding.md`, `02-testing.md`).
  Numeric prefixes help ordering.
- **AI-editable**: Cline can read, write, and update `.clinerules` files
  interactively — a living, adaptable project compass.
- **Advanced memory**: Supports `rules`, `memory`, `directory-structure`
  files for phased workflows and context snapshots.
- **MCP integration**: Integrates with Model Context Protocol tools.

### What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Domain rules (7) | `.clinerules/*.md` | `rules.yaml` (one file per domain) |

Generated domains: TypeScript, .NET, Python, Rust, security, blockchain, IaC.
Cline also reads `AGENTS.md` (always generated) for universal context.

### References

- [Cline — Rules documentation](https://docs.cline.bot/customization/cline-rules)
- [.clinerules: Version-Controlled, Shareable Instructions](https://cline.ghost.io/clinerules-version-controlled-shareable-and-ai-editable-instructions/)
- [Mastering .clinerules Configuration](https://ai.rundatarun.io/AI+Development+%26+Agents/mastering-clinerules-configuration)
- [Cline Rules — DeepWiki](https://deepwiki.com/cline/cline/7.1-cline-rules)
- [The Ultimate Guide to .clinerules](https://learn-cursor.com/en/blog/posts/cline-rules-ultimate-guide)
- [Cline Rules — VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ai-henryalps.clinerules)
- [AGENTS.md support proposal — GitHub](https://github.com/cline/cline/issues/5033)

---

## Roo Code

**Render target:** `roo`

### Platform Overview

Roo Code is an open-source AI coding assistant for VS Code (originally a Cline
fork) with powerful configuration via `.roo/rules/` and custom modes.

### Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project rules | `.roo/rules/*.md` | Markdown, plain text, or `.mdc` |
| Mode-specific rules | `.roo/rules-{mode}/*.md` | Markdown |
| Legacy rules | `.roorules`, `.roorules-{mode}` | Plain text |
| Cross-tool rules | Cursor `.mdc` files | Auto-detected |

**Key capabilities:**

- **Mode-specific rules**: Different rule sets for Architect, Code, Debug,
  Ask, and Orchestrator modes.
- **Rule priority**: `.roo/rules-{mode}/` overrides `.roo/rules/`.
- **Custom modes**: Define new modes with their own instructions and
  persona in `.roo/rules-{mode}/` directories.
- **Configuration profiles**: Different AI providers, model choices,
  temperature, and resource limits per project or phase.
- **Permission management**: Fine-tune file access, auto-approvals,
  and command execution.
- **MCP integration**: Connect external tools/services via Model Context
  Protocol.
- **Cursor rule import**: Directly import `.mdc` rule files from Cursor.
- **Multi-model support**: OpenAI, Anthropic, Google Gemini, Ollama, and more.

### What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Domain rules (7) | `.roo/rules/*.md` | `rules.yaml` (one file per domain) |

Generated domains: TypeScript, .NET, Python, Rust, security, blockchain, IaC.
Roo Code also reads `AGENTS.md` (always generated) after mode-specific rules.

### References

- [Roo Code Features Documentation](https://docs.roocode.com/features/)
- [Custom Instructions & Rules — DeepWiki](https://deepwiki.com/roovetgit/roo-code/5.3-custom-instructions-and-rules)
- [Roo Code: A Guide With Practical Examples — DataCamp](https://www.datacamp.com/tutorial/roo-code)
- [Roo Custom Modes — This Dot Labs](https://www.thisdot.co/blog/roo-custom-modes)
- [Cursor Rules for Roo Code integration](https://shdhumale.wordpress.com/2025/08/19/seamlessly-integrate-cursor-rules-into-your-roo-code-extension-for-vs-code/)
- [Community rules examples — GitHub](https://github.com/feature-foundation/feature)

---

## Continue

**Render target:** `ai`

### Platform Overview

Continue (continue.dev) is an open-source AI coding assistant for VS Code and
JetBrains. It uses `.continue/rules/` for project rules and supports a rich
ecosystem of shareable rule sets.

### Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project rules | `.continue/rules/*.md` | Markdown with optional YAML frontmatter |
| Hub/org rules | Continue Mission Control | Managed dashboard |
| Portable rules | `.continuerules` | Plain text |
| Cross-tool rules | `.cursorrules`, `.windsurfrules` | Auto-detected |

**Key capabilities:**

- **Local rules** in `.continue/rules/` — version-controlled, project-specific.
- **Hub/organization rules** for cross-project enforcement via dashboard.
- **YAML frontmatter** for categorization: `title`, `objective`, `severity`,
  `applies` (glob patterns).
- **Severity levels**: `block` (hard enforcement) or `warn` (soft guidance).
- **Format conversion**: The rules CLI can render rules for Cursor, Claude,
  Copilot, Cody, Codex, and more.
- **Multi-model support**: Assign different rules to distinct models, tasks,
  or agents.
- **Integration**: Works with local and remote LLMs (Ollama, Azure, AWS).
- **UI + CLI**: Visual Studio Code extension GUI and `rules-cli` for
  downloading, rendering, and publishing rule sets.

### What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Continue rules | `.ai/continuerules` | `templates/ai/continuerules` |
| Cursor rules | `.ai/cursorrules` | `templates/ai/cursorrules` |
| Windsurf rules | `.ai/windsurfrules` | `templates/ai/windsurfrules` |

These are portable rule files that work across multiple IDEs.

### References

- [Continue — Rules documentation](https://docs.continue.dev/customize/rules)
- [Awesome Rules — Curated rule collection](https://github.com/continuedev/awesome-rules)
- [Rules CLI Tool — GitHub](https://github.com/continuedev/rules)
- [Configuration Interface — DeepWiki](https://deepwiki.com/continuedev/continue/6.2-configuration-interface)

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

---

## See Also

- [TOOLS.md](./TOOLS.md) — Quick-reference table of what AgentKit Forge generates
- [CUSTOMIZATION.md](./CUSTOMIZATION.md) — How to customize overlays and settings
- [PROJECT_YAML_REFERENCE.md](./PROJECT_YAML_REFERENCE.md) — Project configuration schema
