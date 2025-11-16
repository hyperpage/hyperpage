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

interface LegacyTokenRecord {
  userId: string;
  toolName: string;
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  expiresAt: number | null;
  refreshExpiresAt: number | null;
  scopes: string | null;
  metadata: string | null;
  ivAccess?: string | null;
  ivRefresh?: string | null;
  createdAt?: number;
  updatedAt?: number;
}

interface LegacyOAuthTokenRepository {
  upsertToken?: (record: LegacyTokenRecord) => Promise<void>;
  getToken?: (
    userId: string,
    toolName: string,
  ) => Promise<LegacyTokenRecord | null>;
  deleteToken?: (userId: string, toolName: string) => Promise<unknown>;
}

type RepositoryLike = {
  storeTokens?: OAuthTokenRepository["storeTokens"];
  getTokens?: OAuthTokenRepository["getTokens"];
  removeTokens?: OAuthTokenRepository["removeTokens"];
  updateTokenExpiry?: OAuthTokenRepository["updateTokenExpiry"];
  getExpiredTokens?: OAuthTokenRepository["getExpiredTokens"];
  cleanupExpiredTokens?: OAuthTokenRepository["cleanupExpiredTokens"];
} & LegacyOAuthTokenRepository;

const LEGACY_IV_VALUE = "legacy-compat-iv";

/**
 * Secure OAuth token storage facade.
 *
 * This class delegates to the canonical OAuthTokenRepository, which encapsulates
 * AES-256-GCM handling and the PostgreSQL persistence layer.
 *
 * Public API is preserved; internal persistence is repository-driven.
 */
export class SecureTokenStorage {
  private readonly repo: RepositoryLike;

  constructor() {
    try {
      this.repo = getOAuthTokenRepository() as RepositoryLike;
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

      const storeFn = this.repo.storeTokens;
      if (typeof storeFn === "function") {
        await storeFn.call(this.repo, userId, toolName, repoTokens);
      } else if (typeof this.repo.upsertToken === "function") {
        await this.repo.upsertToken(
          this.buildLegacyRecord(userId, toolName, tokens),
        );
      } else {
        throw new Error("OAuth token repository missing store capability");
      }

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
      const getFn = this.repo.getTokens;

      if (typeof getFn === "function") {
        const stored = await getFn.call(this.repo, userId, toolName);
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
      }

      if (typeof this.repo.getToken === "function") {
        const legacyRecord = await this.repo.getToken(userId, toolName);
        if (!legacyRecord) {
          return null;
        }

        return this.mapLegacyRecordToTokens(legacyRecord);
      }

      return null;
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
      const removeFn = this.repo.removeTokens;
      if (typeof removeFn === "function") {
        await removeFn.call(this.repo, userId, toolName);
      } else if (typeof this.repo.deleteToken === "function") {
        await this.repo.deleteToken(userId, toolName);
      } else {
        throw new Error("OAuth token repository missing remove capability");
      }

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
      const updateFn = this.repo.updateTokenExpiry;
      if (typeof updateFn === "function") {
        await updateFn.call(
          this.repo,
          userId,
          toolName,
          expiresAt,
          refreshExpiresAt,
        );

        logger.debug("Updated token expiry", {
          userId,
          toolName,
        });
        return;
      }

      if (typeof this.repo.upsertToken === "function") {
        const existing =
          typeof this.repo.getToken === "function"
            ? await this.repo.getToken(userId, toolName)
            : null;

        if (!existing) {
          throw new Error("Cannot update expiry for missing token");
        }

        const updatedRecord: LegacyTokenRecord = {
          ...existing,
          expiresAt,
          refreshExpiresAt:
            typeof refreshExpiresAt === "number"
              ? refreshExpiresAt
              : existing.refreshExpiresAt,
          updatedAt: Date.now(),
        };

        await this.repo.upsertToken(updatedRecord);
        logger.debug("Updated token expiry via legacy adapter", {
          userId,
          toolName,
        });
        return;
      }

      throw new Error("OAuth token repository lacks expiry capability");
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
      const fn = this.repo.getExpiredTokens;
      if (typeof fn === "function") {
        return fn.call(this.repo);
      }
      logger.warn(
        "OAuth token repository missing getExpiredTokens implementation",
      );
      return [];
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
      const fn = this.repo.cleanupExpiredTokens;
      if (typeof fn !== "function") {
        logger.warn(
          "OAuth token repository missing cleanupExpiredTokens implementation",
        );
        return 0;
      }
      const rowsAffected = await fn.call(this.repo);

      logger.info("Cleaned up expired OAuth tokens", { rowsAffected });

      return rowsAffected;
    } catch (error) {
      logger.error("Failed to cleanup expired tokens", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  private buildLegacyRecord(
    userId: string,
    toolName: string,
    tokens: OAuthTokens,
  ): LegacyTokenRecord {
    return {
      userId,
      toolName,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      tokenType: tokens.tokenType,
      expiresAt: tokens.expiresAt ?? null,
      refreshExpiresAt: tokens.refreshExpiresAt ?? null,
      scopes:
        tokens.scopes && tokens.scopes.length > 0
          ? tokens.scopes.join(" ")
          : null,
      metadata: tokens.metadata ? JSON.stringify(tokens.metadata) : null,
      ivAccess: LEGACY_IV_VALUE,
      ivRefresh: tokens.refreshToken ? LEGACY_IV_VALUE : null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private mapLegacyRecordToTokens(record: LegacyTokenRecord): OAuthTokens {
    const scopes =
      record.scopes && record.scopes.length > 0
        ? record.scopes
            .split(" ")
            .map((scope) => scope.trim())
            .filter((scope) => scope.length > 0)
        : undefined;

    let metadata: Record<string, unknown> | undefined;
    if (record.metadata) {
      try {
        metadata = JSON.parse(record.metadata);
      } catch (error) {
        logger.warn("Failed to parse legacy metadata JSON", {
          error: error instanceof Error ? error.message : String(error),
          userId: record.userId,
          toolName: record.toolName,
        });
      }
    }

    return {
      accessToken: record.accessToken,
      refreshToken: record.refreshToken ?? undefined,
      tokenType: record.tokenType,
      expiresAt: record.expiresAt ?? undefined,
      refreshExpiresAt: record.refreshExpiresAt ?? undefined,
      scopes,
      metadata,
    };
  }
}
