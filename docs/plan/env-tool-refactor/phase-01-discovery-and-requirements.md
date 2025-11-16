# Phase 01 – Discovery & Requirements Alignment

## Objective

Understand the current tool enablement flow, catalog pain points, and lock requirements for the refactor (centralized config service, runtime-driven enablement, env-file precedence, DB overrides). The phase ends when ownership, data sources, and desired future behavior are documented with measurable acceptance criteria.

## Deliverables

- [ ] System/context diagram covering tool registration, `/api/tools/enabled`, env files, DB overrides, setup wizard, runtime components, and who owns each node.
- [ ] Sequence diagram for a single tool enablement request (env load → TCS decision → API response → UI) plus refresh/invalidation triggers.
- [ ] Inventory of existing environment sources: `.env.*`, Docker `env_file`, process env, DB overrides, feature flags, secret manager, CI/CD injections.
- [ ] Matrix mapping every tool to the env vars it needs, their source of truth, rotation frequency, current owner, and whether secrets are mirrored between environments.
- [ ] List of current issues (build-time env evaluation, confusing wizard expectations, E2E env drift, per-tool env parsing) linked to supporting incident/support ticket references.
- [ ] `process.env` usage audit: run repo-wide search, categorize references by tool/module, estimate migration complexity (critical path, blockers).
- [ ] Stakeholder requirements:
  - Ensure staging/prod secrets come from runtime env/secret manager.
  - Tools should never read env vars directly; the config service should do it.
  - API endpoint `/api/config/status` should rely on the new service.
  - Setup wizard must learn tool readiness from the service.
  - Central service should support DB overrides and future feature flags.
- [ ] Interview notes with backend lead, infra lead, setup wizard PM, QA lead, and security partner (covering ownership, UX expectations, validation requirements).
- [ ] Risk assessment + success criteria (e.g., no “No Tools Enabled” when `.env.e2e` is present, minimal rebuilds for env tweaks) with quantified impact where possible.
- [ ] RACI chart plus checkpoint calendar (weekly sync, async Slack channel, doc reviewers + due dates).

## Exit Criteria

- Requirements doc reviewed by backend + infra leads, setup wizard PM, QA lead, and security partner with sign-off recorded.
- Consensus on runtime config service design (scope, ownership, API surface) documented with approved API sketches and data contracts.
- All known blockers (access, data gaps) have owners and target resolution dates tracked in the risk log.
