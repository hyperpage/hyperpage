# Developer Onboarding Guide for Integration Testing

This guide helps new developers get started with the Hyperpage integration testing suite, covering setup, common patterns, and best practices.

## Prerequisites

### Required Knowledge
- **JavaScript/TypeScript**: Basic proficiency required
- **React**: Understanding of hooks and component patterns
- **Node.js**: Package management and development tools
- **Testing**: Familiarity with testing concepts (Jest, Vitest preferred)
- **APIs**: Understanding of REST API principles

### Development Environment Setup

#### 1. Install Dependencies
```bash
# Clone the repository
git clone https://github.com/hyperpage/hyperpage.git
cd hyperpage

# Install all dependencies
npm install

# Copy environment template
cp .env.local.sample .env.local

# Copy test environment template
cp .env.local.sample .env.local.test
```

#### 2. Environment Configuration
Edit `.env.local.test` for testing:
```bash
# Test environment URL
HYPERPAGE_TEST_BASE_URL=http://localhost:3000

# Enable tools for testing
ENABLE_GITHUB=true
ENABLE_GITLAB=true
ENABLE_JIRA=true

# Mock OAuth credentials for testing
GITHUB_CLIENT_ID=test_github_client
GITLAB_CLIENT_ID=test_gitlab_client
JIRA_CLIENT_ID=test_jira_client
```

#### 3. Database Setup
```bash
# Start development database
npm run db:dev

# Run migrations
npm run db:migrate

# Optional: Start with sample data
npm run db:seed
```

## Testing Infrastructure Overview

### Test Structure
```
__tests__/
├── integration/          # Integration tests
│   ├── oauth/           # OAuth flow testing
│   ├── tools/           # Tool API testing
│   ├── workflows/       # End-to-end testing
│   └── performance/     # Performance testing
├── unit/                # Unit tests
├── e2e/                 # End-to-end UI tests
└── lib/                 # Test utilities
```

### Key Test Classes

#### IntegrationTestEnvironment
- **Purpose**: Provides isolated test environment
- **Usage**: Creates test sessions with mock credentials
- **Location**: `__tests__/lib/test-credentials.ts`

```typescript
// Setup example
const testEnv = await IntegrationTestEnvironment.setup();
const session = await testEnv.createTestSession('github');

// Cleanup example
await testEnv.cleanup();
```

#### OAuthTestCredentials
- **Purpose**: Provides mock OAuth credentials
- **Providers**: GitHub, GitLab, Jira
- **Security**: Isolated to test environment only

```typescript
// Access test credentials
const credentials = OAuthTestCredentials.github;
console.log(credentials.token); // Mock token for testing
```

## First Integration Test

### Step-by-Step Example

#### 1. Create Basic Test Structure
```typescript
// __tests__/integration/tools/my-first-test.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { IntegrationTestEnvironment } from '../../lib/test-credentials';

describe('My First Integration Test', () => {
  let testEnv: IntegrationTestEnvironment;
  let baseUrl: string;

  beforeAll(async () => {
    // Setup test environment
    testEnv = await IntegrationTestEnvironment.setup();
    baseUrl = process.env.HYPERPAGE_TEST_BASE_URL || 'http://localhost:3000';
  });

  afterAll(async () => {
    // Cleanup test environment
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  it('should fetch data from GitHub API', async () => {
    // Create test session
    const session = await testEnv.createTestSession('github');
    
    // Make API request
    const response = await fetch(`${baseUrl}/api/tools/github/pull-requests`, {
      headers: {
        'Cookie': `session_id=${session.id}`
      }
    });

    // Validate response
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('data');
    expect(Array.isArray(data.data)).toBe(true);
  });
});
```

#### 2. Run Your First Test
```bash
# Run specific test
npm run test:integration -- --run --grep "My First Integration Test"

# Run with verbose output
npm run test:integration -- --run --reporter=verbose
```

### Common Patterns

