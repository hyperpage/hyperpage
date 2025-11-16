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

> **Current inventory (Jan 2025)**
>
> | Path                                                         | Purpose & runtime reality                                                                                                                                                         | Default run?                                                                                                                       | Observations / actions                                                                                                                                                                     |
> | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
> | `__tests__/unit/api/*`                                       | Route handlers such as `app/api/health`, `app/api/tools/**`, `app/api/bottlenecks/**`. Fully mocked (registry/cache/db mocked via Vitest).                                        | ✅ Included in `npm test` (Vitest JSdom).                                                                                          | Healthy coverage for API contracts, but some suites (e.g., rate-limit + metrics) still import `fetch`/global timers that rely on JSdom. Keep in “fast” tier.                               |
> | `__tests__/unit/components/hooks/*`                          | Only hooks (`useRateLimit`, `useToolQueries`); there are no component-level tests despite README claiming otherwise.                                                              | ✅                                                                                                                                 | Treat as true unit tests; add TODO to either add component coverage or update docs to reflect hook-only coverage.                                                                          |
> | `__tests__/unit/lib/**`                                      | All persistence/monitoring/tool helpers. Several files (`lib/database/**`, `lib/jobs/**`) hit the Postgres harness in `vitest.setup.ts`.                                          | ✅ but requires `DATABASE_URL`.                                                                                                    | These are the reason npm test fails without Postgres. Need deterministic Postgres bootstrap docs + CI secrets.                                                                             |
> | `__tests__/unit/tools/registry.test.ts`                      | Validates `tools/registry.ts` metadata + enablement flags.                                                                                                                        | ✅                                                                                                                                 | Stays in fast tier; keep as part of basic `npm test`.                                                                                                                                      |
> | `__tests__/integration/database/dual-engine.test.ts`         | Verifies Postgres wiring only (SQLite references are legacy).                                                                                                                     | ✅                                                                                                                                 | Rename to `postgres` to avoid dual-engine confusion and keep as “core integration” (requires Postgres).                                                                                    |
> | `__tests__/integration/tools/*.spec.ts`                      | Hit live Next.js routes via `fetch` to `HYPERPAGE_TEST_BASE_URL`. Wrapped in `describe.skip` unless both `E2E_TESTS=1` and provider tokens are set.                               | ❌ skipped unless opted-in.                                                                                                        | Effective quarantine by env flag, but they silently skip whenever the dev server is not up. Need documented launcher (`npm run dev:test-api` or docker) and a place to report skips.       |
> | `__tests__/integration/workflows/**`                         | “Workflow” suites powered by the fake `TestBrowser`/`UserJourneySimulator`. They never touch Playwright or the real UI; also guarded by `E2E_TESTS`.                              | ⚠️ logically integration, but they only exercise mocks.                                                                            | Decide whether to delete or rewrite to use real Playwright/page objects. Right now they give a false sense of coverage.                                                                    |
> | `__tests__/integration/performance/**`                       | Optional “performance validation” that only uses local mocks. Guarded by `PERFORMANCE_TESTS`.                                                                                     | ❌ default skip.                                                                                                                   | Consider merging into `__tests__/performance/**` or deleting—they do not do real integration work.                                                                                         |
> | `__tests__/performance/**`                                   | Separate optional suites (`database.test.ts`, `rate-limit/rate-limiting-performance.test.ts`) that call real Postgres helpers with loose SLAs. Controlled by `PERFORMANCE_TESTS`. | ❌ default skip.                                                                                                                   | Decide whether these belong to the integration layer or a separate scheduled job; document env requirements explicitly.                                                                    |
> | `__tests__/e2e/*.spec.ts`                                    | Playwright UI flows (`portal`, `rate-limit-handling`, `tool-integration`). Config: `__tests__/e2e/playwright.config.ts`. Not part of Vitest.                                      | Requires manual Playwright command (no npm script). `test:e2e:docker` spins containers but still expects manual `playwright test`. | Need `npm run test:e2e` / `test:e2e:ci` wrappers plus docs. These suites also look for `process.env.E2E_TESTS` before executing, so they currently no-op under the docker compose command. |
> | `__tests__/e2e/oauth/*.spec.ts`                              | Playwright OAuth specs referencing `IntegrationTestEnvironment` + real `/api/auth/...` routes.                                                                                    | Same as above.                                                                                                                     | They assume actual OAuth endpoints and tokens that do not exist in test env; decide to either back them with mocks or quarantine.                                                          |
> | `__tests__/grafana/dashboard.test.ts`                        | Validates `grafana/hyperpage-rate-limiting-dashboard.json`. Guarded by `GRAFANA_TESTS` or `E2E_TESTS`.                                                                            | ❌ default skip.                                                                                                                   | Keep as optional scheduled run; document the env flag because README/docs never mention it.                                                                                                |
> | `__tests__/shared/test-credentials.ts`, `__tests__/mocks/**` | Provide deterministic fake OAuth tokens/session helpers and mock rate-limit server.                                                                                               | N/A (utilities).                                                                                                                   | Update consumers to rely on these utilities instead of inventing new inline mocks; also confirm these files describe real dependencies (currently everything is a stub).                   |

