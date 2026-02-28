# Sourcegraph Cody

**Render target:** _(via AGENTS.md — no dedicated render target)_

---

## Platform Overview

Sourcegraph Cody is an AI coding assistant with deep code intelligence,
powered by Sourcegraph's code graph and search capabilities. It provides
code generation, explanation, and navigation across large codebases with
native support for `AGENTS.md`.

Cody is available as a VS Code extension, JetBrains plugin, and web interface.

---

## Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project instructions | `AGENTS.md` (repo root) | Plain Markdown |
| Cody config | `.cody/config.json` | JSON |
| Context filters | `.cody/ignore` | Gitignore-style patterns |

### Key Capabilities

- **AGENTS.md native**: Reads for project context and coding conventions.
- **Code graph intelligence**: Leverages Sourcegraph's code graph for
  precise, context-aware completions across entire codebases.
- **Multi-repo context**: Can search and understand code across multiple
  repositories simultaneously.
- **Custom commands**: Define reusable prompts and workflows.
- **Context filters**: Control which files/directories Cody can access.
- **Enterprise support**: Organization-wide policies and guardrails.
- **Multi-IDE**: VS Code, JetBrains, web interface.
- **Embeddings**: Generates and uses code embeddings for semantic search.

### Directory Structure Example

```
.cody/
  config.json
  ignore
```

---

## What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Agent instructions | `AGENTS.md` | Always generated from `project.yaml` |

Cody reads the universal `AGENTS.md`. No platform-specific files are
currently generated.

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| AGENTS.md | ✅ Native support | ✅ Always generated | None |
| .cody/config.json | ✅ Project configuration | ❌ Not generated | Could generate Cody config |
| .cody/ignore | ✅ Context file filtering | ❌ Not generated | Could generate ignore patterns |
| Custom commands | ✅ Reusable prompts | ❌ Not generated | Could generate Cody commands |
| Context filters | ✅ File/directory access control | ❌ Not generated | Could generate from project.yaml |
| Multi-repo context | ✅ Cross-repo search | N/A | Platform feature, needs Sourcegraph instance |

**Summary:** Cody is served by `AGENTS.md`. Gaps exist in `.cody/` directory
generation — config, ignore patterns, and custom commands. Adding a `cody`
render target would enable richer integration.

---

## Recommendations

- Consider adding a `cody` render target for dedicated file generation.
- Generate `.cody/ignore` from the same patterns used for `.geminiignore`.
- For enterprise users, document how AGENTS.md content maps to Cody's
  organization-wide policies.

---

## References

- [Sourcegraph Cody documentation](https://sourcegraph.com/docs/cody)
- [Cody VS Code extension](https://marketplace.visualstudio.com/items?itemName=sourcegraph.cody-ai)
- [Sourcegraph code intelligence](https://sourcegraph.com/docs/code-intelligence)
- [Cody custom commands](https://sourcegraph.com/docs/cody/capabilities/commands)
