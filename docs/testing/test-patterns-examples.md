# Test Patterns and Examples

This document provides practical examples of test patterns used throughout the Hyperpage project. These examples demonstrate best practices for different types of tests and serve as templates for writing new tests.

## Overview

Test patterns in Hyperpage follow established conventions:

- **Unit Tests**: Fast, isolated tests using mocks and test doubles
- **Integration Tests**: Tests that verify component interactions
- **Component Tests**: React component testing with user interactions
- **API Tests**: HTTP endpoint testing with realistic request/response cycles
- **Performance Tests**: Load and performance verification tests

## Unit Test Patterns

### 1. Library Function Tests

#### Pattern: Pure Function Testing

```typescript
// __tests__/unit/lib/date-utils.test.ts
import { formatDate, parseDate, isValidDate } from "@/lib/date-utils";

describe("dateUtils", () => {
  describe("formatDate", () => {
    it("should format date in ISO format", () => {
      // Arrange
      const date = new Date("2023-12-25T10:30:00Z");
      const expected = "2023-12-25";

      // Act
      const result = formatDate(date);

      // Assert
      expect(result).toBe(expected);
    });

    it("should handle invalid dates", () => {
      // Arrange
      const invalidDate = new Date("invalid");

      // Act & Assert
      expect(() => formatDate(invalidDate)).toThrow("Invalid date");
    });

    it("should format dates with custom format", () => {
      // Arrange
      const date = new Date("2023-12-25T10:30:00Z");
      const format = "DD/MM/YYYY";
      const expected = "25/12/2023";

      // Act
      const result = formatDate(date, format);

      // Assert
      expect(result).toBe(expected);
    });
  });

  describe("isValidDate", () => {
    it("should return true for valid dates", () => {
      // Arrange
      const validDates = [
        new Date("2023-12-25"),
        new Date(),
        new Date("2024-01-01T00:00:00Z"),
      ];

      // Act & Assert
      validDates.forEach((date) => {
        expect(isValidDate(date)).toBe(true);
      });
    });

    it("should return false for invalid dates", () => {
      // Arrange
      const invalidDates = [
        new Date("invalid"),
        new Date(""),
        new Date("2023-13-25"), // Invalid month
        null,
        undefined,
      ];

      // Act & Assert
      invalidDates.forEach((date) => {
        expect(isValidDate(date as any)).toBe(false);
      });
    });
  });
});
```

#### Pattern: Class/Service Testing with Mocks

```typescript
// __tests__/unit/lib/user-service.test.ts
import { vi } from "vitest";
import { UserService } from "@/lib/user-service";
import { UserRepository } from "@/lib/repositories/user-repository";
import { EmailService } from "@/lib/email-service";

describe("UserService", () => {
  let userService: UserService;
  let mockUserRepository: Partial<UserRepository>;
  let mockEmailService: Partial<EmailService>;

  beforeEach(() => {
    // Create fresh mocks for each test
    mockUserRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockEmailService = {
      sendWelcomeEmail: vi.fn(),
      sendPasswordReset: vi.fn(),
    };

    userService = new UserService(
      mockUserRepository as UserRepository,
      mockEmailService as EmailService,
    );
  });

  describe("createUser", () => {
    it("should create user and send welcome email", async () => {
      // Arrange
      const userData = {
        email: "user@example.com",
        name: "John Doe",
        password: "securepassword",
      };

      const expectedUser = {
        id: "user-123",
        email: userData.email,
        name: userData.name,
        createdAt: expect.any(Date),
      };

      mockUserRepository.create!.mockResolvedValue(expectedUser);
      mockEmailService.sendWelcomeEmail!.mockResolvedValue(undefined);

      // Act
      const result = await userService.createUser(userData);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        ...userData,
        password: expect.any(String), // Hashed password
      });
      expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith(
        userData.email,
        userData.name,
      );
    });

    it("should throw error for duplicate email", async () => {
      // Arrange
      const userData = {
        email: "existing@example.com",
        name: "John Doe",
        password: "securepassword",
      };

      mockUserRepository.create!.mockRejectedValue(
        new Error("User already exists"),
      );

      // Act & Assert
      await expect(userService.createUser(userData)).rejects.toThrow(
        "User already exists",
      );
    });
  });

  describe("getUserById", () => {
    it("should return user when found", async () => {
      // Arrange
      const userId = "user-123";
      const expectedUser = {
        id: userId,
        email: "user@example.com",
        name: "John Doe",
      };

      mockUserRepository.findById!.mockResolvedValue(expectedUser);

      // Act
      const result = await userService.getUserById(userId);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
    });

    it("should return null when user not found", async () => {
      // Arrange
      const userId = "non-existent";
      mockUserRepository.findById!.mockResolvedValue(null);

      // Act
      const result = await userService.getUserById(userId);

      // Assert
      expect(result).toBeNull();
    });
  });
});
```