Immediate actions coming out of the inventory:

- Normalize env-flag naming and document them (`E2E_TESTS`, `PERFORMANCE_TESTS`, `GRAFANA_TESTS`).
- Separate “fast & deterministic” vs “opt-in/heavy” suites in `package.json` scripts and CI matrix.
- Decide on the fate of `__tests__/integration/workflows/**` (rewire to Playwright) and `__tests__/integration/performance/**` (merge or delete). Keep rationale documented here.

### 1.2 Define Owners / Responsibility

For each major area (e.g., rate-limiting, persistence, tool integrations, workflows):

- Link:
  - Tests → owning module(s) (`lib/rate-limit/**`, `lib/database/**`, `tools/**`, `app/api/**`).
- Ensure:
  - No orphaned tests for removed subsystems.
  - Existing tests map cleanly to real behavior.

Current ownership map and gaps:

- **Persistence & sessions**
  - Code: `lib/database/**`, `app/api/sessions`, `app/api/auth/**`, drizzle migrations.
  - Tests: `__tests__/unit/lib/database/**/*.test.ts`, `__tests__/unit/api/health/health.test.ts`, `__tests__/performance/database.test.ts`, `__tests__/integration/database/dual-engine.test.ts`.
  - Issues: Vitest harness (`vitest.setup.ts`) assumes Postgres but CI uses `file:./data/hyperpage.db` (see `.github/workflows/ci-cd.yml`). Need a clear owner (Database Platform) to maintain migrations + harness after the SQLite removal.

- **Tool registry & external APIs**
  - Code: `tools/**`, `app/api/tools/**`, `lib/tooling/**`.
  - Tests: `__tests__/unit/tools/registry.test.ts`, `__tests__/unit/api/tools/*`, Playwright specs (`__tests__/e2e/tool-integration.spec.ts`, `__tests__/e2e/oauth/*.spec.ts`), `__tests__/integration/tools/*.spec.ts`.
  - Issues: Integration suites depend on `IntegrationTestEnvironment` mocks and `isServerAvailable()` HTTP pings. Without a running Next server and provider tokens they silently skip. Assign ownership to the Tooling team and require either live fakes (msw) or dockerized services so these tests can graduate from “skipped by default”.

- **Rate limiting & monitoring**
  - Code: `lib/rate-limit-monitor`, `app/api/rate-limit/**`, `grafana/**`, monitoring docs.
  - Tests: `__tests__/unit/lib/rate-limit-comprehensive.test.ts`, `__tests__/unit/api/bottlenecks/**`, `__tests__/unit/api/metrics/metrics.test.ts`, `__tests__/performance/rate-limit/rate-limiting-performance.test.ts`, Playwright `rate-limit-handling.spec.ts`, Grafana suite.
  - Issues: Some suites rely on mocked `defaultCache` rather than real Redis, while docker-compose.test.yml spins Redis but no tests use it. Need an owner to either wire Redis into integration tests or explicitly scope them to “logic only”.

- **Workflows / UI flows**
  - Code: `app/(pages)`, `app/api/workflows?` (N/A), `components/**`.
  - Tests: `__tests__/integration/workflows/**` (mocked TestBrowser) + Playwright `portal.spec.ts`.
  - Issues: Workflow “integration” tests are completely synthetic, so UI behavior only lives in Playwright. Decide between: (1) delete the synthetic suites, or (2) replace TestBrowser with Playwright page objects shared with E2E tests. Assign to the UX/Workflow owners.

