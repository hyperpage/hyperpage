/**
 * OAuth Configuration for supported tools
 * Uses tool registry for dynamic OAuth configurations
 */

import logger from "./logger";
import { toolRegistry } from "../tools/registry";
import { ToolOAuthConfig } from "../tools/tool-types";

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  redirectUri?: string; // Optional, can be constructed dynamically
  provider: string; // Made extensible - any string instead of hardcoded union
}

/**
 * OAuth token response interface
 */
export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  id_token?: string;
  error?: string;
  error_description?: string;
}

/**
 * Registry-driven OAuth configuration lookup
 * Dynamically retrieves OAuth configs from tool registry
 */
export function getOAuthConfig(
  toolName: string,
  baseUrl?: string,
): OAuthConfig | null {
  // Get tool from registry
  const tool = toolRegistry[toolName.toLowerCase()];

  if (!tool) {
    logger.warn(`Tool ${toolName} not found in registry`);
    return null;
  }

  // Check if tool has OAuth configuration
  if (!tool.config?.oauthConfig) {
    logger.warn(`OAuth not configured for tool ${toolName}`);
    return null;
  }

  const oauthConfig = tool.config.oauthConfig;

  // Get environment variables for this tool using registry-configured names
  const clientId = process.env[oauthConfig.clientIdEnvVar];
  const clientSecret = process.env[oauthConfig.clientSecretEnvVar];

  if (!clientId || !clientSecret) {
    logger.warn(
      `${toolName} OAuth not configured - missing ${oauthConfig.clientIdEnvVar} or ${oauthConfig.clientSecretEnvVar}`,
    );
    return null;
  }

  // Build OAuth URLs - some tools need base URL formatting (like Jira)
  const { authorizationUrl, tokenUrl } = buildOAuthUrls(
    toolName,
    oauthConfig,
    baseUrl,
  );

  return {
    clientId,
    clientSecret,
    authorizationUrl,
    tokenUrl,
    scopes: oauthConfig.scopes,
    provider: toolName.toLowerCase(),
    redirectUri: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/auth/${toolName}/callback`,
  };
}

/**
 * Build OAuth authorization and token URLs for a tool using registry configuration
 */
function buildOAuthUrls(
  toolName: string,
  oauthConfig: ToolOAuthConfig,
  baseUrl?: string,
): { authorizationUrl: string; tokenUrl: string } {
  // For tools with relative URLs (like Jira), we need to format with base URL
  if (oauthConfig.authorizationUrl.startsWith("/")) {
    // This is a relative URL that needs base URL formatting
    const webUrl = baseUrl || getToolWebUrl(toolName);
    if (!webUrl) {
      throw new Error(`Base URL required for ${toolName} OAuth configuration`);
    }

    return {
      authorizationUrl: `${webUrl}${oauthConfig.authorizationUrl}`,
      tokenUrl: `${webUrl}${oauthConfig.tokenUrl}`,
    };
  }

  // For tools with absolute URLs (like GitHub, GitLab), use as-is
  return {
    authorizationUrl: oauthConfig.authorizationUrl,
    tokenUrl: oauthConfig.tokenUrl,
  };
}

/**
 * Get tool's web URL from registry configuration
 */
function getToolWebUrl(toolName: string): string | null {
  const tool = toolRegistry[toolName.toLowerCase()];
  if (!tool || !tool.config) {
    return null;
  }

  // Try to get web URL from tool configuration
  return (
    tool.config.getWebUrl?.() ||
    tool.config.webUrl ||
    process.env[`${toolName.toUpperCase()}_WEB_URL`] ||
    null
  );
}

/**
 * Build authorization URL for OAuth 2.0 flow
 */
export function buildAuthorizationUrl(
  config: OAuthConfig,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri || "",
    scope: config.scopes.join(" "),
    response_type: "code",
    state: state, // CSRF protection
  });

  return `${config.authorizationUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access tokens
 */
export async function exchangeCodeForTokens(
  config: OAuthConfig,
  code: string,
): Promise<OAuthTokenResponse> {
  const tokenUrl = config.tokenUrl;
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: code,
    grant_type: "authorization_code",
  });

  // Add redirect_uri for providers that require it (GitLab, some others)
  if (config.redirectUri) {
    params.append("redirect_uri", config.redirectUri);
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`OAuth token exchange failed for ${config.provider}:`, {
      status: response.status,
      error: errorText,
    });
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  const tokenData = await response.json();

  if (tokenData.error) {
    logger.error(`OAuth response error for ${config.provider}:`, {
      error: tokenData.error,
    });
    throw new Error(`Token response error: ${tokenData.error}`);
  }

  return tokenData as OAuthTokenResponse;
}

/**
 * Validate if OAuth is configured for a tool
 */
export function isOAuthConfigured(toolName: string): boolean {
  const config = getOAuthConfig(toolName);
  return config !== null;
}

/**
 * Get configured OAuth providers from registry
 */
export function getConfiguredProviders(): string[] {
  const providers: string[] = [];

  // Check each tool in registry for OAuth configuration
  for (const [toolName, tool] of Object.entries(toolRegistry)) {
    if (tool && tool.enabled && tool.config?.oauthConfig) {
      const config = getOAuthConfig(toolName);
      if (config) {
        providers.push(toolName);
      }
    }
  }

  return providers;
}

/**
 * Get required OAuth scopes for a tool
 */
export function getRequiredScopes(toolName: string): string[] {
  const tool = toolRegistry[toolName.toLowerCase()];
  if (!tool || !tool.config?.oauthConfig) {
    return [];
  }

  return tool.config.oauthConfig.scopes;
}
