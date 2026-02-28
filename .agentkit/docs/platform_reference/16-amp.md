# Amp

**Render target:** _(via AGENTS.md — no dedicated render target)_

---

## Platform Overview

Amp (by Sourcegraph) is an AI coding agent that runs in the terminal and
IDE, focused on autonomous multi-step coding tasks. It natively supports
`AGENTS.md` for project context and instructions.

---

## Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project instructions | `AGENTS.md` (repo root) | Plain Markdown |

### Key Capabilities

- **AGENTS.md native**: Reads for project context and coding conventions.
- **Autonomous execution**: Plans and executes multi-step coding tasks.
- **Code understanding**: Deep analysis of project structure and patterns.
- **Terminal + IDE**: Works in terminal and as IDE extension.
- **Git integration**: Creates branches, commits, and pull requests.
- **Multi-model**: Supports various LLM backends.
- **Tool use**: Can invoke build, test, and lint tools.

---

## What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Agent instructions | `AGENTS.md` | Always generated from `project.yaml` |

Amp reads the universal `AGENTS.md`. No platform-specific files needed.

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| AGENTS.md | ✅ Native support | ✅ Always generated | None |
| Platform-specific config | ❌ No known config system beyond AGENTS.md | N/A | No gap |

**Summary:** Amp is fully served by the universal `AGENTS.md`. As a relatively
new tool, its configuration surface is currently limited to `AGENTS.md`.
Monitor for future platform-specific configuration options.

---

## References

- [Amp by Sourcegraph](https://sourcegraph.com/amp)
- [Amp documentation](https://ampcode.com/docs)
- [AGENTS.md open standard](https://agents.md/)
