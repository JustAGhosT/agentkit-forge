#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Hook: SessionStart
# Purpose: Detect installed tooling, show git status, and return environment
#          context so Claude has an accurate picture of the workspace.
# Stdin:   JSON with session_id, cwd, hook_event_name, etc.
# Stdout:  JSON with hookSpecificOutput.additionalContext
# ---------------------------------------------------------------------------
set -euo pipefail

# ── Read JSON payload from stdin ──────────────────────────────────────────
INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

# Fall back to $PWD when cwd is not supplied.
CWD="${CWD:-$PWD}"

# ── Detect installed tooling ─────────────────────────────────────────────
declare -a tools_found=()

detect_tool() {
    local name="$1"
    local cmd="$2"
    if command -v "$cmd" &>/dev/null; then
        local ver
        ver=$("$cmd" --version 2>/dev/null | head -n1) || ver="installed"
        tools_found+=("${name}: ${ver}")
    fi
}

detect_tool "Node.js"  "node"
detect_tool "pnpm"     "pnpm"
detect_tool "npm"      "npm"
detect_tool "dotnet"   "dotnet"
detect_tool "Cargo"    "cargo"
detect_tool "Python"   "python3"
detect_tool "Python"   "python"   # fallback if python3 is absent

tools_summary=""
if [[ ${#tools_found[@]} -gt 0 ]]; then
    tools_summary=$(printf '%s\n' "${tools_found[@]}")
else
    tools_summary="No recognised toolchains detected."
fi

# ── Git information ──────────────────────────────────────────────────────
git_summary=""
if command -v git &>/dev/null && git -C "$CWD" rev-parse --is-inside-work-tree &>/dev/null; then
    git_branch=$(git -C "$CWD" branch --show-current 2>/dev/null || echo "detached")
    git_status=$(git -C "$CWD" status --short 2>/dev/null || true)
    dirty_count=0
    if [[ -n "$git_status" ]]; then
        dirty_count=$(echo "$git_status" | wc -l | tr -d ' ')
    fi
    git_summary="Branch: ${git_branch} | Uncommitted files: ${dirty_count}"
else
    git_summary="Not a git repository (or git is not installed)."
fi

# ── Compose the environment summary ─────────────────────────────────────
env_summary=$(printf 'Session: %s\nWorking directory: %s\n\nToolchains:\n%s\n\nGit:\n%s' \
    "$SESSION_ID" "$CWD" "$tools_summary" "$git_summary")

# ── Return structured output ────────────────────────────────────────────
jq -n --arg ctx "$env_summary" '{
    hookSpecificOutput: {
        additionalContext: $ctx
    }
}'

exit 0
