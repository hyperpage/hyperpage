# Phase 03 – Test Suite Stabilization & Pruning

## Objective

Transform the existing test suite into a **reliable, fast, and meaningful** safety net:

- All core paths are covered by stable tests.
- Flaky / obsolete tests are eliminated or quarantined with justification.
- Test layers (unit, integration, e2e, performance) have clear roles.
- Commands and configs are consistent (`package.json`, Vitest, Playwright, Docker).

This phase ensures future refactors can proceed with confidence.

---

## Outcomes

By the end of this phase:

- A clear test taxonomy is defined and enforced.
- `npm test` (or equivalent) runs a deterministic, agreed-upon subset (usually unit + core integration).
- E2E and performance suites have explicit entrypoints and are not silently broken.
- CI configuration matches the intended testing strategy.
- All failing or flaky tests are:
  - Fixed, or
  - Marked as quarantined/skipped with a documented ticket/plan, or
  - Deleted if they test obsolete behavior.

---

## 1. Test Taxonomy & Ownership

### 1.1 Classify All Tests

Scan the structure (example based on current repo):

- `__tests__/unit/**`
- `__tests__/integration/**`
- `__tests__/e2e/**`
- `__tests__/performance/**`
- `__tests__/grafana/**`
- Test setup files:
  - `vitest.config.ts`
  - `vitest.setup.ts`
  - `__tests__/e2e/playwright.config.ts`
  - Any Docker or env files for tests

For each directory, define:

1. **Purpose**:
   - Unit: Pure logic, no external systems.
   - Integration: DB, tools, APIs, multi-module flows.
   - E2E: Browser-level flows; external services mocked or test env.
   - Performance/Load: Non-default; opt-in jobs for profiling.
   - Grafana/Monitoring: Dashboards & alerting validation.

2. **Runtime expectations**:
   - Which ones run on:
     - Local dev quick feedback.
     - Pre-merge CI.
     - Scheduled jobs only.

Deliverable: documented taxonomy in this file referencing actual directories.

### 1.2 Define Owners / Responsibility

For each major area (e.g., rate-limiting, persistence, tool integrations, workflows):

- Link:
  - Tests → owning module(s) (`lib/rate-limit/**`, `lib/database/**`, `tools/**`, `app/api/**`).
- Ensure:
  - No orphaned tests for removed subsystems.
  - Existing tests map cleanly to real behavior.

---

## 2. Command & Configuration Alignment

### 2.1 `package.json` Test Scripts

1. Inventory existing scripts:
   - `test`, `test:unit`, `test:integration`, `test:e2e`, `test:performance`, etc. (to be aligned with reality).
2. Normalize semantics:
   - `test`:
     - Runs fast, reliable suite (usually unit + core integration).
   - `test:unit`:
     - Only `__tests__/unit/**`.
   - `test:integration`:
     - `__tests__/integration/**`, may require local DB/containers.
   - `test:e2e`:
     - Playwright-based browser tests; require environment.
   - `test:performance` or `test:load`:
     - Optional; explicitly documented as heavy.

Ensure:

- No script references non-existent configs or folders.
- `README.md` and `docs/testing/index.md` describe real scripts only.

### 2.2 Vitest Configuration

1. Open `vitest.config.ts`:
   - Confirm:
     - Proper `testMatch` / `include` patterns.
     - TypeScript integration working.
     - Proper setup file (`vitest.setup.ts`) wired.
   - Ensure:
     - No hardcoded paths to deleted files.
     - Coverage config (if any) excludes build artifacts.

2. Update as needed to reflect taxonomy:
   - Split configs or projects if needed (e.g., unit vs integration).

### 2.3 Playwright / E2E Configuration

1. Open `__tests__/e2e/playwright.config.ts`:
   - Verify:
     - `testDir` points to actual E2E tests.
     - Base URL aligns with dev/test env (`docker-compose.e2e.yml`, etc.).
   - Ensure:
     - No references to removed routes or outdated auth flows.
   - Document:
     - How to run E2E locally & in CI.

---

## 3. Systematic Test Run & Failure Classification

### 3.1 Run Core Suites

In sequence (actual commands executed later during implementation):

1. `npm test` (or chosen default).
2. `npm run test:unit` (if defined).
3. `npm run test:integration`.
4. `npm run test:e2e` (optional at this stage; may be separate due to env).
5. `npm run test:performance` (if exists; likely opt-in).

### 3.2 Classify Failures

For each failure, classify into:

1. **Type A – Legitimate Regression / Bug**
   - Test correctly expresses current intended behavior; code is wrong.
   - Action: fix code or configuration.

2. **Type B – Outdated/Drifted Test**
   - Codebase evolved; test still asserts old behavior.
   - Action:
     - Update test to match documented, correct behavior.
     - If behavior is unclear, annotate in this doc and create a decision task.

3. **Type C – Flaky Infrastructure**
   - Timing-sensitive, external dependency, race conditions, test pollution.
   - Action:
     - Stabilize via:
       - Better waits.
       - Local fakes instead of real network.
       - Isolated DB fixtures.
     - If not immediately solvable:
       - Quarantine (skip) with clear reason and ticket.

4. **Type D – Obsolete Feature**
   - Tests cover removed tool, endpoint, environment.
   - Action:
     - Remove test files.
     - Confirm docs and code no longer mention feature.

