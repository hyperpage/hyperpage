/**
 * Test Credential Management for Integration Testing
 *
 * This module provides secure management of test OAuth credentials
 * for integration testing across GitHub, GitLab, and Jira.
 */

/**
 * Check if the test server is available
 */
export async function isServerAvailable(baseUrl: string): Promise<boolean> {
  try {
    // Simple timeout using Promise.race
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), 2000),
    );

    const fetchPromise = fetch(`${baseUrl}/api/health`, {
      method: "GET",
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);
    return response.ok;
  } catch (error) {
    console.log(
      `Server not available at ${baseUrl}:`,
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

export interface OAuthTestCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  testUserId: string;
  username?: string;
  email?: string;
}

export interface TestEnvironment {
  baseUrl: string;
  databaseUrl: string;
  redisUrl: string;
  encryptionKey: string;
}

export interface TestUserData {
  id: string;
  provider: string;
  username: string;
  email: string;
  authenticatedAt: string;
  tokens: Record<string, unknown>;
  // Allow additional properties for test-specific data
  [key: string]: unknown;
}

export class TestCredentialManager {
  private static instance: TestCredentialManager;
  private credentials: Map<string, OAuthTestCredentials> = new Map();
  private environment: TestEnvironment | null = null;

  public static getInstance(): TestCredentialManager {
    if (!TestCredentialManager.instance) {
      TestCredentialManager.instance = new TestCredentialManager();
    }
    return TestCredentialManager.instance;
  }

  public async initialize(environment: TestEnvironment): Promise<void> {
    this.environment = environment;
  }

  public async getTestCredentials(
    provider: "github" | "gitlab" | "jira",
  ): Promise<OAuthTestCredentials> {
    if (!this.credentials.has(provider)) {
      this.credentials.set(
        provider,
        await this.createTestCredentials(provider),
      );
    }
    return this.credentials.get(provider)!;
  }

  private async createTestCredentials(
    provider: string,
  ): Promise<OAuthTestCredentials> {
    const baseUrl = this.environment?.baseUrl || "http://localhost:3000";

    switch (provider) {
      case "github":
        return this.createGitHubCredentials(baseUrl);
      case "gitlab":
        return this.createGitLabCredentials(baseUrl);
      case "jira":
        return this.createJiraCredentials(baseUrl);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private async createGitHubCredentials(
    baseUrl: string,
  ): Promise<OAuthTestCredentials> {
    const clientId = process.env.GITHUB_OAUTH_TEST_CLIENT_ID;
    const clientSecret = process.env.GITHUB_OAUTH_TEST_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      // Return mock credentials for development/testing without real OAuth setup
      return {
        clientId: "mock-github-client-id",
        clientSecret: "mock-github-client-secret",
        redirectUri: `${baseUrl}/api/auth/github/callback`,
        scopes: ["repo", "read:user", "read:org"],
        testUserId: "test-github-user-001",
        username: "hyperpage-test-user",
        email: "test@hyperpage.dev",
      };
    }

    return {
      clientId,
      clientSecret,
      redirectUri: `${baseUrl}/api/auth/github/callback`,
      scopes: ["repo", "read:user", "read:org"],
      testUserId: "test-github-user-001",
      username: process.env.TEST_GITHUB_USERNAME || "hyperpage-test-user",
      email: "test@hyperpage.dev",
    };
  }

  private async createGitLabCredentials(
    baseUrl: string,
  ): Promise<OAuthTestCredentials> {
    const clientId = process.env.GITLAB_OAUTH_TEST_CLIENT_ID;
    const clientSecret = process.env.GITLAB_OAUTH_TEST_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      // Return mock credentials for development/testing
      return {
        clientId: "mock-gitlab-client-id",
        clientSecret: "mock-gitlab-client-secret",
        redirectUri: `${baseUrl}/api/auth/gitlab/callback`,
        scopes: ["read_user", "read_api", "read_repository"],
        testUserId: "test-gitlab-user-001",
        username: "hyperpage-test-user",
        email: "test@hyperpage.dev",
      };
    }

    return {
      clientId,
      clientSecret,
      redirectUri: `${baseUrl}/api/auth/gitlab/callback`,
      scopes: ["read_user", "read_api", "read_repository"],
      testUserId: "test-gitlab-user-001",
      username: process.env.TEST_GITLAB_USERNAME || "hyperpage-test-user",
      email: "test@hyperpage.dev",
    };
  }

  private async createJiraCredentials(
    baseUrl: string,
  ): Promise<OAuthTestCredentials> {
    const clientId = process.env.JIRA_OAUTH_TEST_CLIENT_ID;
    const clientSecret = process.env.JIRA_OAUTH_TEST_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      // Return mock credentials for development/testing
      return {
        clientId: "mock-jira-client-id",
        clientSecret: "mock-jira-client-secret",
        redirectUri: `${baseUrl}/api/auth/jira/callback`,
        scopes: ["read:jira-user", "read:jira-work"],
        testUserId: "test-jira-user-001",
        username: "hyperpage-test-user",
        email: "test@hyperpage.dev",
      };
    }

    return {
      clientId,
      clientSecret,
      redirectUri: `${baseUrl}/api/auth/jira/callback`,
      scopes: ["read:jira-user", "read:jira-work"],
      testUserId: "test-jira-user-001",
      username: process.env.TEST_JIRA_USERNAME || "hyperpage-test-user",
      email: "test@hyperpage.dev",
    };
  }

  public async cleanup(): Promise<void> {
    this.credentials.clear();
  }
}

