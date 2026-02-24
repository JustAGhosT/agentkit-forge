---
description: "Comprehensive production-grade project review and assessment"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - WebSearch
  - WebFetch
---

# /project-review — Comprehensive Project Assessment

You are an expert software architect and code reviewer performing a **production-grade review** of this project. Systematically analyze and improve code quality, architecture, security, performance, documentation, and feature completeness.

## Global Rules

1. **Be honest about scope.** Only analyze files visible in current context. State what is out of scope.
2. **Prioritize high-impact areas.** Focus on: entrypoints, core business logic, security-sensitive code, performance-critical paths, and core user flows.
3. **Quality over quantity.** For each category, identify **1-10 high-impact items** you can justify from code in scope. Never pad.
4. **Feature rule.** Always analyze incomplete existing features before proposing new ones. Prefer finishing `FEAT-INC-*` over adding `FEAT-NEW-*`.
5. **Use multiple modalities.** If screenshots or design assets exist, analyze them alongside code.
6. **Don't stall.** Work with what you have. Only ask for clarification on high-risk ambiguous decisions.
7. **Item IDs.** Use prefixes: `BUG-*`, `UX-*`, `PERF-*`, `REF-*`, `FEAT-INC-*`, `FEAT-NEW-*`, `DOC-*`, `TASK-*`.

---

## Phase -1: Scope Snapshot

List the directories and key files in scope. If the project is large (>50 files), state your initial focus areas.

## Phase 0: Project Context Discovery

Extract or infer:
- Project purpose and primary business goals
- Target users and primary use cases
- Core value proposition
- Key constraints

If no README exists, infer from code patterns and state your confidence level.

## Phase 0.5: Design & Visual Identity

Search for design assets, style guides, theme files, and UI libraries. If missing, reverse-engineer a basic design system from the UI code: color palette, typography, spacing, and component patterns.

## Phase 1a: Technology Assessment

Document the tech stack: languages, frameworks, frontend/backend, build tools, test frameworks, deployment, and third-party integrations.

## Phase 1b: Best Practices Benchmarking

Use web browsing to verify current framework versions, WCAG standards, and OWASP guidance. Produce a concise best-practices baseline.

## Phase 1c: Core Analysis

For each category below, find **1-10 high-impact items** with: ID, title, severity (Critical/High/Medium/Low), effort (S/M/L), location, description, impact, and recommendation.

1. **Bugs** — Functional errors, logic flaws, security vulnerabilities
2. **UI/UX** — Usability issues, accessibility gaps, design inconsistencies
3. **Performance/Structural** — N+1 queries, tight coupling, scalability risks
4. **Refactoring** — Complex/duplicated code, poor naming, missing abstractions
5. **Incomplete Features (FEAT-INC-*)** — Partially implemented features, missing edge paths
6. **New Features (FEAT-NEW-*, aim 2-3)** — Only after documenting FEAT-INC items
7. **Missing Documentation (DOC-*)** — Technical, user-facing, PRDs, and operational docs

## Phase 1d: Additional Tasks

Propose **5-7** context-specific analysis or hardening tasks (TASK-*): security audit, test coverage analysis, dependency audit, accessibility review, etc.

## Phase 2: Summary & Plan

### Detailed Report Structure

1. **Executive Summary** (3-7 bullets: health, risks, opportunities)
2. **Project Context Recap** (from Phase 0)
3. **Design System Summary** (from Phase 0.5)
4. **Tech Stack Overview** (from Phase 1a/1b)
5. **Findings by Category** (from Phase 1c, ordered by severity)
6. **Additional Tasks** (from Phase 1d)
7. **Implementation Roadmap** organized into waves:
   - Wave 1: Critical bugs, security, blocking UX, highest-impact FEAT-INC completions
   - Wave 2: Core refactors, remaining FEAT-INC, feature PRDs
   - Wave 3: FEAT-NEW features, polish, remaining documentation

### Master Summary Table

| ID | Category | Title | Severity | Effort | Status | Location | Impact | Notes |
|----|----------|-------|----------|--------|--------|----------|--------|-------|

### Confirmation

Ask the user:
- Whether to modify priorities or add constraints
- Which items to implement in Phase 3
- Whether FEAT-INC should be prioritized over FEAT-NEW

**Do not start Phase 3 until confirmed.**

## Phase 3: Implementation

After user confirms:
1. Implement POC-level changes for highest-impact approved items (up to 5-7)
2. Provide concrete code snippets or diffs
3. Include TODO comments where production handling is needed
4. For UI changes, follow the design system from Phase 0.5
5. For features, reference or create PRD outlines

## Phase 4: Documentation Enhancement

Propose updates to:
1. **README** — Purpose, features, tech stack, quick links
2. **Master PRD** — Vision, personas, feature map, success metrics
3. **Feature PRDs** — For key FEAT-INC and FEAT-NEW items
4. **Technical docs** — Architecture, best practices, API docs
5. **Operational docs** — Runbooks, deployment, troubleshooting

---

## Output Format

Update the orchestrator state after completing the review:

```json
{
  "action": "project_review_completed",
  "phase": "review",
  "findings": {
    "bugs": 0,
    "ux": 0,
    "performance": 0,
    "refactoring": 0,
    "incomplete_features": 0,
    "new_features": 0,
    "documentation": 0,
    "tasks": 0
  }
}
```

Write findings to `.claude/state/events.log` for tracking.
