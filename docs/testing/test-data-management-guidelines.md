# Test Data Management Guidelines

This document outlines the comprehensive approach to managing test data for the Hyperpage integration testing suite, ensuring consistency, reliability, and maintainability across all test scenarios.

## Overview

Effective test data management is crucial for reliable, maintainable, and predictable integration tests. This guide covers the strategies, patterns, and best practices for managing test data across GitHub, GitLab, and Jira integrations.

## Test Data Architecture

### Data Categories

#### 1. Mock Credentials (`__tests__/lib/test-credentials.ts`)

- **Purpose**: Secure test OAuth credentials
- **Scope**: GitHub, GitLab, Jira authentication data
- **Security**: Isolated to test environment only

#### 2. API Response Mock Data

- **Purpose**: Realistic API responses for testing
- **Structure**: Consistent across all tools
- **Updates**: Version controlled with API changes

#### 3. Session Test Data

- **Purpose**: User sessions and state management
- **Lifecycle**: Creation, validation, cleanup
- **Isolation**: Each test gets fresh session data

#### 4. Error Scenario Data

- **Purpose**: Testing failure modes and edge cases
- **Coverage**: Network errors, auth failures, API limits
- **Validation**: Error message consistency

## Mock Credentials Management

### Credential Structure

```typescript
// __tests__/lib/test-credentials.ts
export const OAuthTestCredentials = {
  github: {
    clientId: "test_github_client_id",
    clientSecret: "test_github_client_secret",
    accessToken: "test_github_access_token_123456789",
    refreshToken: "test_github_refresh_token_987654321",
    username: "test-github-user",
    email: "test@github.com",
    scope: "repo,user:email",
  },

  gitlab: {
    clientId: "test_gitlab_client_id",
    clientSecret: "test_gitlab_client_secret",
    accessToken: "test_gitlab_access_token_abcdef123456",
    refreshToken: "test_gitlab_refresh_token_654321fedcba",
    username: "test-gitlab-user",
    email: "test@gitlab.com",
    scope: "api,read_user",
  },

  jira: {
    clientId: "test_jira_client_id",
    clientSecret: "test_jira_client_secret",
    accessToken: "test_jira_access_token_112233445566",
    refreshToken: "test_jira_refresh_token_665544332211",
    username: "test-jira-user",
    email: "test@atlassian.com",
    cloudId: "test-cloud-id-123",
    scope: "read:jira-user read:jira-work",
  },
};
```

### Credential Usage Patterns

```typescript
// Secure credential access in tests
import {
  OAuthTestCredentials,
  IntegrationTestEnvironment,
} from "../../lib/test-credentials";

describe("GitHub OAuth Test", () => {
  it("should create session with mock credentials", async () => {
    const testEnv = await IntegrationTestEnvironment.setup();
    const session = await testEnv.createTestSession("github");

    // Verify credentials are properly configured
    expect(session.credentials).toMatchObject({
      clientId: OAuthTestCredentials.github.clientId,
      username: OAuthTestCredentials.github.username,
      hasValidToken: true,
    });
  });
});
```

### Credential Security

#### Environment Isolation

```typescript
// Ensure test credentials never leak to production
const ensureTestEnvironment = () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Test credentials should only be used in test environment");
  }
};
```

#### Access Control

```typescript
// Limit credential exposure to test code only
class SecureTestCredentials {
  static get(environment: string) {
    if (environment !== "test") {
      throw new Error("Test credentials are not available in production");
    }
    return OAuthTestCredentials;
  }
}
```

## API Response Mock Data

### Unified Data Format Standards

#### GitHub Pull Request Format

```typescript
const mockGitHubPR = {
  id: 123456789,
  number: 42,
  title: "Feature: Add new authentication method",
  state: "open", // "open", "closed", "merged"
  created_at: "2023-01-15T10:30:00Z",
  updated_at: "2023-01-16T14:22:00Z",
  closed_at: null,
  merged_at: null,
  draft: false,
  user: {
    login: "octocat",
    id: 1,
    avatar_url: "https://github.com/images/error/octocat_happy.gif",
  },
  head: {
    ref: "feature/new-auth",
    sha: "abc123def456",
  },
  base: {
    ref: "main",
    sha: "def456abc123",
  },
  repository: {
    name: "hyperpage",
    full_name: "user/hyperpage",
    owner: {
      login: "user",
      id: 1,
    },
  },
  source: "github",
};
```

#### GitLab Merge Request Format

```typescript
const mockGitLabMR = {
  id: 987654321,
  iid: 42,
  title: "Feature: Add new authentication method",
  state: "opened", // "opened", "closed", "merged", "locked"
  created_at: "2023-01-15T10:30:00Z",
  updated_at: "2023-01-16T14:22:00Z",
  closed_at: null,
  merged_at: null,
  draft: false,
  author: {
    username: "testuser",
    id: 1,
    name: "Test User",
    avatar_url: "https://gitlab.com/uploads/-/system/user/avatar/1/avatar.png",
  },
  source_branch: "feature/new-auth",
  target_branch: "main",
  project_id: 123,
  project: {
    name: "hyperpage",
    path_with_namespace: "user/hyperpage",
  },
  source: "gitlab",
};
```

#### Jira Issue Format

```typescript
const mockJiraIssue = {
  id: "10001",
  key: "HYP-42",
  summary: "Feature: Add new authentication method",
  description:
    "As a user, I want to authenticate using OAuth so that I can securely access the application.",
  status: {
    name: "Open",
    id: "10001",
    category: "new",
  },
  issuetype: {
    name: "Story",
    id: "10001",
    iconUrl: "https://example.atlassian.net/rest/api/2/type/10001/icon",
  },
  priority: {
    name: "Medium",
    id: "3",
  },
  created: "2023-01-15T10:30:00.000Z",
  updated: "2023-01-16T14:22:00.000Z",
  assignee: {
    displayName: "Test User",
    emailAddress: "test@company.com",
  },
  reporter: {
    displayName: "Test Reporter",
    emailAddress: "reporter@company.com",
  },
  project: {
    key: "HYP",
    name: "Hyperpage",
  },
  source: "jira",
};
```

### Data Transformation Standards

#### Unified Field Mapping

```typescript
const dataTransformers = {
  github: {
    prToUnified: (pr: any) => ({
      id: pr.id.toString(),
```