### 2. Utility Function Tests

#### Pattern: Configuration/Validation Testing

```typescript
// __tests__/unit/lib/config-validator.test.ts
import { ConfigValidator } from "@/lib/config-validator";

describe("ConfigValidator", () => {
  describe("validateToolConfig", () => {
    it("should validate GitHub tool configuration", () => {
      // Arrange
      const githubConfig = {
        token: "ghp_xxxxxxxxxxxx",
        username: "octocat",
        enabled: true,
      };

      // Act
      const result = ConfigValidator.validateToolConfig("github", githubConfig);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject GitHub config without token", () => {
      // Arrange
      const invalidConfig = {
        username: "octocat",
        enabled: true,
      };

      // Act
      const result = ConfigValidator.validateToolConfig(
        "github",
        invalidConfig,
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("GitHub token is required");
    });

    it("should validate Jira tool configuration", () => {
      // Arrange
      const jiraConfig = {
        baseUrl: "https://company.atlassian.net",
        email: "user@company.com",
        apiToken: "atlassian-api-token",
        enabled: true,
      };

      // Act
      const result = ConfigValidator.validateToolConfig("jira", jiraConfig);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject invalid Jira URLs", () => {
      // Arrange
      const invalidConfig = {
        baseUrl: "not-a-valid-url",
        email: "user@company.com",
        apiToken: "token",
        enabled: true,
      };

      // Act
      const result = ConfigValidator.validateToolConfig("jira", invalidConfig);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid Jira base URL");
    });
  });
});
```

## Component Test Patterns

### 1. React Component Testing

#### Pattern: Simple Component Testing

```typescript
// __tests__/unit/components/ToolStatusRow.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolStatusRow } from '@/components/ToolStatusRow';
import { ToolStatus } from '@/types/tool';

describe('ToolStatusRow', () => {
  const defaultProps = {
    tool: {
      id: 'github',
      name: 'GitHub',
      enabled: true,
      status: 'connected' as ToolStatus,
      lastSync: new Date('2023-12-25T10:00:00Z'),
      config: {
        username: 'octocat',
        token: 'token'
      }
    } as any,
    onToggle: vi.fn(),
    onConfigure: vi.fn(),
    onDisconnect: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display tool information correctly', () => {
    // Arrange & Act
    render(<ToolStatusRow {...defaultProps} />);

    // Assert
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText(/Last sync:/)).toBeInTheDocument();
  });

  it('should call onToggle when enabled switch is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<ToolStatusRow {...defaultProps} />);

    // Act
    await user.click(screen.getByRole('switch', { name: /Enable GitHub/ }));

    // Assert
    expect(defaultProps.onToggle).toHaveBeenCalledWith('github', false);
  });

  it('should call onConfigure when configure button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<ToolStatusRow {...defaultProps} />);

    // Act
    await user.click(screen.getByRole('button', { name: /Configure/ }));

    // Assert
    expect(defaultProps.onConfigure).toHaveBeenCalledWith('github');
  });

  it('should call onDisconnect when disconnect button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<ToolStatusRow {...defaultProps} />);

    // Act
    await user.click(screen.getByRole('button', { name: /Disconnect/ }));

    // Assert
    expect(defaultProps.onDisconnect).toHaveBeenCalledWith('github');
  });

  it('should show disconnected state for disabled tools', () => {
    // Arrange
    const disabledProps = {
      ...defaultProps,
      tool: {
        ...defaultProps.tool,
        enabled: false,
        status: 'disconnected' as ToolStatus
      }
    };

    // Act
    render(<ToolStatusRow {...disabledProps} />);

    // Assert
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByText(/Enable GitHub/)).toBeInTheDocument();
  });

  it('should show loading state during sync', () => {
    // Arrange
    const loadingProps = {
      ...defaultProps,
      tool: {
        ...defaultProps.tool,
        status: 'syncing' as ToolStatus
      }
    };

    // Act
    render(<ToolStatusRow {...loadingProps} />);

    // Assert
    expect(screen.getByText('Syncing...')).toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});
```

