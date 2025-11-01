/**
 * Test Credential Management for Integration Testing
 * 
 * This module provides secure management of test OAuth credentials
 * for integration testing across GitHub, GitLab, and Jira.
 */

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

  public async getTestCredentials(provider: 'github' | 'gitlab' | 'jira'): Promise<OAuthTestCredentials> {
    if (!this.credentials.has(provider)) {
      this.credentials.set(provider, await this.createTestCredentials(provider));
    }
    return this.credentials.get(provider)!;
  }

  private async createTestCredentials(provider: string): Promise<OAuthTestCredentials> {
    const baseUrl = this.environment?.baseUrl || 'http://localhost:3000';
    
    switch (provider) {
      case 'github':
        return this.createGitHubCredentials(baseUrl);
      case 'gitlab':
        return this.createGitLabCredentials(baseUrl);
      case 'jira':
        return this.createJiraCredentials(baseUrl);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private async createGitHubCredentials(baseUrl: string): Promise<OAuthTestCredentials> {
    const clientId = process.env.GITHUB_OAUTH_TEST_CLIENT_ID;
    const clientSecret = process.env.GITHUB_OAUTH_TEST_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      // Return mock credentials for development/testing without real OAuth setup
      return {
        clientId: 'mock-github-client-id',
        clientSecret: 'mock-github-client-secret',
        redirectUri: `${baseUrl}/api/auth/github/callback`,
        scopes: ['repo', 'read:user', 'read:org'],
        testUserId: 'test-github-user-001',
        username: 'hyperpage-test-user',
        email: 'test@hyperpage.dev'
      };
    }

    return {
      clientId,
      clientSecret,
      redirectUri: `${baseUrl}/api/auth/github/callback`,
      scopes: ['repo', 'read:user', 'read:org'],
      testUserId: 'test-github-user-001',
      username: process.env.TEST_GITHUB_USERNAME || 'hyperpage-test-user',
      email: 'test@hyperpage.dev'
    };
  }

  private async createGitLabCredentials(baseUrl: string): Promise<OAuthTestCredentials> {
    const clientId = process.env.GITLAB_OAUTH_TEST_CLIENT_ID;
    const clientSecret = process.env.GITLAB_OAUTH_TEST_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      // Return mock credentials for development/testing
      return {
        clientId: 'mock-gitlab-client-id',
        clientSecret: 'mock-gitlab-client-secret',
        redirectUri: `${baseUrl}/api/auth/gitlab/callback`,
        scopes: ['read_user', 'read_api', 'read_repository'],
        testUserId: 'test-gitlab-user-001',
        username: 'hyperpage-test-user',
        email: 'test@hyperpage.dev'
      };
    }

    return {
      clientId,
      clientSecret,
      redirectUri: `${baseUrl}/api/auth/gitlab/callback`,
      scopes: ['read_user', 'read_api', 'read_repository'],
      testUserId: 'test-gitlab-user-001',
      username: process.env.TEST_GITLAB_USERNAME || 'hyperpage-test-user',
      email: 'test@hyperpage.dev'
    };
  }

  private async createJiraCredentials(baseUrl: string): Promise<OAuthTestCredentials> {
    const clientId = process.env.JIRA_OAUTH_TEST_CLIENT_ID;
    const clientSecret = process.env.JIRA_OAUTH_TEST_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      // Return mock credentials for development/testing
      return {
        clientId: 'mock-jira-client-id',
        clientSecret: 'mock-jira-client-secret',
        redirectUri: `${baseUrl}/api/auth/jira/callback`,
        scopes: ['read:jira-user', 'read:jira-work'],
        testUserId: 'test-jira-user-001',
        username: 'hyperpage-test-user',
        email: 'test@hyperpage.dev'
      };
    }

    return {
      clientId,
      clientSecret,
      redirectUri: `${baseUrl}/api/auth/jira/callback`,
      scopes: ['read:jira-user', 'read:jira-work'],
      testUserId: 'test-jira-user-001',
      username: process.env.TEST_JIRA_USERNAME || 'hyperpage-test-user',
      email: 'test@hyperpage.dev'
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
  private testUsers: Map<string, any> = new Map();

  public static getInstance(): TestUserManager {
    if (!TestUserManager.instance) {
      TestUserManager.instance = new TestUserManager();
    }
    return TestUserManager.instance;
  }

  public async createTestUser(provider: string, credentials: OAuthTestCredentials): Promise<string> {
    const userId = `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const userData = {
      id: userId,
      provider,
      username: credentials.username || 'test-user',
      email: credentials.email || 'test@example.com',
      authenticatedAt: new Date().toISOString(),
      tokens: {}
    };

    this.testUsers.set(userId, userData);
    return userId;
  }

  public getTestUser(userId: string): any | null {
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
    await TestCredentialManager.getInstance().initialize({
      baseUrl: process.env.HYPERPAGE_TEST_BASE_URL || 'http://localhost:3000',
      databaseUrl: process.env.TEST_DATABASE_URL || 'sqlite:./test.db',
      redisUrl: process.env.TEST_REDIS_URL || 'redis://localhost:6379',
      encryptionKey: process.env.OAUTH_ENCRYPTION_KEY || 'test-encryption-key-32-chars-long!!'
    });

    this.isInitialized = true;
  }

  private setupTestEnvironment(): void {
    // Set test-specific environment variables
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_INTEGRATION_TESTS = 'true';
    process.env.TEST_TIMEOUT = '30000';
    
    // Disable real OAuth in test mode
    process.env.SKIP_REAL_OAUTH = 'true';
  }

  public async createTestSession(provider: string): Promise<{
    userId: string;
    sessionId: string;
    credentials: OAuthTestCredentials;
  }> {
    const credentials = await TestCredentialManager.getInstance().getTestCredentials(provider as any);
    const userId = await TestUserManager.getInstance().createTestUser(provider, credentials);
    const sessionId = `session-${userId}-${Date.now()}`;

    return {
      userId,
      sessionId,
      credentials
    };
  }

  public async cleanup(): Promise<void> {
    await TestCredentialManager.getInstance().cleanup();
    await TestUserManager.getInstance().cleanup();
    this.isInitialized = false;
  }
}