Record all failures and classification in this phase file or a referenced checklist.

---

## 4. Data, Fixtures, and Isolation

### 4.1 Database & Persistence Tests

Targets:

- `__tests__/integration/database/**`
- `__tests__/unit/lib/database/**`
- `__tests__/performance/database.test.ts`
- `init-hyperpage.sql/**`
- `lib/database/migrations/**`

Checklist:

1. Ensure:
   - Tests do **not** depend on developer-local state.
   - Use:
     - Dockerized DB or in-memory/ephemeral instances for CI.
     - Clean setup & teardown (`beforeAll`/`afterAll`, migrations).
2. Verify:
   - Dual-engine (SQLite/Postgres) tests:
     - Still relevant.
     - Correctly parameterized for both engines if supported.
3. Remove or update:
   - Any tests targeting schemas that no longer exist.

### 4.2 Tool Integration Tests

Targets:

- `__tests__/integration/tools/github.spec.ts`
- `__tests__/integration/tools/gitlab.spec.ts`
- `__tests__/integration/tools/jira.spec.ts`
- And others under `__tests__/integration/tools/**`.

Checklist:

1. Ensure:
   - Tests use mocks, fakes, or test tokens; never real production credentials.
   - Behavior matches current `tools/**` registry and handlers.
2. If external API behavior changed:
   - Update mocks/fixtures and assertions.
3. Remove:
   - Tests for tools that are disabled/removed in current architecture.

### 4.3 Workflow & E2E Tests

Targets:

- `__tests__/integration/workflows/**`
- `__tests__/e2e/portal.spec.ts`
- `__tests__/e2e/rate-limit-handling.spec.ts`
- `__tests__/e2e/tool-integration.spec.ts`
- E2E Docker / env configs.

Checklist:

1. Validate that:
   - Flow matches current UI & API.
   - Locators/selectors are robust (data-testid over brittle CSS/XPath).
2. Fix:
   - Failing tests where UI changes are intentional but tests not updated.
3. For flows with unclear business expectations:
   - Document ambiguities; do not blindly change tests.

---

## 5. Flakiness, Stability & Runtime Budget

### 5.1 Flakiness Detection

1. For key suites (unit/integration/e2e):
   - Run multiple times (e.g., 3–5 loops) in CI or local automation.
2. Track:
   - Which tests fail intermittently.
3. For each flaky test:
   - Identify cause:
     - Network timeouts / race conditions.
     - Shared global state.
     - Clock/time dependencies.
     - Test order dependencies.
   - Fix or quarantine.

### 5.2 Runtime Constraints

Define target durations (non-binding, but guiding):

- Unit suite: fast (tens of seconds max).
- Integration: reasonable (can be longer, but deterministic).
- E2E: limited set in default CI; full suite in scheduled runs.
- Performance: opt-in only.

If performance tests are slow or fragile:

- Ensure they are:
  - Disabled by default.
  - Documented with explicit command and context.

---

## 6. Removing and Quarantining Tests Safely

### 6.1 Removal Policy

Remove a test only if:

- It covers a feature or endpoint that no longer exists, **and**
- That removal is confirmed by:
  - Code search (no references).
  - Docs (no longer advertised).
  - Product/architecture agreement.

For each removed test:

- Note:
  - File path.
  - Reason for removal.
  - Linked change (e.g., feature deprecation).

### 6.2 Quarantine Policy

For tests that express desired behavior but are unstable:

1. Mark as skipped using the framework’s native mechanism:
   - e.g., `test.skip(...)` with a clear reason.
2. Add:
   - Reference to issue / TODO with context (file, suspected cause).
3. Do **not** silently disable with comments or untracked changes.

---

## 7. Documentation & Discoverability

Update:

1. `docs/testing/index.md`:
   - Describe test taxonomy:
     - What each directory is for.
     - Which scripts to run for:
       - Quick verification.
       - Full pipeline.
       - E2E/performance.
   - Describe expected environments (DB, Docker, env vars).
2. `README.md`:
   - Keep a short section referencing the detailed testing doc.
3. Ensure:
   - All documented commands are real and passing (per Documentation Accuracy rules).
   - No mention of 100% coverage or similar unless measured and maintained.

---

## 8. Validation & Exit Criteria

This phase is complete only when:

- [ ] Test taxonomy is documented in this phase plan (and optionally `docs/testing/index.md`).
- [ ] `npm test`:
  - [ ] Runs a deterministic, passing suite on a clean checkout.
- [ ] Unit tests:
  - [ ] Green and quick.
- [ ] Integration tests:
  - [ ] Green when required dependencies (DB, etc.) are up.
  - [ ] Documented setup instructions.
- [ ] E2E tests:
  - [ ] Either passing with documented env, or explicitly quarantined with issues filed.
- [ ] Performance/Load tests:
  - [ ] Are opt-in and documented (not silently failing or auto-run).
- [ ] No tests rely on:
  - [ ] Real production credentials.
  - [ ] Random local state.
- [ ] All flaky or failing tests are:
  - [ ] Fixed, or
  - [ ] Skipped with documented reason, or
  - [ ] Removed with justification.
- [ ] `docs/testing/index.md` and `README.md`:
  - [ ] Refer only to working, validated scripts and strategies.

Once exit criteria are met, the test suite is trustworthy, and you can safely proceed to **Phase 04 – API & Route Handler Normalization & Security**.
