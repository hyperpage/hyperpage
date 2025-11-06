# Test Organization and Structure Guide

This document outlines the reorganized test structure for the Hyperpage project, which was completed as part of Phase 3 of the testing infrastructure improvements.

## Test Directory Structure

The test suite has been reorganized into a clear, hierarchical structure:

```
__tests__/
├── shared/                          # Shared test utilities and constants
│   └── test-credentials.ts          # Test credentials, mock data, and utilities
├── unit/                            # Unit tests (fast, isolated tests)
│   ├── api/                         # API endpoint tests
│   ├── components/                  # Component unit tests
│   ├── lib/                         # Library and utility tests
│   └── tools/                       # Tool registry and configuration tests
├── integration/                     # Integration tests (end-to-end, slow)
│   ├── environment/                 # Environment setup tests
│   ├── oauth/                       # OAuth flow integration tests
│   ├── performance/                 # Performance and load testing
│   ├── tools/                       # Tool integration tests
│   └── workflows/                   # User workflow tests
│       └── utils/                   # Workflow testing utilities
├── e2e/                             # End-to-end browser tests
├── performance/                     # Dedicated performance tests
├── tools/                           # Tool-specific test helpers
└── mocks/                           # Mock servers and external services
```

## Test Categories and Their Purposes

### Unit Tests (`__tests__/unit/`)

- **API Tests** (`api/`): Test individual API endpoints in isolation
- **Component Tests** (`components/`): Test React components with mocked data
- **Library Tests** (`lib/`): Test utility functions, classes, and services
- **Tool Tests** (`tools/`): Test tool registry, validation, and configuration

**Key Principles:**

- Fast execution (sub-second per test)
- No external dependencies
- Mock all external services
- Focus on individual units of code

### Integration Tests (`__tests__/integration/`)

- **Environment Tests** (`environment/`): Test system configuration and setup
- **OAuth Tests** (`oauth/`): Test authentication flows across providers
- **Performance Tests** (`performance/`): Test system behavior under load
- **Tool Integration Tests** (`tools/`): Test tool APIs and data fetching
- **Workflow Tests** (`workflows/`): Test complete user journeys

**Key Principles:**

- Slower execution (may take seconds to minutes)
- Test interactions between components
- May use real or mocked external services
- Focus on end-to-end functionality

### End-to-End Tests (`__tests__/e2e/`)

- Browser-based tests using Playwright
- Test complete user flows through the UI
- Validate real user scenarios
- Slowest execution time

### Performance Tests (`__tests__/performance/`)

- Dedicated performance and load testing
- Monitor system behavior under stress
- Validate performance requirements

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
# Unit tests only (fast)
npm run test:unit

# Integration tests only
npm run test:integration

# End-to-end tests
npm run test:e2e

# Performance tests
npm run test:performance
```

### By Specific Areas

```bash
# API tests only
npm test -- --testPathPattern=unit/api

# Tool integration tests
npm test -- --testPathPattern=integration/tools

# OAuth flow tests
npm test -- --testPathPattern=integration/oauth
```

## Test Configuration

### Environment Variables

Tests use the shared test credentials and mock environments. No real API keys or sensitive data is required.

### Test Data

All tests use generated mock data that simulates real API responses without making external requests.

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
