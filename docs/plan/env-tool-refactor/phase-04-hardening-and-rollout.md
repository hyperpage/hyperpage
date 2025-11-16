# Phase 04 – Hardening & Rollout

## Objective

Stabilize the new configuration pipeline, document usage, and roll the change through all environments with clear monitoring, rollback levers, and runbooks for future teams.

## Tasks

- [ ] Monitoring & Logging
  - Emit structured logs when TCS detects missing variables / disabled tools (include tool slug, env, source, correlation id).
  - Add metrics (count of enabled tools, config errors) to `/api/metrics` or Observability stack with dashboard + alert thresholds.
  - Capture refresh duration + failures in tracing so we can diagnose latency spikes.
  - Verify log redaction rules so secrets never leak.
- [ ] Documentation & Runbooks
  - Update README/setup docs to explain the new config pipeline and env file precedence with flowchart.
  - Document how to add a new tool (define metadata + update TCS requirements) with code snippets + checklist.
  - Document env overrides for staging/prod (e.g., secret manager injection) including who owns the secrets and how rotations happen.
  - Publish runbook for “No tools enabled” that references new observability signals and CLI debug steps.
- [ ] Migration + Cleanup
  - Remove temporary compatibility shims (e.g., old env checks, fallback code, feature flag scaffolding) once monitoring is stable.
  - Clean up `.env.*` references in docs that are no longer accurate and ensure templates reference the new CLI.
  - Archive the legacy setup wizard logic once the new flow is proven, including deleting unused API endpoints/tests.
  - File follow-up tickets for any remaining TODOs uncovered during rollout.
- [ ] Rollout Plan
  - Validate locally, in staging, and in production-like environments with documented sign-offs and bake times.
  - Provide a rollback plan (toggle to revert to old behavior if critical issues arise) with owner + response time goal.
  - Schedule canary release + monitoring watch window; define “go/no-go” checklist.
  - Communicate change (Slack + release notes) so support knows what signals to watch.

## Exit Criteria

- Monitoring confirms expected behavior (tools enabled per env, missing var alerts).
- Documentation/runbooks updated.
- Rollout complete across environments with sign-off from stakeholders and rollback plan tested.
- Alerting + dashboards handed off to on-call rotation with acknowledgement.
