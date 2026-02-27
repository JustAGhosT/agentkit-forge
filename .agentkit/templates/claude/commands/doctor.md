# /doctor

{{commandDescription}}

## Purpose

Diagnose AgentKit Forge setup and spec quality issues quickly.

## Workflow

1. Validate all spec files (`spec-validate`).
2. Verify required template roots exist for active render targets.
3. Check `.agentkit-repo` and overlay alignment.
4. Highlight high-impact missing `project.yaml` fields.
5. Suggest next actions sorted by impact.

## Output

- Overall status: PASS/WARN/FAIL
- Findings list with severity
- Suggested command sequence to remediate
