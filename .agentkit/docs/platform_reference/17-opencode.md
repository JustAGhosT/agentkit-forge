# OpenCode

**Render target:** _(via AGENTS.md — no dedicated render target)_

---

## Platform Overview

OpenCode is an open-source terminal-based AI coding assistant that natively
supports `AGENTS.md` for project instructions. It provides an interactive
terminal UI for code generation, editing, and project navigation.

---

## Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project instructions | `AGENTS.md` (repo root) | Plain Markdown |
| Config | `~/.config/opencode/config.json` | JSON |

### Key Capabilities

- **AGENTS.md native**: Reads for project context and coding conventions.
- **Terminal UI**: Rich interactive terminal interface for coding tasks.
- **Multi-model support**: Works with multiple LLM providers.
- **File operations**: Read, write, and navigate project files.
- **Shell integration**: Execute commands and analyze output.
- **Open source**: Community-driven development and extensibility.

---

## What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Agent instructions | `AGENTS.md` | Always generated from `project.yaml` |

OpenCode reads the universal `AGENTS.md`. No platform-specific files needed.

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| AGENTS.md | ✅ Native support | ✅ Always generated | None |
| Config file | ✅ JSON config | ❌ Not generated | Could generate project config |
| Platform-specific features | ⚠️ Limited config surface | N/A | Monitor for future expansion |

**Summary:** OpenCode is fully served by the universal `AGENTS.md`. Its
configuration surface is minimal beyond AGENTS.md. Monitor for future
platform-specific configuration options.

---

## References

- [OpenCode — GitHub](https://github.com/opencode-ai/opencode)
- [AGENTS.md open standard](https://agents.md/)
