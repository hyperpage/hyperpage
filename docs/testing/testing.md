# Testing Guide

This guide covers the comprehensive testing strategy, framework selection, and quality assurance practices for Hyperpage, with an emphasis on:

- Repository-first, dual-engine persistence
- Hermetic testing using minimal, contract-accurate fakes
- Clear separation between unit, integration, and E2E concerns

## Testing Overview

Hyperpage includes automated tests for reliability and stability, featuring a multi-layer testing infrastructure.

### Testing Frameworks

- **Unit Tests:** Vitest + React Testing Library for components, utilities, and repositories
- **Integration Tests:** OAuth flows, tool integrations, and API endpoint testing
- **E2E Tests:** Playwright for complete user workflow validation
- **Security Testing:** Token encryption, session management, and credential handling
- **Performance Testing:** Rate limiting and load testing
- **Mocking:** `vi.mock` for controlled isolation
- **Coverage:** Code coverage reporting for critical paths

## Test Structure

### Directory Layout

```text
__tests__/
├── api/                    # API route tests
├── components/             # Component tests
├── e2e/                    # Playwright-based end-to-end tests
├── integration/            # Integration-level tests
│   ├── oauth/              # OAuth flow tests
│   ├── tools/              # Tool API & registry tests
│   ├── workflows/          # Cross-tool workflows
│   └── performance/        # Performance/load tests
└── unit/
    ├── lib/                # Library, repository, and service unit tests
    └── ...                 # Other unit scopes
```

Repository and persistence-related tests live primarily under:

- `__tests__/unit/lib/database/`
- `__tests__/unit/lib/...` (for consumers using repository fakes)
- Selected integration tests under `__tests__/integration/` when real HTTP flows are required

## Running Tests

### Unit & Integration Tests

```bash
# Run all unit + integration tests
npm test

# Coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Vitest UI
npm run test:ui
```

### Integration Test Commands (If configured)

```bash
npm run test:integration                        # one-shot run for __tests__/integration/**
npm run test:integration:tools                  # provider-backed HTTP suites (requires dev server + tokens)
npm run test:watch -- __tests__/integration     # watch mode (no dedicated script)
npm run test:coverage -- --include __tests__/integration/**
```

`npm run test:integration:tools` assumes a Next.js server is running (local dev or docker) and that `HYPERPAGE_TEST_BASE_URL` plus provider tokens are set. Override the URL if your server listens elsewhere.

### End-to-End Testing

E2E tests are isolated and require appropriate setup.

```bash
npm run test:e2e            # Local Playwright run (spawns dev server, sets E2E_TESTS=1)
npm run test:e2e:headed     # Same as above but headed browsers
npm run test:e2e:docker     # Dockerized Next.js + Playwright stack with automatic teardown
```

> ℹ️ OAuth Playwright specs (`__tests__/e2e/oauth/**`) remain quarantined unless you also set `E2E_OAUTH=1` and provide valid provider credentials in `.env.test`. Without the flag, they are skipped automatically.

## Repository-First and Hermetic Testing Patterns

Hyperpage’s persistence architecture is repository-first and dual-engine. Testing must reflect this.

### 1. Repository-Level Tests (Engine-Specific)

Location: `__tests__/unit/lib/database/`

Goals:

- Verify that each repository:
  - Selects the correct engine using `getReadWriteDb()` + `$schema` identity checks.
  - Maps fields correctly for both SQLite and PostgreSQL.
  - Implements documented semantics (upserts, cleanup, history writes, etc.).
  - Does not rely on environment flags for engine selection.

Patterns:

- Use `vi.mock` and dynamic imports to control `getReadWriteDb()` and module evaluation order when needed.
- Provide minimal, hermetic fakes:
  - SQLite-shaped: exposes only the tables and methods used by the repository.
  - Postgres-shaped: exposes `$schema` with the relevant `pgSchema` tables and only the fluent query methods actually called.
- Assert:
  - Correct `$schema`-based engine selection.
  - Expected behavior at the repository contract level rather than inspecting Drizzle AST or SQL strings.
  - No `eslint-disable-next-line` and no `any`-based shortcuts in tests.

Concrete patterns:

- AppState:
  - FakePgDb + `$schema.appState === pgSchema.appState` harness for `PostgresAppStateRepository`.
  - Dual-engine tests assert wiring and singleton behavior without depending on import order quirks.
- OAuthTokens:
  - FakePgDb implementing only the methods used by `PostgresOAuthTokenRepository`.
  - Tests verify provider/scope/raw mappings and expiry/cleanup semantics.
- Jobs:
  - FakePgDb + `QueryAdapter` with tagged conditions to validate `PostgresJobRepository` logic.
- RateLimits:
  - Minimal SQLite/Postgres fakes:
    - Asserts `cleanupOlderThan` deletes on SQLite and is a no-op on Postgres.
- ToolConfig:
  - Intended to use the same hermetic pattern:
    - Fakes for SQLite/Postgres shapes.
    - Assertions on normalization and `(system, global)` owner scoping.

Repositories to cover (and/or validate):

- `SessionRepository`
- `AppStateRepository`
- `OAuthTokenRepository`
- `JobRepository`
- `RateLimitRepository`
- `ToolConfigRepository`

