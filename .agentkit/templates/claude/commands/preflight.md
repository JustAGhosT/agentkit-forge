# /preflight

{{commandDescription}}

## Purpose

Run release-readiness checks beyond `/check` before merge/ship.

## Usage

`/preflight [--stack <stack>] [--range <git-range>] [--strict]`

## Checks

1. Run `/check` and fail on any quality gate error.
2. Verify changelog/release notes updates when user-facing behavior changed.
3. Validate commit messages in range follow conventional commit format.
4. Detect TODO/FIXME entries without issue references in changed files.
5. Confirm coverage did not regress.
6. Confirm docs updated for API/CLI behavior changes.

## Output

Provide a pass/fail table:

- Check
- Status
- Evidence
- Required follow-up
