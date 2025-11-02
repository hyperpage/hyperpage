# Test Troubleshooting Guide

This comprehensive guide provides solutions for common integration test failures and debugging procedures for the Hyperpage platform testing suite.

## Quick Reference

### Most Common Issues
| Error | Quick Fix |
|-------|-----------|
| `ECONNREFUSED ::1:3000` | Start the application server: `npm run dev` |
| `Unsupported provider` | Use only 'github', 'gitlab', or 'jira' as providers |
| TypeScript compilation errors | Check type definitions in `__tests__/lib/test-credentials.ts` |
| Memory leaks | Ensure proper session cleanup in `afterEach`/`afterAll` |

## Environment Setup Issues

### Server Connection Problems

#### Issue: Connection Refused Errors
**Symptom:**
```
Error: connect ECONNREFUSED ::1:3000
    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1234:16)
```

**Diagnosis:**
1. Check if the application server is running
2. Verify the correct port (default: 3000)
3. Confirm environment variable settings

**Solutions:**
```bash
# Start the development server
npm run dev

# Or start with specific environment
HYPERPAGE_TEST_BASE_URL=http://localhost:3000 npm run dev

# Verify server is accessible
curl http://localhost:3000/api/health
```

#### Issue: Environment Variables Not Loading
**Symptom:**
```
TypeError: Cannot read properties of undefined (reading 'ENABLE_GITHUB')
```

**Diagnosis:**
```bash
# Check if .env.local.test exists
ls -la .env.local.test

# Verify environment variables are set
cat .env.local.test | grep ENABLE
```

**Solutions:**
```bash
# Copy from sample if missing
cp .env.local.sample .env.local.test

# Ensure test environment loads correctly
echo "HYPERPAGE_TEST_BASE_URL=http://localhost:3000" > .env.local.test
```

### Database Connection Issues

#### Issue: Database Connection Failures
**Symptom:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Diagnosis:**
```bash
# Check if database is running
ps aux | grep postgres

# Test database connection
psql -h localhost -U postgres -d hyperpage_test
```

**Solutions:**
```bash
# Start PostgreSQL
brew services start postgresql

# Or use Docker
docker run --name postgres-test -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:13

# Reset test database
npm run db:reset:test
```

## Authentication and OAuth Issues

### OAuth Configuration Problems

#### Issue: Invalid OAuth Credentials
**Symptom:**
```
Error: OAuth token validation failed
    at OAuthTokenStore.validateToken
```

**Diagnosis:**
1. Check OAuth app configuration
2. Verify redirect URIs match exactly
3. Confirm scopes are properly configured

**Solutions:**
```bash
# Validate OAuth configuration
# GitHub: Settings > Developer settings > OAuth Apps
# GitLab: Admin Area > Applications
# Jira: Apps > Manage apps > OAuth 2.0 (3LO)

# Test with mock credentials for development
GITHUB_CLIENT_ID=mock_client_id npm run test:integration
```

#### Issue: Session Creation Failures
**Symptom:**
```
TypeError: Cannot create session: Invalid provider
```

**Diagnosis:**
```typescript
// Check provider names in test
const validProviders = ['github', 'gitlab', 'jira'];
const invalidProvider = 'cross-tool'; // This will fail
```

**Solutions:**
```typescript
// Use only valid provider names
const session = await testEnv.createTestSession('github'); // ✅
const session = await testEnv.createTestSession('gitlab'); // ✅
const session = await testEnv.createTestSession('jira');   // ✅

// Avoid invalid provider names
const session = await testEnv.createTestSession('invalid'); // ❌
```

### Token and Session Management

#### Issue: Token Expiration During Tests
**Symptom:**
```
Error: 401 Unauthorized - Token has expired
```

**Diagnosis:**
```typescript
// Check token expiration logic
const isExpired = Date.now() > token.expires_at;
```

