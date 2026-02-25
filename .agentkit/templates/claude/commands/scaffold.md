# /scaffold

{{commandDescription}}

## Purpose

Generate implementation skeletons that follow project conventions and domain
rules before writing custom logic.

## Usage

`/scaffold --type <endpoint|component|module|migration|test|service> --name <name> [--stack <stack>] [--path <path>]`

## Workflow

1. Read `project.yaml`, `rules.yaml`, and relevant agent/team scopes.
2. Resolve target files and directories for the scaffold type.
3. Generate minimal, compilable skeleton files with TODO markers only where
   unavoidable.
4. Include tests and docs stubs when applicable.
5. Report generated files and next implementation steps.

## Guardrails

- Never overwrite non-generated files without explicit instruction.
- Keep generated outputs small and composable.
- Follow naming conventions and architecture patterns from `CLAUDE.md`.
