# Testing Guide

This guide covers the comprehensive testing strategy, framework selection, and quality assurance practices for Hyperpage.

## Testing Overview

Hyperpage includes automated tests for reliability and stability, featuring a comprehensive multi-layer testing infrastructure that ensures enterprise-grade reliability.

### Testing Frameworks

- **Unit Tests:** Vitest + React Testing Library for component and utility testing
- **Integration Tests:** Comprehensive OAuth flows, tool integrations, and API endpoint testing
- **E2E Tests:** Playwright for complete user workflow validation
- **Security Testing:** OAuth token encryption, session management, and credential handling
- **Performance Testing:** Rate limiting, concurrent authentication, and load testing
- **Mocking:** Integrated vi.mock for API and component isolation
- **Coverage:** Code coverage analysis available

## Test Structure

### Testing Directory Structure

```
__tests__/
├── api/                    # API route tests
├── components/            # Component tests
├── e2e/                  # End-to-end testing setup
├── integration/           # ✅ Integration testing suite
│   ├── oauth/            # OAuth flow integration tests
│   ├── tools/            # Tool API integration tests
│   ├── workflows/        # End-to-end workflow tests
│   └── performance/      # Load and performance tests
└── lib/                  # Utility function tests & test infrastructure
```

## Running Tests

### Unit & Integration Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode during development
npm run test:watch

# Run with UI
npm run test:ui
```

### Integration Testing (NEW)

```bash
# Run all integration tests
npm run test:integration

# Run specific provider tests
npm run test:oauth              # All OAuth tests
npm run test:oauth:github       # GitHub OAuth only
npm run test:oauth:gitlab       # GitLab OAuth only
npm run test:oauth:jira         # Jira OAuth only

# Run with coverage
npm run test:integration:coverage

# Run in watch mode for development
npm run test:integration:watch
```

### End-to-End Testing

E2E tests require proper environment setup and are designed for manual verification scenarios.

```bash
# Install Playwright browsers (one-time setup)
npm run test:e2e:install

# Run E2E tests (requires dev server configuration)
npm run test:e2e

# Run E2E tests in debug mode
npm run test:e2e:debug

# Run E2E tests with visual interface
npm run test:e2e:ui

# Docker-based E2E tests (isolated environment - RECOMMENDED)
npm run test:e2e:docker
```

## Integration Testing Infrastructure

### Test Environment Setup

Create `.env.local.test` for integration testing:

```bash
# Test Environment
NODE_ENV=test
ENABLE_INTEGRATION_TESTS=true
HYPERPAGE_TEST_BASE_URL=http://localhost:3000
TEST_DATABASE_URL=sqlite:./test.db
TEST_REDIS_URL=redis://localhost:6379

# OAuth Test Credentials (Optional - uses mock if not provided)
GITHUB_OAUTH_TEST_CLIENT_ID=your_test_github_client_id
GITHUB_OAUTH_TEST_CLIENT_SECRET=your_test_github_client_secret
SKIP_REAL_OAUTH=true
```

### Test Credential Management

The integration testing framework provides secure credential management:

```typescript
import { IntegrationTestEnvironment } from '__tests__/lib/test-credentials';

describe('Integration Test', () => {
  let testEnv: IntegrationTestEnvironment;
  let testSession: any;

  beforeAll(async () => {
    testEnv = await IntegrationTestEnvironment.setup();
  });

  beforeEach(async () => {
    testSession = await testEnv.createTestSession('github');
  });

  afterEach(async () => {
    await cleanupTestSession(testSession);
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });
});
```

### OAuth Integration Testing

#### GitHub OAuth Tests

Comprehensive testing of GitHub OAuth flows:

```typescript
test('should initiate GitHub OAuth flow', async ({ page }) => {
  await page.goto(`${baseUrl}/api/auth/github/initiate`);
  await expect(page).toHaveURL(/github\.com\/login\/oauth\/authorize/);
});

test('should store encrypted OAuth tokens', async () => {
  const response = await fetch(`${baseUrl}/api/auth/github/status`, {
    headers: { 'Cookie': `sessionId=${testSession.sessionId}` }
  });
  expect(response.status).toBe(200);
});
```

### Cross-Provider Testing

Tests validate consistent behavior across all OAuth providers:

- **Flow Initiation**: State parameter generation and validation
- **Callback Processing**: Authorization code exchange and token storage
- **Token Management**: Encryption, refresh, and cleanup
- **API Integration**: Authenticated requests to provider APIs
- **Rate Limiting**: Handling of provider-specific rate limits
- **Error Scenarios**: Invalid credentials, expired tokens, network failures

## Docker E2E Testing Setup

The **Docker-based E2E setup** provides complete environment isolation, eliminating conflicts with unit testing frameworks. This is the **recommended approach** for E2E testing as it resolves all framework conflicts between Vitest and Playwright.

#### Prerequisites

- Docker and Docker Compose installed
- At least 4GB RAM available for containers

#### Quick Start

```bash
# Run complete E2E test suite in isolated containers (RECOMMENDED)
npm run test:e2e:docker

