# Cline

**Render target:** `cline`

| | |
|---|---|
| **Type** | AI Coding Assistant (VS Code extension) |
| **Categories** | IDE Extension |
| **Access** | VS Code extension — install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev) |
| **Documentation** | [docs.cline.bot](https://docs.cline.bot/) |
| **Performance Rating** | ⭐⭐⭐½ — **73/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--ide-extensions)) |

---

## Platform Overview

Cline is an open-source VS Code extension with a robust `.clinerules/` directory
system for defining project-specific rules, coding standards, and AI behavior.
It also supports cross-tool compatibility with `.cursorrules`, `.windsurfrules`,
and `AGENTS.md`.

---

## Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project rules | `.clinerules/*.md` | Markdown or plain text |
| Global rules | `~/Documents/Cline/Rules/` (macOS/Linux) | Markdown or plain text |
| Cross-tool rules | `.cursorrules`, `.windsurfrules`, `AGENTS.md` | Auto-detected |

### Key Capabilities

- **Workspace rules** in `.clinerules/` are version-controlled and shared
  with the team.
- **Global rules** for personal standards across all projects.
- **Rule precedence**: Project rules override global rules.
- **Cross-tool compatibility**: Detects rules from Cursor, Windsurf, AGENTS.md.
- **Toggleable rules**: Enable/disable via Cline's UI per project or globally.
- **Modularity**: Organize by topic (`01-coding.md`, `02-testing.md`).
  Numeric prefixes help ordering; rules are automatically combined.
- **AI-editable**: Cline can read, write, and update `.clinerules` files
  interactively — a living, adaptable project compass.
- **Advanced memory**: Supports `rules`, `memory`, `directory-structure`
  files for phased workflows and context snapshots.
- **MCP integration**: Integrates with Model Context Protocol tools.
- **AGENTS.md support**: Loads alongside `.clinerules/`.

### Directory Structure Example

```
your-project/
├── .clinerules/
│   ├── 01-coding-standards.md
│   ├── 02-testing.md
│   ├── api-style-guide.md
│   └── architecture.md
├── AGENTS.md
├── src/
└── ...
```

Advanced structure:
```
.clinerules/
├── rules          # Phased workflow rules
├── memory         # Project/sprint context snapshots
└── directory-structure  # Codebase map for AI navigation
```

---

## What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Domain rules (7) | `.clinerules/*.md` | `rules.yaml` (one file per domain) |

Generated domains: TypeScript, .NET, Python, Rust, security, blockchain, IaC.
Cline also reads `AGENTS.md` (always generated) for universal context.

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| Project rules (.clinerules/) | ✅ Markdown files, version-controlled | ✅ 7 domain rules generated | None |
| Global rules | ✅ `~/Documents/Cline/Rules/` | ❌ Not generated | User-level, not project-scoped |
| Cross-tool detection | ✅ .cursorrules, .windsurfrules, AGENTS.md | ✅ AGENTS.md always generated | None |
| Toggleable rules | ✅ UI enable/disable | N/A | Platform UI feature |
| Numeric ordering | ✅ Prefix-based ordering | ⚠️ Not using prefixes | Could add numeric prefixes to generated rules |
| AI-editable rules | ✅ Cline can modify rules | N/A | Platform feature |
| Memory files | ✅ Context snapshots, project history | ❌ Not generated | Could generate memory/context templates |
| Directory structure file | ✅ Codebase map for navigation | ❌ Not generated | Could generate from project.yaml |
| Phased workflows | ✅ Requirements → planning → implementation | ❌ Not generated | Could generate workflow phase rules |
| MCP integration | ✅ Tool connections | ❌ Not generated | Add MCP config |
| AGENTS.md support | ✅ Loads alongside .clinerules/ | ✅ Always generated | None |

**Summary:** Core domain rules are generated. Key gaps are memory/context
templates, directory structure generation, phased workflow rules, and numeric
ordering prefixes.

---

## References

- [Cline — Rules documentation](https://docs.cline.bot/customization/cline-rules)
- [.clinerules: Version-Controlled, Shareable Instructions](https://cline.ghost.io/clinerules-version-controlled-shareable-and-ai-editable-instructions/)
- [Mastering .clinerules Configuration](https://ai.rundatarun.io/AI+Development+%26+Agents/mastering-clinerules-configuration)
- [Cline Rules — DeepWiki](https://deepwiki.com/cline/cline/7.1-cline-rules)
- [The Ultimate Guide to .clinerules](https://learn-cursor.com/en/blog/posts/cline-rules-ultimate-guide)
- [Cline Rules — VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ai-henryalps.clinerules)
- [AGENTS.md support proposal — GitHub](https://github.com/cline/cline/issues/5033)
- [Comprehensive Cline Project Guide](https://cline-project-guide.vercel.app/)