- **OAuth & authn**
  - Code: `app/api/auth/**`, `lib/oauth/**`.
  - Tests: Playwright OAuth specs, integration suites referencing `/api/auth/**`, `__tests__/unit/lib/oauth-token-store.test.ts`.
  - Issues: README advertises “OAuth integration tests” runnable via `npm test -- --run integration/oauth`, but there is no such directory. Align docs with reality and decide which team maintains the Playwright OAuth specs (they currently lack env gating and will fail without actual GitHub/GitLab/Jira endpoints).

- **Grafana / Observability**
  - Code: `grafana/*`, `lib/monitoring/**`.
  - Tests: `__tests__/grafana/dashboard.test.ts`, `__tests__/unit/lib/monitoring/*.test.ts`.
  - Issues: Grafana suite is optional and never runs in CI. Determine whether Observability owns it and schedule it (maybe nightly) or remove it.

Document every mapping + decision outcome back in this file so future contributors know who to contact when a suite flakes.

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

> **Reality check (Jan 2025)**
>
> - `package.json` only defines:
>   - `test` → `vitest run`
>   - `test:watch`, `test:coverage`, `test:ui`
>   - `test:all` → `vitest run && npm run test:e2e:docker`
>   - `test:e2e:docker` → `docker-compose -f __tests__/e2e/docker-compose.e2e.yml --profile e2e up ...`
> - There are **no** `test:unit`, `test:integration`, `test:e2e`, or `test:performance` scripts even though:
>   - README.md:149-174 documents every one of those commands plus Vitest `--run integration/tools/github` selectors.
>   - `.github/workflows/ci-cd.yml` uses `npm run test:unit`, `npm run test:integration`, `npm run test:performance`, `npm run test:e2e`.
>   - `docs/testing/index.md` claims “npx vitest” runs everything including E2E and performance.
>
> As a result:
>
> - The CI “Comprehensive Test Suite” job cannot run today; the scripts simply do not exist.
> - Local contributors follow README instructions that immediately fail with “missing script”.
> - `test:all` runs Vitest **twice** when someone really just wants “fast tests + Playwright”.
> - `npm run test:e2e:docker` only builds/starts containers; it never calls `npx playwright test`, and the Playwright specs themselves are gated on `process.env.E2E_TESTS === "1"`, so even inside Compose nothing happens.
>
> **Action items**
>
> 1. Decide on taxonomy-driven scripts:
>    - `test` = “fast, deterministic” (unit + Postgres-backed integration) once Postgres bootstrap is reliable.
>    - `test:unit`, `test:integration`, `test:db`, `test:perf`, `test:e2e`, `test:e2e:docker` as wrappers around Vitest and Playwright.
> 2. Update README.md + docs/testing + onboarding to match the actual scripts (or vice versa).
> 3. Update GitHub Actions to use the new scripts and provide the required env (Postgres container, BASE_URL, provider tokens where relevant).
> 4. Remove misleading `vitest -- --run ...` examples unless we truly support those filters via `testMatch` and `--runInBand`.

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

Findings from `vitest.config.ts` / `vitest.setup.ts`:

- Vitest currently runs in the JSDOM environment for compatibility; revisit multi-project Node vs JSDOM splitting after the SQLite cleanup if performance becomes a concern.
- Introduced a dedicated `vitest.global-setup.ts` to automatically load `.env.test` before any suite runs, removing a common source of local misconfiguration.
- `vitest.setup.ts` now waits for the recreated Postgres database to accept connections and bumps the pool connection timeout so migrations no longer race the server startup. Tests only drop/create the whole DB when `RESET_TEST_DB=1`; otherwise the harness reuses the existing schema and relies on deterministic truncation/seed logic.
- `exclude` only omits `__tests__/e2e/**`; everything else, including optional performance/integration suites, is discovered every time. They guard themselves with env checks, but Vitest still spends time collecting them. Once taxonomy is codified, adjust `include` or `testMatch` accordingly (e.g., `test:unit` only matches `__tests__/unit/**`).
- `typecheck` runs `tsc` across every test file on each `vitest run` because `typecheck.enabled=true`. This more than doubles runtime and duplicates the dedicated `npm run type-check`. Decide whether to disable this in favor of the explicit script or scope it to CI-only.
- Update (Feb 2025): `typecheck.enabled` now returns `true` only on CI or when developers export `VITEST_TYPECHECK=1`. Local `vitest run` executions no longer double-run the TypeScript compiler by default.
- `vitest.setup.ts` drops and recreates the Postgres database unconditionally whenever Vitest boots. Without `DATABASE_URL` set, it throws immediately. Documented instructions exist (docs/testing/index.md), but no `.env.test` sample ships in the repo and CI sets `DATABASE_URL=file:./data/hyperpage.db`, which is incompatible. We need:
  - A committed `.env.test.example` (or instructions in docs) plus automation (`npm run db:test:up`) that starts `docker-compose.test.yml`.
  - Adjustments to CI to run a Postgres service, export `DATABASE_URL`, and avoid `file:` URLs.
