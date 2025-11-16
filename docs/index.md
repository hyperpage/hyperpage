# Hyperpage Documentation Index

Hyperpage aggregates GitHub, GitLab, and Jira data into a single Next.js portal. The documentation is organized so you can install the stack, understand the architecture, and reason about the registry-driven tool system without wading through outdated promises.

## Getting Oriented

- [`README.md`](../README.md) – short project overview and quick start.
- [`docs/installation.md`](installation.md) – detailed setup, Node/Postgres requirements, and migration tips.
- [`docs/usage.md`](usage.md) – how the portal UI behaves (search, widgets, adaptive polling).
- [`docs/testing/index.md`](testing/index.md) – canonical Postgres-only test stack and commands.
- [`docs/tool-integration-system.md`](tool-integration-system.md) – registry contracts for tools, widgets, and OAuth metadata.
- [`docs/config-management.md`](config-management.md) – environment files, secrets, and deployment configuration.

## Architecture & Systems Reference

- [`docs/architecture/architecture.md`](architecture/architecture.md) – application topology, registry boundaries, security notes.
- [`docs/persistence.md`](persistence.md) – PostgreSQL schema, repositories, and migration strategy.
- [`docs/caching.md`](caching.md) – cache factory, Redis usage, and fallback behavior.
- [`docs/logging.md`](logging.md) and [`docs/monitoring.md`](monitoring.md) – Pino logging and Prometheus/Grafana integrations.
- [`docs/performance.md`](performance.md) – current middleware (batching + compression) and future optimization backlog.
- [`docs/ui.md`](ui.md) – component hierarchy, design system, and layout rules.

## Operations & Deployment

- [`docs/operations/deployment.md`](operations/deployment.md) – Docker Compose overlays, production notes, and CI hooks.
- [`docs/operations/scaling.md`](operations/scaling.md) – Redis-based session clustering and coordination, plus clearly marked future scaling ideas.
- [`docs/docker`](docker) – container-specific guidance.
- [`docs/roadmap.md`](roadmap.md) – focuses on the actual clean-up backlog instead of marketing claims.

## Current Capabilities (Shipped Today)

- Registry-driven widgets and APIs for GitHub, GitLab, Jira, and the aggregate Code Reviews / CI/CD / Ticketing surfaces.
- Adaptive polling driven by rate-limit telemetry (`useToolQueries` + `lib/rate-limit-utils`).
- PostgreSQL-only persistence via Drizzle with repositories for jobs, OAuth tokens, sessions, tool configs, and rate limits.
- `/api/batch` for grouped requests and `/api/metrics` for Prometheus exports.
- Redis-backed session manager with automatic memory fallback, suitable for multiple pods or processes.
- CI workflows that run linting, type-checking, vitest suites, and Playwright.

## Future Work & Research Notes

Some documents capture research or future-state designs. Each of those files now starts with a "Current Status" section that clarifies what is implemented versus planned. Treat sections labeled **Future Work** or **Design Reference** (for example in `docs/performance.md` or `docs/operations/scaling.md`) as aspirational.

## Support & Contributions

- Bug reports and feature requests go through GitHub issues.
- Read [`docs/CONTRIBUTING.md`](CONTRIBUTING.md) before sending pull requests.
- Security questions should follow the guidance in [`docs/security.md`](security.md).
