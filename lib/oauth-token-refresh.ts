import { SecureTokenStorage, OAuthTokens } from "./oauth-token-store";
import { getOAuthConfig } from "./oauth-config";
import logger from "./logger";

/**
 * OAuth Token Refresh Management
 * Handles automatic token refresh for seamless user experience
 */
export class OAuthTokenRefresh {
  private tokenStorage: SecureTokenStorage;

  constructor(tokenStorage?: SecureTokenStorage) {
    this.tokenStorage = tokenStorage || new SecureTokenStorage();
  }

  /**
   * Check and refresh tokens if needed for a user-tool pair
   */
  async ensureValidTokens(
    userId: string,
    toolName: string,
  ): Promise<OAuthTokens | null> {
    try {
      const tokens = await this.tokenStorage.getTokens(userId, toolName);

      if (!tokens) {
        logger.debug(`No tokens found for user ${userId}, tool ${toolName}`);
        return null;
      }

      // Check if tokens are expired
      if (this.tokenStorage.areExpired(tokens)) {
        logger.info(`Tokens expired for user ${userId}, tool ${toolName}`);

        // Try to refresh using refresh token
        const refreshedTokens = await this.refreshTokens(
          userId,
          toolName,
          tokens,
        );

        if (refreshedTokens) {
          logger.info(
            `Successfully refreshed tokens for user ${userId}, tool ${toolName}`,
          );
          return refreshedTokens;
        } else {
          logger.warn(
            `Failed to refresh tokens for user ${userId}, tool ${toolName}`,
          );
          // Remove expired tokens that couldn't be refreshed
          await this.tokenStorage.removeTokens(userId, toolName);
          return null;
        }
      }

      // Check if tokens need preemptive refresh (within 5 minutes of expiry)
      if (this.tokenStorage.shouldRefresh(tokens)) {
        logger.info(
          `Tokens need refresh (preemptive) for user ${userId}, tool ${toolName}`,
        );

        try {
          const refreshedTokens = await this.refreshTokens(
            userId,
            toolName,
            tokens,
          );
          if (refreshedTokens) {
            logger.info(
              `Successfully refreshed tokens preemptively for user ${userId}, tool ${toolName}`,
            );
            return refreshedTokens;
          }
        } catch (error) {
          logger.warn(
            `Preemptive refresh failed for user ${userId}, tool ${toolName}, will use existing tokens for now:`,
            error,
          );
        }
      }

      return tokens;
    } catch (error) {
      logger.error(
        `Error ensuring valid tokens for user ${userId}, tool ${toolName}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Refresh tokens using refresh token
   */
  private async refreshTokens(
    userId: string,
    toolName: string,
    currentTokens: OAuthTokens,
  ): Promise<OAuthTokens | null> {
    try {
      if (!currentTokens.refreshToken) {
        logger.warn(
          `No refresh token available for user ${userId}, tool ${toolName}`,
        );
        return null;
      }

      // Check if refresh token is expired
      if (this.tokenStorage.isRefreshExpired(currentTokens)) {
        logger.warn(
          `Refresh token expired for user ${userId}, tool ${toolName}`,
        );
        return null;
      }

      const config = getOAuthConfig(toolName);
      if (!config) {
        logger.error(`No OAuth config found for tool ${toolName}`);
        return null;
      }

      // Use refresh token to get new access token
      const newTokens = await this.performTokenRefresh(
        config,
        currentTokens.refreshToken,
      );

      if (newTokens) {
        // Calculate expiry times if not provided
        const now = Date.now();
        const accessTokenExpiry = newTokens.expiresAt || now + 3600 * 1000; // 1 hour default
        const refreshTokenExpiry =
          newTokens.refreshExpiresAt ||
          (currentTokens.refreshExpiresAt &&
          currentTokens.refreshExpiresAt > now
            ? currentTokens.refreshExpiresAt
            : now + 30 * 24 * 60 * 60 * 1000); // 30 days default

        const tokensToStore: OAuthTokens = {
          ...newTokens,
          expiresAt: accessTokenExpiry,
          refreshExpiresAt: refreshTokenExpiry,
        };

        // Store refreshed tokens
        await this.tokenStorage.storeTokens(userId, toolName, tokensToStore);
        await this.tokenStorage.updateTokenExpiry(
          userId,
          toolName,
          accessTokenExpiry,
          refreshTokenExpiry,
        );

        return tokensToStore;
      }

      return null;
    } catch (error) {
      logger.error(
        `Token refresh failed for user ${userId}, tool ${toolName}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Perform the actual token refresh API call
   */
  private async performTokenRefresh(
    config: {
      clientId: string;
      clientSecret: string;
      tokenUrl: string;
      provider: string;
    },
    refreshToken: string,
  ): Promise<OAuthTokens | null> {
    try {
      // Prepare refresh request
      const params = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      });

      const response = await fetch(config.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `Token refresh request failed for ${config.provider}: ${response.status}`,
          errorText,
        );
        throw new Error(`Refresh request failed: ${response.status}`);
      }

      const refreshData = await response.json();

      if (refreshData.error) {
        logger.error(
          `Token refresh response error for ${config.provider}:`,
          refreshData.error,
        );
        throw new Error(`Refresh response error: ${refreshData.error}`);
      }

      // Convert response to our OAuthTokens format
      const newTokens: OAuthTokens = {
        accessToken: refreshData.access_token,
        refreshToken: refreshData.refresh_token || refreshToken, // Use new token or keep existing
        tokenType: refreshData.token_type || "Bearer",
        scopes: refreshData.scope ? refreshData.scope.split(" ") : undefined,
        metadata: {
          ...refreshData,
          refresh_timestamp: Date.now(),
        },
      };

      // Calculate absolute expiry times if relative times are provided
      const now = Date.now();
      if (refreshData.expires_in) {
        newTokens.expiresAt = now + refreshData.expires_in * 1000;
      }

      logger.info(`Token refresh successful for ${config.provider}`);
      return newTokens;
    } catch (error) {
      logger.error(
        `Token refresh API call failed for ${config.provider}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Batch refresh all expired tokens
   * Useful for background processing or admin maintenance
   */
  async refreshExpiredTokens(): Promise<{
    successful: number;
    failed: number;
  }> {
    try {
      const expiredTokens = await this.tokenStorage.getExpiredTokens();
      let successful = 0;
      let failed = 0;

      logger.info(
        `Starting batch refresh of ${expiredTokens.length} expired tokens`,
      );

      for (const { userId, toolName } of expiredTokens) {
        try {
          await this.ensureValidTokens(userId, toolName);
          successful++;
        } catch (error) {
          logger.error(
            `Batch refresh failed for user ${userId}, tool ${toolName}:`,
            error,
          );
          failed++;
        }
      }

      logger.info(
        `Batch refresh completed: ${successful} successful, ${failed} failed`,
      );
      return { successful, failed };
    } catch (error) {
      logger.error("Batch token refresh failed:", error);
      return { successful: 0, failed: 0 };
    }
  }

  /**
   * Get token expiry information for monitoring
   */
  async getTokenExpiryInfo(
    userId: string,
    toolName: string,
  ): Promise<{
    accessTokenExpiry?: number;
    refreshTokenExpiry?: number;
    shouldRefresh: boolean;
    isExpired: boolean;
  } | null> {
    const tokens = await this.tokenStorage.getTokens(userId, toolName);

    if (!tokens) {
      return null;
    }

    return {
      accessTokenExpiry: tokens.expiresAt,
      refreshTokenExpiry: tokens.refreshExpiresAt,
      shouldRefresh: this.tokenStorage.shouldRefresh(tokens),
      isExpired: this.tokenStorage.areExpired(tokens),
    };
  }
}

/**
 * Global token refresh manager singleton
 */
export const tokenRefreshManager = new OAuthTokenRefresh();

/**
 * Utility function to get valid tokens with automatic refresh
 */
export async function getValidTokens(
  userId: string,
  toolName: string,
): Promise<OAuthTokens | null> {
  return tokenRefreshManager.ensureValidTokens(userId, toolName);
}

/**
 * Background token refresh process
 * Can be called periodically to maintain valid tokens
 */
export async function performBackgroundTokenRefresh(): Promise<void> {
  logger.info("Starting background token refresh process");

  const result = await tokenRefreshManager.refreshExpiredTokens();

  if (result.successful > 0 || result.failed > 0) {
    logger.info(
      `Background token refresh completed: ${result.successful} refreshed, ${result.failed} failed`,
    );
  }
}
