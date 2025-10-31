/**
 * OAuth Configuration for supported tools
 * Centralizes OAuth client configurations, scopes, and provider URLs
 */

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  redirectUri?: string; // Optional, can be constructed dynamically
  provider: 'github' | 'gitlab' | 'jira';
}

// Environment variable keys for OAuth
const OAUTH_ENV_VARS = {
  GITHUB_CLIENT_ID: 'GITHUB_OAUTH_CLIENT_ID',
  GITHUB_CLIENT_SECRET: 'GITHUB_OAUTH_CLIENT_SECRET',
  GITLAB_CLIENT_ID: 'GITLAB_OAUTH_CLIENT_ID',
  GITLAB_CLIENT_SECRET: 'GITLAB_OAUTH_CLIENT_SECRET',
  JIRA_CLIENT_ID: 'JIRA_OAUTH_CLIENT_ID',
  JIRA_CLIENT_SECRET: 'JIRA_OAUTH_CLIENT_SECRET',
} as const;

/**
 * Get OAuth configuration for a specific tool
 */
export function getOAuthConfig(toolName: string, baseUrl?: string): OAuthConfig | null {
  switch (toolName.toLowerCase()) {
    case 'github':
      return getGitHubConfig();
    case 'gitlab':
      return getGitLabConfig();
    case 'jira':
      return getJiraConfig(baseUrl);
    default:
      return null;
  }
}

/**
 * GitHub OAuth configuration
 */
function getGitHubConfig(): OAuthConfig | null {
  const clientId = process.env[OAUTH_ENV_VARS.GITHUB_CLIENT_ID];
  const clientSecret = process.env[OAUTH_ENV_VARS.GITHUB_CLIENT_SECRET];

  if (!clientId || !clientSecret) {
    console.warn('GitHub OAuth not configured - missing CLIENT_ID or CLIENT_SECRET');
    return null;
  }

  return {
    provider: 'github',
    clientId,
    clientSecret,
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: [
      'read:user',      // Read user profile data
      'repo',           // Full access to public and private repositories
      'read:org',       // Read organization membership and teams
      'read:discussion' // Read discussion data
    ],
    redirectUri: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/github/callback`,
  };
}

/**
 * GitLab OAuth configuration
 */
function getGitLabConfig(): OAuthConfig | null {
  const clientId = process.env[OAUTH_ENV_VARS.GITLAB_CLIENT_ID];
  const clientSecret = process.env[OAUTH_ENV_VARS.GITLAB_CLIENT_SECRET];

  if (!clientId || !clientSecret) {
    console.warn('GitLab OAuth not configured - missing CLIENT_ID or CLIENT_SECRET');
    return null;
  }

  return {
    provider: 'gitlab',
    clientId,
    clientSecret,
    authorizationUrl: 'https://gitlab.com/oauth/authorize', // Can be made configurable for self-hosted
    tokenUrl: 'https://gitlab.com/oauth/token', // Can be made configurable for self-hosted
    scopes: [
      'read_user',      // Read user profile
      'api',            // Full API access
    ],
    redirectUri: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/gitlab/callback`,
  };
}

/**
 * Jira OAuth 2.0 configuration
 * Note: Jira uses instance-specific URLs
 */
function getJiraConfig(instanceUrl?: string): OAuthConfig | null {
  const clientId = process.env[OAUTH_ENV_VARS.JIRA_CLIENT_ID];
  const clientSecret = process.env[OAUTH_ENV_VARS.JIRA_CLIENT_SECRET];

  if (!clientId || !clientSecret) {
    console.warn('Jira OAuth not configured - missing CLIENT_ID or CLIENT_SECRET');
    return null;
  }

  // For Jira, we need an instance URL. If not provided, fall back to environment variable
  const baseUrl = instanceUrl || process.env['JIRA_WEB_URL'];
  if (!baseUrl) {
    console.warn('Jira OAuth not configured - missing instance URL (JIRA_WEB_URL)');
    return null;
  }

  return {
    provider: 'jira',
    clientId,
    clientSecret,
    authorizationUrl: `${baseUrl}/rest/oauth2/latest/authorize`,
    tokenUrl: `${baseUrl}/rest/oauth2/latest/token`,
    scopes: [
      'read:jira-work',  // Read jira work items
      'read:jira-user',  // Read user information
      'write:jira-work'  // Create and edit jira work items
    ],
    redirectUri: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/jira/callback`,
  };
}

/**
 * Build authorization URL for OAuth 2.0 flow
 */
export function buildAuthorizationUrl(config: OAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri || '',
    scope: config.scopes.join(' '),
    response_type: 'code',
    state: state, // CSRF protection
  });

  return `${config.authorizationUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access tokens
 */
export async function exchangeCodeForTokens(
  config: OAuthConfig,
  code: string
): Promise<any> {
  const tokenUrl = config.tokenUrl;
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: code,
    grant_type: 'authorization_code',
  });

  // Add redirect_uri for providers that require it (GitLab, some others)
  if (config.redirectUri) {
    params.append('redirect_uri', config.redirectUri);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OAuth token exchange failed for ${config.provider}:`, response.status, errorText);
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  const tokenData = await response.json();

  if (tokenData.error) {
    console.error(`OAuth response error for ${config.provider}:`, tokenData.error);
    throw new Error(`Token response error: ${tokenData.error}`);
  }

  return tokenData;
}

/**
 * Validate if OAuth is configured for a tool
 */
export function isOAuthConfigured(toolName: string): boolean {
  const config = getOAuthConfig(toolName);
  return config !== null;
}

/**
 * Get configured OAuth providers
 */
export function getConfiguredProviders(): string[] {
  const providers = ['github', 'gitlab', 'jira'];
  return providers.filter(provider => isOAuthConfigured(provider));
}

/**
 * Get required OAuth scopes for a tool
 */
export function getRequiredScopes(toolName: string): string[] {
  switch (toolName.toLowerCase()) {
    case 'github':
      return ['read:user', 'repo', 'read:org'];
    case 'gitlab':
      return ['read_user', 'api'];
    case 'jira':
      return ['read:jira-work', 'read:jira-user'];
    default:
      return [];
  }
}