/**
 * Test User Management
 */
export class TestUserManager {
  private static instance: TestUserManager;
  private testUsers: Map<string, TestUserData> = new Map();

  public static getInstance(): TestUserManager {
    if (!TestUserManager.instance) {
      TestUserManager.instance = new TestUserManager();
    }
    return TestUserManager.instance;
  }

  public async createTestUser(
    provider: string,
    credentials: OAuthTestCredentials,
  ): Promise<string> {
    const userId = `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const userData: TestUserData = {
      id: userId,
      provider,
      username: credentials.username || "test-user",
      email: credentials.email || "test@example.com",
      authenticatedAt: new Date().toISOString(),
      tokens: {},
    };

    this.testUsers.set(userId, userData);
    return userId;
  }

  public getTestUser(userId: string): TestUserData | null {
    return this.testUsers.get(userId) || null;
  }

  public async cleanup(): Promise<void> {
    this.testUsers.clear();
  }
}

/**
 * Integration Test Environment Setup
 */
export class IntegrationTestEnvironment {
  private static instance: IntegrationTestEnvironment;
  private isInitialized = false;
  private environment: TestEnvironment | null = null;

  public static async setup(): Promise<IntegrationTestEnvironment> {
    if (!IntegrationTestEnvironment.instance) {
      IntegrationTestEnvironment.instance = new IntegrationTestEnvironment();
      await IntegrationTestEnvironment.instance.initialize();
    }
    return IntegrationTestEnvironment.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Initialize test environment variables
    this.setupTestEnvironment();

    // Initialize credential manager
    this.environment = {
      baseUrl: process.env.HYPERPAGE_TEST_BASE_URL || "http://localhost:3000",
      databaseUrl: process.env.TEST_DATABASE_URL || "sqlite:./test.db",
      redisUrl: process.env.TEST_REDIS_URL || "redis://localhost:6379",
      encryptionKey:
        process.env.OAUTH_ENCRYPTION_KEY ||
        "test-encryption-key-32-chars-long!!",
    };

    await TestCredentialManager.getInstance().initialize(this.environment);

    this.isInitialized = true;
  }

  private setupTestEnvironment(): void {
    // Set test-specific environment variables
    (process.env as Record<string, string>).NODE_ENV = "test";
    (process.env as Record<string, string>).ENABLE_INTEGRATION_TESTS = "true";
    (process.env as Record<string, string>).TEST_TIMEOUT = "30000";

    // Enable tools for testing
    (process.env as Record<string, string>).ENABLE_GITHUB = "true";
    (process.env as Record<string, string>).ENABLE_GITLAB = "true";
    (process.env as Record<string, string>).ENABLE_JIRA = "true";

    // Set mock Jira credentials for testing
    (process.env as Record<string, string>).JIRA_WEB_URL =
      "https://test-jira.atlassian.net";
    (process.env as Record<string, string>).JIRA_API_TOKEN = "test-api-token";
    (process.env as Record<string, string>).JIRA_EMAIL = "test@example.com";

    // Disable real OAuth in test mode
    (process.env as Record<string, string>).SKIP_REAL_OAUTH = "true";
  }

  public async createTestSession(provider: string): Promise<{
    userId: string;
    sessionId: string;
    credentials: OAuthTestCredentials;
  }> {
    const credentials =
      await TestCredentialManager.getInstance().getTestCredentials(
        provider as "github" | "gitlab" | "jira",
      );
    const userId = await TestUserManager.getInstance().createTestUser(
      provider,
      credentials,
    );

    // Use the sessions API with enhanced timing and verification
    const baseUrl = this.environment?.baseUrl || "http://localhost:3000";

    // Create session with retry logic for reliability
    let sessionId: string | null = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts && !sessionId) {
      try {
        const sessionResponse = await fetch(`${baseUrl}/api/sessions`);

        if (!sessionResponse.ok) {
          throw new Error(
            `Failed to create test session: ${sessionResponse.status}`,
          );
        }

        const sessionData = await sessionResponse.json();
        sessionId = sessionData.sessionId;

        if (!sessionId) {
          throw new Error("No session ID returned from sessions API");
        }

        // Optimized verification: immediate session check without artificial delays
        const verifyResponse = await fetch(
          `${baseUrl}/api/sessions?sessionId=${sessionId}`,
        );
        if (!verifyResponse.ok) {
          console.warn(
            `Session verification attempt ${attempts + 1} failed for ${sessionId}`,
          );
          sessionId = null; // Retry
        } else {
          console.log(
            `Successfully created and verified test session ${sessionId} for provider ${provider}`,
          );
        }
      } catch (error) {
        console.warn(`Session creation attempt ${attempts + 1} failed:`, error);
        sessionId = null; // Retry
      }

      attempts++;
    }

    if (!sessionId) {
      throw new Error(
        `Failed to create test session after ${maxAttempts} attempts`,
      );
    }

    return {
      userId,
      sessionId,
      credentials,
    };
  }

  public async cleanup(): Promise<void> {
    await TestCredentialManager.getInstance().cleanup();
    await TestUserManager.getInstance().cleanup();
    this.isInitialized = false;
  }
}
