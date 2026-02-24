#!/usr/bin/env pwsh
# ---------------------------------------------------------------------------
# Hook: SessionStart
# Purpose: Detect installed tooling, show git status, and return environment
#          context so Claude has an accurate picture of the workspace.
# Stdin:   JSON with session_id, cwd, hook_event_name, etc.
# Stdout:  JSON with hookSpecificOutput.additionalContext
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Stop"

# -- Read JSON payload from stdin ------------------------------------------
try {
    $rawInput = @($input) -join ""
    $data = $rawInput | ConvertFrom-Json
} catch {
    $data = $null
}

$sessionId  = if ($data -and $data.PSObject.Properties['session_id'])  { $data.session_id }  else { "" }
$cwd        = if ($data -and $data.PSObject.Properties['cwd'])         { $data.cwd }         else { $PWD.Path }

if ([string]::IsNullOrWhiteSpace($cwd)) { $cwd = $PWD.Path }

# -- Detect installed tooling ----------------------------------------------
$toolsFound = [System.Collections.Generic.List[string]]::new()

function Test-Tool {
    param([string]$Name, [string]$Command)
    try {
        $cmd = Get-Command $Command -ErrorAction SilentlyContinue
        if ($cmd) {
            $ver = & $Command --version 2>$null | Select-Object -First 1
            if (-not $ver) { $ver = "installed" }
            $toolsFound.Add("${Name}: ${ver}")
        }
    } catch {
        # Tool not available -- skip.
    }
}

Test-Tool -Name "Node.js"  -Command "node"
Test-Tool -Name "pnpm"     -Command "pnpm"
Test-Tool -Name "npm"      -Command "npm"
Test-Tool -Name "dotnet"   -Command "dotnet"
Test-Tool -Name "Cargo"    -Command "cargo"
Test-Tool -Name "Python"   -Command "python3"
Test-Tool -Name "Python"   -Command "python"

if ($toolsFound.Count -gt 0) {
    $toolsSummary = $toolsFound -join "`n"
} else {
    $toolsSummary = "No recognised toolchains detected."
}

# -- Git information -------------------------------------------------------
$gitSummary = ""
try {
    $isGit = & git -C $cwd rev-parse --is-inside-work-tree 2>$null
    if ($isGit -eq "true") {
        $gitBranch = & git -C $cwd branch --show-current 2>$null
        if ([string]::IsNullOrWhiteSpace($gitBranch)) { $gitBranch = "detached" }
        $gitStatus = & git -C $cwd status --short 2>$null
        $dirtyCount = 0
        if ($gitStatus) {
            $dirtyCount = @($gitStatus).Count
        }
        $gitSummary = "Branch: $gitBranch | Uncommitted files: $dirtyCount"
    } else {
        $gitSummary = "Not a git repository (or git is not installed)."
    }
} catch {
    $gitSummary = "Not a git repository (or git is not installed)."
}

# -- Compose environment summary -------------------------------------------
$envSummary = @"
Session: $sessionId
Working directory: $cwd

Toolchains:
$toolsSummary

Git:
$gitSummary
"@

# -- Return structured output ----------------------------------------------
$output = @{
    hookSpecificOutput = @{
        additionalContext = $envSummary
    }
} | ConvertTo-Json -Depth 5

Write-Output $output
exit 0