- Coverage thresholds (80%) apply to every suite despite many being skipped. Decide whether to keep coverage for unit-only runs or add a `vitest.config.unit.ts` aimed at coverage while integration/perf/e2e remain opt-in.

Document the final config shape back here (e.g., whether we end up with multi-project Vitest or custom `testMatch` per script).

### 2.3 Playwright / E2E Configuration

1. Open `__tests__/e2e/playwright.config.ts`:
   - Verify:
     - `testDir` points to actual E2E tests.
     - Base URL aligns with dev/test env (`docker-compose.e2e.yml`, etc.).
   - Ensure:
     - No references to removed routes or outdated auth flows.
   - Document:
     - How to run E2E locally & in CI.

What we have today:

- Playwright config lives at `__tests__/e2e/playwright.config.ts`. `testDir: "./"` relative to that folder works, and `testMatch: "**/*.spec.ts"` picks up both top-level specs and `oauth/*.spec.ts`.
- `use.baseURL` defaults to `http://localhost:3000` unless `BASE_URL` is set. Docker compose passes `BASE_URL=http://hyperpage-e2e:3000`.
- `webServer` is disabled whenever `E2E_TEST` is set; otherwise it runs `npm run dev`. The docker compose workflow sets `E2E_TEST=true`, so Playwright never tries to boot the dev server (good). Locally, though, we rely on `npm run dev` but the README/e2e docs never mention `E2E_TEST`.
- There is **no npm script** that calls `playwright test --config __tests__/e2e/playwright.config.ts`. The only script is `test:e2e:docker`, which runs docker compose but does not actually execute Playwright (the compose file starts a `playwright` service that runs the tests, but the script never tears down containers or collect reports).
- Gating is inconsistent:
  - `portal.spec.ts`, `rate-limit-handling.spec.ts`, `tool-integration.spec.ts` wrap everything in `if (process.env.E2E_TESTS === "1")` using Playwright’s `test.describe`. Unless `E2E_TESTS=1`, these suites show up as “skipped” and nothing runs.
  - The OAuth specs do **not** check `E2E_TESTS`, so they always try to hit `/api/auth/github/initiate`, etc., and will fail without real OAuth providers.
  - Docker compose never sets `E2E_TESTS`, so even inside containers most specs immediately skip.
- `__tests__/e2e/Dockerfile.e2e` copies tests from `app/__tests__/...` (wrong path; tests live at repo root). This image likely fails to build or runs with empty suites.

Action plan:

1. Add scripts:
   - `test:e2e` → `BASE_URL=http://localhost:3000 npx playwright test --config __tests__/e2e/playwright.config.ts`
   - `test:e2e:headed`, `test:e2e:ci`, etc., as needed.
2. Decide whether `E2E_TESTS` should control Playwright suites at all. If we keep it, set it inside every script/compose file so tests actually run, and document it.
3. Fix Dockerfile pathing and ensure `test:e2e:docker` orchestrates `docker compose up --abort-on-container-exit` plus cleanup.
4. Classify OAuth specs as “enterprise/manual” if we cannot provide fake providers; otherwise, add mocks/test doubles so they can run in CI.

> Update (Feb 2025):
>
> - `npm run test:e2e:docker` delegates to `scripts/test-e2e-docker.sh`, which traps `EXIT` and always calls `docker-compose ... down -v` to tear down the stack even on failures.
> - OAuth Playwright specs (`__tests__/e2e/oauth/**`) are quarantined behind the explicit `E2E_OAUTH=1` flag (still requires `E2E_TESTS=1`) until we can provide hermetic provider mocks.
> - Portal E2E coverage (`__tests__/e2e/portal.spec.ts`) now verifies the current empty-state UI and passes when pointing Playwright at a running dev server (`npm run dev -- --hostname 127.0.0.1` + `BASE_URL=http://127.0.0.1:3000`). README and `docs/testing/index.md` document the workflow.