### 2. Hermetic Integration-Style Tests (Contract-First)

Consumers of repositories (e.g. `MemoryJobQueue`, `SecureTokenStorage`) must be tested against repository interfaces, not real DBs.

Key principle:

- Tests validate “how the consumer uses the repository contract,” not the underlying tables.

Example: `MemoryJobQueue` hermetic integration test

- File: `__tests__/unit/lib/memory-job-queue.integration.test.ts`
- Technique:
  - `vi.mock("lib/database/job-repository")`:
    - Preserve actual exports.
    - Replace `getJobRepository` with a `vi.fn` returning a fake `JobRepository`.
  - `createFakeJobRepository()`:
    - Implements `insert`, `exists`, `loadActiveJobs`, `updateStatus`, `cleanupCompletedBefore`.
    - Records calls and maintains an in-memory job list.

This verifies:

- `enqueue` calls `exists` then `insert` on the repository.
- `updateJobStatus` delegates to `updateStatus`.
- `loadPersistedJobs` uses `loadActiveJobs`.
- `cleanupOldJobs` uses `cleanupCompletedBefore`.
- No direct access to `jobs` / `jobHistory` schemas.

The same pattern applies to:

- `SecureTokenStorage`:
  - Use a fake `OAuthTokenRepository` that tracks calls and shapes.
  - Assert correct usage of store/get/cleanup operations.
- `RateLimitService`:
  - Use a fake `RateLimitRepository` that records interactions.
  - Assert correct usage of `load`, `upsert`, and `cleanup` contracts without assuming engine.
- `ToolConfigManager` and related tooling:
  - Use a fake `ToolConfigRepository` that exposes `NormalizedToolConfig` operations.
  - Assert behavior purely against the repository contract.
- Future services:
  - Always test against repository-shaped fakes.

### 3. Allowed and Prohibited Patterns

Allowed:

- `vi.mock` of repository factory modules (`get*Repository`) to inject fakes.
- Minimal fakes that:
  - Implement only required methods.
  - Are fully typed against repository interfaces.
- Engine-specific tests co-located with repository modules.
- Dynamic import patterns in tests to control evaluation order for singleton factories where needed.

Prohibited:

- In non-repository code (including tests for consumers):
  - Direct imports of `lib/database/schema` or `lib/database/pg-schema`.
  - Manual engine branching (`if DB_ENGINE === "..."`) in application logic.
  - Using real DB engines for unit tests where a fake suffices.
- In repository tests:
  - Reliance on Drizzle AST internals or undocumented metadata beyond `$schema` identity checks.
  - `eslint-disable-next-line` to silence issues instead of fixing fakes or types.
  - `any`-typed fakes that bypass contract validation.

## Integration Testing Infrastructure

When a real HTTP or multi-component flow is required, use `__tests__/integration/`.

Typical use cases:

- OAuth flows across multiple modules.
- Tool registry resolution + handler execution via HTTP.
- Cross-tool workflows.

Patterns:

- Stand up the Next.js app or a minimal server if needed.
- Use environment flags to control real vs mock external dependencies.
- Keep these tests targeted; do not replicate unit-level assertions here.

## Docker E2E Testing Setup

Docker-based E2E tests provide process isolation and avoid conflicts between Vitest and Playwright.

Quick start:

```bash
npm run test:e2e:docker
docker-compose -f __tests__/e2e/docker-compose.e2e.yml down
```

Use this path for full, production-like validation.

## Development Quality Assurance

Guiding principles:

- Prefer small, hermetic tests that:
  - Depend on contracts (repository interfaces, tool registry types).
  - Avoid real external services by default.
- Use engine-specific repository tests to validate persistence details once.
- Use E2E/ Docker-based flows for final confidence, not as a replacement for unit/integration coverage.

## Testing Architecture Summary

### Mock Infrastructure

- Use `vi.mock` for:
  - Repository factories (`get*Repository`)
  - External HTTP clients
- Provide:
  - Minimal in-memory fakes
  - Deterministic behavior for assertions

### Coverage Focus

- Repository contracts and engine mappings
- OAuth token storage and rotation logic
- Job queue behavior through `JobRepository`
- Tool registry-driven routing and handlers
- Security-sensitive flows (tokens, sessions, rate limits)

## Troubleshooting

Common issues and mitigations remain as previously documented:

- Ensure dependencies installed and Node.js version compatible.
- Use proper `.env` variants for tests.
- Keep mocks localized and reset between tests.
- Separate Playwright/E2E from Vitest environments.

## Contributing to Tests

When adding or changing features:

1. Add/extend unit tests for:
   - Repository interfaces and mappings.
   - Services that depend on repositories (using fakes).
2. For new flows:
   - Add targeted integration tests if HTTP or multi-module behavior is involved.
3. Ensure:
   - No direct schema access in application tests.
   - No `eslint-disable-next-line` in test code.
4. Run:
   - `npm test`
   - Any relevant integration/E2E commands before merging.

## Additional Resources

- `docs/persistence.md` — repository-first, dual-engine architecture
- `docs/sqlite-to-postgresql/dual-engine-repositories.md` — detailed migration patterns
- `docs/tool-integration-system.md` — tool registry and persistence integration
- `docs/api.md` — API documentation
- `docs/architecture/` — system design references
