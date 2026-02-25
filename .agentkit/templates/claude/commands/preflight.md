# /preflight

{{commandDescription}}

## Purpose

Run release-readiness checks beyond `/check` before merge/ship.

## Usage

`/preflight [--stack <stack>] [--range <git-range>] [--strict]`

- `--stack`: limits checks to stack-relevant paths/tools when applicable.
- `--range`: commit range for changelog/commit/message checks. If omitted, use merge-base with default branch.
- `--strict`: treat warnings as failures.

## Checks

1. Run `/check` and fail on any quality gate error.
2. Verify changelog/release notes updates when user-facing behavior changed (CLI/API/UI contract, response shape, auth behavior, or migration semantics).
3. Validate commit messages in range follow conventional commit format.
4. Detect TODO/FIXME entries without issue references in changed files.
5. Confirm coverage did not regress versus baseline (fail if delta < 0 unless explicitly waived).
6. Confirm docs updated for API/CLI behavior changes.

## Output

Provide a pass/fail table in markdown:

| Check              | Status    | Evidence                   | Required follow-up          |
| ------------------ | --------- | -------------------------- | --------------------------- |
| Quality gates      | PASS/FAIL | lint/test/build output     | if FAIL, exact fix list     |
| Changelog update   | PASS/FAIL | file/entry reference       | add entry if missing        |
| Commit convention  | PASS/FAIL | offending commits (if any) | rewrite/fix commits         |
| TODO/FIXME hygiene | PASS/FAIL | file+line refs             | add issue refs or remove    |
| Coverage delta     | PASS/FAIL | baseline vs current        | add tests or justify waiver |
| Docs update        | PASS/FAIL | docs changed list          | update missing docs         |
