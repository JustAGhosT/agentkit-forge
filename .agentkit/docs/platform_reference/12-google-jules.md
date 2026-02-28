# Google Jules

**Render target:** _(via AGENTS.md — no dedicated render target)_

| | |
|---|---|
| **Type** | Autonomous Cloud Coding Agent |
| **Categories** | Cloud / Autonomous Agent |
| **Access** | Web interface — [jules.google](https://jules.google/) — requires Google account and GitHub repo access |
| **Documentation** | [developers.google.com/jules](https://developers.google.com/jules) |
| **Performance Rating** | ⭐⭐⭐½ — **71/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--cloud--autonomous-agents)) |

---

## Platform Overview

Google Jules is Google's autonomous AI coding agent that works directly with
GitHub repositories. It reads `AGENTS.md` from the repo root before every task,
making it automatically compatible with AgentKit Forge's universal output.

Jules operates as a cloud-based agent, analyzing your codebase, creating plans,
and submitting pull requests — all driven by the instructions in `AGENTS.md`.

---

## Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project instructions | `AGENTS.md` (repo root) | Plain Markdown |

### Key Capabilities

- **AGENTS.md native**: Reads from repo root before every task execution.
- **Autonomous operation**: Analyzes code, creates plans, and submits PRs
  without continuous human interaction.
- **GitHub integration**: Works directly with GitHub repos — creates branches,
  commits, and pull requests.
- **Multi-step planning**: Breaks down complex tasks into executable steps.
- **Code understanding**: Deep analysis of project structure and dependencies.
- **Asynchronous execution**: Tasks run in the cloud while you work on
  other things.

---

## What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Agent instructions | `AGENTS.md` | Always generated from `project.yaml` |

Jules reads the universal `AGENTS.md` — no platform-specific files needed.

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| AGENTS.md | ✅ Reads before every task | ✅ Always generated | None |
| Task-specific instructions | ✅ Via AGENTS.md content | ✅ Included in AGENTS.md | None |
| Repo structure context | ✅ Analyzes automatically | ✅ Documented in AGENTS.md | None |
| Build/test commands | ✅ Reads from AGENTS.md | ✅ Included in AGENTS.md | None |
| Platform-specific config | ❌ No dedicated config system | N/A | No gap — Jules relies on AGENTS.md |

**Summary:** Jules is fully served by the universal `AGENTS.md`. No dedicated
render target or platform-specific files are needed. The comprehensiveness
of the generated `AGENTS.md` directly determines Jules' effectiveness.

---

## Recommendations

- Ensure `AGENTS.md` includes clear build, test, and lint commands (Jules
  needs these to verify its work).
- Include PR conventions and branch naming standards.
- Document key architectural decisions Jules should respect.

---

## Consolidated Rating

| Dimension | Score | Details |
|-----------|-------|---------|
| Coding Performance | 71/100 ⭐⭐⭐½ | [details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--cloud--autonomous-agents) |
| Developer Experience | 68/100 ⭐⭐⭐½ | [details](./PLATFORM_DEVELOPER_EXPERIENCE.md#category-matrix--cloud--autonomous-agents) |
| Cost & Value | 62/100 ⭐⭐⭐ | [details](./PLATFORM_COST_ANALYSIS.md#category-matrix--cloud--autonomous-agents) |
| Customization | 41/100 ⭐⭐ | [details](./PLATFORM_CUSTOMIZATION.md#category-matrix--cloud--autonomous-agents) |
| Privacy & Security | 49/100 ⭐⭐½ | [details](./PLATFORM_PRIVACY_SECURITY.md#category-matrix--cloud--autonomous-agents) |
| Team & Enterprise | 43/100 ⭐⭐ | [details](./PLATFORM_TEAM_ENTERPRISE.md#category-matrix--cloud--autonomous-agents) |
| **Weighted Total** | **62/100 ⭐⭐⭐** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **Async bug fixes** — fire-and-forget: describe the issue, get a PR later
- **Teams already using Gemini** — included in Gemini subscription plans
- **Low-effort maintenance tasks** — automated dependency updates, simple fixes
- **AGENTS.md-driven projects** — reads AGENTS.md before every task

### Not Ideal For

- **Interactive/iterative coding** — async-only, no real-time collaboration
- **Complex customization** — only reads AGENTS.md, no rules directory or skills
- **Enterprise governance** — emerging enterprise features, not yet mature
- **Time-sensitive tasks** — cloud execution introduces latency

---

## References

- [Google Jules — AI coding agent](https://jules.google/)
- [Google Jules documentation](https://developers.google.com/jules)
- [AGENTS.md open standard](https://agents.md/)
