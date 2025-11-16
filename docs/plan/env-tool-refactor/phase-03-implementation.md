# Phase 03 – Implementation & Migration

## Objective

Build and integrate the Tool Configuration Service and migrate the codebase to use it without regressions.

## Workstreams

1. **Core Service Implementation**
   - [ ] Implement env loader with precedence logic (runtime env → `.env.*` fallback → defaults) plus `ENV_FILE` override flag and validation for missing files.
   - [ ] Support live reload triggers (file watcher in dev, manual `refresh()` endpoint in prod).
   - [ ] Implement DB override resolver with batching, cache TTL, and optimistic update hook for admin UI.
   - [ ] Implement TCS API (enablement, readiness, metadata, missing vars, `lastEvaluatedAt`, `source`) with full TypeScript types and runtime validation (zod/io-ts).
   - [ ] Add caching/invalidation strategy (per request vs. shared, TTL, invalidation triggers) documented in code comments + ADR.
   - [ ] Add structured logging/metrics (e.g., `tcs_missing_env_total`, `tcs_refresh_duration_ms` histogram).
   - [ ] Keep DB override + secret manager adapters behind interfaces so we can ship env-based MVP first (stubs return “not configured” signals).

2. **Tool Modules Migration**
   - [ ] Remove direct `process.env` reads in tool definitions; they should export metadata only (code mods + lint rule updates).
   - [ ] Update `tools/index.ts` to fetch enabled tools via TCS, including fallback for legacy feature flag paths during rollout.
   - [ ] Ensure capability checks still behave (e.g., rate-limit tools still advertise “rate-limit”) with contract tests comparing before/after payloads.
   - [ ] Update any build-time scripts that previously imported tool modules to avoid crashing when TCS is unavailable (mock provider).

3. **API & UI Consumers**
   - [ ] `/api/tools/enabled` uses TCS outputs exclusively (and merges DB overrides) with pagination + cache headers preserved.
   - [ ] `/api/config/status` uses TCS to report core/tool readiness; update contract tests + docs.
   - [ ] Setup wizard hooks/components consume TCS outputs via the API with feature flag to flip back if blockers found.
   - [ ] Other callers (`Portal`, `useToolStatus`, etc.) remain unchanged aside from the data shape; provide adapter layer if necessary.
   - [ ] Add admin debug panel (optional) to show TCS evaluation per tool to reduce support overhead.

4. **Env Management**
   - [ ] Update `.env.*` templates to document new precedence (and add `ENV_FILE` metadata if needed), including comments for secret sourcing.
   - [ ] Ensure Docker/E2E builds pass the correct env file or env vars for TCS; update compose files + CI scripts.
   - [ ] Provide `scripts/check-env` CLI to surface missing vars locally before boot.

5. **Testing**
   - [ ] Unit tests for TCS (env precedence, overrides, missing vars, invalid file handling) with coverage thresholds.
   - [ ] Integration tests for `/api/tools/enabled` + `/api/config/status` verifying readiness states, response caching, and error handling.
   - [ ] Regression/E2E verification (e.g., `npm run test:e2e:docker` shows enabled tools when `.env.e2e` is set) plus Playwright smoke for setup wizard flow.
   - [ ] Performance tests ensuring TCS lookups stay under target latency (e.g., <5 ms per request).

## Exit Criteria

- TCS is the single source of truth for tool enablement.
- Tool modules no longer read env vars directly.
- Setup wizard/UI uses TCS data to decide readiness.
- CI + Docker builds pass with env-driven enablement (no more “No Tools Enabled” when env flags are set).
- Feature flag to fallback to legacy path exists (and is toggled off by default) with runbook for emergency re-enable.
- Post-implementation verification checklist completed (metrics dashboards green, logs clean of new errors).
