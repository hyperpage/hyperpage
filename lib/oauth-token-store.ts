import logger from "@/lib/logger";
import {
  getOAuthTokenRepository,
  type OAuthTokenRepository,
  type OAuthTokens as RepoOAuthTokens,
} from "@/lib/database/oauth-token-repository";

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: number; // milliseconds timestamp
  refreshExpiresAt?: number; // refresh token expiry
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

export interface StoredTokens extends OAuthTokens {
  id: number;
  userId: string;
  toolName: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Secure OAuth token storage facade.
 *
 * This class is kept for backwards compatibility but now delegates to the
 * canonical OAuthTokenRepository, which encapsulates AES-256-GCM handling and
 * dual-engine behavior (SQLite/Postgres).
 *
 * Public API is preserved; internal persistence is repository-driven.
 */
export class SecureTokenStorage {
  private readonly repo: OAuthTokenRepository;

  constructor() {
    try {
      this.repo = getOAuthTokenRepository();
      logger.info(
        "SecureTokenStorage initialized via OAuthTokenRepository facade",
      );
    } catch (error) {
      logger.error("Failed to initialize secure token storage", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Store OAuth tokens for a user-tool pair.
   * Encryption and persistence are handled by OAuthTokenRepository.
   */
  async storeTokens(
    userId: string,
    toolName: string,
    tokens: OAuthTokens,
  ): Promise<void> {
    try {
      const repoTokens: RepoOAuthTokens = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: tokens.tokenType,
        expiresAt: tokens.expiresAt,
        refreshExpiresAt: tokens.refreshExpiresAt,
        scopes: tokens.scopes,
        metadata: tokens.metadata,
      };

      await this.repo.storeTokens(userId, toolName, repoTokens);

      logger.info("Stored OAuth tokens", { userId, toolName });
    } catch (error) {
      logger.error("Failed to store OAuth tokens", {
        error: error instanceof Error ? error.message : String(error),
        userId,
        toolName,
      });
      throw new Error("Token storage failed");
    }
  }

  /**
   * Retrieve OAuth tokens for a user-tool pair.
   * Returned shape matches the facade's OAuthTokens interface.
   */
  async getTokens(
    userId: string,
    toolName: string,
  ): Promise<OAuthTokens | null> {
    try {
      const stored = await this.repo.getTokens(userId, toolName);
      if (!stored) {
        return null;
      }

      return {
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken,
        tokenType: stored.tokenType,
        expiresAt: stored.expiresAt,
        refreshExpiresAt: stored.refreshExpiresAt,
        scopes: stored.scopes,
        metadata: stored.metadata,
      };
    } catch (error) {
      logger.error("Failed to retrieve OAuth tokens", {
        error: error instanceof Error ? error.message : String(error),
        userId,
        toolName,
      });
      return null;
    }
  }

  /**
   * Determine if tokens should be proactively refreshed.
   * Threshold: expires within 5 minutes.
   */
  shouldRefresh(tokens: OAuthTokens): boolean {
    if (!tokens.expiresAt) {
      return false;
    }
    const refreshThresholdMs = 5 * 60 * 1000;
    return tokens.expiresAt - Date.now() < refreshThresholdMs;
  }

  /**
   * Check if access token is expired.
   */
  areExpired(tokens: OAuthTokens): boolean {
    if (!tokens.expiresAt) {
      return false;
    }
    return tokens.expiresAt <= Date.now();
  }

  /**
   * Check if refresh token is expired.
   * If no refresh expiry is present, treat as expired.
   */
  isRefreshExpired(tokens: OAuthTokens): boolean {
    if (!tokens.refreshExpiresAt) {
      return true;
    }
    return tokens.refreshExpiresAt <= Date.now();
  }

  /**
   * Remove stored tokens for a user-tool pair.
   */
  async removeTokens(userId: string, toolName: string): Promise<void> {
    try {
      await this.repo.removeTokens(userId, toolName);
      logger.info("Removed OAuth tokens", { userId, toolName });
    } catch (error) {
      logger.error("Failed to remove OAuth tokens", {
        error: error instanceof Error ? error.message : String(error),
        userId,
        toolName,
      });
      throw new Error("Token removal failed");
    }
  }

  /**
   * Update expiry information for stored tokens.
   */
  async updateTokenExpiry(
    userId: string,
    toolName: string,
    expiresAt: number,
    refreshExpiresAt?: number,
  ): Promise<void> {
    try {
      await this.repo.updateTokenExpiry(
        userId,
        toolName,
        expiresAt,
        refreshExpiresAt,
      );

      logger.debug("Updated token expiry", {
        userId,
        toolName,
      });
    } catch (error) {
      logger.error("Failed to update token expiry", {
        error: error instanceof Error ? error.message : String(error),
        userId,
        toolName,
      });
      throw new Error("Token expiry update failed");
    }
  }

  /**
   * Get identifiers of expired tokens.
   */
  async getExpiredTokens(): Promise<
    Array<{ userId: string; toolName: string }>
  > {
    try {
      return this.repo.getExpiredTokens();
    } catch (error) {
      logger.error("Failed to get expired tokens", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Cleanup expired tokens, returning the number of rows affected.
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const rowsAffected = await this.repo.cleanupExpiredTokens();

      logger.info("Cleaned up expired OAuth tokens", { rowsAffected });

      return rowsAffected;
    } catch (error) {
      logger.error("Failed to cleanup expired tokens", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }
}
