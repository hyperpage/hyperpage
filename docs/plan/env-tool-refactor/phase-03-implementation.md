# Phase 03 – Implementation & Migration

## Objective

Build and integrate the Tool Configuration Service and migrate the codebase to use it without regressions.

## Workstreams

1. **Core Service Implementation**
   - [ ] Implement env loader with precedence logic (runtime env → `.env.*` fallback → defaults).
   - [ ] Implement DB override resolver.
   - [ ] Implement TCS API (enablement, readiness, metadata, missing vars).
   - [ ] Add caching/invalidation strategy (per request vs. shared, TTL, invalidation triggers).

2. **Tool Modules Migration**
   - [ ] Remove direct `process.env` reads in tool definitions; they should export metadata only.
   - [ ] Update `tools/index.ts` to fetch enabled tools via TCS.
   - [ ] Ensure capability checks still behave (e.g., rate-limit tools still advertise “rate-limit”).

3. **API & UI Consumers**
   - [ ] `/api/tools/enabled` uses TCS outputs exclusively (and merges DB overrides).
   - [ ] `/api/config/status` uses TCS to report core/tool readiness.
   - [ ] Setup wizard hooks/components consume TCS outputs via the API.
   - [ ] Other callers (`Portal`, `useToolStatus`, etc.) remain unchanged aside from the data shape.

4. **Env Management**
   - [ ] Update `.env.*` templates to document new precedence (and add `ENV_FILE` metadata if needed).
   - [ ] Ensure Docker/E2E builds pass the correct env file or env vars for TCS.

5. **Testing**
   - [ ] Unit tests for TCS (env precedence, overrides, missing vars).
   - [ ] Integration tests for `/api/tools/enabled` + `/api/config/status` verifying readiness states.
   - [ ] Regression/E2E verification (e.g., `npm run test:e2e:docker` shows enabled tools when `.env.e2e` is set).

## Exit Criteria

- TCS is the single source of truth for tool enablement.
- Tool modules no longer read env vars directly.
- Setup wizard/UI uses TCS data to decide readiness.
- CI + Docker builds pass with env-driven enablement (no more “No Tools Enabled” when env flags are set).