#### Pattern: Form Component Testing

```typescript
// __tests__/unit/components/ToolConfigForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolConfigForm } from '@/components/ToolConfigForm';

describe('ToolConfigForm', () => {
  const defaultProps = {
    toolId: 'github',
    initialConfig: {
      username: '',
      token: '',
      organization: ''
    },
    onSave: vi.fn(),
    onCancel: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render form with empty fields', () => {
    // Arrange & Act
    render(<ToolConfigForm {...defaultProps} />);

    // Assert
    expect(screen.getByLabelText(/Username/)).toHaveValue('');
    expect(screen.getByLabelText(/Token/)).toHaveValue('');
    expect(screen.getByLabelText(/Organization/)).toHaveValue('');
  });

  it('should populate form with initial config', () => {
    // Arrange
    const propsWithConfig = {
      ...defaultProps,
      initialConfig: {
        username: 'octocat',
        token: 'ghp_xxx',
        organization: 'github'
      }
    };

    // Act
    render(<ToolConfigForm {...propsWithConfig} />);

    // Assert
    expect(screen.getByLabelText(/Username/)).toHaveValue('octocat');
    expect(screen.getByLabelText(/Token/)).toHaveValue('ghp_xxx');
    expect(screen.getByLabelText(/Organization/)).toHaveValue('github');
  });

  it('should validate required fields', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<ToolConfigForm {...defaultProps} />);

    // Act - try to save without filling required fields
    await user.click(screen.getByRole('button', { name: /Save/ }));

    // Assert
    expect(screen.getByText(/Username is required/)).toBeInTheDocument();
    expect(screen.getByText(/Token is required/)).toBeInTheDocument();
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it('should save valid configuration', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<ToolConfigForm {...defaultProps} />);

    // Act - fill form and save
    await user.type(screen.getByLabelText(/Username/), 'octocat');
    await user.type(screen.getByLabelText(/Token/), 'ghp_xxx');
    await user.type(screen.getByLabelText(/Organization/), 'github');
    await user.click(screen.getByRole('button', { name: /Save/ }));

    // Assert
    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith({
        username: 'octocat',
        token: 'ghp_xxx',
        organization: 'github'
      });
    });
  });

  it('should call onCancel when cancel button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<ToolConfigForm {...defaultProps} />);

    // Act
    await user.click(screen.getByRole('button', { name: /Cancel/ }));

    // Assert
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('should show loading state during save', async () => {
    // Arrange
    const user = userEvent.setup();
    const onSaveWithDelay = vi.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, 100))
    );

    render(<ToolConfigForm {...defaultProps} onSave={onSaveWithDelay} />);

    // Act - fill and save
    await user.type(screen.getByLabelText(/Username/), 'octocat');
    await user.type(screen.getByLabelText(/Token/), 'ghp_xxx');
    await user.click(screen.getByRole('button', { name: /Save/ }));

    // Assert
    expect(screen.getByText(/Saving.../)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save/ })).toBeDisabled();
  });
});
```

### 2. Hook Testing

#### Pattern: Custom Hook Testing