**Solutions:**
```typescript
// Extend token expiration for testing
const extendedSession = await testEnv.createTestSession('github', {
  expiresIn: 3600 * 24 // 24 hours
});

// Or mock token refresh
vi.mocked(oauthTokenStore).refreshToken.mockResolvedValue(newToken);
```

## API Integration Issues

### GitHub API Problems

#### Issue: Rate Limiting Errors
**Symptom:**
```
Error: API rate limit exceeded for GitHub API
```

**Diagnosis:**
```typescript
// Check rate limit headers
const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
```

**Solutions:**
```typescript
// Implement rate limit handling
const handleRateLimit = async (response: Response) => {
  if (response.status === 403) {
    const resetTime = response.headers.get('X-RateLimit-Reset');
    const waitTime = resetTime ? (resetTime - Date.now()) : 60000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
};
```

#### Issue: Invalid Repository Access
**Symptom:**
```
Error: 404 Not Found - Repository not found
```

**Diagnosis:**
```typescript
// Verify repository access
const repoExists = await githubAPI.getRepository('owner', 'repo');
```

**Solutions:**
```typescript
// Use test repositories with proper access
const testRepo = 'hyperpage-test/repo';

// Or mock repository responses
vi.mocked(githubAPI.getRepository).mockResolvedValue({
  name: 'test-repo',
  full_name: 'test-user/test-repo'
});
```

### GitLab API Problems

#### Issue: Authentication Failures
**Symptom:**
```
Error: 401 Unauthorized - Invalid GitLab token
```

**Diagnosis:**
```typescript
// Check token validity
const isTokenValid = await gitlabAPI.validateToken(token);
```

**Solutions:**
```typescript
// Use personal access token with proper scopes
const gitlabToken = 'glpat-test-token-with-scopes';

// Or use application tokens for testing
const appToken = await gitlabAPI.createApplicationToken('test-app');
```

#### Issue: Project Access Denied
**Symptom:**
```
Error: 403 Forbidden - Project access denied
```

**Solutions:**
```typescript
// Ensure project is accessible
const project = await gitlabAPI.getProject(projectId, {
  membership: true // Only return projects where user is a member
});

// Or use public projects for testing
const publicProjectId = 1; // Usually a test project
```

### Jira API Problems

#### Issue: JQL Query Errors
**Symptom:**
```
Error: Invalid JQL query syntax
```

**Diagnosis:**
```typescript
// Validate JQL syntax
const isValidJQL = await jiraAPI.validateJQL('project = TEST AND status = Open');
```

**Solutions:**
```typescript
// Use correct JQL syntax
const validJQL = 'project = TEST AND status = Open ORDER BY created DESC';

// Test with simpler queries first
const simpleJQL = 'project = TEST';
```

#### Issue: Field Access Errors
**Symptom:**
```
Error: Field 'customfield_12345' does not exist
```

**Solutions:**
```typescript
// Use standard fields for testing
const standardFields = ['summary', 'description', 'status', 'assignee'];

// Or get field definitions first
const fields = await jiraAPI.getFields();
const validField = fields.find(f => f.name === 'Custom Field Name');
```

## Performance and Resource Issues

### Memory and Resource Leaks

#### Issue: Growing Memory Usage
**Symptom:**
```
Memory usage: 512MB -> 1GB -> 2GB during test execution
```

**Diagnosis:**
```bash
# Monitor memory usage
ps aux | grep node | awk '{print $4}'

# Use Node.js memory analysis
node --inspect --trace-warnings __tests__/integration/tools/github.spec.ts
```

**Solutions:**
```typescript
// Proper cleanup in tests
afterEach(async () => {
  // Clean up sessions
  await Promise.all(sessions.map(session => session.cleanup()));
  
  // Clear mocks
  vi.clearAllMocks();
  
  // Reset global state
  globalState.reset();
});

// Use weak references for large objects
const weakMap = new WeakMap();
// Instead of: const largeObject = createLargeObject();
```

