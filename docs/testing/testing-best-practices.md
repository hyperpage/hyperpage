# Testing Best Practices Guide

This guide provides comprehensive best practices for writing and maintaining tests in the Hyperpage project, based on the reorganized test structure and shared utilities.

## Test Design Principles

### 1. Test Pyramid Adherence

Follow the test pyramid to maintain a healthy test suite:

```
    /\
   /  \        E2E Tests (10%) - Critical user paths only
  /____\
 /      \      Integration Tests (20%) - Service interactions
/        \
\        /      Unit Tests (70%) - Fast, isolated, comprehensive
 \______/
```

#### Unit Tests (70% of total tests)

- **Purpose**: Test individual functions, components, and modules in isolation
- **Speed**: Sub-second execution
- **Dependencies**: Mock everything external
- **Coverage**: High coverage for business logic

#### Integration Tests (20% of total tests)

- **Purpose**: Test interactions between components and services
- **Speed**: Seconds to minutes
- **Dependencies**: May use mocked external services
- **Coverage**: Focus on critical integration points

#### E2E Tests (10% of total tests)

- **Purpose**: Validate complete user workflows
- **Speed**: Minutes
- **Dependencies**: Real environment setup
- **Coverage**: Only critical user paths

### 2. Test Organization Rules

#### File Naming Conventions

- **Unit Tests**: `[component/function].test.ts` or `[component/function].spec.ts`
- **Integration Tests**: `[feature].integration.test.ts`
- **E2E Tests**: `[user-flow].e2e.spec.ts`
- **Performance Tests**: `[component/feature].performance.test.ts`

#### Directory Structure

- **Unit tests**: Mirror source code structure in `__tests__/unit/`
- **Integration tests**: Organized by feature area in `__tests__/integration/`
- **E2E tests**: Organized by user journey in `__tests__/e2e/`

## Writing Effective Unit Tests

### 1. Component Testing

#### React Component Test Pattern

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Wrap components with necessary providers
const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe("ComponentName", () => {
  it("renders correctly with default props", () => {
    renderWithProviders(<ComponentName />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("handles user interactions", async () => {
    renderWithProviders(<ComponentName />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("Success message")).toBeInTheDocument();
    });
  });
});
```

#### Hook Testing Pattern

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { useCustomHook } from "./useCustomHook";

describe("useCustomHook", () => {
  it("provides expected data structure", async () => {
    const { result } = renderHook(() => useCustomHook());

    expect(result.current).toHaveProperty("data");
    expect(result.current).toHaveProperty("loading");
    expect(result.current).toHaveProperty("error");
  });

  it("updates when dependencies change", async () => {
    const { result, rerender } = renderHook((props) => useCustomHook(props), {
      initialProps: { id: 1 },
    });

    rerender({ id: 2 });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
  });
});
```

### 2. Library Testing

#### Utility Function Testing

```typescript
import { describe, it, expect } from "vitest";
import { utilityFunction } from "./utilityFunction";

describe("utilityFunction", () => {
  it("handles valid input correctly", () => {
    const result = utilityFunction({
      input: "valid",
      options: { strict: true },
    });

    expect(result).toEqual({
      success: true,
      data: "processed",
    });
  });

  it("handles invalid input gracefully", () => {
    const result = utilityFunction({
      input: "invalid",
      options: { strict: true },
    });

    expect(result).toEqual({
      success: false,
      error: "Invalid input",
    });
  });
});
```

#### Class Testing

```typescript
import { describe, it, expect, vi } from "vitest";
import { ServiceClass } from "./ServiceClass";

describe("ServiceClass", () => {
  it("processes data correctly", () => {
    const instance = new ServiceClass();
    const result = instance.processData("test input");

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
  });

  it("handles external dependencies", () => {
    const mockExternal = vi.fn();
    const instance = new ServiceClass(mockExternal);

    instance.processData("test");

    expect(mockExternal).toHaveBeenCalledWith("test");
  });
});
```

## Writing Effective Integration Tests

### 1. Using Shared Test Utilities

#### Integration Test Pattern

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  IntegrationTestEnvironment,
  TestUserManager,
  generateMockGitHubData,
} from "../../shared/test-credentials";

