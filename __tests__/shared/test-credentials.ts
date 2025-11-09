/**
 * Test Credentials and Configuration
 *
 * This file provides safe test credentials and mock configurations
 * for testing purposes. No real credentials should be included here.
 */

export const TEST_CREDENTIALS = {
  // Mock GitHub credentials for testing
  github: {
    username: "test-user",
    token: "test-github-token-12345",
    apiUrl: "https://api.github.com",
    webUrl: "https://github.com",
  },

  // Mock GitLab credentials for testing
  gitlab: {
    username: "test-user",
    token: "test-gitlab-token-12345",
    apiUrl: "https://gitlab.com/api/v4",
    webUrl: "https://gitlab.com",
  },

  // Mock Jira credentials for testing
  jira: {
    username: "test-user@example.com",
    token: "test-jira-token-12345",
    apiUrl: "https://test-domain.atlassian.net/rest/api/3",
    webUrl: "https://test-domain.atlassian.net",
  },

  // Mock OAuth configuration
  oauth: {
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "http://localhost:3000/api/auth/callback",
    scopes: ["read:user", "read:org"],
  },

  // Mock database credentials
  database: {
    host: "localhost",
    port: 5432,
    database: "hyperpage_test",
    username: "test_user",
    password: "test_password",
  },

  // Mock Redis configuration
  redis: {
    host: "localhost",
    port: 6379,
    db: 0,
    password: "test_redis_password",
  },
} as const;

// Environment variable mappings for test setup
export const TEST_ENV_VARS = {
  // GitHub
  GITHUB_USERNAME: TEST_CREDENTIALS.github.username,
  GITHUB_TOKEN: TEST_CREDENTIALS.github.token,
  GITHUB_WEB_URL: TEST_CREDENTIALS.github.webUrl,

  // GitLab
  GITLAB_USERNAME: TEST_CREDENTIALS.gitlab.username,
  GITLAB_TOKEN: TEST_CREDENTIALS.gitlab.token,
  GITLAB_WEB_URL: TEST_CREDENTIALS.gitlab.webUrl,

  // Jira
  JIRA_EMAIL: TEST_CREDENTIALS.jira.username,
  JIRA_API_TOKEN: TEST_CREDENTIALS.jira.token,
  JIRA_WEB_URL: TEST_CREDENTIALS.jira.webUrl,

  // OAuth
  OAUTH_CLIENT_ID: TEST_CREDENTIALS.oauth.clientId,
  OAUTH_CLIENT_SECRET: TEST_CREDENTIALS.oauth.clientSecret,
  OAUTH_REDIRECT_URI: TEST_CREDENTIALS.oauth.redirectUri,

  // Database
  DATABASE_HOST: TEST_CREDENTIALS.database.host,
  DATABASE_PORT: String(TEST_CREDENTIALS.database.port),
  DATABASE_NAME: TEST_CREDENTIALS.database.database,
  DATABASE_USERNAME: TEST_CREDENTIALS.database.username,
  DATABASE_PASSWORD: TEST_CREDENTIALS.database.password,

  // Redis
  REDIS_HOST: TEST_CREDENTIALS.redis.host,
  REDIS_PORT: String(TEST_CREDENTIALS.redis.port),
  REDIS_PASSWORD: TEST_CREDENTIALS.redis.password,
} as const;

export type TestCredentialKey = keyof typeof TEST_CREDENTIALS;

export function getTestCredential(service: TestCredentialKey) {
  return TEST_CREDENTIALS[service];
}

export function getTestEnvVar(key: keyof typeof TEST_ENV_VARS): string {
  return TEST_ENV_VARS[key];
}

// Mock tool configurations for testing
export const MOCK_TOOL_CONFIGS = {
  github: {
    enabled: true,
    auth: {
      type: "token" as const,
      token: TEST_CREDENTIALS.github.token,
    },
    config: {
      apiUrl: TEST_CREDENTIALS.github.apiUrl,
      webUrl: TEST_CREDENTIALS.github.webUrl,
    },
  },

  gitlab: {
    enabled: true,
    auth: {
      type: "token" as const,
      token: TEST_CREDENTIALS.gitlab.token,
    },
    config: {
      apiUrl: TEST_CREDENTIALS.gitlab.apiUrl,
      webUrl: TEST_CREDENTIALS.gitlab.webUrl,
    },
  },

  jira: {
    enabled: true,
    auth: {
      type: "basic" as const,
      username: TEST_CREDENTIALS.jira.username,
      token: TEST_CREDENTIALS.jira.token,
    },
    config: {
      apiUrl: TEST_CREDENTIALS.jira.apiUrl,
      webUrl: TEST_CREDENTIALS.jira.webUrl,
    },
  },
} as const;

// OAuth Test Credentials interface
export interface OAuthTestCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: readonly string[];
  token?: string;
  username?: string;
  testUserId?: string;
}

// Test User interface (used by integration tests)
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
  tokens?: Record<string, object>;
  [key: string]: string | number | boolean | object | undefined; // Allow additional properties for test compatibility
}

// Test User Data interface
// Test User Data type alias
export type TestUserData = TestUser;

// Test Session interface
export interface TestSession {
  userId: string;
  sessionId: string;
  provider: string;
  credentials: OAuthTestCredentials;
  timestamp: number;
}

// Integration Test Environment manager
export class IntegrationTestEnvironment {
  private static instance: IntegrationTestEnvironment;
  private userSessions: Map<string, TestSession> = new Map();
  private isInitialized = false;

  static async setup(): Promise<IntegrationTestEnvironment> {
    if (!IntegrationTestEnvironment.instance) {
      IntegrationTestEnvironment.instance = new IntegrationTestEnvironment();
    }
    await IntegrationTestEnvironment.instance.initialize();
    return IntegrationTestEnvironment.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Initialize test environment
    this.isInitialized = true;
  }

