# Workflow Testing Guide

## Overview

This comprehensive end-to-end workflow testing suite validates the complete integration experience across GitHub, GitLab, and Jira tools within the Hyperpage platform.

## Test Suite Architecture

### Core Components

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

- **New User Onboarding**: Setup wizard, OAuth flows, initial configuration
- **Existing User Experience**: Login persistence, preference management
- **Portal Navigation**: Tool switching, data viewing, widget interactions
- **Error Handling**: Authentication failures, configuration errors

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

### Individual Test Suites

```bash
# Run specific test suite
npx vitest run __tests__/integration/workflows/user-journey.spec.ts
npx vitest run __tests__/integration/workflows/session-management.spec.ts
npx vitest run __tests__/integration/workflows/rate-limiting-coordination.spec.ts
npx vitest run __tests__/integration/workflows/error-recovery.spec.ts
npx vitest run __tests__/integration/workflows/multi-tool-orchestration.spec.ts
```

### All Workflow Tests

```bash
# Run all workflow tests
npx vitest run __tests__/integration/workflows/

# Run with watch mode for development
npx vitest __tests__/integration/workflows/
```

### With Coverage

```bash
# Run tests with coverage report
npx vitest run __tests__/integration/workflows/ --coverage
```

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

This workflow testing guide complements the main testing strategy outlined in [testing.md](testing.md). While unit and integration tests focus on individual components, workflow tests validate complete user journeys and cross-platform interactions.

### Cross-Reference

- **Unit Tests**: Component-level validation
- **Integration Tests**: API and OAuth flow testing
- **E2E Tests**: User interface workflows
- **Workflow Tests**: Cross-platform orchestration and data flows

For comprehensive testing strategy, see [testing.md](testing.md). For development workflow, see [development-workflow.md](development-workflow.md).