```typescript
// __tests__/unit/components/hooks/useAuthState.test.ts
import { renderHook, act } from '@testing-library/react';
import { useAuthState } from '@/components/hooks/useAuthState';
import { AuthProvider } from '@/components/AuthProvider';

describe('useAuthState', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
  });

  it('should initialize with logged out state', () => {
    // Arrange & Act
    const { result } = renderHook(() => useAuthState(), { wrapper });

    // Assert
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should load user from localStorage on mount', () => {
    // Arrange
    const storedUser = {
      id: 'user-123',
      email: 'user@example.com',
      name: 'Test User'
    };
    localStorage.setItem('auth_user', JSON.stringify(storedUser));

    // Act
    const { result } = renderHook(() => useAuthState(), { wrapper });

    // Assert
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(storedUser);
  });

  it('should login user successfully', async () => {
    // Arrange
    const { result } = renderHook(() => useAuthState(), { wrapper });
    const loginData = {
      email: 'user@example.com',
      password: 'password'
    };

    // Act
    await act(async () => {
      await result.current.login(loginData);
    });

    // Assert
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(expect.objectContaining({
      email: loginData.email
    }));
    expect(localStorage.getItem('auth_user')).toBeTruthy();
  });

  it('should logout user successfully', async () => {
    // Arrange
    const storedUser = {
      id: 'user-123',
      email: 'user@example.com',
      name: 'Test User'
    };
    localStorage.setItem('auth_user', JSON.stringify(storedUser));

    const { result } = renderHook(() => useAuthState(), { wrapper });

    // Verify initial state
    expect(result.current.isAuthenticated).toBe(true);

    // Act
    await act(async () => {
      await result.current.logout();
    });

    // Assert
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('auth_user')).toBeNull();
  });

  it('should handle login errors', async () => {
    // Arrange
    const { result } = renderHook(() => useAuthState(), { wrapper });
    const invalidCredentials = {
      email: 'invalid@example.com',
      password: 'wrongpassword'
    };

    // Act & Assert
    await act(async () => {
      await expect(result.current.login(invalidCredentials))
        .rejects
        .toThrow('Invalid credentials');
    });

    // Assert
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });
});
```

## API Test Patterns

### 1. Next.js API Route Testing

#### Pattern: API Handler Testing with Mock Request/Response

```typescript
// __tests__/unit/api/tools/enabled.test.ts
import { createRequest, createResponse } from "node-mocks-http";
import handler from "@/app/api/tools/enabled/route";
import { getEnabledTools } from "@/lib/tool-registry";

vi.mock("@/lib/tool-registry");

describe("/api/tools/enabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return enabled tools successfully", async () => {
    // Arrange
    const mockEnabledTools = [
      {
        id: "github",
        name: "GitHub",
        enabled: true,
        status: "connected",
      },
      {
        id: "jira",
        name: "Jira",
        enabled: true,
        status: "disconnected",
      },
    ];

    vi.mocked(getEnabledTools).mockResolvedValue(mockEnabledTools);

    const request = createRequest({
      method: "GET",
    });
    const response = createResponse();

    // Act
    await handler(request, response);

    // Assert
    expect(response.statusCode).toBe(200);
    const data = response._getJSONData();
    expect(data).toEqual({
      success: true,
      tools: mockEnabledTools,
    });
  });

  it("should handle server errors", async () => {
    // Arrange
    vi.mocked(getEnabledTools).mockRejectedValue(
      new Error("Database connection failed"),
    );

    const request = createRequest({
      method: "GET",
    });
    const response = createResponse();

    // Act
    await handler(request, response);

    // Assert
    expect(response.statusCode).toBe(500);
    const data = response._getJSONData();
    expect(data).toEqual({
      success: false,
      error: "An error occurred while processing the request",
    });
  });

  it("should reject POST requests", async () => {
    // Arrange
    const request = createRequest({
      method: "POST",
    });
    const response = createResponse();

    // Act
    await handler(request, response);

    // Assert
    expect(response.statusCode).toBe(405);
    const data = response._getJSONData();
    expect(data).toEqual({
      success: false,
      error: "Method not allowed",
    });
  });
});
```

#### Pattern: Dynamic Route API Testing

```typescript
// __tests__/unit/api/tools/[tool]/metrics.test.ts
import { createRequest, createResponse } from "node-mocks-http";
import handler from "@/app/api/tools/[tool]/metrics/route";
import { getToolMetrics } from "@/lib/tool-service";

vi.mock("@/lib/tool-service");

describe("/api/tools/[tool]/metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return metrics for valid tool", async () => {
    // Arrange
    const toolId = "github";
    const mockMetrics = {
      totalRequests: 1000,
      successRate: 98.5,
      averageResponseTime: 150,
      lastSync: new Date("2023-12-25T10:00:00Z"),
    };

    vi.mocked(getToolMetrics).mockResolvedValue(mockMetrics);

    const request = createRequest({
      method: "GET",
      params: { tool: toolId },
    });
    const response = createResponse();

    // Act
    await handler(request, response);

    // Assert
    expect(response.statusCode).toBe(200);
    const data = response._getJSONData();
    expect(data).toEqual({
      success: true,
      metrics: mockMetrics,
    });
  });

  it("should return 404 for non-existent tool", async () => {
    // Arrange
    const toolId = "nonexistent";
    vi.mocked(getToolMetrics).mockResolvedValue(null);

    const request = createRequest({
      method: "GET",
      params: { tool: toolId },
    });
    const response = createResponse();

    // Act
    await handler(request, response);

    // Assert
    expect(response.statusCode).toBe(404);
    const data = response._getJSONData();
    expect(data).toEqual({
      success: false,
      error: "Tool not found",
    });
  });

  it("should validate tool ID format", async () => {
    // Arrange
    const toolId = "invalid-tool@id";
    const request = createRequest({
      method: "GET",
      params: { tool: toolId },
    });
    const response = createResponse();

    // Act
    await handler(request, response);

    // Assert
    expect(response.statusCode).toBe(400);
    const data = response._getJSONData();
    expect(data).toEqual({
      success: false,
      error: "Invalid tool ID format",
    });
  });
});
```

