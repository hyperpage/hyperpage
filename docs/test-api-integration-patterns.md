# API Integration Patterns for Testing

This document outlines the standardized API integration patterns and best practices for testing the Hyperpage platform's external API interactions.

## Overview

The Hyperpage platform integrates with multiple external APIs (GitHub, GitLab, Jira) requiring consistent testing patterns across all providers. This guide establishes standardized approaches for API testing, authentication, error handling, and data validation.

## Core API Integration Patterns

### 1. Standard Request Pattern

All API integrations follow a consistent request/response pattern:

```typescript
interface APIRequest {
  method: "GET" | "POST" | "PUT" | "DELETE";
  endpoint: string;
  headers: Record<string, string>;
  params?: Record<string, any>;
  body?: any;
}

interface APIResponse<T = any> {
  status: number;
  data: T;
  error?: string;
  rateLimit?: {
    remaining: number;
    reset: number;
    limit: number;
  };
}

// Standard API client pattern
class APIClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    this.baseURL = baseURL;
    this.defaultHeaders = defaultHeaders;
  }

  async request<T>(config: APIRequest): Promise<APIResponse<T>> {
    const url = new URL(`${this.baseURL}${config.endpoint}`);

    // Add query parameters
    if (config.params) {
      Object.entries(config.params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      method: config.method,
      headers: {
        ...this.defaultHeaders,
        ...config.headers,
      },
      body: config.body ? JSON.stringify(config.body) : undefined,
    });

    const data = await response.json();

    return {
      status: response.status,
      data,
      rateLimit: this.extractRateLimitInfo(response),
    };
  }
}
```

### 2. Authentication Patterns

#### OAuth Token Validation

```typescript
const validateOAuthToken = async (
  token: string,
  provider: string,
): Promise<boolean> => {
  try {
    const response = await fetch(`${provider}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    return response.status === 200;
  } catch (error) {
    return false;
  }
};
```

#### Session-Based Authentication

```typescript
const createAuthenticatedRequest = (sessionId: string, endpoint: string) => {
  return fetch(`${baseUrl}${endpoint}`, {
    headers: {
      Cookie: `session_id=${sessionId}`,
      "Content-Type": "application/json",
    },
  });
};
```

### 3. Error Handling Patterns

#### Standardized Error Response

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  requestId: string;
}

const handleAPIError = (response: Response): ErrorResponse => {
  return {
    error: {
      code: `HTTP_${response.status}`,
      message: getErrorMessage(response.status),
      details: response.status >= 500 ? "Internal server error" : undefined,
    },
    timestamp: new Date().toISOString(),
    requestId: generateRequestId(),
  };
};
```

#### Rate Limit Handling

```typescript
const handleRateLimit = async (response: Response): Promise<boolean> => {
  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000;

    await new Promise((resolve) => setTimeout(resolve, waitTime));
    return true; // Indicates retry needed
  }
  return false;
};
```

## Tool-Specific Patterns

### GitHub API Patterns

#### Rate Limit Aware Requests

```typescript
const githubAPI = {
  async fetchPullRequests(session: any, params: any = {}) {
    // Check rate limit before making request
    const rateLimitResponse = await fetch("https://api.github.com/rate_limit");
    const rateLimitData = await rateLimitResponse.json();

    if (rateLimitData.resources.core.remaining < 10) {
      throw new Error("GitHub API rate limit too low");
    }

    return createAuthenticatedRequest(
      session.id,
      "/api/tools/github/pull-requests",
    );
  },

  // Handle GitHub-specific pagination
  async fetchWithPagination(endpoint: string, session: any, page: number = 1) {
    const response = await createAuthenticatedRequest(
      session.id,
      `${endpoint}?page=${page}&per_page=100`,
    );

    const data = await response.json();
    const nextPage = response.headers.get("Link")?.includes('rel="next"');

    return {
      data,
      hasNextPage: nextPage,
    };
  },
};
```

### GitLab API Patterns

#### Progressive Backoff Strategy