  async cleanup(): Promise<void> {
    // Clean up all test sessions
    this.userSessions.clear();
    this.isInitialized = false;
  }

  async createTestSession(provider: string): Promise<TestSession> {
    const userId = `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const sessionId = `test-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const session: TestSession = {
      userId,
      sessionId,
      provider,
      credentials: {
        clientId: TEST_CREDENTIALS.oauth.clientId,
        clientSecret: TEST_CREDENTIALS.oauth.clientSecret,
        redirectUri: TEST_CREDENTIALS.oauth.redirectUri,
        scopes: TEST_CREDENTIALS.oauth.scopes,
        token: this.generateTestToken(provider),
        username: `${provider}-test-user`,
      },
      timestamp: Date.now(),
    };

    this.userSessions.set(userId, session);
    return session;
  }

  private generateTestToken(provider: string): string {
    return `test-${provider}-token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getTestSession(userId: string): TestSession | null {
    return this.userSessions.get(userId) || null;
  }

  getAllSessions(): TestSession[] {
    return Array.from(this.userSessions.values());
  }

  async reset(): Promise<void> {
    this.userSessions.clear();
  }
}

// Test User Manager singleton
export class TestUserManager {
  private static instance: TestUserManager;
  private testUsers: Map<string, TestUser> = new Map();

  static getInstance(): TestUserManager {
    if (!TestUserManager.instance) {
      TestUserManager.instance = new TestUserManager();
    }
    return TestUserManager.instance;
  }

  createTestUser(session: TestSession): TestUser {
    const testUser: TestUser = {
      id: session.userId,
      userId: session.userId,
      sessionId: session.sessionId,
      provider: session.provider,
      credentials: session.credentials,
      lastAccessed: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      accessCount: 0,
      isActive: true,
      tokens: {},
    };

    this.testUsers.set(session.userId, testUser);
    return testUser;
  }

  getTestUser(userId: string): TestUser | null {
    const user = this.testUsers.get(userId);
    if (user) {
      user.lastAccessed = new Date().toISOString();
      user.accessCount++;
    }
    return user || null;
  }

  updateTestUser(userId: string, updates: Partial<TestUser>): void {
    const user = this.testUsers.get(userId);
    if (user) {
      Object.assign(user, updates);
      user.lastAccessed = new Date().toISOString();
    }
  }

  removeTestUser(userId: string): boolean {
    return this.testUsers.delete(userId);
  }

  getAllTestUsers(): TestUser[] {
    return Array.from(this.testUsers.values());
  }

  clearAllUsers(): void {
    this.testUsers.clear();
  }

  getActiveUserCount(): number {
    return Array.from(this.testUsers.values()).filter((user) => user.isActive)
      .length;
  }
}

// Server availability checker (deterministic, real HTTP-based)
export async function isServerAvailable(
  service: "github" | "gitlab" | "jira" | "redis" | "database",
): Promise<boolean> {
  const baseUrl =
    process.env.HYPERPAGE_TEST_BASE_URL || "http://localhost:3000";

  try {
    switch (service) {
      case "jira": {
        // Check that the app server is up and the Jira tool is wired.
        // We intentionally use a lightweight GET that should exist when Jira is enabled.
        const res = await fetch(`${baseUrl}/api/tools/jira/issues`, {
          method: "GET",
        });
        // Consider server available when endpoint responds at all (no network error)
        // and is not a 5xx. auth/401/403 are acceptable: they prove routing/handler work.
        return res.status < 500;
      }

      case "github": {
        const res = await fetch(`${baseUrl}/api/tools/github/pull-requests`, {
          method: "GET",
        });
        return res.status < 500;
      }

      case "gitlab": {
        const res = await fetch(`${baseUrl}/api/tools/gitlab/issues`, {
          method: "GET",
        });
        return res.status < 500;
      }

      case "redis":
      case "database": {
        // For now, treat these as available once the main app server responds to /api/health.
        const res = await fetch(`${baseUrl}/api/health`, { method: "GET" });
        return res.status < 500;
      }

      default:
        return false;
    }
  } catch {
    return false;
  }
}

// Wait for server availability with timeout
export async function waitForServer(
  service: Parameters<typeof isServerAvailable>[0],
  timeoutMs: number = 10000,
  intervalMs: number = 1000,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await isServerAvailable(service)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}

// Test data generators
export function generateMockGitHubData(count: number = 5) {
  return Array.from({ length: count }, (_, i) => ({
    id: `gh-${i + 1}`,
    title: `GitHub Issue #${i + 1}`,
    state: Math.random() > 0.5 ? "open" : "closed",
    created_at: new Date(Date.now() - i * 3600000).toISOString(),
    updated_at: new Date().toISOString(),
    html_url: `https://github.com/test/repo/issues/${i + 1}`,
  }));
}

export function generateMockGitLabData(count: number = 5) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `GitLab Issue #${i + 1}`,
    state: Math.random() > 0.5 ? "opened" : "closed",
    created_at: new Date(Date.now() - i * 3600000).toISOString(),
    updated_at: new Date().toISOString(),
    web_url: `https://gitlab.com/test/project/-/issues/${i + 1}`,
  }));
}

export function generateMockJiraData(count: number = 5) {
  return Array.from({ length: count }, (_, i) => ({
    key: `JIRA-${i + 1}`,
    fields: {
      summary: `Jira Issue #${i + 1}`,
      status: { name: Math.random() > 0.5 ? "Open" : "In Progress" },
      created: new Date(Date.now() - i * 3600000).toISOString(),
      updated: new Date().toISOString(),
    },
    self: `https://test.atlassian.net/rest/api/3/issue/JIRA-${i + 1}`,
  }));
}
