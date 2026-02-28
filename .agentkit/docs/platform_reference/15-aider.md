# Aider

**Render target:** _(via AGENTS.md — no dedicated render target)_

---

## Platform Overview

Aider is an open-source AI pair programming tool that works in the terminal.
It reads `AGENTS.md` for project context and also supports a dedicated
conventions file for coding standards. Aider works with multiple LLM providers
(OpenAI, Anthropic, local models) and supports advanced git integration.

---

## Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project instructions | `AGENTS.md` (repo root) | Plain Markdown |
| Conventions file | `.aider.conventions.md` | Plain Markdown |
| Config file | `.aider.conf.yml` | YAML |
| Model config | `.aider.model.settings.yml` | YAML |
| Environment | `.env` | Key-value pairs |
| Ignore patterns | `.aiderignore` | Gitignore-style patterns |

### Key Capabilities

- **AGENTS.md native**: Reads for project context and instructions.
- **Conventions file**: `.aider.conventions.md` for coding standards,
  style guides, and project-specific rules.
- **Git integration**: Automatic commits, intelligent diffs, git history
  awareness for context.
- **Multi-file editing**: Edit multiple files in a single conversation.
- **Repository mapping**: Understands project structure via repo map.
- **Multi-model support**: OpenAI, Anthropic, Gemini, Ollama, and more.
- **Architect mode**: Plan-then-implement workflow with separate models.
- **Watch mode**: Monitor file changes and auto-apply AI suggestions.
- **Linting integration**: Auto-fix linting errors after code changes.
- **Testing integration**: Run tests and auto-fix failures.

### Configuration Files

```
project/
├── AGENTS.md                    # Project instructions
├── .aider.conventions.md        # Coding standards
├── .aider.conf.yml              # Tool configuration
├── .aider.model.settings.yml    # Model preferences
├── .aiderignore                 # Files to exclude
└── .env                         # API keys
```

### Example .aider.conf.yml

```yaml
model: claude-sonnet-4-20250514
auto-commits: true
auto-lint: true
auto-test: true
test-cmd: npm test
lint-cmd: npm run lint
```

---

## What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Agent instructions | `AGENTS.md` | Always generated from `project.yaml` |

Aider reads the universal `AGENTS.md`. No platform-specific files are
currently generated.

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| AGENTS.md | ✅ Native support | ✅ Always generated | None |
| .aider.conventions.md | ✅ Coding standards file | ❌ Not generated | Generate conventions from project.yaml |
| .aider.conf.yml | ✅ Tool configuration | ❌ Not generated | Generate config with build/test commands |
| .aiderignore | ✅ File exclusion | ❌ Not generated | Generate from project.yaml patterns |
| .aider.model.settings.yml | ✅ Model preferences | ❌ Not generated | Could generate model presets |
| Architect mode config | ✅ Plan-then-implement | ❌ Not configured | Could configure architect mode defaults |
| Git integration | ✅ Auto-commits, diffs | N/A | Platform feature |

**Summary:** Aider is served by `AGENTS.md` but has significant configuration
surface that could be generated. The `.aider.conventions.md` file is the
highest-value gap — it's where Aider looks for coding standards beyond
what's in AGENTS.md. Adding an `aider` render target would enable richer
integration.

---

## Recommendations

- Consider adding an `aider` render target for dedicated file generation.
- Generate `.aider.conventions.md` from the conventions section of `project.yaml`.
- Generate `.aider.conf.yml` with test/lint commands from `project.yaml`.
- Generate `.aiderignore` from common exclusion patterns.

---

## References

- [Aider documentation](https://aider.chat/)
- [Aider conventions file](https://aider.chat/docs/config/conventions.html)
- [Aider configuration](https://aider.chat/docs/config.html)
- [Aider model configuration](https://aider.chat/docs/config/model-settings.html)
- [Aider GitHub repository](https://github.com/Aider-AI/aider)
- [Aider with AGENTS.md](https://aider.chat/docs/config/agents-md.html)
