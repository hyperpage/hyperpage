import { and, eq, lt, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import logger from "@/lib/logger";
import * as pgSchema from "@/lib/database/pg-schema";
import { getReadWriteDb } from "@/lib/database/connection";

/**
 * Public shape for OAuth tokens (plaintext view).
 */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: number;
  refreshExpiresAt?: number;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Storage record metadata (id type is backend-specific).
 */
export interface StoredTokens extends OAuthTokens {
  id: number | string;
  userId: string;
  toolName: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Repository contract for OAuth token storage.
 *
 * Current implementation:
 * - PostgresOAuthTokenRepository (pgSchema.oauthTokens)
 *
 * Legacy SQLite implementations have been removed from the runtime graph and
 * exist only in historical documentation/migration notes.
 */
export interface OAuthTokenRepository {
  storeTokens(
    userId: string,
    toolName: string,
    tokens: OAuthTokens,
  ): Promise<void>;

  getTokens(userId: string, toolName: string): Promise<OAuthTokens | null>;

  removeTokens(userId: string, toolName: string): Promise<void>;

  updateTokenExpiry(
    userId: string,
    toolName: string,
    expiresAt: number,
    refreshExpiresAt?: number,
  ): Promise<void>;

  getExpiredTokens(): Promise<Array<{ userId: string; toolName: string }>>;

  cleanupExpiredTokens(): Promise<number>;
}

/**
 * Shared AES-256-GCM helper.
 * Expects OAUTH_ENCRYPTION_KEY as hex; must decode to 32 bytes.
 */

/**
 * PostgreSQL-backed implementation using pgSchema.oauthTokens.
 *
 * Note: This implementation reuses the existing pgSchema.oauthTokens layout and
 * AES-256-GCM is NOT applied here; secrets remain in plain columns as defined
 * by the schema. This matches the prior Postgres harness behavior.
 */
export class PostgresOAuthTokenRepository implements OAuthTokenRepository {
  private readonly cipherless = true; // Placeholder to document behavior

  constructor(private readonly db: NodePgDatabase<typeof pgSchema>) {}

  private mapScopesToText(scopes?: string[]): string | null {
    if (!scopes || scopes.length === 0) return null;
    return scopes.join(" ");
  }

  private mapTextToScopes(scopeText: string | null): string[] | undefined {
    if (!scopeText) return undefined;
    const parts = scopeText
      .split(" ")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return parts.length > 0 ? parts : undefined;
  }

  private buildRawPayload(
    tokens: OAuthTokens,
    existingRaw: unknown,
  ): Record<string, unknown> {
    const base: Record<string, unknown> =
      existingRaw && typeof existingRaw === "object"
        ? { ...(existingRaw as Record<string, unknown>) }
        : {};

    if (tokens.metadata && typeof tokens.metadata === "object") {
      base.metadata = tokens.metadata;
    }

    if (typeof tokens.refreshExpiresAt === "number") {
      base.refreshExpiresAt = tokens.refreshExpiresAt;
    }

    return base;
  }

  async storeTokens(
    userId: string,
    toolName: string,
    tokens: OAuthTokens,
  ): Promise<void> {
    const now = new Date();

    const existingRows = await this.db
      .select()
      .from(pgSchema.oauthTokens)
      .where(
        and(
          eq(pgSchema.oauthTokens.userId, userId),
          eq(pgSchema.oauthTokens.provider, toolName),
        ),
      )
      .limit(1);

    const existing = existingRows[0];
    const raw = this.buildRawPayload(tokens, existing?.raw);

    const expiresAt =
      typeof tokens.expiresAt === "number"
        ? new Date(tokens.expiresAt)
        : undefined;

    try {
      if (existing) {
        await this.db
          .update(pgSchema.oauthTokens)
          .set({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken ?? null,
            tokenType: tokens.tokenType,
            scope: this.mapScopesToText(tokens.scopes),
            expiresAt: expiresAt ?? null,
            raw,
            updatedAt: now,
          })
          .where(
            and(
              eq(pgSchema.oauthTokens.userId, userId),
              eq(pgSchema.oauthTokens.provider, toolName),
            ),
          );
      } else {
        await this.db.insert(pgSchema.oauthTokens).values({
          userId,
          provider: toolName,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken ?? null,
          tokenType: tokens.tokenType,
          scope: this.mapScopesToText(tokens.scopes),
          expiresAt: expiresAt ?? null,
          raw,
          createdAt: now,
          updatedAt: now,
        });
      }

      logger.info("PostgresOAuthTokenRepository: stored tokens", {
        userId,
        toolName,
      });
    } catch (error) {
      logger.error("PostgresOAuthTokenRepository: storeTokens failed", {
        error: error instanceof Error ? error.message : String(error),
        userId,
        toolName,
      });
      throw new Error("Token storage failed");
    }
  }

  async getTokens(
    userId: string,
    toolName: string,
  ): Promise<OAuthTokens | null> {
    try {
      const rows = await this.db
        .select()
        .from(pgSchema.oauthTokens)
        .where(
          and(
            eq(pgSchema.oauthTokens.userId, userId),
            eq(pgSchema.oauthTokens.provider, toolName),
          ),
        )
        .limit(1);

      const record = rows[0];
      if (!record) {
        return null;
      }

      const scopes = this.mapTextToScopes(record.scope);

      const raw = record.raw as
        | { metadata?: Record<string, unknown>; refreshExpiresAt?: number }
        | null
        | undefined;

      const metadata =
        raw && raw.metadata && typeof raw.metadata === "object"
          ? (raw.metadata as Record<string, unknown>)
          : undefined;

      const refreshExpiresAt =
        raw && typeof raw.refreshExpiresAt === "number"
          ? raw.refreshExpiresAt
          : undefined;

      return {
        accessToken: record.accessToken,
        refreshToken: record.refreshToken ?? undefined,
        tokenType: record.tokenType ?? "bearer",
        expiresAt: record.expiresAt ? record.expiresAt.getTime() : undefined,
        refreshExpiresAt,
        scopes,
        metadata,
      };
    } catch (error) {
      logger.error("PostgresOAuthTokenRepository: getTokens failed", {
        error: error instanceof Error ? error.message : String(error),
        userId,
        toolName,
      });
      return null;
    }
  }

  async removeTokens(userId: string, toolName: string): Promise<void> {
    try {
      await this.db
        .delete(pgSchema.oauthTokens)
        .where(
          and(
            eq(pgSchema.oauthTokens.userId, userId),
            eq(pgSchema.oauthTokens.provider, toolName),
          ),
        );

      logger.info("PostgresOAuthTokenRepository: removed tokens", {
        userId,
        toolName,
      });
    } catch (error) {
      logger.error("PostgresOAuthTokenRepository: removeTokens failed", {
        error: error instanceof Error ? error.message : String(error),
        userId,
        toolName,
      });
      throw new Error("Token removal failed");
    }
  }

  async updateTokenExpiry(
    userId: string,
    toolName: string,
    expiresAt: number,
    refreshExpiresAt?: number,
  ): Promise<void> {
    try {
      const rows = await this.db
        .select({ raw: pgSchema.oauthTokens.raw })
        .from(pgSchema.oauthTokens)
        .where(
          and(
            eq(pgSchema.oauthTokens.userId, userId),
            eq(pgSchema.oauthTokens.provider, toolName),
          ),
        )
        .limit(1);

      const existingRaw = rows[0]?.raw;
      const raw =
        typeof existingRaw === "object" && existingRaw !== null
          ? { ...(existingRaw as Record<string, unknown>) }
          : {};

      if (typeof refreshExpiresAt === "number") {
        raw.refreshExpiresAt = refreshExpiresAt;
      }

      await this.db
        .update(pgSchema.oauthTokens)
        .set({
          expiresAt: new Date(expiresAt),
          raw,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(pgSchema.oauthTokens.userId, userId),
            eq(pgSchema.oauthTokens.provider, toolName),
          ),
        );

      logger.debug("PostgresOAuthTokenRepository: updated token expiry", {
        userId,
        toolName,
      });
    } catch (error) {
      logger.error("PostgresOAuthTokenRepository: updateTokenExpiry failed", {
        error: error instanceof Error ? error.message : String(error),
        userId,
        toolName,
      });
      throw new Error("Token expiry update failed");
    }
  }

  async getExpiredTokens(): Promise<
    Array<{ userId: string; toolName: string }>
  > {
    try {
      const now = new Date();

      const rows = await this.db
        .select({
          userId: pgSchema.oauthTokens.userId,
          provider: pgSchema.oauthTokens.provider,
        })
        .from(pgSchema.oauthTokens)
        .where(lt(pgSchema.oauthTokens.expiresAt, now));

      return rows.map((row) => ({
        userId: row.userId,
        toolName: row.provider,
      }));
    } catch (error) {
      logger.error("PostgresOAuthTokenRepository: getExpiredTokens failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async cleanupExpiredTokens(): Promise<number> {
    try {
      const now = new Date();

      const result = await this.db.delete(pgSchema.oauthTokens).where(
        sql`(${pgSchema.oauthTokens.expiresAt} < ${now}) AND (
            ${pgSchema.oauthTokens.raw} IS NULL
            OR (${pgSchema.oauthTokens.raw} ->> 'refreshExpiresAt')::bigint < ${now.getTime()}
          )`,
      );

      const rowsAffected =
        (result as { rowsAffected?: number })?.rowsAffected ?? 0;

      logger.info("PostgresOAuthTokenRepository: cleaned up expired tokens", {
        rowsAffected,
      });

      return rowsAffected;
    } catch (error) {
      logger.error(
        "PostgresOAuthTokenRepository: cleanupExpiredTokens failed",
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
      return 0;
    }
  }
}

let _oauthRepo: OAuthTokenRepository | null = null;

/**
 * Returns a singleton PostgreSQL OAuthTokenRepository.
 */
export function getOAuthTokenRepository(): OAuthTokenRepository {
  if (_oauthRepo) {
    return _oauthRepo;
  }

  const db = getReadWriteDb() as NodePgDatabase<typeof pgSchema>;
  _oauthRepo = new PostgresOAuthTokenRepository(db);
  return _oauthRepo;
}