## Integration Test Patterns

### 1. OAuth Flow Integration Testing

#### Pattern: Complete OAuth Flow Testing

```typescript
// __tests__/integration/oauth/github-flow.spec.ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { setupTestServer, cleanupTestServer } from "../helpers/test-server";
import { createTestUser, deleteTestUser } from "../helpers/test-user";
import { mockGitHubAPI } from "../mocks/github-api";

describe("GitHub OAuth Flow Integration", () => {
  let testServer: any;
  let testUser: any;

  beforeAll(async () => {
    testServer = await setupTestServer();
    testUser = await createTestUser();
    await mockGitHubAPI.start();
  });

  afterAll(async () => {
    await cleanupTestServer(testServer);
    await deleteTestUser(testUser.id);
    await mockGitHubAPI.stop();
  });

  test("should complete OAuth flow successfully", async () => {
    // Arrange
    const authCode = "test-auth-code";
    const expectedUser = {
      id: "github-user-123",
      login: "octocat",
      name: "The Octocat",
      email: "octocat@github.com",
    };

    // Act - Step 1: Exchange code for token
    const tokenResponse = await fetch(
      "http://localhost:3000/api/auth/oauth/github",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: authCode }),
      },
    );

    // Assert - Token exchange
    expect(tokenResponse.status).toBe(200);
    const tokenData = await tokenResponse.json();
    expect(tokenData.success).toBe(true);
    expect(tokenData.accessToken).toBeDefined();

    // Act - Step 2: Get user info
    const userResponse = await fetch("http://localhost:3000/api/auth/me", {
      headers: {
        Authorization: `Bearer ${tokenData.accessToken}`,
      },
    });

    // Assert - User info
    expect(userResponse.status).toBe(200);
    const userData = await userResponse.json();
    expect(userData.user).toEqual(expectedUser);
    expect(userData.connections).toContain("github");
  });

  test("should handle OAuth errors gracefully", async () => {
    // Arrange
    const invalidCode = "invalid-auth-code";

    // Act
    const response = await fetch(
      "http://localhost:3000/api/auth/oauth/github",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: invalidCode }),
      },
    );

    // Assert
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("OAuth authorization failed");
  });

  test("should refresh expired tokens", async () => {
    // Arrange
    const expiredToken = "expired-token";
    const refreshToken = "valid-refresh-token";

    // Act
    const response = await fetch("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    // Assert
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.accessToken).toBeDefined();
    expect(data.accessToken).not.toBe(expiredToken);
  });
});
```

### 2. Tool Integration Testing

#### Pattern: Multi-Tool Integration Testing

