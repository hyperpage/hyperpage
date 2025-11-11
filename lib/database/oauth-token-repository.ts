import { and, eq, lt, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import crypto from "crypto";

import logger from "@/lib/logger";
import { oauthTokens as sqliteOauthTokens } from "@/lib/database/schema";
import * as pgSchema from "@/lib/database/pg-schema";
import { getAppDatabase, getReadWriteDb } from "@/lib/database/connection";

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
 * Repository contract for encrypted OAuth token storage.
 *
 * Implementations:
 * - SqliteOAuthTokenRepository (legacy sqliteOauthTokens)
 * - PostgresOAuthTokenRepository (pgSchema.oauthTokens) [PLANNED, NOT IMPLEMENTED]
 *
 * Both:
 * - Use AES-256-GCM encryption compatible with existing behavior
 * - Never log secrets (only metadata like userId/toolName)
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
class AesGcmCipher {
  private readonly key: Buffer;

  constructor() {
    const raw = process.env.OAUTH_ENCRYPTION_KEY;
    if (!raw || raw.length < 32) {
      throw new Error(
        "OAUTH_ENCRYPTION_KEY must be set and at least 32 characters",
      );
    }

    // Support both raw bytes (32 length) and hex (64 length).
    this.key = raw.length === 64 ? Buffer.from(raw, "hex") : Buffer.from(raw);

    if (this.key.length !== 32) {
      logger.warn(
        "OAUTH_ENCRYPTION_KEY is not 32 bytes; AES-256-GCM may be misconfigured",
      );
    }
  }

  encrypt(plaintext: string): { encrypted: string; iv: string } {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);

      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();
      return {
        encrypted,
        iv: `${iv.toString("hex")}:${authTag.toString("hex")}`,
      };
    } catch (error) {
      logger.error("OAuthTokenRepository: encryption failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error("Encryption failed");
    }
  }

  decrypt(encrypted: string, ivAndTag: string): string {
    try {
      const [ivHex, tagHex] = ivAndTag.split(":");
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(tagHex, "hex");

      const decipher = crypto.createDecipheriv("aes-256-gcm", this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (error) {
      logger.error("OAuthTokenRepository: decryption failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error("Decryption failed");
    }
  }
}

/**
 * SQLite-backed implementation using legacy oauthTokens table.
 */
class SqliteOAuthTokenRepository implements OAuthTokenRepository {
  private readonly cipher = new AesGcmCipher();

  private get db() {
    const { drizzle } = getAppDatabase();
    return drizzle;
  }

  async storeTokens(
    userId: string,
    toolName: string,
    tokens: OAuthTokens,
  ): Promise<void> {
    const now = Date.now();

    const encAccess = this.cipher.encrypt(tokens.accessToken);
    const encRefresh = tokens.refreshToken
      ? this.cipher.encrypt(tokens.refreshToken)
      : null;

    const scopes = tokens.scopes ? tokens.scopes.join(" ") : null;
    const metadata = tokens.metadata ? JSON.stringify(tokens.metadata) : null;

    const tokenData: typeof sqliteOauthTokens.$inferInsert = {
      userId,
      toolName,
      accessToken: encAccess.encrypted,
      refreshToken: encRefresh?.encrypted ?? null,
      tokenType: tokens.tokenType,
      expiresAt: tokens.expiresAt ?? null,
      refreshExpiresAt: tokens.refreshExpiresAt ?? null,
      scopes,
      metadata,
      ivAccess: encAccess.iv,
      ivRefresh: encRefresh?.iv ?? null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.db
        .insert(sqliteOauthTokens)
        .values(tokenData)
        .onConflictDoUpdate({
          target: [sqliteOauthTokens.userId, sqliteOauthTokens.toolName],
          set: {
            ...tokenData,
            updatedAt: now,
          },
        });

      logger.info("SqliteOAuthTokenRepository: stored tokens", {
        userId,
        toolName,
      });
    } catch (error) {
      logger.error("SqliteOAuthTokenRepository: storeTokens failed", {
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
        .from(sqliteOauthTokens)
        .where(
          and(
            eq(sqliteOauthTokens.userId, userId),
            eq(sqliteOauthTokens.toolName, toolName),
          ),
        )
        .limit(1);

      if (rows.length === 0) {
        return null;
      }

      const record = rows[0];

      const accessToken = this.cipher.decrypt(
        record.accessToken,
        record.ivAccess,
      );

      let refreshToken: string | undefined;
      if (record.refreshToken && record.ivRefresh) {
        refreshToken = this.cipher.decrypt(
          record.refreshToken,
          record.ivRefresh,
        );
      }

      const scopes = record.scopes
        ? record.scopes.split(" ").filter((s) => s.length > 0)
        : undefined;

      const metadata = record.metadata
        ? (JSON.parse(record.metadata) as Record<string, unknown>)
        : undefined;

      return {
        accessToken,
        refreshToken,
        tokenType: record.tokenType,
        expiresAt: record.expiresAt ?? undefined,
        refreshExpiresAt: record.refreshExpiresAt ?? undefined,
        scopes,
        metadata,
      };
    } catch (error) {
      logger.error("SqliteOAuthTokenRepository: getTokens failed", {
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
        .delete(sqliteOauthTokens)
        .where(
          and(
            eq(sqliteOauthTokens.userId, userId),
            eq(sqliteOauthTokens.toolName, toolName),
          ),
        );

      logger.info("SqliteOAuthTokenRepository: removed tokens", {
        userId,
        toolName,
      });
    } catch (error) {
      logger.error("SqliteOAuthTokenRepository: removeTokens failed", {
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
      await this.db
        .update(sqliteOauthTokens)
        .set({
          expiresAt,
          refreshExpiresAt: refreshExpiresAt ?? null,
          updatedAt: Date.now(),
        })
        .where(
          and(
            eq(sqliteOauthTokens.userId, userId),
            eq(sqliteOauthTokens.toolName, toolName),
          ),
        );

      logger.debug("SqliteOAuthTokenRepository: updated token expiry", {
        userId,
        toolName,
      });
    } catch (error) {
      logger.error("SqliteOAuthTokenRepository: updateTokenExpiry failed", {
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
      const now = Date.now();

      const rows = await this.db
        .select({
          userId: sqliteOauthTokens.userId,
          toolName: sqliteOauthTokens.toolName,
        })
        .from(sqliteOauthTokens)
        .where(sql`${sqliteOauthTokens.expiresAt} < ${now}`);

      return rows.map((row) => ({
        userId: row.userId,
        toolName: row.toolName,
      }));
    } catch (error) {
      logger.error("SqliteOAuthTokenRepository: getExpiredTokens failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async cleanupExpiredTokens(): Promise<number> {
    try {
      const now = Date.now();

      const result = await this.db
        .delete(sqliteOauthTokens)
        .where(
          sql`${sqliteOauthTokens.expiresAt} < ${now} AND (${sqliteOauthTokens.refreshExpiresAt} IS NULL OR ${sqliteOauthTokens.refreshExpiresAt} < ${now})`,
        );

      const rowsAffected =
        (result as { rowsAffected?: number })?.rowsAffected ?? 0;

      logger.info("SqliteOAuthTokenRepository: cleaned up expired tokens", {
        rowsAffected,
      });

      return rowsAffected;
    } catch (error) {
      logger.error("SqliteOAuthTokenRepository: cleanupExpiredTokens failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }
}

/**
 * PostgresOAuthTokenRepository:
 * NOT IMPLEMENTED YET.
 *
 * The existing pgSchema.oauthTokens definition:
 * - Uses columns: userId, provider, scope, accessToken, refreshToken,
 *   expiresAt, tokenType, raw, createdAt, updatedAt
 * - Does NOT include the encrypted ivAccess/ivRefresh/metadata/toolName
 *   fields used by the legacy SQLite-backed store.
 *
 * A correct Postgres implementation requires a clear mapping decision:
 * - Either evolve pgSchema.oauthTokens to the encrypted model, or
 * - Map logical OAuthTokens into provider/scope/raw consistently.
 *
 * Until that decision is made, any concrete Postgres implementation here
 * would be incorrect. To avoid type and runtime drift, it is deliberately
 * left unimplemented.
 */
export class PostgresOAuthTokenRepository implements OAuthTokenRepository {
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

    // Load existing row (if any) to preserve unknown raw fields.
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

/**
 * Engine detection helper reused from job-repository pattern.
 */
function isPostgresDb(db: unknown): db is NodePgDatabase<typeof pgSchema> {
  try {
    const schema = (db as { $schema?: Record<string, unknown> }).$schema;
    return Boolean(schema && schema.oauthTokens === pgSchema.oauthTokens);
  } catch (error) {
    logger.debug("OAuthTokenRepository: failed to inspect drizzle schema", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

let _oauthRepo: OAuthTokenRepository | null = null;

/**
 * Returns a singleton dual-engine OAuthTokenRepository.
 *
 * - For sqlite (default / non-pg schema): SqliteOAuthTokenRepository
 * - For postgres (pgSchema.oauthTokens present): PostgresOAuthTokenRepository
 */
export function getOAuthTokenRepository(): OAuthTokenRepository {
  if (_oauthRepo) {
    return _oauthRepo;
  }

  const db = getReadWriteDb();

  if (isPostgresDb(db)) {
    _oauthRepo = new PostgresOAuthTokenRepository(db);
  } else {
    _oauthRepo = new SqliteOAuthTokenRepository();
  }

  return _oauthRepo;
}
