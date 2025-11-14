# Test Organization and Structure Guide

This document outlines the reorganized test structure for the Hyperpage project, which was completed as part of Phase 3 of the testing infrastructure improvements.

## Test Directory Structure

The test suite has been reorganized into a clear, hierarchical structure:

```
__tests__/
├── shared/                # Shared test utilities (test-credentials, fake sessions, env helpers)
├── mocks/                 # Mock servers (e.g., rate-limit server) reused across suites
├── unit/                  # Unit + API-facing suites (still rely on Postgres harness)
│   ├── api/               # Route handlers (bottlenecks, tools, health, metrics, etc.)
│   ├── components/        # React hook/component tests
│   ├── lib/               # Database/repos, queues, monitoring; Postgres + Redis heavy
│   └── tools/             # Tool registry/config validation
├── integration/           # Postgres-backed workflows + HTTP integration tests
│   ├── database/          # Harness sanity checks (Postgres-only)
│   ├── performance/       # Optional mocked “performance validation” (PERFORMANCE_TESTS=1)
│   ├── tools/             # Calls live Next.js routes; gated by E2E_TESTS + tokens
│   └── workflows/         # Synthetic TestBrowser workflows (to be migrated to real E2E)
├── performance/           # Optional timed suites (PERFORMANCE_TESTS=1)
│   └── rate-limit/        # Focused perf scenarios
├── e2e/                   # Playwright tests + docker harness
│   └── oauth/             # Provider-specific specs (require tokens)
└── grafana/               # Dashboard validation (GRAFANA_TESTS=1)
```

## Test Categories and Their Purposes

### Unit Tests (`__tests__/unit/`)

- **API Tests** (`api/`): Exercise Next.js route handlers. They mock external services but still rely on the Postgres harness via repository imports.
- **Component Tests** (`components/`): React hooks/components with mocked browser APIs.
- **Library Tests** (`lib/`): Database repositories, queues, cache, monitoring, OAuth helpers. These tests provision/drop the Postgres DB through `vitest.setup.ts` and occasionally touch Redis.
- **Tool Tests** (`tools/`): Registry metadata and enablement logic.

**Key Principles:**

- Keep suites deterministic and hermetic (mock network + external APIs).
- Tests are categorized as “unit” but still require a running Postgres instance. Start the dockerized DB (`npm run db:test:up`) before invoking `npm run test:unit`.
- Prefer shared fixtures/utilities over ad-hoc mocks to avoid drift.

### Integration Tests (`__tests__/integration/`)

- **Database**: `database/dual-engine.test.ts` validates Postgres-only wiring. Rename/expand as we continue tightening the harness.
- **Performance**: Mock-heavy timing sanity checks; flagged via `PERFORMANCE_TESTS`.
- **Tools**: Hit actual app routes (`/api/tools/**`) using `fetch`. Require the dev server plus `E2E_TESTS` and provider tokens. They skip automatically when the server is down.
- **Workflows**: Synthetic UI flows built on `TestBrowser`/`UserJourneySimulator`. Treat them as transitional until replaced by Playwright.

**Key Principles:**

- Depend on the Postgres harness (and sometimes Redis). The dockerized DB must be running.
- Tool suites should be treated as opt-in: they skip unless explicitly enabled + server reachable.
- Long term, migrate anything that pretends to be UI automation into Playwright.

### End-to-End Tests (`__tests__/e2e/`)

- Playwright specs (`portal`, `rate-limit-handling`, `tool-integration`, `oauth/*`) run against a real Next.js server (local dev or docker compose).
- Controlled via `npm run test:e2e*` scripts that set `E2E_TESTS=1`.
- OAuth specs expect real provider tokens and now remain quarantined unless `E2E_OAUTH=1` (in addition to `E2E_TESTS=1`) is set with valid provider credentials.

### Performance Tests (`__tests__/performance/`)

- Optional timed suites (`database.test.ts`, `rate-limit/rate-limiting-performance.test.ts`).
- Disabled unless `PERFORMANCE_TESTS=1`.
- Focus on guarding regressions in repo/cache helpers, not micro-benchmarks.

### Grafana Tests (`__tests__/grafana/`)

- Validate dashboard JSON against Grafana expectations.
- Opt-in via `GRAFANA_TESTS=1` or `E2E_TESTS=1`.

## Shared Test Utilities

### Test Credentials (`__tests__/shared/test-credentials.ts`)

The shared test utilities provide:

- **Mock Credentials**: Safe test credentials for all supported services
- **Test User Management**: `TestUserManager` singleton for user lifecycle
- **Integration Environment**: `IntegrationTestEnvironment` for setup/teardown
- **Mock Data Generators**: Generate realistic test data for all tools
- **Server Availability Checks**: Mock service availability for testing

#### Key Interfaces

```typescript
// Test user interface used across integration tests
export interface TestUser {
  id: string;
  userId: string;
  sessionId: string;
  provider: string;
  credentials: OAuthTestCredentials;
  lastAccessed: string;
  createdAt: string;
  accessCount: number;
  isActive: boolean;
  tokens?: Record<string, unknown>;
}

// Integration test environment manager
export class IntegrationTestEnvironment {
  static async setup(): Promise<IntegrationTestEnvironment>;
  async createTestSession(provider: string): Promise<TestSession>;
  async cleanup(): Promise<void>;
}

// Test user lifecycle management
export class TestUserManager {
  static getInstance(): TestUserManager;
  createTestUser(session: TestSession): TestUser;
  getTestUser(userId: string): TestUser | null;
}
```

## Running Tests

### By Category

```bash
# Unit + API suites (require Postgres running via npm run db:test:up)
npm run test:unit

# Integration suites (__tests__/integration/**)
npm run test:integration

# Postgres + perf-focused suites
PERFORMANCE_TESTS=1 npm run test:perf

# Playwright E2E
npm run test:e2e

# Dockerized Playwright against built app
npm run test:e2e:docker
```

For narrower filters, use Vitest’s path arguments. Example:

```bash
# Only run GitHub tool integration specs (assuming server + tokens available)
E2E_TESTS=1 npm run test -- __tests__/integration/tools/github.spec.ts
```

## Test Configuration

### Environment Variables

Most suites rely on `.env.testing` and the Postgres harness:

- Set `DATABASE_URL` (e.g., via `.env.testing`) so `vitest.setup.ts` can drop/create the test database.
- Optional suites require env flags:
  - `E2E_TESTS=1` for tool integration specs + Playwright.
  - `E2E_OAUTH=1` when enabling `__tests__/e2e/oauth/**` alongside provider tokens.
  - `PERFORMANCE_TESTS=1` for `__tests__/performance/**` and `__tests__/integration/performance/**`.
  - `GRAFANA_TESTS=1` for `__tests__/grafana`.
- Tool integration suites additionally require `HYPERPAGE_TEST_BASE_URL` to match the running Next.js server (defaults to `http://localhost:3000` in `.env.testing` / npm scripts) plus the provider tokens referenced above.
- Provider tokens (`GITHUB_TOKEN`, `GITLAB_TOKEN`, `JIRA_API_TOKEN`) are required whenever a suite reaches out to their routes or OAuth flows. Keep placeholders in `.env.testing` and override locally as needed.

### Test Data

- `vitest.setup.ts` seeds deterministic rows into Postgres tables before each test. Avoid creating ad-hoc fixtures outside the harness.
- `__tests__/shared/test-credentials.ts` provides fake OAuth credentials, session helpers, and mock data generators for integration/tool suites.
- Playwright suites rely on whatever data the app surfaces; when asserting on tool data, prefer high-level UI expectations rather than brittle mock payloads.

## Migration and Maintenance

### Adding New Tests

1. Choose the appropriate category based on test scope
2. Use shared utilities from `__tests__/shared/test-credentials.ts`
3. Follow the established patterns in existing tests
4. Include proper cleanup in `afterEach` or `afterAll` hooks

### Best Practices

- **Unit tests**: Mock everything, test one thing at a time
- **Integration tests**: Test realistic scenarios, use shared utilities
- **Performance tests**: Measure actual performance, not just functionality
- **E2E tests**: Test critical user paths, keep them minimal

## Recent Changes (Phase 3)

### Phase 3.1: API Test Reorganization

- Moved API tests from scattered locations to `__tests__/unit/api/`
- Standardized API test patterns and utilities
- Fixed import paths and dependencies

### Phase 3.2: Library Test Consolidation

- Consolidated library tests into `__tests__/unit/lib/`
- Removed legacy test directories
- Updated all import paths to new structure

### Phase 3.3: Component Test Organization

- Organized component tests by feature area
- Established consistent component testing patterns
- Added shared component testing utilities

### Phase 3.4: Tool Test Reorganization

- Reorganized tool-specific tests into logical structure
- Created tool integration test patterns
- Established tool testing best practices

### Phase 3.5: Shared Utilities Creation

- Created comprehensive shared test utilities
- Implemented TestUserManager and IntegrationTestEnvironment
- Added mock data generators and server availability checkers

## Future Enhancements

### Phase 3.6: Documentation Updates

- [x] Update test organization documentation
- [ ] Add testing best practices guide
- [ ] Create test debugging guide
- [ ] Document performance testing procedures

### Phase 3.7: Validation and Quality Assurance

- [ ] Validate test coverage across all areas
- [ ] Ensure all tests pass with new structure
- [ ] Performance validation of test suite
- [ ] Final quality assurance checks
