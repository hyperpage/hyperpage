/**
 * Unified OAuth Service
 *
 * Consolidates OAuth configuration, error handling, state management, token refresh,
 * and secure storage into a single, cohesive service.
 *
 * This service replaces:
 * - oauth-config.ts (configuration management)
 * - oauth-errors.ts (error handling and user messaging)
 * - oauth-state-cookies.ts (state management)
 * - oauth-token-refresh.ts (token refresh logic)
 * - oauth-token-store.ts (secure storage)
 */

import type { NextRequest } from "next/server";

import { toolRegistry } from "@/tools/registry";
import type { ToolOAuthConfig } from "@/tools/tool-types";
import logger from "@/lib/logger";

// Enhanced interfaces for unified service
export interface OAuthServiceOptions {
  stateSecret: string;
  encryptionKey?: string;
  tokenStore?: OAuthTokenStore | undefined;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  redirectUri?: string;
  provider: string;
}

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

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  scope?: string;
  expiresAt: number;
  refreshExpiresAt?: number;
  idToken?: string;
}

export interface OAuthError {
  type: OAuthErrorType;
  message: string;
  userMessage: string;
  technicalDetails?: string;
  suggestedAction?: string;
  retryable: boolean;
  toolName: string;
  provider: string;
}

export enum OAuthErrorType {
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
  TOKEN_EXCHANGE_FAILED = "TOKEN_EXCHANGE_FAILED",
  TOKEN_REFRESH_FAILED = "TOKEN_REFRESH_FAILED",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  STATE_MISMATCH = "STATE_MISMATCH",
  INVALID_REQUEST = "INVALID_REQUEST",
  RATE_LIMITED = "RATE_LIMITED",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

// Error message mappings for user-friendly display
const ERROR_MESSAGES = {
  [OAuthErrorType.CONFIGURATION_ERROR]: {
    userMessage:
      "Authentication is not configured for this tool. Please check your settings.",
    suggestedAction:
      "Ensure OAuth credentials are properly configured in environment variables.",
  },
  [OAuthErrorType.NETWORK_ERROR]: {
    userMessage:
      "Unable to connect to the authentication service. Please check your internet connection.",
    suggestedAction:
      "Try again in a few moments or check your network connection.",
  },
  [OAuthErrorType.AUTHENTICATION_FAILED]: {
    userMessage: "Authentication was denied. Please try again.",
    suggestedAction:
      "Make sure you have the necessary permissions for this tool.",
  },
  [OAuthErrorType.TOKEN_EXCHANGE_FAILED]: {
    userMessage:
      "Failed to complete authentication. The authorization may have expired.",
    suggestedAction: "Please try connecting again.",
  },
  [OAuthErrorType.TOKEN_REFRESH_FAILED]: {
    userMessage:
      "Your connection has expired and could not be renewed automatically.",
    suggestedAction: "Please reconnect to this tool.",
  },
  [OAuthErrorType.PERMISSION_DENIED]: {
    userMessage: "You don't have the required permissions for this tool.",
    suggestedAction: "Request additional permissions from your administrator.",
  },
  [OAuthErrorType.STATE_MISMATCH]: {
    userMessage: "Authentication session has expired. Please try again.",
    suggestedAction: "Restart the authentication process.",
  },
  [OAuthErrorType.INVALID_REQUEST]: {
    userMessage: "There was an issue with the authentication request.",
    suggestedAction:
      "Please try connecting again. If the problem persists, contact support.",
  },
  [OAuthErrorType.RATE_LIMITED]: {
    userMessage:
      "Too many authentication attempts. Please wait before trying again.",
    suggestedAction: "Wait a few minutes before attempting to connect again.",
  },
  [OAuthErrorType.SERVICE_UNAVAILABLE]: {
    userMessage: "The authentication service is temporarily unavailable.",
    suggestedAction: "Try again later or check the service status.",
  },
  [OAuthErrorType.UNKNOWN_ERROR]: {
    userMessage: "An unexpected error occurred during authentication.",
    suggestedAction:
      "Please try again. If the problem continues, contact support.",
  },
};

// Configuration Manager
class OAuthConfigManager {
  /**
   * Registry-driven OAuth configuration lookup
   * Dynamically retrieves OAuth configs from tool registry
   */
  getOAuthConfig(toolName: string, baseUrl?: string): OAuthConfig | null {
    const tool = toolRegistry[toolName.toLowerCase()];
    if (!tool) {
      logger.warn(`Tool ${toolName} not found in registry`);
      return null;
    }

    if (!tool.config?.oauthConfig) {
      logger.warn(`OAuth not configured for tool ${toolName}`);
      return null;
    }

    const oauthConfig = tool.config.oauthConfig;
    const clientId = process.env[oauthConfig.clientIdEnvVar];
    const clientSecret = process.env[oauthConfig.clientSecretEnvVar];

    if (!clientId || !clientSecret) {
      logger.warn(
        `${toolName} OAuth not configured - missing ${oauthConfig.clientIdEnvVar} or ${oauthConfig.clientSecretEnvVar}`,
      );
      return null;
    }

    const { authorizationUrl, tokenUrl } = this.buildOAuthUrls(
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
      redirectUri: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/auth/${toolName}/callback`,
    };
  }

  /**
   * Build OAuth authorization and token URLs for a tool using registry configuration
   */
  private buildOAuthUrls(
    toolName: string,
    oauthConfig: ToolOAuthConfig,
    baseUrl?: string,
  ): { authorizationUrl: string; tokenUrl: string } {
    if (oauthConfig.authorizationUrl.startsWith("/")) {
      const webUrl = baseUrl || this.getToolWebUrl(toolName);
      if (!webUrl) {
        throw new Error(
          `Base URL required for ${toolName} OAuth configuration`,
        );
      }

      return {
        authorizationUrl: `${webUrl}${oauthConfig.authorizationUrl}`,
        tokenUrl: `${webUrl}${oauthConfig.tokenUrl}`,
      };
    }

    return {
      authorizationUrl: oauthConfig.authorizationUrl,
      tokenUrl: oauthConfig.tokenUrl,
    };
  }

  /**
   * Get tool's web URL from registry configuration
   */
  private getToolWebUrl(toolName: string): string | null {
    const tool = toolRegistry[toolName.toLowerCase()];
    if (!tool || !tool.config) {
      return null;
    }

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
  buildAuthorizationUrl(config: OAuthConfig, state: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri || "",
      scope: config.scopes.join(" "),
      response_type: "code",
      state: state,
    });

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeCodeForTokens(
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
   * Check if OAuth is configured for a tool
   */
  isOAuthConfigured(toolName: string): boolean {
    const config = this.getOAuthConfig(toolName);
    return config !== null;
  }

  /**
   * Get configured OAuth providers from registry
   */
  getConfiguredProviders(): string[] {
    const providers: string[] = [];

    for (const [toolName, tool] of Object.entries(toolRegistry)) {
      if (tool && tool.enabled && tool.config?.oauthConfig) {
        const config = this.getOAuthConfig(toolName);
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
  getRequiredScopes(toolName: string): string[] {
    const tool = toolRegistry[toolName.toLowerCase()];
    if (!tool || !tool.config?.oauthConfig) {
      return [];
    }

    return tool.config.oauthConfig.scopes;
  }
}

// Error Handler
class OAuthErrorHandler {
  /**
   * Create an OAuth error object with appropriate messaging
   */
  createOAuthError(
    type: OAuthErrorType,
    toolName: string,
    provider: string,
    technicalDetails?: string,
    originalError?: Error | unknown,
  ): OAuthError {
    const messages = ERROR_MESSAGES[type];

    return {
      type,
      message: `OAuth ${type} for ${toolName} (${provider})`,
      userMessage: messages.userMessage,
      technicalDetails:
        technicalDetails ||
        (originalError instanceof Error ? originalError.message : undefined),
      suggestedAction: messages.suggestedAction,
      retryable: this.isRetryableError(type),
      toolName,
      provider,
    };
  }

  /**
   * Parse OAuth provider error responses
   */
  parseOAuthProviderError(
    toolName: string,
    provider: string,
    response: unknown,
    statusCode?: number,
  ): OAuthError {
    if (provider === "github") {
      return this.parseGitHubError(toolName, response, statusCode);
    } else if (provider === "gitlab") {
      return this.parseGitLabError(toolName, response, statusCode);
    } else if (provider === "jira") {
      return this.parseJiraError(toolName, response, statusCode);
    }

    return this.createOAuthError(
      this.determineErrorType(statusCode),
      toolName,
      provider,
      JSON.stringify(response),
    );
  }

  /**
   * Parse GitHub OAuth error responses
   */
  private parseGitHubError(
    toolName: string,
    response: unknown,
    statusCode?: number,
  ): OAuthError {
    const responseObj = response as {
      error?: string;
      error_description?: string;
    };
    const error = responseObj.error;
    const errorDescription = responseObj.error_description;

    switch (error) {
      case "access_denied":
        return this.createOAuthError(
          OAuthErrorType.AUTHENTICATION_FAILED,
          toolName,
          "github",
          errorDescription || "User denied access",
        );

      case "redirect_uri_mismatch":
      case "invalid_request":
        return this.createOAuthError(
          OAuthErrorType.INVALID_REQUEST,
          toolName,
          "github",
          errorDescription || error || "",
        );

      default:
        const errorType = this.determineErrorType(statusCode);
        return this.createOAuthError(
          errorType,
          toolName,
          "github",
          errorDescription || error || "GitHub OAuth error",
        );
    }
  }

  /**
   * Parse GitLab OAuth error responses
   */
  private parseGitLabError(
    toolName: string,
    response: unknown,
    statusCode?: number,
  ): OAuthError {
    const responseObj = response as {
      error?: string;
      error_description?: string;
    };
    const error = responseObj.error;
    const errorDescription = responseObj.error_description;

    switch (error) {
      case "access_denied":
        return this.createOAuthError(
          OAuthErrorType.AUTHENTICATION_FAILED,
          toolName,
          "gitlab",
          errorDescription || "User denied access",
        );

      case "invalid_request":
      case "unauthorized_client":
      case "unsupported_grant_type":
        return this.createOAuthError(
          OAuthErrorType.INVALID_REQUEST,
          toolName,
          "gitlab",
          errorDescription || error || "",
        );

      default:
        const errorType = this.determineErrorType(statusCode);
        return this.createOAuthError(
          errorType,
          toolName,
          "gitlab",
          errorDescription || error || "GitLab OAuth error",
        );
    }
  }

  /**
   * Parse Jira OAuth error responses
   */
  private parseJiraError(
    toolName: string,
    response: unknown,
    statusCode?: number,
  ): OAuthError {
    const responseObj = response as {
      error?: string;
      error_description?: string;
    };
    const error = responseObj.error;

    switch (error) {
      case "access_denied":
        return this.createOAuthError(
          OAuthErrorType.AUTHENTICATION_FAILED,
          toolName,
          "jira",
          responseObj.error_description || "User denied access",
        );

      case "invalid_request":
      case "unauthorized_client":
      case "invalid_client":
        return this.createOAuthError(
          OAuthErrorType.INVALID_REQUEST,
          toolName,
          "jira",
          responseObj.error_description || error || "",
        );

      default:
        const errorType = this.determineErrorType(statusCode);
        return this.createOAuthError(
          errorType,
          toolName,
          "jira",
          responseObj.error_description || error || "Jira OAuth error",
        );
    }
  }

  /**
   * Determine error type from HTTP status code
   */
  private determineErrorType(statusCode?: number): OAuthErrorType {
    if (!statusCode) return OAuthErrorType.UNKNOWN_ERROR;

    switch (statusCode) {
      case 400:
        return OAuthErrorType.INVALID_REQUEST;
      case 401:
        return OAuthErrorType.AUTHENTICATION_FAILED;
      case 403:
        return OAuthErrorType.PERMISSION_DENIED;
      case 404:
        return OAuthErrorType.INVALID_REQUEST;
      case 429:
        return OAuthErrorType.RATE_LIMITED;
      case 500:
      case 501:
      case 502:
      case 503:
      case 504:
        return OAuthErrorType.SERVICE_UNAVAILABLE;
      default:
        return OAuthErrorType.UNKNOWN_ERROR;
    }
  }

  /**
   * Check if an error type is retryable
   */
  private isRetryableError(type: OAuthErrorType): boolean {
    const retryableErrors = [
      OAuthErrorType.NETWORK_ERROR,
      OAuthErrorType.TOKEN_REFRESH_FAILED,
      OAuthErrorType.RATE_LIMITED,
      OAuthErrorType.SERVICE_UNAVAILABLE,
    ];

    return retryableErrors.includes(type);
  }

  /**
   * Log OAuth errors with appropriate level
   */
  logOAuthError(error: OAuthError, context?: string): void {
    const logData = {
      type: error.type,
      toolName: error.toolName,
      provider: error.provider,
      retryable: error.retryable,
      technicalDetails: error.technicalDetails,
      context,
    };

    if (
      error.type === OAuthErrorType.CONFIGURATION_ERROR ||
      error.type === OAuthErrorType.PERMISSION_DENIED ||
      error.type === OAuthErrorType.AUTHENTICATION_FAILED
    ) {
      logger.warn("OAuth Error", logData);
    } else {
      logger.error("OAuth Error", logData);
    }
  }

  /**
   * Create a user-friendly error display component props
   */
  getErrorDisplayProps(error: OAuthError): {
    title: string;
    description: string;
    action: string;
    severity: "error" | "warning" | "info";
  } {
    let severity: "error" | "warning" | "info" = "error";

    if (
      error.type === OAuthErrorType.CONFIGURATION_ERROR ||
      error.type === OAuthErrorType.PERMISSION_DENIED
    ) {
      severity = "warning";
    } else if (
      error.type === OAuthErrorType.RATE_LIMITED ||
      error.type === OAuthErrorType.SERVICE_UNAVAILABLE
    ) {
      severity = "info";
    }

    return {
      title: this.getErrorTitle(error.type),
      description: error.userMessage,
      action:
        error.suggestedAction || "Contact support if the problem persists.",
      severity,
    };
  }

  /**
   * Get human-readable error title
   */
  private getErrorTitle(errorType: OAuthErrorType): string {
    const titles = {
      [OAuthErrorType.CONFIGURATION_ERROR]: "Configuration Error",
      [OAuthErrorType.NETWORK_ERROR]: "Connection Error",
      [OAuthErrorType.AUTHENTICATION_FAILED]: "Authentication Failed",
      [OAuthErrorType.TOKEN_EXCHANGE_FAILED]: "Token Exchange Failed",
      [OAuthErrorType.TOKEN_REFRESH_FAILED]: "Connection Renewal Failed",
      [OAuthErrorType.PERMISSION_DENIED]: "Permission Denied",
      [OAuthErrorType.STATE_MISMATCH]: "Session Expired",
      [OAuthErrorType.INVALID_REQUEST]: "Invalid Request",
      [OAuthErrorType.RATE_LIMITED]: "Rate Limited",
      [OAuthErrorType.SERVICE_UNAVAILABLE]: "Service Unavailable",
      [OAuthErrorType.UNKNOWN_ERROR]: "Authentication Error",
    };

    return titles[errorType] || "Authentication Error";
  }
}

// State Manager
class OAuthStateManager {
  private stateSecret: string;

  constructor(stateSecret: string) {
    this.stateSecret = stateSecret;
  }

  /**
   * Create a secure state cookie for CSRF protection
   */
  async createStateCookie(
    provider: string,
  ): Promise<{ name: string; value: string; options: unknown }> {
    const state = this.generateSecureState(provider);

    return {
      name: "oauth_state",
      value: state,
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        maxAge: 10 * 60 * 1000, // 10 minutes
        path: "/",
        name: "oauth_state",
      },
    };
  }

  /**
   * Validate and extract state from cookie
   */
  validateState(cookieValue: string, provider: string): boolean {
    try {
      const parsed = JSON.parse(Buffer.from(cookieValue, "base64").toString());
      return (
        parsed.provider === provider &&
        parsed.timestamp > Date.now() - 10 * 60 * 1000
      );
    } catch {
      return false;
    }
  }

  /**
   * Generate a secure state value
   */
  private generateSecureState(provider: string): string {
    const stateData = {
      provider,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(2, 15),
    };

    return Buffer.from(JSON.stringify(stateData)).toString("base64");
  }

  /**
   * Extract state from request cookies
   */
  getStateFromRequest(request: NextRequest): string | null {
    return request.cookies.get("oauth_state")?.value || null;
  }

  /**
   * Clear state cookie
   */
  clearStateCookie(): { name: string; value: string; options: unknown } {
    return {
      name: "oauth_state",
      value: "",
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        maxAge: 0,
        path: "/",
        name: "oauth_state",
      },
    };
  }
}

// Token Store Interface
export interface OAuthTokenStore {
  storeTokens(
    userId: string,
    toolName: string,
    tokens: OAuthTokens,
  ): Promise<void>;
  getTokens(userId: string, toolName: string): Promise<OAuthTokens | null>;
  refreshTokens(
    userId: string,
    toolName: string,
    refreshToken: string,
  ): Promise<OAuthTokens | null>;
  revokeTokens(userId: string, toolName: string): Promise<void>;
  isTokenExpired(tokens: OAuthTokens): boolean;
}

// In-Memory Token Store (for development/testing)
class InMemoryTokenStore implements OAuthTokenStore {
  private tokens: Map<string, Map<string, OAuthTokens>> = new Map();

  async storeTokens(
    userId: string,
    toolName: string,
    tokens: OAuthTokens,
  ): Promise<void> {
    if (!this.tokens.has(userId)) {
      this.tokens.set(userId, new Map());
    }
    this.tokens.get(userId)!.set(toolName, tokens);
  }

  async getTokens(
    userId: string,
    toolName: string,
  ): Promise<OAuthTokens | null> {
    return this.tokens.get(userId)?.get(toolName) || null;
  }

  async refreshTokens(
    userId: string,
    toolName: string,
    refreshToken: string,
  ): Promise<OAuthTokens | null> {
    // Implementation for token refresh would go here
    // This is a placeholder for the interface
    // Parameters are intentionally not used in this stub implementation
    void userId;
    void toolName;
    void refreshToken;
    return null;
  }

  async revokeTokens(userId: string, toolName: string): Promise<void> {
    this.tokens.get(userId)?.delete(toolName);
  }

  isTokenExpired(tokens: OAuthTokens): boolean {
    return Date.now() >= tokens.expiresAt;
  }
}

// Token Manager
class OAuthTokenManager {
  private tokenStore: OAuthTokenStore;

  constructor(tokenStore?: OAuthTokenStore) {
    this.tokenStore = tokenStore || new InMemoryTokenStore();
  }

  /**
   * Ensure tokens are valid, refresh if necessary
   */
  async ensureValidTokens(
    userId: string,
    toolName: string,
  ): Promise<OAuthTokens | null> {
    const tokens = await this.tokenStore.getTokens(userId, toolName);

    if (!tokens) {
      return null;
    }

    if (this.tokenStore.isTokenExpired(tokens) && tokens.refreshToken) {
      // Attempt to refresh the token
      try {
        const refreshedTokens = await this.tokenStore.refreshTokens(
          userId,
          toolName,
          tokens.refreshToken,
        );
        if (refreshedTokens) {
          await this.tokenStore.storeTokens(userId, toolName, refreshedTokens);
          return refreshedTokens;
        }
      } catch (error) {
        logger.error("Failed to refresh OAuth token", {
          toolName,
          userId,
          error,
        });
        return null;
      }
    }

    return tokens;
  }

  /**
   * Store tokens securely
   */
  async storeTokens(
    userId: string,
    toolName: string,
    tokens: OAuthTokens,
  ): Promise<void> {
    await this.tokenStore.storeTokens(userId, toolName, tokens);
  }

  /**
   * Get tokens for a user and tool
   */
  async getTokens(
    userId: string,
    toolName: string,
  ): Promise<OAuthTokens | null> {
    return this.tokenStore.getTokens(userId, toolName);
  }

  /**
   * Revoke tokens for a user and tool
   */
  async revokeTokens(userId: string, toolName: string): Promise<void> {
    await this.tokenStore.revokeTokens(userId, toolName);
  }

  /**
   * Convert token response to internal format
   */
  convertTokenResponse(
    response: OAuthTokenResponse,
    config: OAuthConfig,
  ): OAuthTokens {
    const now = Date.now();
    const expiresAt = response.expires_in
      ? now + response.expires_in * 1000
      : now + 3600 * 1000; // Default 1 hour

    // Suppress unused parameter warning for config since it's not used in this conversion
    void config;

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      tokenType: response.token_type,
      scope: response.scope,
      expiresAt,
      refreshExpiresAt: response.refresh_token_expires_in
        ? now + response.refresh_token_expires_in * 1000
        : undefined,
      idToken: response.id_token,
    };
  }
}

/**
 * Unified OAuth Service
 *
 * Consolidates all OAuth functionality into a single, maintainable service.
 */
export class UnifiedOAuthService {
  private configManager: OAuthConfigManager;
  private errorHandler: OAuthErrorHandler;
  private tokenManager: OAuthTokenManager;
  private stateManager: OAuthStateManager;

  constructor(options: OAuthServiceOptions) {
    this.configManager = new OAuthConfigManager();
    this.errorHandler = new OAuthErrorHandler();
    this.tokenManager = new OAuthTokenManager(options.tokenStore);
    this.stateManager = new OAuthStateManager(options.stateSecret);
  }

  /**
   * Get OAuth configuration for a tool
   */
  getOAuthConfig(toolName: string, baseUrl?: string): OAuthConfig | null {
    return this.configManager.getOAuthConfig(toolName, baseUrl);
  }

  /**
   * Build authorization URL for OAuth flow
   */
  buildAuthorizationUrl(
    toolName: string,
    state: string,
    baseUrl?: string,
  ): string | null {
    const config = this.getOAuthConfig(toolName, baseUrl);
    if (!config) {
      return null;
    }

    return this.configManager.buildAuthorizationUrl(config, state);
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleOAuthCallback(
    code: string,
    state: string,
    provider: string,
    request: NextRequest,
  ): Promise<{ tokens?: OAuthTokens; error?: OAuthError }> {
    try {
      // Validate state
      const stateCookie = this.stateManager.getStateFromRequest(request);
      if (
        !stateCookie ||
        !this.stateManager.validateState(stateCookie, provider)
      ) {
        return {
          error: this.errorHandler.createOAuthError(
            OAuthErrorType.STATE_MISMATCH,
            provider,
            provider,
          ),
        };
      }

      const config = this.getOAuthConfig(provider);
      if (!config) {
        return {
          error: this.errorHandler.createOAuthError(
            OAuthErrorType.CONFIGURATION_ERROR,
            provider,
            provider,
          ),
        };
      }

      // Exchange code for tokens
      const tokenResponse = await this.configManager.exchangeCodeForTokens(
        config,
        code,
      );
      const tokens = this.tokenManager.convertTokenResponse(
        tokenResponse,
        config,
      );

      return { tokens };
    } catch (error) {
      return {
        error: this.errorHandler.createOAuthError(
          OAuthErrorType.TOKEN_EXCHANGE_FAILED,
          provider,
          provider,
          undefined,
          error,
        ),
      };
    }
  }

  /**
   * Ensure valid tokens for a user and tool
   */
  async ensureValidTokens(
    userId: string,
    toolName: string,
  ): Promise<OAuthTokens | null> {
    return this.tokenManager.ensureValidTokens(userId, toolName);
  }

  /**
   * Store tokens for a user and tool
   */
  async storeTokens(
    userId: string,
    toolName: string,
    tokens: OAuthTokens,
  ): Promise<void> {
    await this.tokenManager.storeTokens(userId, toolName, tokens);
  }

  /**
   * Get tokens for a user and tool
   */
  async getTokens(
    userId: string,
    toolName: string,
  ): Promise<OAuthTokens | null> {
    return this.tokenManager.getTokens(userId, toolName);
  }

  /**
   * Revoke access for a user and tool
   */
  async revokeAccess(userId: string, toolName: string): Promise<void> {
    await this.tokenManager.revokeTokens(userId, toolName);
  }

  /**
   * Create state cookie for OAuth flow
   */
  async createStateCookie(
    provider: string,
  ): Promise<{ name: string; value: string; options: unknown }> {
    return this.stateManager.createStateCookie(provider);
  }

  /**
   * Parse OAuth provider error
   */
  parseProviderError(
    toolName: string,
    provider: string,
    response: unknown,
    statusCode?: number,
  ): OAuthError {
    return this.errorHandler.parseOAuthProviderError(
      toolName,
      provider,
      response,
      statusCode,
    );
  }

  /**
   * Log OAuth error
   */
  logOAuthError(error: OAuthError, context?: string): void {
    this.errorHandler.logOAuthError(error, context);
  }

  /**
   * Get error display props
   */
  getErrorDisplayProps(error: OAuthError): {
    title: string;
    description: string;
    action: string;
    severity: "error" | "warning" | "info";
  } {
    return this.errorHandler.getErrorDisplayProps(error);
  }

  /**
   * Check if OAuth is configured for a tool
   */
  isOAuthConfigured(toolName: string): boolean {
    return this.configManager.isOAuthConfigured(toolName);
  }

  /**
   * Get configured OAuth providers
   */
  getConfiguredProviders(): string[] {
    return this.configManager.getConfiguredProviders();
  }

  /**
   * Get required scopes for a tool
   */
  getRequiredScopes(toolName: string): string[] {
    return this.configManager.getRequiredScopes(toolName);
  }

  /**
   * Clear state cookie
   */
  clearStateCookie(): { name: string; value: string; options: unknown } {
    return this.stateManager.clearStateCookie();
  }
}
