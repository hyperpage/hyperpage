# Test File Structure Guide

This document provides a comprehensive guide to the new test file structure implemented in the Hyperpage project.

## Overview

The test organization has been redesigned to follow industry best practices and improve maintainability, performance, and discoverability. The new structure separates tests by purpose, complexity, and execution requirements.

## Directory Structure

```
__tests__/
├── unit/                    # Fast, isolated unit tests
│   ├── api/                 # API endpoint tests
│   │   ├── auth/           # Authentication API tests
│   │   ├── tools/          # Tool management API tests
│   │   ├── bottlenecks/    # Bottleneck detection API tests
│   │   ├── health/         # Health check API tests
│   │   └── metrics/        # Metrics API tests
│   ├── components/         # React component tests
│   │   └── hooks/          # Custom hook tests
│   ├── lib/                # Library function tests
│   │   ├── cache/          # Caching functionality tests
│   │   ├── database/       # Database operation tests
│   │   ├── jobs/           # Job queue and scheduler tests
│   │   └── monitoring/     # Monitoring and alerting tests
│   └── tools/              # Tool integration tests
├── integration/            # Slow, end-to-end tests
│   ├── oauth/              # OAuth flow integration tests
│   ├── performance/        # Performance integration tests
│   ├── tools/              # Multi-tool integration tests
│   └── workflows/          # Workflow integration tests
├── performance/            # Performance and load tests
│   ├── api/                # API performance tests
│   ├── rate-limit/         # Rate limiting performance tests
│   └── database/           # Database performance tests
├── e2e/                    # End-to-end browser tests
├── grafana/                # Grafana dashboard tests
└── mocks/                  # Shared test mocks and utilities
```

## Test Categories

### Unit Tests (`__tests__/unit/`)

**Purpose**: Test individual functions, components, and modules in isolation
**Execution**: Fast (< 5 seconds)
**Dependencies**: Minimal, use mocks extensively
**Examples**:

- Library function tests
- React component tests
- Custom hook tests
- API route handler tests

### Integration Tests (`__tests__/integration/`)

**Purpose**: Test how multiple components work together
**Execution**: Medium (5-30 seconds)
**Dependencies**: Real services where necessary
**Examples**:

- OAuth flow tests
- Database integration tests
- Multi-tool workflow tests
- API integration tests

### Performance Tests (`__tests__/performance/`)

**Purpose**: Test system performance under load
**Execution**: Slow (30+ seconds)
**Dependencies**: Production-like environment
**Examples**:

- Load testing
- Rate limiting performance
- Database query performance
- Memory usage tests

### End-to-End Tests (`__tests__/e2e/`)

**Purpose**: Test complete user workflows
**Execution**: Very slow (minutes)
**Dependencies**: Running application instance
**Examples**:

- Complete user journeys
- Browser automation tests
- Full application workflows

## File Naming Conventions

### Test Files

- **Unit Tests**: `{filename}.test.ts`
- **Integration Tests**: `{feature}.spec.ts`
- **Performance Tests**: `{component}-performance.test.ts`
- **E2E Tests**: `{workflow}.spec.ts`

### Helper Files

- **Test Constants**: `test-constants.ts`
- **Test Utilities**: `test-utils.ts`
- **Mock Data**: `mock-{service}.ts`
- **Test Configuration**: `{test-type}.config.ts`

## Import Patterns

### Unit Test Imports

```typescript
// Direct imports for unit tests
import { describe, test, expect, beforeEach, vi } from "vitest";
import { functionToTest } from "@/lib/function-to-test";
import { createMock } from "@/test-utils";

// Component tests
import { render, screen, fireEvent } from "@testing-library/react";
import { MyComponent } from "@/components/MyComponent";
```

### Integration Test Imports

```typescript
// Integration test imports
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { setupTestServer } from "@/tests/integration/setup";
import { createTestUser } from "@/tests/integration/helpers";

// API integration
import { createRequest, createResponse } from "node-mocks-http";
import handler from "@/app/api/endpoint/route";
```

### E2E Test Imports

```typescript
// E2E test imports
import { test, expect } from "@playwright/test";
import { TestBrowser } from "@/tests/e2e/utils/test-browser";
```

## Test Configuration

### Vitest Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "__tests__/", "**/*.d.ts", "**/*.config.*"],
    },
  },
});
```

### Playwright Configuration

```typescript
// tests/e2e/playwright.config.ts
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
});
```

## Running Tests

### All Tests

```bash
npm test
```

### Specific Test Types

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Performance tests only
npm run test:performance

# E2E tests only
npm run test:e2e
```

### Specific Files

```bash
# Test single file
npm test -- __tests__/unit/lib/my-function.test.ts

# Test by pattern
npm test -- --grep "authentication"

# Test with coverage
npm test -- --coverage
```

