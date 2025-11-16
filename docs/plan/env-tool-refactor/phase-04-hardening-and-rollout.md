# Phase 04 – Hardening & Rollout

## Objective

Stabilize the new configuration pipeline, document usage, and roll the change through all environments.

## Tasks

- [ ] Monitoring & Logging
  - Emit structured logs when TCS detects missing variables / disabled tools.
  - Add metrics (count of enabled tools, config errors) to `/api/metrics` or Observability stack.
- [ ] Documentation & Runbooks
  - Update README/setup docs to explain the new config pipeline and env file precedence.
  - Document how to add a new tool (define metadata + update TCS requirements).
  - Document env overrides for staging/prod (e.g., secret manager injection).
- [ ] Migration + Cleanup
  - Remove temporary compatibility shims (e.g., old env checks, fallback code).
  - Clean up `.env.*` references in docs that are no longer accurate.
  - Archive the legacy setup wizard logic once the new flow is proven.
- [ ] Rollout Plan
  - Validate locally, in staging, and in production-like environments.
  - Provide a rollback plan (toggle to revert to old behavior if critical issues arise).

## Exit Criteria

- Monitoring confirms expected behavior (tools enabled per env, missing var alerts).
- Documentation/runbooks updated.
- Rollout complete across environments with sign-off from stakeholders.