---

## 3. Systematic Test Run & Failure Classification

### 3.1 Run Core Suites

In sequence (actual commands executed later during implementation):

1. `npm test` (or chosen default).
2. `npm run test:unit` (if defined).
3. `npm run test:integration`.
4. `npm run test:e2e` (optional at this stage; may be separate due to env).
5. `npm run test:performance` (if exists; likely opt-in).

Prerequisites before any of the above will succeed in this repo:

- Export `DATABASE_URL` pointing at a disposable Postgres database. The Vitest harness will drop/create it during startup. Use `docker-compose -f docker-compose.yml -f docker-compose.test.yml up -d postgres redis` and set `DATABASE_URL=postgresql://postgres:password@localhost:5432/hyperpage-test` (or whatever `.env.test` uses). SQLite URLs (`file:./data/hyperpage.db`) will fail immediately.
- If Redis is required (some rate-limit tests reference `defaultCache`), either run the Redis service from `docker-compose.test.yml` or flip those suites to pure in-memory mocks. Document whichever path we pick.
- For integration suites that `fetch` against the running Next.js server, start `npm run dev -- --port 3000` (or use the dockerized `hyperpage-test-app` service) **before** launching Vitest. Otherwise, `isServerAvailable()` returns false and entire describe blocks skip silently.
- For Playwright, ensure `BASE_URL` resolves to the running app (dev server or docker). If we keep the `webServer` option, confirm `npm run dev` honors the same `.env.test`.
- Collect artifacts (coverage, test-results, Playwright report) somewhere under `./logs/tests/<date>` so we can diff between runs.

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
- (legacy) `init-hyperpage.sql/**` – directory removed; keep note for historical context only.
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

Repository-specific findings:

- `vitest.setup.ts` already provisions/drops Postgres via drizzle, but there is no `.env.test` checked in, and `docker-compose.test.yml` expects that file. Action: add `.env.test.example` plus docs (or reuse `.env.sample` with a `DATABASE_URL_TEST` entry) so people can create the required file deterministically.
- `.github/workflows/ci-cd.yml` sets `DATABASE_URL=file:./data/hyperpage.db`, which will never work with the Postgres-only harness. Update CI to start a Postgres service (container or `services.postgres`) and feed a real URL.
- (Completed Jan 2025) `init-hyperpage.sql` directory was removed. Ensure no future docs reintroduce references unless the file returns.
- All SQLite-focused tests (`*.sqlite.test.ts`) have been removed; the repo is PostgreSQL-only.
- Verify whether `lib/database/migrations/index.ts` exposes only `000_init_pg_schema`. If we intend to add more migrations, make sure they are exported and that the fallback migrator in `vitest.setup.ts` is up-to-date.

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

Current situation:

- Every suite in `__tests__/integration/tools/*.spec.ts` imports `IntegrationTestEnvironment` and `isServerAvailable()` from `__tests__/shared/test-credentials.ts`. The environment helper only produces fake sessions/tokens and does **not** reach into the app/database. Meanwhile, `isServerAvailable()` makes HTTP GET requests against the running Next server. If the server is down, the entire suite logs a warning and skips (without marking the run as skipped overall). Decide on a contract:
  - Either start the API server (via `npm run dev -- --hostname 127.0.0.1` or docker) before running these suites and treat skips as failures.
  - Or refactor them into pure unit tests that mock `fetch`.