```typescript
const gitlabAPI = {
  async fetchWithBackoff(
    endpoint: string,
    session: any,
    maxRetries: number = 3,
  ) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await createAuthenticatedRequest(session.id, endpoint);
      } catch (error) {
        if (attempt === maxRetries) throw error;

        // Progressive backoff: 1s, 2s, 4s
        const waitTime = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  },

  // Handle GitLab's different API versions
  async fetchFromVersion(endpoint: string, version: string = "v4") {
    return `https://gitlab.com/api/${version}${endpoint}`;
  },
};
```

### Jira API Patterns

#### JQL Query Optimization

```typescript
const jiraAPI = {
  async fetchIssues(session: any, jql: string, maxResults: number = 100) {
    // Optimize JQL for performance
    const optimizedJQL = this.optimizeJQL(jql);

    const response = await createAuthenticatedRequest(
      session.id,
      `/api/tools/jira/issues?jql=${encodeURIComponent(optimizedJQL)}&maxResults=${maxResults}`,
    );

    return response;
  },

  optimizeJQL(jql: string): string {
    // Ensure proper ordering for consistent results
    if (!jql.includes("ORDER BY")) {
      jql += " ORDER BY created DESC";
    }

    // Limit complexity for testing
    return jql.length > 500 ? jql.substring(0, 500) : jql;
  },

  // Batch operations for efficiency
  async batchFetch(session: any, issueIds: string[]) {
    const batchSize = 50; // Jira's limit
    const batches = [];

    for (let i = 0; i < issueIds.length; i += batchSize) {
      const batch = issueIds.slice(i, i + batchSize);
      const response = await createAuthenticatedRequest(
        session.id,
        `/api/tools/jira/issues/batch?ids=${batch.join(",")}`,
      );
      batches.push(await response.json());
    }

    return batches.flat();
  },
};
```

## Cross-Tool Aggregation Patterns

### Unified Response Formatting

```typescript
const createUnifiedResponse = (
  providerResponses: ProviderResponse[],
): UnifiedResponse => {
  const unifiedItems = providerResponses.flatMap((response) =>
    response.data.map((item) =>
      transformToUnifiedFormat(item, response.provider),
    ),
  );

  return {
    data: unifiedItems.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ),
    summary: {
      total: unifiedItems.length,
      providers: providerResponses.length,
      lastUpdated: new Date().toISOString(),
    },
    rateLimits: providerResponses.map((r) => r.rateLimit),
  };
};
```

### Cross-Tool Error Handling

```typescript
const aggregateWithGracefulDegradation = async (
  requests: Promise<any>[],
): Promise<AggregatorResponse> => {
  const results = await Promise.allSettled(requests);

  const successful = results
    .filter(
      (result): result is PromiseFulfilledResult<any> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);

  const failed = results
    .filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    )
    .map((result) => ({
      error: result.reason.message,
      provider: result.reason.provider,
    }));

  return {
    data: successful.flatMap((r) => r.data),
    errors: failed,
    successRate: successful.length / results.length,
    partialSuccess: failed.length > 0 && successful.length > 0,
  };
};
```

## Testing Patterns

### Mock API Responses

```typescript
const mockAPIResponses = {
  github: {
    pullRequests: {
      status: 200,
      data: [
        {
          id: 123,
          number: 42,
          title: "Feature: Add authentication",
          state: "open",
          created_at: "2023-01-15T10:30:00Z",
          source: "github",
        },
      ],
    },
  },

  gitlab: {
    mergeRequests: {
      status: 200,
      data: [
        {
          id: 456,
          iid: 42,
          title: "Feature: Add authentication",
          state: "opened",
          created_at: "2023-01-15T10:30:00Z",
          source: "gitlab",
        },
      ],
    },
  },

  jira: {
    issues: {
      status: 200,
      data: [
        {
          id: "789",
          key: "PROJ-42",
          fields: {
            summary: "Feature: Add authentication",
            status: { name: "Open" },
            created: "2023-01-15T10:30:00.000Z",
          },
          source: "jira",
        },
      ],
    },
  },
};
```

### Integration Test Setup

```typescript
const setupIntegrationTests = async () => {
  const testEnv = await IntegrationTestEnvironment.setup();

  // Create sessions for each provider
  const sessions = {
    github: await testEnv.createTestSession("github"),
    gitlab: await testEnv.createTestSession("gitlab"),
    jira: await testEnv.createTestSession("jira"),
  };

  return {
    testEnv,
    sessions,
    cleanup: async () => {
      await testEnv.cleanup();
    },
  };
};
```

### API Testing Utilities

```typescript
class APITestUtils {
  static async testEndpoint(
    endpoint: string,
    session: any,
    expectedStatus: number = 200,
  ) {
    const response = await createAuthenticatedRequest(session.id, endpoint);
    expect(response.status).toBe(expectedStatus);

    if (expectedStatus === 200) {
      const data = await response.json();
      expect(data).toHaveProperty("data");
      return data;
    }

    return null;
  }

  static validateUnifiedFormat(item: any) {
    expect(item).toHaveProperty("id");
    expect(item).toHaveProperty("title");
    expect(item).toHaveProperty("status");
    expect(item).toHaveProperty("created_at");
    expect(item).toHaveProperty("source");
    expect(["github", "gitlab", "jira"]).toContain(item.source);
  }

  static async testRateLimitHandling(apiCall: () => Promise<any>) {
    // Simulate rate limit scenario
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 429,
      headers: new Headers({ "Retry-After": "60" }),
    } as Response);

    const result = await apiCall();
    expect(result).toHaveProperty("rateLimit");
  }
}
```

## Performance Testing Patterns

### Concurrent Request Testing

```typescript
const testConcurrentRequests = async (
  endpoint: string,
  session: any,
  concurrentCount: number = 10,
) => {
  const requests = Array.from({ length: concurrentCount }, () =>
    createAuthenticatedRequest(session.id, endpoint),
  );

  const responses = await Promise.all(requests);

  // All requests should succeed or gracefully handle rate limits
  const successCount = responses.filter((r) => r.status === 200).length;
  const rateLimitCount = responses.filter((r) => r.status === 429).length;

  expect(successCount + rateLimitCount).toBe(concurrentCount);
};
```

### Load Testing Patterns

```typescript
const createLoadTest = (endpoint: string, session: any) => {
  return async (iteration: number) => {
    const startTime = Date.now();

    try {
      const response = await createAuthenticatedRequest(session.id, endpoint);
      const duration = Date.now() - startTime;

      return {
        iteration,
        status: response.status,
        duration,
        success: response.status === 200,
      };
    } catch (error) {
      return {
        iteration,
        status: 0,
        duration: Date.now() - startTime,
        success: false,
        error: error.message,
      };
    }
  };
};
```

This comprehensive API integration pattern guide ensures consistent, reliable, and maintainable testing across all external API integrations in the Hyperpage platform.
