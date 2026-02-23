# Customization

How to configure agentkit-forge for your project using overlays and settings.

## How Overlays Work

Agentkit-forge uses a layered configuration system:

1. **Spec files** in `agentkit/spec/` are the canonical source of truth. These define the default slash commands, rules, settings, and templates that ship with agentkit-forge.

2. **Overlays** in `agentkit/overlays/<repoName>/` customize the spec on a per-project basis. Each repository gets its own overlay directory.

3. On **`agentkit init`**, the `__TEMPLATE__` overlay is copied to a new directory named after your repository. This gives you a starting point for customization.

### Merge Semantics

When the spec and overlay are merged during `agentkit sync`:

- **Templates** (`.md` files, command definitions): File-level replace. If the overlay contains a file with the same name as a spec file, the overlay version completely replaces the spec version.
- **Settings** (`.yaml` configuration): Data-level union. Overlay settings are merged into spec settings. For permission lists, **deny wins** -- if a command appears in both `allow` and `deny`, it is denied.

### Directory Structure

```
agentkit/
  spec/               # Canonical defaults
    commands/
    rules/
    settings.yaml
  overlays/
    __TEMPLATE__/      # Copied on init
    my-project/        # Your project-specific overlay
      commands/
      rules/
      settings.yaml
```

## Common Customization Patterns

### 1. Adding a Custom Slash Command

Create a new `.md` file in your overlay's commands directory:

```
agentkit/overlays/<repoName>/commands/my-command.md
```

The file should follow the standard command template format with a frontmatter section defining the command name, description, and any parameters. When you run `agentkit sync`, the command will be generated into `.claude/commands/`.

### 2. Adding Domain-Specific Rules

Add rules to `rules.yaml` in your overlay directory:

```yaml
# agentkit/overlays/<repoName>/rules/rules.yaml
rules:
  - id: use-repository-pattern
    description: "All data access must go through repository classes"
    scope: "src/data/**"

  - id: no-direct-sql
    description: "Never write raw SQL; use the ORM query builder"
    scope: "src/**"
```

These rules are injected into the AI agent context and guide code generation and review.

### 3. Restricting Permissions

Add commands to the deny list in your overlay's `settings.yaml`:

```yaml
# agentkit/overlays/<repoName>/settings.yaml
permissions:
  deny:
    - "rm -rf /"
    - "docker system prune"
    - "git push --force"
    - "DROP DATABASE"
```

Because deny wins during merge, these restrictions cannot be overridden by the base spec's allow list.

### 4. Changing the Primary Tech Stack

Set `primaryStack` in your overlay settings to influence how agents generate code and select tools:

```yaml
# agentkit/overlays/<repoName>/settings.yaml
primaryStack: "dotnet"
```

This affects template selection, default linting rules, and which build/test commands the agents prefer.

## Settings Reference

### Permissions

```yaml
permissions:
  allow:
    - "npm test"
    - "npm run build"
    - "dotnet test"
  deny:
    - "rm -rf"
    - "git push --force"
```

- `permissions.allow` -- List of bash commands and patterns that agents are permitted to run.
- `permissions.deny` -- List of bash commands and patterns that agents are forbidden from running. **Deny always wins** over allow.

### Hooks

```yaml
hooks:
  sessionStart: ".claude/hooks/session-start.sh"
  preToolUse: ".claude/hooks/pre-tool-use.sh"
  postToolUse: ".claude/hooks/post-tool-use.sh"
  stop: ".claude/hooks/stop.sh"
```

- `hooks.sessionStart` -- Runs when a new Claude Code session begins.
- `hooks.preToolUse` -- Runs before each tool invocation. Can block tool use by returning a non-zero exit code.
- `hooks.postToolUse` -- Runs after each tool invocation. Useful for logging and validation.
- `hooks.stop` -- Runs when the agent is about to stop. Used to enforce continuation or trigger handoff generation.

### Cost Tracking

```yaml
costTracking:
  enabled: true
  logDir: ".claude/costs/"
  retentionDays: 30
```

- `costTracking.enabled` -- Whether to log token usage and estimated costs.
- `costTracking.logDir` -- Directory where cost log files are written.
- `costTracking.retentionDays` -- Number of days to retain cost logs before automatic cleanup.

## Example Overlays

### Web App (Node.js)

```yaml
# agentkit/overlays/my-web-app/settings.yaml
primaryStack: "node"

permissions:
  allow:
    - "npm test"
    - "npm run build"
    - "npm run lint"
    - "npx next build"
  deny:
    - "npm publish"

hooks:
  postToolUse: ".claude/hooks/post-tool-use.sh"

costTracking:
  enabled: true
  logDir: ".claude/costs/"
  retentionDays: 14
```

### API Service (.NET)

```yaml
# agentkit/overlays/my-api-service/settings.yaml
primaryStack: "dotnet"

permissions:
  allow:
    - "dotnet test"
    - "dotnet build"
    - "dotnet run"
    - "dotnet ef migrations"
  deny:
    - "dotnet ef database drop"
    - "rm -rf bin/"

hooks:
  preToolUse: ".claude/hooks/pre-tool-use.sh"
  stop: ".claude/hooks/stop.sh"

costTracking:
  enabled: true
  logDir: ".claude/costs/"
  retentionDays: 30
```

### Monorepo (pnpm Workspaces)

```yaml
# agentkit/overlays/my-monorepo/settings.yaml
primaryStack: "node"

permissions:
  allow:
    - "pnpm test"
    - "pnpm build"
    - "pnpm lint"
    - "pnpm --filter"
    - "turbo run build"
    - "turbo run test"
  deny:
    - "pnpm publish"
    - "npm publish"

hooks:
  sessionStart: ".claude/hooks/session-start.sh"
  preToolUse: ".claude/hooks/pre-tool-use.sh"
  postToolUse: ".claude/hooks/post-tool-use.sh"
  stop: ".claude/hooks/stop.sh"

costTracking:
  enabled: true
  logDir: ".claude/costs/"
  retentionDays: 7
```