- Update (Feb 2025): The cross-tool aggregation suite now follows the same guard as the provider-specific ones (`describe.skip` unless `E2E_TESTS=1` plus GitHub/GitLab/Jira tokens). This prevents `npm run test:integration` from failing outright when the HTTP stack or credentials are missing.
- Guard conditions today: `process.env.E2E_TESTS === "1" && token env var`. Without both, the describe block never runs. Document which env vars unlock each provider (`GITHUB_TOKEN`, `GITLAB_TOKEN`, `JIRA_API_TOKEN`). README currently tells people to run `npm test -- --run integration/tools/github` instead of setting env flags.
- Verify that `MOCK_TOOL_CONFIGS` and `TEST_ENV_VARS` do not hardcode secrets. They currently contain sample values but no `.env.test` references. Consider generating these values at runtime or loading them from `.env.test` instead of repeating placeholders.
- Some suites still talk about “real GitHub data” even though they use mocks; update the descriptions or convert them into true integration tests backed by http mocks (msw, polly) plus fixture responses checked into `__tests__/mocks`.
- **Next actions:**
  1. Add a scripted launcher (e.g., `npm run test:integration:tools`) that spins up the Next server (or docker profile) plus `E2E_TESTS=1` before invoking Vitest so developers can reliably exercise these suites.
  2. Track provider-token requirements centrally (matrix in docs/testing) so CI can opt into providers explicitly.
  3. For flows that truly need browser coverage, migrate them to Playwright and retire the duplicate integration specs.

> Update (Feb 2025):
>
> - `npm run test:integration:tools` now sets `E2E_TESTS=1` and defaults `HYPERPAGE_TEST_BASE_URL` to `http://localhost:3000`, giving developers a single entrypoint for provider-backed HTTP suites.
> - README + docs/testing describe the required dev-server/tokens workflow so contributors know how to opt in.

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

Repo-specific notes:

- `__tests__/integration/workflows/utils/test-browser.ts` is a pure TypeScript mock that simulates pages/tabs without launching a browser. The “workflow” specs never hit the real UI – they manipulate `TestBrowser`’s internal maps. Treat these files either as unit tests (move under `__tests__/unit`) or delete them in favor of actual Playwright coverage.
- Playwright specs already exist (`portal.spec.ts`, `rate-limit-handling.spec.ts`, `tool-integration.spec.ts`, plus OAuth specs), but they are not wired into any npm script or CI job, and most of them skip automatically because `E2E_TESTS` is unset. Decide the canonical trigger (env var vs CLI flag).
- Docker-based E2E uses `__tests__/e2e/Dockerfile.e2e` and `docker-compose.e2e.yml`, but the Dockerfile copies tests from `app/__tests__` instead of root, so the image likely runs empty suites. Fix before we advertise dockerized Playwright runs.
- Several Playwright tests call APIs (`/api/tools/github/pull-requests`, `/api/auth/github/initiate`) that assume OAuth providers are configured. Decide whether to mock those endpoints (msw/proxy) or gate the tests behind additional env vars (and document expected failure modes). Right now they will just fail due to 401/404 in any default environment.
- **Next actions:**
  1. Migrate the synthetic TestBrowser suites (user-journey/session-management/etc.) to Playwright page objects where feasible, or formally deprecate them once equivalent Playwright coverage exists.
  2. Provide an explicit Playwright CI profile (GitHub Actions job or scheduled run) that passes `E2E_TESTS=1`, `BASE_URL`, and provider tokens so we regularly exercise real UI flows.
  3. Decide on a fallback/mock strategy for provider-specific OAuth flows (fake OAuth server vs. quarantined specs) and document it in docs/testing/workflow-testing-guide.md.

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

Specific guidance for Hyperpage:

- Focus flakiness hunting on the suites that actually touch IO: the Postgres-backed unit/integration tests (anything importing `getReadWriteDb`), the integration/tool suites that `fetch` against the dev server, and the Playwright specs. Hook a temporary `npm run test:ci -- --retry 2` workflow that runs `vitest run --retry 2 --reporter=dot` inside CI to surface nondeterminism.
- The optional suites already take env flags to skip. Keep a central table (maybe `docs/testing/index.md`) listing every flag, default value, and who owns turning it on in CI. Right now no one knows that `GRAFANA_TESTS` or `PERFORMANCE_TESTS` exist.
- Runtime targets: measure current Vitest runtime once Postgres is up (expected < 2 min). If we exceed that, split into `test:unit` (jsdom + mocks) and `test:db` (node + Postgres) so developers can run the fast subset frequently.

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

Potential removals/quarantines already identified:

- `__tests__/integration/workflows/**` – currently pure mocks duplicating what Playwright should do. Unless we can back them with real HTTP/UI, plan to delete or convert to lightweight unit tests.
- `__tests__/integration/performance/**` – purely mocked “performance” checks that overlap with `__tests__/performance/**`. Candidates for removal unless we can prove unique value.
- `__tests__/e2e/oauth/*.spec.ts` – depend on real GitHub/GitLab/Jira OAuth applications. Without dedicated fixtures these will always fail in CI. Either add a fake OAuth server or quarantine them with a clear ticket.
- Any remaining SQLite-specific tests should be deleted immediately; the project no longer ships SQLite fallbacks.

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