#### Issue: Slow Test Execution
**Symptom:**
```
Test execution time > 30 seconds
```

**Diagnosis:**
```bash
# Profile test execution
npm run test:integration -- --reporter=verbose --logHeapUsage
```

**Solutions:**
```typescript
// Optimize test setup
beforeAll(async () => {
  // Cache expensive setup
  if (!globalThis.cachedTestEnv) {
    globalThis.cachedTestEnv = await IntegrationTestEnvironment.setup();
  }
  testEnv = globalThis.cachedTestEnv;
});

// Use parallel execution
export default defineConfig({
  test: {
    threads: true,
    maxWorkers: 4
  }
});
```

### Network and Timeout Issues

#### Issue: Network Timeouts
**Symptom:**
```
Error: Request timeout of 5000ms exceeded
```

**Solutions:**
```typescript
// Increase timeout for slow operations
const response = await fetch(url, {
  signal: AbortSignal.timeout(30000) // 30 seconds
});

// Or handle timeouts gracefully
const withTimeout = (promise: Promise, ms: number) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), ms)
    )
  ]);
};
```

## Data and Mock Issues

### Mock Data Problems

#### Issue: Inconsistent Mock Data
**Symptom:**
```
Expected: { id: 123, title: "Test" }
Actual: { id: 456, title: "Different" }
```

**Solutions:**
```typescript
// Use consistent mock data
const mockData = {
  github: {
    pullRequest: {
      id: 123,
      number: 42,
      title: "Test Pull Request"
    }
  },
  gitlab: {
    mergeRequest: {
      id: 456,
      iid: 42,
      title: "Test Merge Request"
    }
  }
};

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  mockData.reset();
});
```

#### Issue: Real API vs Mock Mismatch
**Symptom:**
```
Mock function was not called with expected arguments
```

**Solutions:**
```typescript
// Ensure mocks match real API signatures
const realAPIResponse = {
  id: 1,
  number: 1,
  title: "Real PR Title",
  state: "open",
  created_at: "2023-01-01T00:00:00Z"
};

// Update mock to match
vi.mocked(fetch).mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(realAPIResponse)
} as Response);
```

## Debugging Techniques

### Debug Mode Testing

#### Enable Verbose Output
```bash
# Run tests with maximum verbosity
npm run test:integration -- --reporter=verbose --logHeapUsage

# Run specific failing test
npm run test:integration -- --reporter=verbose --grep "GitHub pull requests"
```

#### Test-by-Test Debugging
```typescript
// Use debugger statements
it('should debug this specific scenario', async () => {
  debugger; // Breakpoint will trigger here
  
  const result = await testFunction();
  console.log('Result:', result);
});

// Or use console.log strategically
it('should fetch GitHub pull requests', async () => {
  console.log('Before API call');
  const response = await fetch(url);
  console.log('Response status:', response.status);
  const data = await response.json();
  console.log('Data keys:', Object.keys(data));
});
```

### Network Request Debugging

#### Intercept and Log Requests
```typescript
// Mock fetch to log requests
const originalFetch = global.fetch;
global.fetch = async (url: string, options?: any) => {
  console.log(`[DEBUG] ${options?.method || 'GET'} ${url}`);
  console.log('[DEBUG] Headers:', options?.headers);
  console.log('[DEBUG] Body:', options?.body);
  
  const response = await originalFetch(url, options);
  console.log(`[DEBUG] Response: ${response.status}`);
  return response;
};
```

#### API Response Inspection
```typescript
// Log API responses for analysis
const logAPIResponse = async (response: Response) => {
  const data = await response.clone().json();
  console.log('API Response Structure:', {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    data: data
  });
  return response;
};
```

### Session Debugging

#### Session State Inspection
```typescript
// Log session information
const debugSession = (session: TestSession) => {
  console.log('Session Debug:', {
    id: session.id,
    provider: session.provider,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    hasValidToken:
