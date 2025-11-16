# Workflow Testing Guide

## Overview

This guide documents the legacy “workflow” suites that live under `__tests__/integration/workflows`.  
They currently rely on synthetic helpers (`TestBrowser`, `UserJourneySimulator`) rather than real browsers, so treat them as higher-level integration/unit tests rather than true E2E coverage.  
Playwright-based flows (`__tests__/e2e/**`) are the future direction; until they fully replace these suites, use this guide to understand what the synthetic workflow tests cover and how to run them.

## Test Suite Architecture

### Core Components (Synthetic Harness)

1. **TestBrowser** (`utils/test-browser.ts`)
   - Simulates browser interactions and session management
   - Provides session data storage and retrieval
   - Handles navigation and waiting operations

2. **UserJourneySimulator** (`utils/user-journey-simulator.ts`)
   - Orchestrates complete user workflows
   - Manages OAuth authentication flows
   - Simulates portal navigation and tool interactions

3. **Integration Test Environment** (`../../lib/test-credentials.ts`)
   - Provides OAuth test credentials and environment setup
   - Manages test session lifecycle
   - Handles cleanup and resource management

### Test Suites

#### 1. User Journey Tests (`user-journey.spec.ts`)

**Coverage**: Complete user workflows from first visit to active usage

- **New User Onboarding**: Setup wizard, OAuth flows, initial configuration (simulated via mocks)
- **Existing User Experience**: Login persistence, preference management (mock storage)
- **Portal Navigation**: Tool switching, data viewing, widget interactions (TestBrowser-only, no real DOM)
- **Error Handling**: Authentication failures, configuration errors (synthetic responses)

#### 2. Session Management Tests (`session-management.spec.ts`)

**Coverage**: Session lifecycle and persistence

- **Session Creation**: Proper metadata, integrity validation, expiration handling
- **Token Management**: OAuth refresh, renewal, failure handling
- **Multi-Session Support**: Concurrent providers, session isolation
- **Persistence**: Cross-browser restarts, state maintenance, auto-refresh
- **Security**: Data encryption, integrity validation, concurrent access

#### 3. Rate Limiting Coordination Tests (`rate-limiting-coordination.spec.ts`)

**Coverage**: Cross-platform API rate limit management

- **Individual Limits**: GitHub (5000/hour), GitLab (300/min), Jira (1000/day)
- **Cross-Tool Coordination**: Load distribution, mixed states, recovery
- **User Experience**: Rate limit feedback, graceful degradation, real-time status

#### 4. Error Recovery Tests (`error-recovery.spec.ts`)

**Coverage**: System resilience and fault tolerance

- **Network Failures**: Timeouts, connection issues, DNS failures
- **API Errors**: 401/403/404/429/500 responses, retry logic
- **Authentication Issues**: Token expiration, revocation, scope errors
- **Recovery Mechanisms**: Fallback data, exponential backoff, circuit breakers

#### 5. Multi-Tool Orchestration Tests (`multi-tool-orchestration.spec.ts`)

**Coverage**: Cross-platform workflows and data synchronization

- **Workflow Orchestration**: PR-to-issue linking, data aggregation
- **Data Consistency**: Synchronization, bidirectional updates
- **Performance**: Time bounds, concurrent workflows, timeout handling
- **Error Recovery**: Partial failures, workflow timeouts

## Running the Tests

> ⚠️ These suites require the Postgres harness plus the synthetic helpers. Run `npm run db:test:up` and ensure `DATABASE_URL` is exported before executing any command below.

### Individual Test Suites

```bash
# Run specific workflow suite
npm run test -- __tests__/integration/workflows/user-journey.spec.ts
npm run test -- __tests__/integration/workflows/session-management.spec.ts
npm run test -- __tests__/integration/workflows/rate-limiting-coordination.spec.ts
npm run test -- __tests__/integration/workflows/error-recovery.spec.ts
npm run test -- __tests__/integration/workflows/multi-tool-orchestration.spec.ts
```

### Entire Workflow Folder

```bash
# Run all workflow suites once (CI-style)
npm run test -- __tests__/integration/workflows

# Watch mode for iterative development
npm run test:watch -- __tests__/integration/workflows

# With coverage instrumentation
npm run test:coverage -- --include __tests__/integration/workflows/**
```

Because these suites rely on mocked browsers, they never set `E2E_TESTS`. If you need actual UI validation, use Playwright (`npm run test:e2e`) instead.

## Test Execution Patterns

### Environment Setup

All tests use the same setup pattern:

```typescript
beforeAll(async () => {
  testEnv = await IntegrationTestEnvironment.setup();
  baseUrl = process.env.HYPERPAGE_TEST_BASE_URL || "http://localhost:3000";
  browser = new TestBrowser();
  journeySimulator = new UserJourneySimulator(baseUrl, browser);
});

afterAll(async () => {
  await browser.cleanup();
  await testEnv.cleanup();
});
```

### Mock Data Simulation

Tests use sophisticated mock data simulation:

```typescript
// Simulate API responses with realistic patterns
const simulateAPICall = async (
  provider: string,
  endpoint: string,
  params: any,
) => {
  const success = Math.random() > 0.2; // 80% success rate for realistic testing
  return {
    success,
    data: success ? { items: [], total: 0 } : null,
    error: success ? null : "API Error",
  };
};
```

### Session Management

```typescript
// Create test sessions with proper credentials
const testSession = await testEnv.createTestSession("github");
await journeySimulator.completeOAuthFlow("github", testSession.credentials);
```

## Test Categories and Coverage

### Authentication & Authorization (15 tests)

- OAuth flow completion
- Token refresh mechanisms
- Session persistence across browser restarts
- Multi-provider session management
- Security validation and encryption

### Data Integration (20 tests)

- Cross-tool data synchronization
- Workflow linking (PR ↔ Issue)
- Real-time data updates
- Data consistency validation
- Performance under load

### Error Handling & Recovery (25 tests)

- Network failure recovery
- API error handling (4xx/5xx)
- Rate limiting coordination
- Graceful degradation patterns
- User feedback mechanisms

### User Experience (30 tests)

- Complete user journeys
- Setup wizard workflows
- Portal navigation
- Widget interactions
- Multi-device compatibility

### Performance & Reliability (22 tests)

- Concurrent workflow handling
- Timeout management
- Resource cleanup
- Memory leak prevention
- Load balancing validation

## Key Test Scenarios

### Complete User Journey

1. **First Visit**: Setup wizard → OAuth authentication → Tool configuration
2. **Daily Usage**: Portal navigation → Data viewing → Tool interactions
3. **Error Recovery**: Handle failures gracefully → Maintain user context
4. **Session Persistence**: Browser restart → Continued functionality

### Cross-Tool Orchestration

1. **GitHub ↔ Jira**: PR creation → Automatic issue linking
2. **Multi-Provider**: Concurrent operations across all tools
3. **Data Synchronization**: Real-time updates across platforms
4. **Failure Isolation**: One tool fails → Others continue operating

### Rate Limiting Management

1. **Individual Limits**: Respect each provider's limits
2. **Cross-Platform**: Coordinate usage across tools
3. **User Feedback**: Clear rate limit status and recovery
4. **Adaptive Behavior**: Backoff strategies and recovery

## Mock Implementation Details

### Browser Session Simulation

```typescript
// Session data storage and retrieval
browser.setSessionData("oauth_github", credentials);
const storedCredentials = browser.getSessionData("oauth_github");

// Session persistence across operations
browser.setSessionData("session_last_activity", Date.now());
```

### API Response Mocking

```typescript
// Simulate various API states
const apiStates = {
  success: { status: 200, data: {...} },
  rateLimited: { status: 429, retryAfter: 60 },
  unauthorized: { status: 401, error: 'Token expired' },
  serverError: { status: 500, error: 'Service unavailable' }
};
```

### Workflow Orchestration Simulation

```typescript
// Cross-tool data aggregation
const aggregatedData = await Promise.all([
  simulateAPICall("github", "pulls", {}),
  simulateAPICall("gitlab", "merge_requests", {}),
  simulateAPICall("jira", "issues", {}),
]);
```

## Best Practices

### Test Isolation

- Each test creates its own session
- Cleanup happens in `afterEach`/`afterAll`
- No shared state between tests
- Proper resource disposal

### Realistic Scenarios

- Use actual API rate limits (GitHub: 5000/hour, GitLab: 300/min, Jira: 1000/day)
- Simulate real-world error patterns and recovery mechanisms
- Test concurrent operations and cross-tool workflows
- Validate user experience under various failure conditions

### Performance Testing

- Measure response times for each test operation
- Track memory usage during long-running tests
- Validate timeout handling and recovery
- Test concurrent user scenarios

## Integration with Main Testing Strategy

This guide complements the repo-wide testing docs ([testing.md](testing.md), [test-organization.md](test-organization.md)), but keep the following caveats in mind:

- **Synthetic scope**: These suites never launch a real browser or hit real network traffic. Treat their assertions as higher-level logic tests, not true E2E coverage.
- **Playwright migration**: Critical workflows (setup wizard, OAuth journeys, multi-tool orchestration) must eventually be validated through Playwright (`__tests__/e2e/**`). Use this doc as a stopgap reference until that migration is complete.
- **Env requirements**: Even though the browser is mocked, repositories and API handlers still run against the Postgres harness, so start the dockerized DB and export `DATABASE_URL` before executing.

### Cross-Reference

- **Unit Tests**: Component-level validation (`npm run test:unit`)
- **Integration Tests**: API + Postgres-backed flows (`npm run test:integration`)
- **Workflow Tests (synthetic)**: Mocked TestBrowser/UserJourneySimulator suites (this doc)
- **E2E Tests**: Real UI/browser coverage via Playwright (`npm run test:e2e`)

For the overarching taxonomy and how to combine these layers in CI, see [testing.md](testing.md) and [development-workflow.md](development-workflow.md).