Docs to audit once the taxonomy is finalized:

- `README.md` (“Testing” section) still advertises `npm run test:integration`, provider-specific Vitest filters, `npm run test:e2e`, and `npm run test:e2e:ui`. None of them exist. Replace with the real script list and mention the Postgres prerequisite.
- `docs/testing/index.md` assumes a Postgres-only stack (good) but also claims that running `npx vitest` exercises E2E, performance, Grafana, and legacy SQLite suites. Update the taxonomy there to match the actual env-flag behavior recorded above.
- `docs/testing/test-organization.md` shows directories that are not present anymore (`__tests__/integration/oauth`, `__tests__/integration/environment`, etc.). Regenerate the tree (maybe via `tree __tests__ -L 2`) and explain the new owners.
- `docs/testing/workflow-testing-guide.md` should mention that the current TestBrowser-based suites are synthetic and outline the plan (replace with Playwright or remove).
- `.github/workflows/*.yml` must be updated alongside docs so CI instructions match reality (Postgres service, which scripts run on which events, how to enable Playwright/E2E/perf jobs).

---

## 8. Immediate Remediation Backlog

To move from analysis to action, track the following discrete tasks (open tickets per item):

1. **Bootstrap scripts & CI**
   - Add `test:unit`, `test:integration`, `test:db`, `test:perf`, `test:e2e`, `test:e2e:docker` scripts matching the taxonomy.
   - Update `.github/workflows/ci-cd.yml` to call those scripts, start Postgres/Redis services, and pass `DATABASE_URL` + `BASE_URL`.
2. **Environment assets**
   - Commit `.env.test.example` (or equivalent) covering `DATABASE_URL`, Redis, tool flags, and document `docker-compose.test.yml` usage.
   - Provide helper commands (`npm run db:test:up`, `npm run db:test:reset`) that wrap the compose stack + migrations.
3. **Vitest split**
   - Introduce separate configs or `projects` for jsdom “unit” vs node “db/integration” suites; disable global `typecheck` unless running in CI.
   - Limit inclusion patterns per script so optional suites aren’t traversed by default.
4. **Playwright/E2E hygiene**
   - Fix `__tests__/e2e/Dockerfile.e2e` copy paths, ensure `test:e2e:docker` runs the suite and tears down containers, and wire `E2E_TESTS=1`.
   - Decide whether OAuth specs run with mocks (preferred) or are quarantined; document prerequisites per provider.
5. **Workflow/performance suites cleanup**
   - Replace `TestBrowser`-based “integration” suites with real Playwright coverage or downgrade/delete them.
   - Merge redundant `__tests__/integration/performance/**` files into the optional performance folder or remove them entirely.
6. **Docs + onboarding**
   - Rewrite README/testing docs + onboarding steps to reflect the new commands, env files, and suite taxonomy.
   - Add a single “Testing quickstart” section linking all relevant docs and pointing at the Postgres bootstrap instructions.

---

## 8. Validation & Exit Criteria

This phase is complete only when:

- [x] Test taxonomy is documented in this phase plan (and optionally `docs/testing/index.md`).
- [x] `npm test`:
  - [x] Runs a deterministic, passing suite on a clean checkout.
- [x] Unit tests:
  - [x] Green and quick.
- [x] Integration tests:
  - [x] Green when required dependencies (DB, etc.) are up.
  - [x] Documented setup instructions.
- [x] E2E tests:
  - [x] Either passing with documented env, or explicitly quarantined with issues filed.
- [x] Performance/Load tests:
  - [x] Are opt-in and documented (not silently failing or auto-run).
- [x] No tests rely on:
  - [x] Real production credentials.
  - [x] Random local state.
- [x] All flaky or failing tests are:
  - [x] Fixed, or
  - [x] Skipped with documented reason, or
  - [x] Removed with justification.
- [x] `docs/testing/index.md` and `README.md`:
  - [x] Refer only to working, validated scripts and strategies.

Once exit criteria are met, the test suite is trustworthy, and you can safely proceed to **Phase 04 – API & Route Handler Normalization & Security**.
