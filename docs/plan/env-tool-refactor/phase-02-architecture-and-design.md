# Phase 02 – Architecture & Design

## Objective

Design the centralized Tool Configuration Service (TCS) and supporting components (env loader, override resolver, API contracts) with enough detail for implementation, including data contracts, cache/refresh strategy, security boundaries, and migration plan.

## Scope

- TCS responsibilities:
  - Load env defaults (respecting env precedence: runtime overrides > DB overrides > `.env.*` defaults) with the ability to insert future sources (secret manager, feature flags).
  - Validate required vars per tool, produce readiness status, and annotate each var with confidence/source metadata.
  - Surface enablement decisions (`isEnabled`, `missingEnv`, `source`, `lastEvaluatedAt`, `requiresRestart`).
  - Provide a typed interface consumable by server modules and API routes plus a CLI helper for local debugging.
  - Define lifecycle hooks for refresh (initialization, per-request, manual invalidation, subscription to DB changes).
- Supporting pieces:
  - Env loader that supports `.env.dev`, `.env.e2e`, `.env.staging`, `.env.production`, etc., with explicit priority ordering and ability to override via `ENV_FILE` env var.
  - Adapter for `tool_configs` DB overrides including batching, caching, and optimistic updates for admin UI.
  - Extensibility plan for feature flags / secret managers (Vault, AWS Secrets Manager) with interface boundaries and security assumptions.
  - Data model for `/api/config/status`, `/api/tools/enabled`, and setup wizard components to consume TCS outputs.
  - Observability requirements (structured logs, metrics names, debug endpoints).

## Deliverables

- [ ] High-level architecture diagram showing where TCS lives (lib/service), how server entrypoints use it, and trust boundaries (who can access raw secrets).
- [ ] Detailed sequence diagram for config evaluation (file read → merge → validation → API serialization) for both boot-time and per-request flows.
- [ ] Interface definitions (TypeScript) for TCS (e.g., `getToolEnablement(toolSlug)`, `getAllToolsWithStatus()`, `getCoreReadiness()`, `subscribeToChanges()`) including input/output examples.
- [ ] Schema / JSON examples for `/api/config/status`, `/api/tools/enabled`, and wizard responses after refactor.
- [ ] Design notes describing env precedence, caching strategy, refresh behavior (on demand vs. boot), thread safety, error handling, and logging.
- [ ] Security considerations (how secrets are read, masked, cached, and audited).
- [ ] Plan for migrating existing modules:
  - Tool definitions stop reading `process.env`.
  - `/api/tools/enabled` uses TCS outputs instead of direct registry introspection (include pseudo-code diff).
  - Setup wizard and `/api/config/status` call TCS with defined fallbacks for partial data.
  - Portal / other consumers validated against new schema with backward compatibility window defined.
- [ ] Testing strategy (unit tests for TCS, integration tests for `/api/tools/enabled`, e2e verification) with named suites and acceptance criteria per endpoint.
- [ ] Rollout checklist (feature flag strategy, monitoring hooks) produced in partnership with Phase 04 owners.

## Exit Criteria

- Design reviewed/approved by backend + infra + security + frontend (wizard) owners with meeting notes stored in docs.
- Stories/tasks for Phase 03 implementation derived from the design with estimates, dependencies, and sequencing.
- Identified tech debt or open questions are logged with follow-up owners and due dates.