```typescript
// __tests__/integration/tools/multi-tool-sync.spec.ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { setupTestServer, cleanupTestServer } from "../helpers/test-server";
import { enableTool, disableTool } from "../helpers/tool-management";
import { mockGitHubAPI, mockJiraAPI } from "../mocks/external-apis";

describe("Multi-Tool Synchronization", () => {
  let testServer: any;

  beforeAll(async () => {
    testServer = await setupTestServer();
    await mockGitHubAPI.start();
    await mockJiraAPI.start();
  });

  afterAll(async () => {
    await cleanupTestServer(testServer);
    await mockGitHubAPI.stop();
    await mockJiraAPI.stop();
  });

  test("should sync data from multiple tools", async () => {
    // Arrange
    await enableTool("github", {
      token: "test-token",
      username: "octocat",
    });

    await enableTool("jira", {
      baseUrl: "https://company.atlassian.net",
      email: "user@company.com",
      apiToken: "test-token",
    });

    // Act - Trigger sync
    const syncResponse = await fetch("http://localhost:3000/api/tools/sync", {
      method: "POST",
    });

    // Assert
    expect(syncResponse.status).toBe(200);
    const syncData = await syncResponse.json();
    expect(syncData.success).toBe(true);
    expect(syncData.results.github).toBeDefined();
    expect(syncData.results.jira).toBeDefined();

    // Verify data was fetched
    expect(syncData.results.github.itemsCount).toBeGreaterThan(0);
    expect(syncData.results.jira.itemsCount).toBeGreaterThan(0);
  });

  test("should handle partial tool failures", async () => {
    // Arrange
    await enableTool("github", {
      token: "valid-token",
      username: "octocat",
    });

    // Mock Jira API to fail
    await mockJiraAPI.simulateFailure();

    await enableTool("jira", {
      baseUrl: "https://company.atlassian.net",
      email: "user@company.com",
      apiToken: "invalid-token",
    });

    // Act
    const syncResponse = await fetch("http://localhost:3000/api/tools/sync", {
      method: "POST",
    });

    // Assert
    expect(syncResponse.status).toBe(207); // Multi-status
    const syncData = await syncResponse.json();
    expect(syncData.success).toBe(false);
    expect(syncData.results.github.success).toBe(true);
    expect(syncData.results.jira.success).toBe(false);
    expect(syncData.results.jira.error).toContain("Authentication failed");
  });

  test("should respect rate limits across tools", async () => {
    // Arrange
    await enableTool("github", {
      token: "test-token",
      username: "octocat",
    });

    // Act - Make multiple rapid requests
    const requests = Array.from({ length: 10 }, (_, i) =>
      fetch(`http://localhost:3000/api/tools/github/data?page=${i}`),
    );

    const responses = await Promise.all(requests);

    // Assert
    const rateLimitedResponses = responses.filter((r) => r.status === 429);
    expect(rateLimitedResponses.length).toBeGreaterThan(0);

    // Should have some successful responses
    const successfulResponses = responses.filter((r) => r.status === 200);
    expect(successfulResponses.length).toBeGreaterThan(0);
  });
});
```

## Performance Test Patterns

### 1. API Performance Testing

#### Pattern: Response Time Testing

```typescript
// __tests__/performance/api/response-time.test.ts
import { describe, test, expect } from "vitest";

describe("API Response Time Performance", () => {
  const endpoints = [
    { path: "/api/tools/enabled", maxTime: 200 },
    { path: "/api/health", maxTime: 100 },
    { path: "/api/metrics", maxTime: 500 },
    { path: "/api/tools/github/metrics", maxTime: 300 },
  ];

  endpoints.forEach(({ path, maxTime }) => {
    test(`should respond to ${path} within ${maxTime}ms`, async () => {
      // Arrange
      const startTime = performance.now();

      // Act
      const response = await fetch(`http://localhost:3000${path}`);
      const endTime = performance.now();

      // Assert
      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(maxTime);
    });
  });

  test("should handle concurrent requests efficiently", async () => {
    // Arrange
    const concurrentRequests = 50;
    const endpoint = "/api/tools/enabled";

    // Act
    const startTime = performance.now();
    const requests = Array.from({ length: concurrentRequests }, () =>
      fetch(`http://localhost:3000${endpoint}`),
    );

    const responses = await Promise.all(requests);
    const endTime = performance.now();

    // Assert
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(endTime - startTime).toBeLessThan(2000); // 2 seconds for 50 requests
  });
});
```

### 2. Database Performance Testing

#### Pattern: Database Query Performance

```typescript
// __tests__/performance/database/query-performance.test.ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { setupTestDatabase, cleanupTestDatabase } from "../helpers/database";
import { createTestData } from "../helpers/test-data";

