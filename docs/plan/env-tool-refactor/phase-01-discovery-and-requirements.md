# Phase 01 – Discovery & Requirements Alignment

## Objective

Understand the current tool enablement flow, catalog pain points, and lock requirements for the refactor (centralized config service, runtime-driven enablement, env-file precedence, DB overrides).

## Deliverables

- [ ] System diagram covering tool registration, `/api/tools/enabled`, env files, DB overrides, setup wizard, and runtime components.
- [ ] Inventory of existing environment sources: `.env.*`, Docker `env_file`, process env, DB overrides, feature flags.
- [ ] List of current issues (build-time env evaluation, confusing wizard expectations, E2E env drift, per-tool env parsing).
- [ ] Stakeholder requirements:
  - Ensure staging/prod secrets come from runtime env/secret manager.
  - Tools should never read env vars directly; the config service should do it.
  - API endpoint `/api/config/status` should rely on the new service.
  - Setup wizard must learn tool readiness from the service.
  - Central service should support DB overrides and future feature flags.
- [ ] Risk assessment + success criteria (e.g., no “No Tools Enabled” when `.env.e2e` is present, minimal rebuilds for env tweaks).

## Exit Criteria

- Requirements doc reviewed by backend + infra leads.
- Consensus on runtime config service design (scope, ownership, API surface).
