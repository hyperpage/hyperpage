# Testing Strategy

This guide summarizes how the Hyperpage test suite is organized today and how contributors should approach new tests. Every test assumes the PostgreSQL-only runtime introduced in Phase 01 and relies on the repositories/services already in the codebase.

## Frameworks & Taxonomy

- **Vitest** drives unit and integration tests.
- **React Testing Library** exercises client components.
- **Playwright** powers the optional end-to-end suites.
- **Prometheus/Grafana checks** are treated as opt-in verification rather than default CI stages.

Suites fall into the following categories:

| Type            | Location                      | Notes                                                               |
| --------------- | ----------------------------- | ------------------------------------------------------------------- |
| Unit            | `__tests__/unit/**`           | Hooks, utilities, repositories, and service facades.                |
| Integration     | `__tests__/integration/**`    | Repository-backed workflows, API routes, and registry interactions. |
| Tool HTTP tests | `__tests__/integration/tools` | Require a running dev server + real tokens; guarded by env flags.   |
| Playwright      | `__tests__/e2e/**`            | Disabled by default; run locally only when you opt in.              |
| Performance     | `__tests__/performance/**`    | Optional; set `PERFORMANCE_TESTS=1` to opt in.                      |

## Commands

```bash
npm run test            # Unit + integration suites (default vitest run)
npm run test:unit       # Unit-only entries
npm run test:integration# Contract tests under __tests__/integration
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage reporting
npm run test:integration:tools   # Provider HTTP suites (requires dev server + tokens)
npm run test:e2e        # Playwright (spawns dev server, opt-in only)
```

All `db:test:*` scripts reference `docker-compose.test.yml`, so make sure `.env.test` (copied from `.env.test.example`) points at the correct Postgres/Redis hosts. The Vitest harness drops and recreates the database automatically; you only need to ensure the container or local instance is reachable.

## Repository-First Testing Patterns

Hyperpage’s persistence layer is repository-first. Tests should validate behaviour against repository contracts rather than raw Drizzle tables.

1. **Mock factories, not tables.**
   - Use `vi.mock("@/lib/database/<repo>")` to return a fake repository implementation that matches the exported interface.
   - Provide only the methods a consumer needs (`storeTokens`, `loadActiveJobs`, etc.).

2. **Hermetic fakes.**
   - For repository unit tests, build fakes that mimic the Drizzle API surface actually used (e.g., expose `.select().from().where()` chains backed by arrays).
   - For service tests, implement repository methods with simple in-memory maps so you can assert interactions precisely.

3. **No dual-engine branching.**
   - The runtime is PostgreSQL-only. Do not add SQLite fallbacks or engine toggles in tests or production code. If a document or test still mentions SQLite, treat it as historical context.

4. **Deterministic data.**
   - The harness seeds predictable fixtures (see `vitest.setup.ts`). Avoid relying on implicit state; either use the seeded records or create what you need explicitly inside the test.

## Writing New Tests

- Prefer colocating repository/unit tests near the functionality under test (e.g., `__tests__/unit/lib/database/<repo>.test.ts`).
- Use `describe("<module>", () => { ... })` with focused scenarios rather than sprawling mega-tests.
- When adding a new repository, create a Postgres-focused test that exercises:
  - Insert/update/delete semantics
  - Error handling when the repository returns `null`
  - Any normalization performed before returning values to callers
- For hooks/components, stick to React Testing Library helpers and mock network requests with `vi.mock` or `global.fetch` overrides.

## Optional Suites & Flags

| Flag                  | Effect                                                                              |
| --------------------- | ----------------------------------------------------------------------------------- |
| `E2E_TESTS=1`         | Enables Playwright suites and tool HTTP tests (when combined with provider tokens). |
| `E2E_OAUTH=1`         | Turns on OAuth-heavy Playwright specs; requires valid OAuth client IDs/secrets.     |
| `PERFORMANCE_TESTS=1` | Runs `npm run test:perf` suites.                                                    |
| `GRAFANA_TESTS=1`     | Runs Grafana/dashboard validation tests (skipped otherwise).                        |

These suites are intentionally opt-in. The default `npm test` run is fast and hermetic so contributors can iterate quickly.

## Tooling Tips

- Always run `npm run db:test:up` before integration suites; the script ensures Postgres and Redis containers are up.
- If you need to inspect database state, connect to the `hyperpage-test` instance specified in `.env.test` rather than production databases.
- When in doubt about schema setup, read `vitest.setup.ts`—it documents the setup/teardown logic and the table list the harness expects.

Keeping tests aligned with the repository-first model avoids regressions when schema or adapter details evolve.