describe("Database Query Performance", () => {
  beforeAll(async () => {
    await setupTestDatabase();
    await createTestData(10000); // Create 10k test records
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  test("should query users table efficiently", async () => {
    // Arrange
    const startTime = performance.now();

    // Act
    const result = await database.query(
      `
      SELECT * FROM users 
      WHERE created_at > $1 
      ORDER BY created_at DESC 
      LIMIT 100
    `,
      [new Date("2023-01-01")],
    );

    const endTime = performance.now();

    // Assert
    expect(result.rows).toBeDefined();
    expect(result.rows.length).toBeLessThanOrEqual(100);
    expect(endTime - startTime).toBeLessThan(50); // 50ms threshold
  });

  test("should handle complex joins within performance budget", async () => {
    // Arrange
    const startTime = performance.now();

    // Act
    const result = await database.query(`
      SELECT 
        u.id, u.name, u.email,
        COUNT(t.id) as tool_count,
        MAX(t.last_sync) as last_tool_sync
      FROM users u
      LEFT JOIN user_tools ut ON u.id = ut.user_id
      LEFT JOIN tools t ON ut.tool_id = t.id
      WHERE u.active = true
      GROUP BY u.id, u.name, u.email
      ORDER BY tool_count DESC
      LIMIT 1000
    `);

    const endTime = performance.now();

    // Assert
    expect(result.rows).toBeDefined();
    expect(endTime - startTime).toBeLessThan(200); // 200ms threshold
  });
});
```

## E2E Test Patterns

### 1. User Workflow Testing

#### Pattern: Complete User Journey Testing

```typescript
// __tests__/e2e/user-workflow.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Complete User Workflow", () => {
  test("user can set up and use GitHub integration", async ({ page }) => {
    // Arrange
    await page.goto("/");

    // Act & Assert - Step 1: Landing page
    await expect(page.locator("h1")).toContainText("Hyperpage Dashboard");

    // Act & Assert - Step 2: Navigate to settings
    await page.click('[data-testid="settings-link"]');
    await expect(page).toHaveURL("/settings");

    // Act & Assert - Step 3: Enable GitHub tool
    await page.click('[data-testid="github-toggle"]');
    await expect(
      page.locator('[data-testid="github-config-form"]'),
    ).toBeVisible();

    // Act & Assert - Step 4: Fill GitHub configuration
    await page.fill('[data-testid="github-username"]', "test-user");
    await page.fill('[data-testid="github-token"]', "test-token");
    await page.click('[data-testid="save-github-config"]');

    // Act & Assert - Step 5: Verify connection
    await expect(page.locator('[data-testid="github-status"]')).toContainText(
      "Connected",
    );

    // Act & Assert - Step 6: View dashboard with GitHub data
    await page.click('[data-testid="dashboard-link"]');
    await expect(page).toHaveURL("/dashboard");
    await expect(page.locator('[data-testid="github-widget"]')).toBeVisible();

    // Act & Assert - Step 7: Verify GitHub data is displayed
    await expect(
      page.locator('[data-testid="github-repos-count"]'),
    ).toContainText(/\d+/); // Should show some number of repos
  });

  test("user can disconnect tool and remove it from dashboard", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/settings");

    // Act - Disconnect GitHub tool
    await page.click('[data-testid="github-disconnect"]');
    await page.click('[data-testid="confirm-disconnect"]');

    // Assert - Verify disconnection
    await expect(page.locator('[data-testid="github-status"]')).toContainText(
      "Disconnected",
    );

    // Act - Navigate to dashboard
    await page.click('[data-testid="dashboard-link"]');

    // Assert - Verify GitHub widget is removed
    await expect(
      page.locator('[data-testid="github-widget"]'),
    ).not.toBeVisible();
  });
});
```

### 2. Error Handling E2E Testing

#### Pattern: Error Scenario Testing

```typescript
// __tests__/e2e/error-handling.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Error Handling", () => {
  test("should show appropriate error for invalid tool configuration", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/settings");

    // Act - Try to enable Jira with invalid URL
    await page.click('[data-testid="jira-toggle"]');
    await page.fill('[data-testid="jira-base-url"]', "invalid-url");
    await page.fill('[data-testid="jira-email"]', "test@example.com");
    await page.fill('[data-testid="jira-token"]', "test-token");
    await page.click('[data-testid="save-jira-config"]');

    // Assert - Should show validation error
    await expect(page.locator('[data-testid="error-message"]')).toContainText(
      "Invalid Jira URL format",
    );
  });

  test("should handle API errors gracefully", async ({ page, context }) => {
    // Arrange - Mock API to return 500 error
    await context.route("**/api/tools/*", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: "Internal server error",
        }),
      });
    });

    // Act
    await page.goto("/dashboard");

    // Assert - Should show error state instead of crashing
    await expect(page.locator('[data-testid="error-boundary"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText(
      "Something went wrong",
    );

    // Should provide retry option
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test("should handle network connectivity issues", async ({
    page,
    context,
  }) => {
    // Arrange - Block all network requests
    await context.route("**/*", async (route) => {
      await route.abort("internetdisconnected");
    });

    // Act
    await page.goto("/dashboard");

    // Assert - Should show offline state
    await expect(
      page.locator('[data-testid="offline-indicator"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="retry-connection"]'),
    ).toBeVisible();
  });
});
```

## Test Data Management Patterns

### 1. Factory Pattern for Test Data

```typescript
// __tests__/utils/test-factories.ts
export const createUser = (overrides = {}) => ({
  id: `user-${Date.now()}-${Math.random()}`,
  email: `user${Math.random()}@example.com`,
  name: "Test User",
  role: "user",
  active: true,
  createdAt: new Date("2023-01-01"),
  ...overrides,
});