# Clean up containers (when tests complete)
docker-compose -f __tests__/e2e/docker-compose.e2e.yml down
```

#### Docker Architecture

The E2E setup includes:
- **`hyperpage-e2e`**: Next.js app container with health checks and API endpoints
- **`playwright`**: Isolated test runner using official Playwright image with all browsers (Chromium, Firefox, WebKit)

#### Environment Configuration

Tests use `__tests__/e2e/.env.e2e` with mock data. Tools are enabled but use test credentials to avoid API rate limits and ensure deterministic behavior.

## Development Quality Assurance

### Verified Components

✅ **Confirmed Quality Standards:**
- Next.js 15 API route compatibility
- React hook testing with proper act() wrappers
- Mock infrastructure for isolated testing
- Async state management validation
- OAuth integration testing infrastructure
- Security validation for token handling
- Cross-tool workflow validation

### Integration Testing Features

- **OAuth Integration Testing**: End-to-end testing of GitHub, GitLab, and Jira OAuth flows
- **Tool API Integration**: Real API testing with GitHub, GitLab, and Jira endpoints
- **Cross-Tool Workflows**: Validation of unified data aggregation across multiple tools
- **Error Recovery Testing**: Network failures, rate limiting, and authentication error scenarios
- **Mock Support**: Development-friendly testing with mock credentials when real OAuth setup unavailable

## CI/CD Integration

All tests run in automated pipelines to maintain continuous quality:

```bash
npm ci && npm test && npm run test:coverage && npm run test:integration
```

Integration tests run alongside unit and E2E tests in CI/CD pipeline.

## Testing Architecture

### Mock Infrastructure
- **vi.mock**: Comprehensive API mocking for unit tests
- **Component Isolation**: Mocked external dependencies
- **Test Doubles**: Clean separation between tests
- **Integration Test Environment**: Isolated test environment with mock and real OAuth support

### Coverage Goals
- **Statement Coverage**: Target >90%
- **Branch Coverage**: Focus on critical paths
- **Function Coverage**: Ensure utility functions tested
- **Integration Coverage**: Comprehensive OAuth and API integration coverage

### Test Organization
- **Unit Tests**: `/__tests__/` directory mirroring source structure
- **Integration Tests**: OAuth flows, API integrations, and cross-tool workflows
- **E2E Tests**: Complete user flow validation with Playwright
- **Performance Tests**: Load testing and concurrent authentication scenarios

## Troubleshooting

### Common Testing Issues

**"Tests failing on fresh clone"**
- Run `npm install` to ensure all dependencies
- Check that `.env.local` contains test configurations
- Verify Node.js version 18+

**"Mock errors in tests"**
- Clear test cache: `npm run test:clean-cache`
- Reset Vitest state: `npm run test:reset`
- Check mock configurations are properly imported

**"Integration tests failing with OAuth setup"**
- Ensure `SKIP_REAL_OAUTH=true` for development without real OAuth setup
- Check test environment setup: `IntegrationTestEnvironment.setup()`
- Verify test database and Redis are available for testing

**"E2E tests failing with environment conflicts"**
- E2E tests require isolation from unit test frameworks (Vitest globals conflict with Playwright)
- Run E2E tests in a separate Node.js environment via Docker or dedicated CI stage
- Disable Playwright webServer config and start dev server manually

**"E2E tests timing out"**
- Ensure development server is running: `npm run dev`
- Configure longer timeouts in Playwright config
- Check network connectivity to test endpoints

## Contributing to Tests

When adding new features:

1. **Write unit tests** for all new functions and components
2. **Add integration tests** for API routes and data flows
3. **Add OAuth integration tests** for new authentication flows
4. **Update mocks** when changing external APIs
5. **Run full test suite** before submitting PRs

### Test Best Practices

- **Test Isolation**: Each test should be independent
- **Meaningful Names**: Describe what the test validates
- **Mock Wisely**: Only mock external dependencies
- **Integration Focus**: Test real OAuth flows and API integrations
- **Security Testing**: Validate token encryption and session management
- **Clean Up**: Ensure no test state pollution

### Code Coverage Requirements

- **New Code**: Minimum 90% coverage
- **Critical Paths**: 100% coverage for error handling and OAuth flows
- **Regression Tests**: Cover bug fixes permanently
- **Integration Coverage**: Comprehensive testing of OAuth and API integrations

## Additional Resources

- **[Integration Testing Guide](integration-testing-guide.md)**: Detailed guide for integration testing setup and usage
- **[OAuth Architecture Design](oauth-architecture-design.md)**: Understanding OAuth integration patterns
- **[API Documentation](api.md)**: API endpoints and testing strategies
- **[Architecture Documentation](architecture.md)**: System design and testing implications

For implementation details, see [`docs/api.md`](api.md) and [`docs/architecture.md`](architecture.md).