### Test Options

```bash
# Run in watch mode
npm test -- --watch

# Run with verbose output
npm test -- --reporter=verbose

# Run with debugging
npm test -- --inspect-brk
```

## Best Practices

### Writing Unit Tests

1. **Keep tests focused**: One test should verify one behavior
2. **Use descriptive names**: Test names should describe the expected behavior
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **Mock external dependencies**: Use mocks for databases, APIs, etc.
5. **Test edge cases**: Include error conditions and boundary values

```typescript
describe("UserService", () => {
  describe("createUser", () => {
    it("should create user with valid data", async () => {
      // Arrange
      const userData = { name: "John Doe", email: "john@example.com" };
      const expectedUser = {
        id: "1",
        ...userData,
        createdAt: expect.any(Date),
      };

      // Act
      const result = await UserService.createUser(userData);

      // Assert
      expect(result).toEqual(expectedUser);
    });

    it("should throw error for invalid email", async () => {
      // Arrange
      const userData = { name: "John Doe", email: "invalid-email" };

      // Act & Assert
      await expect(UserService.createUser(userData)).rejects.toThrow(
        "Invalid email format",
      );
    });
  });
});
```

### Writing Integration Tests

1. **Set up real dependencies**: Use actual databases, services where appropriate
2. **Clean up after tests**: Always clean up test data
3. **Test realistic scenarios**: Use data and flows that match production
4. **Handle async operations**: Properly handle promises and async/await

```typescript
describe("OAuth Integration", () => {
  beforeAll(async () => {
    await setupTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer();
  });

  it("should complete full OAuth flow", async () => {
    // Test the complete flow with real services
    const response = await fetch("/api/auth/oauth/github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "test-code" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```

### Writing Performance Tests

1. **Use realistic data sets**: Test with data sizes similar to production
2. **Measure key metrics**: Response time, memory usage, throughput
3. **Test under load**: Simulate concurrent users and requests
4. **Set performance budgets**: Define acceptable performance thresholds

```typescript
describe("Rate Limiting Performance", () => {
  it("should handle 1000 requests under 2 seconds", async () => {
    const startTime = performance.now();
    const requests = Array.from({ length: 1000 }, (_, i) =>
      testRateLimitRequest(i.toString()),
    );

    await Promise.all(requests);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(2000);
  });
});
```

## Test Data Management

### Test Constants

```typescript
// __tests__/test-constants.ts
export const TEST_USER = {
  id: "test-user-id",
  email: "test@example.com",
  name: "Test User",
};

export const TEST_TOOLS = {
  github: {
    name: "GitHub",
    enabled: true,
    config: { token: "test-token" },
  },
  jira: {
    name: "Jira",
    enabled: false,
    config: {},
  },
};
```

### Mock Data

```typescript
// __tests__/mocks/tool-mock.ts
export const createMockTool = (overrides = {}) => ({
  id: "mock-tool",
  name: "Mock Tool",
  enabled: true,
  config: {},
  widgets: [],
  ...overrides,
});
```

## Continuous Integration

### GitHub Actions Integration

Tests are automatically run in CI/CD pipeline:

- **Unit tests**: Run on every push
- **Integration tests**: Run on pull requests
- **Performance tests**: Run nightly
- **E2E tests**: Run on staging deployments

### Test Reports

- **Coverage reports**: Generated for unit tests
- **JUnit XML**: Generated for integration with external tools
- **HTML reports**: Generated for e2e tests
- **Performance reports**: Generated for performance tests

## Troubleshooting

### Common Issues

1. **Test timeouts**

   ```typescript
   // Increase timeout for slow tests
   test(
     "slow operation",
     async () => {
       // Test implementation
     },
     { timeout: 30000 },
   );
   ```

2. **Database connection issues**

   ```typescript
   // Use test database
   beforeEach(async () => {
     await setupTestDatabase();
   });
   ```

3. **Mock conflicts**
   ```typescript
   // Clear mocks between tests
   afterEach(() => {
     vi.clearAllMocks();
   });
   ```

## Migration from Old Structure

If you're migrating existing tests to the new structure:

1. **Identify test type**: Determine if it's unit, integration, or performance
2. **Find appropriate directory**: Move to the correct category
3. **Update imports**: Fix any broken import paths
4. **Update test commands**: Update any custom test scripts
5. **Run tests**: Verify tests still pass in new location

## Conclusion

This new test structure provides:

- **Better organization**: Clear separation of test types
- **Improved performance**: Faster unit test execution
- **Better maintainability**: Easier to find and update tests
- **Better coverage**: More comprehensive testing strategy
- **Better CI/CD integration**: Optimized for continuous integration

For questions or issues with the test structure, refer to the main testing documentation or contact the development team.