export const createTool = (overrides = {}) => ({
  id: `tool-${Date.now()}-${Math.random()}`,
  name: "Test Tool",
  type: "github",
  enabled: true,
  config: {},
  status: "connected",
  lastSync: new Date(),
  ...overrides,
});

export const createToolConfig = (toolType: string, overrides = {}) => {
  const configs = {
    github: {
      username: "octocat",
      token: "ghp_xxx",
      organization: "",
    },
    jira: {
      baseUrl: "https://company.atlassian.net",
      email: "user@company.com",
      apiToken: "xxx",
    },
  };

  return {
    ...configs[toolType],
    ...overrides,
  };
};
```

### 2. Database Seeding

```typescript
// __tests__/utils/database-seeder.ts
export const seedDatabase = async () => {
  // Create test users
  const users = Array.from({ length: 10 }, (_, i) =>
    createUser({ email: `user${i}@test.com` }),
  );

  await database.insert("users", users);

  // Create test tools
  const tools = [
    createTool({ type: "github", name: "GitHub" }),
    createTool({ type: "jira", name: "Jira" }),
    createTool({ type: "gitlab", name: "GitLab" }),
  ];

  await database.insert("tools", tools);

  // Create user-tool associations
  const associations = users.flatMap((user) =>
    tools.map((tool) => ({
      userId: user.id,
      toolId: tool.id,
      enabled: Math.random() > 0.5,
      config: {},
    })),
  );

  await database.insert("user_tools", associations);
};
```

## Best Practices Summary

### 1. Test Organization

- **One test file per component/module**: Keep tests focused and maintainable
- **Descriptive test names**: Test names should read like sentences
- **Group related tests**: Use `describe` blocks to organize related tests
- **AAA pattern**: Arrange, Act, Assert structure

### 2. Test Data Management

- **Use factories**: Create consistent test data with overrides
- **Isolate tests**: Each test should be independent
- **Clean up after tests**: Use `afterEach` or `afterAll` hooks
- **Unique identifiers**: Use timestamps or random values to avoid conflicts

### 3. Mocking Strategy

- **Mock external dependencies**: APIs, databases, services
- **Use realistic data**: Mock data should be representative of real scenarios
- **Clear mocks**: Reset mocks between tests
- **Partial mocks**: Mock only what you need to test in isolation

### 4. Performance Considerations

- **Fast unit tests**: Unit tests should run in milliseconds
- **Parallel execution**: Run independent tests in parallel where possible
- **Selective testing**: Use test filtering for specific scenarios
- **Resource cleanup**: Ensure tests don't leak resources

### 5. Error Testing

- **Happy path and edge cases**: Test both success and failure scenarios
- **Error boundaries**: Test error handling and recovery
- **Network issues**: Test timeout, offline, and connection errors
- **Validation**: Test input validation and constraint violations

## Conclusion

These patterns and examples provide a comprehensive foundation for writing tests in the Hyperpage project. They demonstrate:

- **Consistent structure** across different types of tests
- **Real-world scenarios** that match actual usage patterns
- **Performance considerations** for scalable test suites
- **Error handling** for robust applications
- **Best practices** for maintainable test code

For questions or suggestions about these patterns, please refer to the development team or create an issue in the project repository.
