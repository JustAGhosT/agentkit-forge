# Roo Code

**Render target:** `roo`

---

## Platform Overview

Roo Code is an open-source AI coding assistant for VS Code (originally a Cline
fork) with powerful configuration via `.roo/rules/` and custom modes. It supports
multiple AI providers, mode-specific rules, and Cursor rule imports.

---

## Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project rules | `.roo/rules/*.md` | Markdown, plain text, or `.mdc` |
| Mode-specific rules | `.roo/rules-{mode}/*.md` | Markdown |
| Legacy rules | `.roorules`, `.roorules-{mode}` | Plain text |
| Cross-tool rules | Cursor `.mdc` files | Auto-detected |

### Key Capabilities

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
- **Multi-model support**: OpenAI, Anthropic, Google Gemini, Ollama, Z.AI
  GLM, and local models.
- **Task automation**: Boomerang tasks, checkpoints, auto-approving actions.
- **AGENTS.md support**: Loads after mode-specific rules, before generic rules.

### Directory Structure Example

```
.roo/
  rules/
    typescript.md
    security.md
    architecture.md
  rules-code/
    coding-standards.md
  rules-architect/
    design-patterns.md
  rules-debug/
    troubleshooting.md
```

---

## What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Domain rules (7) | `.roo/rules/*.md` | `rules.yaml` (one file per domain) |

Generated domains: TypeScript, .NET, Python, Rust, security, blockchain, IaC.
Roo Code also reads `AGENTS.md` (always generated) after mode-specific rules.

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| Project rules (.roo/rules/) | ✅ Markdown files | ✅ 7 domain rules generated | None |
| Mode-specific rules | ✅ `.roo/rules-{mode}/` | ❌ Not generated | Generate mode-specific rules (architect, code, debug) |
| Custom modes | ✅ Custom mode definitions | ❌ Not generated | Could map team roles to Roo modes |
| Configuration profiles | ✅ Per-project AI settings | ❌ Not generated | Could generate profile presets |
| Permission management | ✅ Fine-grained access control | ❌ Not generated | Could generate permission config |
| Legacy .roorules | ⚠️ Backward compatible | ❌ Not generated | Correct — legacy format |
| Cursor rule import | ✅ .mdc auto-detection | N/A | Works with Cursor rules if present |
| MCP integration | ✅ Tool connections | ❌ Not generated | Add MCP config |
| AGENTS.md support | ✅ Loads after mode rules | ✅ Always generated | None |
| Task automation | ✅ Boomerang tasks, checkpoints | ❌ Not generated | Could generate task templates |

**Summary:** Core domain rules are generated. Primary gap is mode-specific
rule generation — Roo Code's biggest differentiator. Mapping team roles
to Roo modes would significantly enhance integration.

---

## References

- [Roo Code Features Documentation](https://docs.roocode.com/features/)
- [Custom Instructions & Rules — DeepWiki](https://deepwiki.com/roovetgit/roo-code/5.3-custom-instructions-and-rules)
- [Roo Code: A Guide With Practical Examples — DataCamp](https://www.datacamp.com/tutorial/roo-code)
- [Roo Custom Modes — This Dot Labs](https://www.thisdot.co/blog/roo-custom-modes)
- [Cursor Rules for Roo Code integration](https://shdhumale.wordpress.com/2025/08/19/seamlessly-integrate-cursor-rules-into-your-roo-code-extension-for-vs-code/)
- [Community rules examples — GitHub](https://github.com/feature-foundation/feature)
- [Roo Code — AI Tool Review — Aigregator](https://aigregator.com/tools/roo-code)