describe("GitHub Integration", () => {
  let testEnv: IntegrationTestEnvironment;

  beforeAll(async () => {
    testEnv = await IntegrationTestEnvironment.setup();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("fetches issues successfully", async () => {
    const session = await testEnv.createTestSession("github");
    const userManager = TestUserManager.getInstance();
    const user = userManager.createTestUser(session);

    // Use mock data generators
    const mockData = generateMockGitHubData(5);

    expect(mockData).toHaveLength(5);
    expect(mockData[0]).toHaveProperty("title");
    expect(mockData[0]).toHaveProperty("state");
  });
});
```

### 2. API Integration Testing

#### API Endpoint Testing Pattern

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GET, POST } from "../../../../app/api/tools/endpoint/route";
import { createRequest, createResponse } from "node-mocks-http";

// Mock the tools registry
vi.mock("../../../../tools", () => ({
  getToolRegistry: vi.fn(() => ({
    getEnabledTools: () => ["github", "gitlab"],
    getTool: vi.fn((name) => ({
      name,
      enabled: true,
      config: {},
    })),
  })),
}));

describe("API Endpoint Tests", () => {
  it("returns enabled tools", async () => {
    const request = createRequest({
      method: "GET",
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    // Add more specific assertions
  });
});
```

## E2E Testing Best Practices

### 1. Critical User Path Testing

```typescript
import { test, expect } from "@playwright/test";

test.describe("User Authentication Flow", () => {
  test("complete OAuth flow", async ({ page }) => {
    await page.goto("/");

    // Click setup wizard
    await page.click('[data-testid="setup-wizard"]');

    // Select GitHub
    await page.click('[data-provider="github"]');

    // Should redirect to GitHub OAuth
    await page.waitForURL("**/github.com/**");

    // Simulate OAuth callback
    await page.goto("/api/auth/callback?code=test-code&state=test-state");

    // Verify dashboard loads
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
  });
});
```

## Performance Testing Guidelines

### 1. Load Testing Pattern

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { IntegrationTestEnvironment } from "../../shared/test-credentials";

describe("Performance Tests", () => {
  let testEnv: IntegrationTestEnvironment;

  beforeAll(async () => {
    testEnv = await IntegrationTestEnvironment.setup();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("handles concurrent user load", async () => {
    const startTime = performance.now();

    const sessions = await Promise.all(
      Array.from({ length: 20 }, () => testEnv.createTestSession("github")),
    );

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    expect(sessions).toHaveLength(20);
    expect(totalTime).toBeLessThan(2000); // 2 second threshold
  });
});
```

## Test Data Management

### 1. Mock Data Generation

```typescript
// Use shared mock data generators
import {
  generateMockGitHubData,
  generateMockGitLabData,
  generateMockJiraData,
} from "../../shared/test-credentials";

// Generate tool-specific data
const githubIssues = generateMockGitHubData(10);
const gitlabIssues = generateMockGitLabData(10);
const jiraIssues = generateMockJiraData(10);
```

### 2. Test Credentials

```typescript
// Always use shared test credentials
import {
  TEST_CREDENTIALS,
  MOCK_TOOL_CONFIGS,
} from "../../shared/test-credentials";

// Access safe test data
const githubConfig = TEST_CREDENTIALS.github;
const mockConfig = MOCK_TOOL_CONFIGS.github;
```

## Mock and Stub Strategies

### 1. External Service Mocking

```typescript
// Mock external APIs
vi.mock("../../../lib/api-client", () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue({ data: mockData }),
    post: vi.fn().mockResolvedValue({ success: true }),
  })),
}));
```

### 2. Database Mocking

```typescript
// Mock database operations
vi.mock("../../../lib/database", () => ({
  database: {
    query: vi.fn().mockResolvedValue([{ id: 1, name: "test" }]),
    insert: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({ affectedRows: 1 }),
  },
}));
```

## Test Cleanup and Isolation

### 1. Proper Test Cleanup

```typescript
describe("Test Suite", () => {
  let testEnv: IntegrationTestEnvironment;

  beforeAll(async () => {
    testEnv = await IntegrationTestEnvironment.setup();
  });

  afterAll(async () => {
    // Always cleanup to prevent test interference
    await testEnv.cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    // Reset state before each test
    vi.clearAllMocks();
  });
});
```

### 2. Test Isolation Principles

- Each test should be independent
- No shared state between tests
- Clean up after each test
- Use descriptive test names

## Debugging Tests

### 1. Console Output in Tests

```typescript
it("debug test execution", () => {
  console.log("Test is running");
  console.log("Current state:", someState);

  const result = functionUnderTest();

  // Use console.warn for important information
  console.warn("Result:", result);
});
```

### 2. Test Debugging Tools

```typescript
// Add debugging utilities
const debug = {
  log: (message: string, data?: unknown) => {
    console.log(`[DEBUG] ${message}`, data);
  },
  error: (message: string, error?: Error) => {
    console.error(`[ERROR] ${message}`, error);
  },
};
```

## Test Coverage Guidelines

### 1. Coverage Targets

- **Unit Tests**: 80%+ code coverage
- **Integration Tests**: 60%+ integration coverage
- **E2E Tests**: 100% critical path coverage

### 2. Coverage Analysis

```bash
# Run tests with coverage
npm run test:coverage

# Generate coverage report
npm run test:coverage:report
```

## Continuous Integration

### 1. Test Execution Strategy

```bash
# Fast feedback loop
npm run test:unit          # Quick unit tests
npm run test:unit -- --watch # Watch mode for development

# Pre-commit checks
npm run test:lint
npm run test:type-check
npm run test:unit

# Full test suite for CI
npm run test:full
```

### 2. Test Environment Setup

- Use test databases
- Mock all external dependencies
- Ensure tests run in isolation
- Validate test data cleanup

## Common Pitfalls and Solutions

### 1. Over-Mocking

**Problem**: Mocking too much implementation detail
**Solution**: Mock at boundaries, not internally

### 2. Brittle Tests

**Problem**: Tests break with minor implementation changes
**Solution**: Test behavior, not implementation

### 3. Slow Tests

**Problem**: Tests take too long to run
**Solution**: Minimize I/O, use mocks effectively

### 4. Flaky Tests

**Problem**: Tests sometimes pass, sometimes fail
**Solution**: Ensure test isolation and proper cleanup

## Migration to New Test Structure

### 1. Import Path Updates

```typescript
// Old import paths
import { someFunction } from "../../../lib/utils";

// New import paths
import { someFunction } from "../../../../lib/utils";
```

### 2. Using Shared Utilities

```typescript
// Replace ad-hoc mocks
// OLD: Custom mock implementations

// NEW: Use shared test utilities
import {
  TestUserManager,
  IntegrationTestEnvironment,
  generateMockGitHubData,
} from "../../shared/test-credentials";
```

## Summary

Following these best practices will ensure:

- **Fast Feedback**: Quick test execution for rapid development
- **Reliable Tests**: Consistent, non-flaky test results
- **Maintainable Code**: Easy to understand and update tests
- **Good Coverage**: Appropriate test coverage for all code paths
- **Developer Experience**: Pleasant testing experience for the team

Remember: Tests are code too. Apply the same quality standards, refactoring practices, and design principles to your test code as you do to your production code.
