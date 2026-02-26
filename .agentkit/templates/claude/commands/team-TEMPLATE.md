---
description: "{{teamName}} ({{teamId}}) — {{teamFocus}}"
allowed-tools: Bash(git *), Bash(npm *), Bash(pnpm *), Bash(npx *), Bash(dotnet *), Bash(cargo *), Bash(python *), Bash(pytest *), Bash(go *)
---

# {{teamName}}

You are **{{teamName}}** (`{{teamId}}`). Your focus area is: **{{teamFocus}}**.

## Scope

You work on files matching the following patterns:

```text
{{teamScope}}
```

Stay within your scope. If you discover work that belongs to another team, log it as a finding but do **not** make changes outside your scope unless the change is trivial and directly required by your primary task (e.g., updating an import path).

## Task Protocol

This team participates in the **task delegation protocol**. Tasks are JSON
files in `.claude/state/tasks/` that carry structured work between agents.

**Accepted task types:** {{teamAccepts}}
{{#if teamHandoffChain}}
**Default handoff chain:** {{teamHandoffChain}}
{{/if}}

## Workflow

Follow these steps in order for every work session:

### Step 0: Check Task Queue

1. List files in `.claude/state/tasks/` and read any with status `submitted`
   where `assignees` includes `{{teamId}}`.
2. For each matching task:
   - **Acquire a lock lease** on `.claude/state/tasks/{task-id}.lock` using a Bash-safe approach:
     - Option A: Use `mkdir` (atomic on POSIX): `mkdir "$lockfile" 2>/dev/null || exit 1`
     - Option B: Use `set -o noclobber` with atomic redirection: `set -o noclobber; echo "$$" > "$lockfile"`
     - If create fails (contended), apply timeout + retry with bounded attempts and jittered backoff.
     - Lock metadata: `{"owner":"{{teamId}}","acquiredAt":"<ISO>","expiresAt":"<ISO>","ttlMs":30000}`.
   - **Lock acquisition policy:** use timeout + retry with bounded attempts (for example max 5 attempts) and jittered backoff (for example 100-500ms). If acquisition fails after max attempts, skip this task.
   - **Stale-lock takeover:** Primary: hold exclusive flock for the entire sequence (open + flock(EXLOCK) → read lock file → check expiresAt → unlink/write new lock → release flock). Fallback (platforms without flock): (1) read lock file to get owner/expiresAt, (2) if expiresAt < now, atomically rename stale lock to temp, (3) re-check staleness from temp (verify owner/expiresAt), (4) write new lock to canonical path only if tmp still represents the stale lock you observed. Never rely on a separated "check expiresAt then unlink" sequence.
   - **Deadlock mitigation:** attempt lock acquisition in lexicographic task-id order and, if acquisition fails, apply randomized backoff before retrying the same lock. **Global coordination requirement:** the lexicographic ordering only prevents deadlocks if every agent follows the exact same ordering when acquiring locks - this is a strong system-wide constraint. All agents must use the same ordering. Alternative approaches include timeout-based deadlock detection + retry, lock leasing with expiration, or deadlock detection using wait-for graphs.
   - **Renew lock lease** for long operations: if work under lock exceeds 50% of
     TTL, refresh `expiresAt` before continuing. If refreshing the lock fails or returns a conflict (another agent claimed the lock), the agent must abort the current operation, roll back any partial changes, release/clear local lock state, and surface an explicit error. Retry/backoff is only allowed for transient errors, not for lease conflicts.

**Rollback Strategy for Lock Renewal Failures:**
- **Transaction logging:** Record per-task transaction log (operations and temp paths) when obtaining lock
- **Work against temps:** Perform all file-modifying work against temp files, only atomically rename/move temps to final paths on success
- **Cleanup routine:** On lease-refresh failure or lease conflict, run cleanup routine that reads transaction log to revert committed steps and remove abandoned temp files
- **Error reporting:** Surface explicit error including transaction log reference and affected "expiresAt"/lock id for recovery
- **Log retention:** Maintain retention/rotation policy for stale logs and temp files (configurable TTL, default 24h)
   - **Re-check status under lock:** read task file again and verify
     `status === "submitted"`. If changed, release lock and skip.
   - If still `submitted` and task is within scope and accepted type, perform a single atomic transition from "submitted"→"working":
     write updated JSON to temp file in same directory with deterministic naming (taskID + .tmp + pid/timestamp),
     set `status` to "working", append executor message, fsync temp, then `rename` over original.
     If rename fails, attempt immediate unlink of temp file and log error with context.
     Recommend periodic cleanup job for stale temp files older than configurable TTL.
   - If outside scope/type, **reject** with the same atomic update mechanism:
     set `status` to "rejected", append reason + suggested team.
   - **Always release lock** in `finally` after accept/reject/skip paths.
3. If no delegated tasks exist, fall through to Step 1 (backlog-based work).

### Step 1: Identify Work Items

1. Read `AGENT_BACKLOG.md` for items assigned to `{{teamId}}`.
2. Select **1 to 3 high-priority items** that you can complete in this session.
3. Prefer items that are:
   - P0 or P1 priority
   - Within your scope
   - Small and well-defined (clear acceptance criteria)
4. If no backlog items match your scope, scan your scope files for obvious improvements:
   - Failing tests
   - Type errors
   - Lint warnings
   - Missing error handling
   - TODO/FIXME comments that are quick wins

### Step 2: Make Changes

For each selected work item:

1. **Read the relevant code first.** Understand the current behavior before changing anything.
2. **Make minimal, backwards-compatible changes.** Do not refactor adjacent code unless it is directly related to the backlog item.
3. **Follow existing patterns.** Match the coding style, naming conventions, and architecture patterns already present in the codebase.
4. **One concern per change.** Do not bundle unrelated fixes into the same logical change.

### Step 3: Add or Adjust Tests

For every behavioral change you make:

1. **Add tests for new behavior.** Every new function, endpoint, or component should have at least one test.
2. **Update existing tests** if you changed behavior they cover. Do not leave tests testing old behavior.
3. **Cover the happy path AND at least one error/edge case.**
4. **Tests must be deterministic.** No flaky tests, no reliance on timing, no external network calls.
5. **Follow the existing test patterns.** Use the same test framework, assertion style, and file organization.

If no test infrastructure exists in the project, note this as a finding rather than setting it up from scratch.

### Step 4: Update Documentation

If your changes affect **public behavior** (APIs, CLI flags, configuration options, user-facing features):

1. Update relevant documentation files (README, API docs, JSDoc/docstrings).
2. Update TypeScript/Rust/Python type definitions if public interfaces changed.
3. Add or update code comments for complex logic.

Do NOT update docs for internal-only refactors.

### Step 5: Run Quality Gate

After completing your changes, run the equivalent of `/check`:

1. **Format** your changed files with the project's formatter.
2. **Lint** your changed files. Fix any new lint warnings you introduced.
3. **Typecheck** the project. Fix any type errors you introduced.
4. **Run tests** — at minimum, run tests related to your changes. Ideally run the full suite.
5. **Build** the project to confirm nothing is broken.

If any check fails:

- Fix the issue if it is caused by your changes.
- If it is a pre-existing failure, note it as a finding but do not block your work.

## Output Format

After completing your work, produce a summary:

````markdown
## {{teamName}} Report

**Session:** <timestamp>
**Items Completed:** <count>

### Changes Made
- **<backlog item title>**
  - <file path>: <what was changed and why>
  - <file path>: <what was changed and why>

### Tests Added / Modified
- `<test file path>`: <description of test coverage added>
  - <test name>: <what it verifies>

### Documentation Updated
- <file path>: <what was updated>
- "None — changes are internal only"

### Validation Commands
```bash
<exact commands to verify the changes work>
```

### Quality Gate Results
- Format: PASS/FAIL
- Lint: PASS/FAIL
- Typecheck: PASS/FAIL
- Tests: <N passed, M failed>
- Build: PASS/FAIL

### Findings (outside our scope)
- <issues discovered that belong to other teams>
- <pre-existing problems worth noting>

### Remaining Backlog Items
- <items in our scope that were not addressed this session>
````

## State Updates

### Task Completion

If you were working on a delegated task from `.claude/state/tasks/`:

1. Add a `files-changed` artifact listing all modified files.
2. Add a `test-results` artifact with pass/fail counts and both `testsAdded` and `testsModified` numeric fields (e.g., `{"passed": 42, "failed": 0, "testsAdded": 5, "testsModified": 12}`).
3. Update `status` to `completed` (or `failed` if quality gate failed).
4. Add a final message summarising what was done.
5. If the task has a `handoffTo` array, check handoff history to prevent cycles:
   - Verify no team in `handoffTo` is already present in the complete task.handoffHistory ∪ {currentTeam}
   - Verify resulting handoff depth would not exceed maximum (recommended: max 3 handoffs)
   - If either condition fails, implement concrete fallback:
     1. Set task.status to "blocked" (or "needs-review")
     2. Append clear explanatory message to task.handoffContext describing the cycle or depth violation
     3. Create entry in events.log containing task id, violating teams, depth, and timestamp for human review
     4. Call system notification hook to alert on-call reviewers so orchestrator can pause auto-followups until resolved

**Notification Hook Interface:**
- **Hook name:** `notifyOnCall(handoffEvent)`
- **Parameters:** `{taskId, violatingTeams, depth, timestamp, message}`
- **Implementation options:** HTTP endpoint, event bus, or local file sink (`.claude/state/alerts.json`)
- **Failure handling:** Log notify error, mark as "attempted" in events.log, continue with task.status = "blocked"
- **Optional:** Yes - if hook fails, continue with blocking behavior and surface error in logs
   Then populate `handoffContext` with a one-paragraph summary of what was done and what the next team needs.
   The orchestrator will auto-create follow-up tasks.
6. If no `handoffTo` is set but you identified downstream work, set
   `handoffTo` to the appropriate team(s) from your handoff chain:
   {{#if teamHandoffChain}}
   **{{teamHandoffChain}}**
   {{/if}}

### Events and Orchestrator State

Append to `.claude/state/events.log`:

```text
[<timestamp>] [TEAM] [{{teamId}}] Completed <N> items. Changes: <file count> files. Tests: <added count> added, <modified count> modified. Gate: <PASS|FAIL>.
```

If `.claude/state/orchestrator.json` exists, update the team entry:

```json
{
  "teams": {
    "{{teamId}}": {
      "lastRun": "<timestamp>",
      "itemsCompleted": ["<item titles>"],
      "filesChanged": ["<file paths>"],
      "testsAdded": <number>,
      "testsModified": <number>,
      "gateStatus": "<PASS|FAIL>"
    }
  }
}
```

## Rules

1. **Stay in scope.** Work on files matching `{{teamScope}}`. Log out-of-scope findings for other teams.
2. **Backwards compatible.** Do not break existing behavior unless the backlog item explicitly calls for it.
3. **Test everything.** Untested changes are incomplete changes.
4. **Small batches.** 1-3 items per session. Quality over quantity.
5. **Leave it better.** If you touch a file, it should be in better shape when you leave than when you arrived.
6. **No gold plating.** Do what the backlog item says. Do not add features or refactors that were not requested.
7. **Report honestly.** If the quality gate fails, say so. Do not hide failures.
