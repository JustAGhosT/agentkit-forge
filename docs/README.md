# agentkit-forge — Documentation

Welcome to the agentkit-forge documentation hub. This index links to every
documentation category maintained by this repository.

## Categories

| # | Category | Description |
| --- | -------- | ----------- |
| 1 | [Product](./01_product/) | Product vision, strategy, personas, and metrics |
| 2 | [Specifications](./02_specs/) | Functional, technical, API, and data model specs |
| 3 | [Architecture](./03_architecture/) | System design, diagrams, ADRs, and tech stack |
| 4 | [API](./04_api/) | API reference, authentication, versioning, and errors |
| 5 | [Operations](./05_operations/) | Deployment, monitoring, incident response |
| 6 | [Engineering](./06_engineering/) | Setup, coding standards, testing, and git workflow |
| 7 | [Integrations](./07_integrations/) | External APIs, webhooks, and SDK |
| 8 | [Reference](./08_reference/) | Glossary, FAQ, changelog, and tool config |

## Quick Links

- [Product PRD](./01_product/01_prd.md)
- [Architecture Overview](./03_architecture/01_overview.md)
- [API Overview](./04_api/01_overview.md)
- [Development Setup](./06_engineering/01_setup.md)
- [Deployment Guide](./05_operations/01_deployment.md)
- [Glossary](./08_reference/01_glossary.md)
- [project.yaml Reference](./08_reference/05_project_yaml_reference.md)
- [PRD Library](./prd/README.md)

## Conventions

- Files prefixed with numbers (e.g. `01_`) define reading order.
- Do not edit generated files directly — run `pnpm -C .agentkit agentkit:sync`
  to regenerate them from the AgentKit Forge spec and overlays.
- New content belongs in the relevant category subdirectory.
- ADRs belong in `03_architecture/03_decisions/` and are numbered sequentially.
