# Phase 02 – Architecture & Design

## Objective

Design the centralized Tool Configuration Service (TCS) and supporting components (env loader, override resolver, API contracts) with enough detail for implementation.

## Scope

- TCS responsibilities:
  - Load env defaults (respecting env precedence: runtime overrides > DB overrides > `.env.*` defaults).
  - Validate required vars per tool, produce readiness status.
  - Surface enablement decisions (`isEnabled`, `missingEnv`, `source`).
  - Provide a typed interface consumable by server modules and API routes.
- Supporting pieces:
  - Env loader that supports `.env.dev`, `.env.e2e`, `.env.staging`, `.env.production`, etc., with explicit priority ordering.
  - Adapter for `tool_configs` DB overrides.
  - Future support for feature flags / secret managers.
  - Data model for `/api/config/status` and `/api/tools/enabled` to consume TCS outputs.

## Deliverables

- [ ] High-level architecture diagram showing where TCS lives (lib/service) and how server entrypoints use it.
- [ ] Interface definitions (TypeScript) for TCS (e.g., `getToolEnablement(toolSlug)`, `getAllToolsWithStatus()`, `getCoreReadiness()` etc.).
- [ ] Design notes describing env precedence, caching strategy, refresh behavior (on demand vs. boot).
- [ ] Plan for migrating existing modules:
  - Tool definitions stop reading `process.env`.
  - `/api/tools/enabled` uses TCS outputs instead of direct registry introspection.
  - Setup wizard and `/api/config/status` call TCS.
- [ ] Testing strategy (unit tests for TCS, integration tests for `/api/tools/enabled`, e2e verification).

## Exit Criteria

- Design reviewed/approved by team.
- Stories/tasks for Phase 03 implementation derived from the design.