#### Pattern 1: API Request with Authentication
```typescript
const authenticatedRequest = async (endpoint: string, sessionId: string) => {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      'Cookie': `session_id=${sessionId}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
};
```

#### Pattern 2: Mock Data Validation
```typescript
const validatePullRequest = (pr: any) => {
  expect(pr).toHaveProperty('id');
  expect(pr).toHaveProperty('title');
  expect(pr).toHaveProperty('state');
  expect(pr).toHaveProperty('created_at');
  expect(['open', 'closed', 'merged']).toContain(pr.state);
};
```

#### Pattern 3: Error Handling
```typescript
const testErrorHandling = async () => {
  const invalidSessionId = 'invalid-session-id';
  
  const response = await fetch(`${baseUrl}/api/tools/github/pull-requests`, {
    headers: {
      'Cookie': `session_id=${invalidSessionId}`
    }
  });

  expect(response.status).toBe(401);
  
  const errorData = await response.json();
  expect(errorData).toHaveProperty('error');
};
```

## Testing Different Tools

### GitHub Integration Testing

#### Basic GitHub Test
```typescript
describe('GitHub Integration', () => {
  let session: TestSession;

  beforeAll(async () => {
    const testEnv = await IntegrationTestEnvironment.setup();
    session = await testEnv.createTestSession('github');
  });

  it('should fetch GitHub pull requests', async () => {
    const response = await fetch(`${baseUrl}/api/tools/github/pull-requests`, {
      headers: { 'Cookie': `session_id=${session.id}` }
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    
    // Validate unified data format
    if (data.data.length > 0) {
      const pr = data.data[0];
      expect(pr).toHaveProperty('id');
      expect(pr).toHaveProperty('title');
      expect(pr).toHaveProperty('source');
      expect(pr.source).toBe('github');
    }
  });
});
```

#### GitHub-Specific Testing Patterns
```typescript
// Test rate limiting
it('should handle GitHub rate limits', async () => {
  // Simulate rate limit scenario
  vi.mocked(fetch).mockResolvedValueOnce({
    status: 403,
    headers: new Headers({ 'X-RateLimit-Remaining': '0' })
  } as Response);

  const response = await makeAuthenticatedRequest('/api/tools/github/pull-requests', session.id);
  expect(response.rateLimit).toBeDefined();
});

// Test repository filtering
it('should filter pull requests by repository', async () => {
  const response = await fetch(`${baseUrl}/api/tools/github/pull-requests?repo=owner/repo`, {
    headers: { 'Cookie': `session_id=${session.id}` }
  });

  expect(response.status).toBe(200);
  const data = await response.json();
  
  // Verify repository filtering worked
  if (data.data.length > 0) {
    expect(data.data[0].repository).toContain('owner/repo');
  }
});
```

### GitLab Integration Testing

#### Basic GitLab Test
```typescript
describe('GitLab Integration', () => {
  let session: TestSession;

  beforeAll(async () => {
    const testEnv = await IntegrationTestEnvironment.setup();
    session = await testEnv.createTestSession('gitlab');
  });

  it('should fetch GitLab merge requests', async () => {
    const response = await fetch(`${baseUrl}/api/tools/gitlab/merge-requests`, {
      headers: { 'Cookie': `session_id=${session.id}` }
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    
    // Validate GitLab-specific data
    if (data.data.length > 0) {
      const mr = data.data[0];
      expect(mr).toHaveProperty('iid'); // GitLab internal ID
      expect(mr.source).toBe('gitlab');
    }
  });
});
```

### Jira Integration Testing

#### Basic Jira Test
```typescript
describe('Jira Integration', () => {
  let session: TestSession;

  beforeAll(async () => {
    const testEnv = await IntegrationTestEnvironment.setup();
    session = await testEnv.createTestSession('jira');
  });

  it('should fetch Jira issues', async () => {
    const response = await fetch(`${baseUrl}/api/tools/jira/issues`, {
      headers: { 'Cookie': `session_id=${session.id}` }
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    
    // Validate Jira-specific data
    if (data.data.length > 0) {
      const issue = data.data[0];
      expect(issue).toHaveProperty('key'); // Jira issue key (e.g., PROJ-123)
      expect(issue).toHaveProperty('fields');
      expect(issue.source).toBe('jira');
    }
  });
});
```

## Performance Testing Basics

### Performance Test Setup
```typescript
describe('Performance Tests', () => {
  it('should complete API requests within time limit', async () => {
    const startTime = Date.now();
    
    const response = await fetch(`${baseUrl}/api/tools/github/pull-requests`, {
      headers: { 'Cookie': `session_id=${session.id}` }
    });

    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    expect(response.status).toBe(200);
  });

  it('should handle concurrent requests', async () => {
    const requests = Array.from({ length: 10 }, (_, i) => 
      fetch(`${baseUrl}/api/tools/github/pull-requests`, {
        headers: { 'Cookie': `session_id=${session.id}` }
      })
    );

    const responses = await Promise.all(requests);
    
    // All requests should succeed
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });
});
```

## Common Pitfalls and Solutions

### Pitfall 1: Not Cleaning Up Test Sessions
**Problem**: Memory leaks and test interference
**Solution**: Always cleanup in `afterEach` or `afterAll`

```typescript
afterEach(async () => {
  if (testEnv && testEnv.sessions) {
    // Clean up all sessions created during test
    for (const session of testEnv.sessions) {
      await session.cleanup();
    }
  }
});
```

### Pitfall 2: Hardcoded URLs
**Problem**: Tests break when server runs on different port
**Solution**: Use environment variables

```typescript
// Bad
const response = await fetch('http://localhost:3000/api/tools/github/pull-requests');

// Good
const baseUrl = process.env.HYPERPAGE_TEST_BASE_URL || 'http://localhost:3000';
const response = await fetch(`${baseUrl}/api/tools/github/pull-requests`);
```

### Pitfall 3: Ignoring Async Operations
**Problem**: Tests fail due to timing issues
**Solution**: Properly handle async operations

```typescript
// Bad
it('should update data', () => {
  updateData(); // Async operation not awaited
  expect(data).toBe('updated'); // Fails because updateData hasn't completed
});

// Good
it('should update data', async () => {
  await updateData(); // Properly await async operation
  expect(data).toBe('updated');
});
```

### Pitfall 4: Testing Implementation Details
**Problem**: Tests break when implementation changes
**Solution**: Test behavior, not implementation

```typescript
// Bad - Testing implementation
it('should call updateUser function', () => {
  expect(updateUser).toHaveBeenCalledWith(userId, userData);
});

// Good - Testing behavior
it('should update user information', async () => {
  const result = await updateUser(userId, userData);
  expect(result.name).toBe(userData.name);
  expect(result.email).toBe(userData.email);
});
```

## Testing Best Practices

### 1. Test Organization
- **Group related tests** using `describe` blocks
- **Use descriptive test names** that explain the scenario
- **Follow AAA pattern**: Arrange, Act, Assert
- **Keep tests independent** - no shared state

### 2. Data Management
- **Use consistent mock data** across tests
- **Reset mocks between tests** using `beforeEach`
- **Validate data structure** in addition to content
- **Test both happy path and error scenarios**

### 3. Error Handling
- **Test error conditions** thoroughly
- **Validate error messages** are user-friendly
- **Test network failures** and timeouts
- **Ensure graceful degradation**

### 4. Performance Considerations
- **Set appropriate timeouts** for slow operations
- **Test under load** with concurrent requests
- **Monitor memory usage** during test execution
- **Optimize test setup** with caching where appropriate

## Running Tests

### Development Workflow
```bash
# Run tests in watch mode during development
npm run test:integration --watch

# Run specific test file
npm run test:integration -- --run integration/tools/github.spec.ts

# Run tests with coverage
npm run test:integration -- --run --coverage

# Run tests matching pattern
npm run test:integration -- --grep "should fetch.*pull requests"
```

### CI/CD Integration
```bash
# Run all integration tests (for CI)
npm run test:integration -- --run

# Generate test reports
npm run test:integration -- --run --reporter=junit --outputFile=test-results.xml
```

### Debugging Tests
```bash
# Run with verbose output
npm run test:integration -- --reporter=verbose

# Run specific failing test
npm run test:integration -- --reporter=verbose --grep "failing test name"

# Run tests with debugger
node --inspect-brk ./node_modules/.bin/vitest run integration/tools/github.spec.ts
```

## Getting Help

### Documentation Resources
- [Integration Testing Guide](integration-testing-guide.md) - Comprehensive test suite documentation
- [Test Maintenance Procedures](test-maintenance-procedures.md) - Long-term test maintenance
- [Test Troubleshooting Guide](test-troubleshooting-guide.md) - Common issues and solutions

### Debugging Tools
```typescript
// Add console logging for debugging
it('should debug API response', async () => {
  const response = await fetch(`${baseUrl}/api/tools/github/pull-requests`);
  const data = await response.json();
  
  console.log('Response status:', response.status);
  console.log('Data structure:', JSON.stringify(data, null, 2));
  console.log('Data keys:', Object.keys(data));
  
  expect(response.status).toBe(200);
});
```

### Common Commands Reference
```bash
# Setup development environment
npm run dev

# Run all integration tests
npm run test:integration

# Run specific test suite
npm run test:integration:oauth
npm run test:integration:tools
npm run test:integration:workflows

# Debug specific test
npm run test:integration -- --grep "test name"

# Check test coverage
npm run test:integration -- --coverage
```

## Next Steps

After completing this onboarding guide:

1. **Explore existing tests** in `__tests__/integration/` for reference patterns
2. **Contribute new tests** for features you're working on
3. **Improve test coverage** by adding tests for edge cases
4. **Optimize test performance** by identifying slow tests
5. **Maintain test quality** by following the maintenance procedures

Remember: Good tests are an investment in code quality and developer productivity. Take time to write comprehensive, maintainable tests that provide confidence in the codebase.
