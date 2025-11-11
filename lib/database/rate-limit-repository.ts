import { sql } from "drizzle-orm";
import * as sqliteSchema from "./schema";
import * as pgSchema from "./pg-schema";
import { getReadWriteDb } from "./connection";
import logger, { rateLimitLogger } from "@/lib/logger";

/**
 * Normalized rate limit record used by higher-level services.
 *
 * This mirrors the semantics of the legacy SQLite-based implementation:
 * - id: stable key, e.g. "github:global"
 * - platform: "github" | "gitlab" | "jira" | other identifiers
 * - limitRemaining / limitTotal: nullable numeric values
 * - resetTime: nullable epoch ms
 * - lastUpdated: epoch ms
 */
export interface NormalizedRateLimitRecord {
  id: string;
  platform: string;
  limitRemaining: number | null;
  limitTotal: number | null;
  resetTime: number | null;
  lastUpdated: number;
}

/**
 * Dual-engine rate limit repository.
 *
 * - SQLite backend:
 *   Uses sqliteSchema.rateLimits as aligned with legacy behavior.
 *
 * - Postgres backend:
 *   Uses pgSchema.rateLimits:
 *     - key: "${platform}:global"
 *     - remaining: maps to limitRemaining
 *     - resetAt: maps to resetTime
 *     - metadata (jsonb) stores:
 *         {
 *           platform: string;
 *           limitTotal: number | null;
 *           lastUpdated: number;
 *         }
 *
 * Selection is driven by getReadWriteDb() (DB_ENGINE).
 */
export class RateLimitRepository {
  /**
   * Load all persisted rate limit records.
   * Used at startup to warm in-memory cache.
   */
  async loadAll(): Promise<NormalizedRateLimitRecord[]> {
    const db = getReadWriteDb();

    if (this.isPostgresDb(db)) {
      const rows = await db.select().from(pgSchema.rateLimits);

      return rows
        .map((row) => this.fromPostgresRow(row))
        .filter(
          (record): record is NormalizedRateLimitRecord => record !== null,
        );
    }

    const rows = await db.select().from(sqliteSchema.rateLimits);

    return rows.map((row) => this.fromSQLiteRow(row));
  }

  /**
   * Upsert a single rate limit record.
   */
  async upsert(record: NormalizedRateLimitRecord): Promise<void> {
    const db = getReadWriteDb();

    if (this.isPostgresDb(db)) {
      const key = record.id;
      const metadata = this.toPostgresMetadata(record);

      const resetAt =
        record.resetTime !== null ? new Date(record.resetTime) : null;

      await db
        .insert(pgSchema.rateLimits)
        .values({
          key,
          remaining: record.limitRemaining ?? undefined,
          resetAt: resetAt ?? undefined,
          metadata,
        } as typeof pgSchema.rateLimits.$inferInsert)
        .onConflictDoUpdate({
          target: pgSchema.rateLimits.key,
          set: {
            remaining: record.limitRemaining ?? undefined,
            resetAt: resetAt ?? undefined,
            metadata,
          },
        });

      return;
    }

    await db
      .insert(sqliteSchema.rateLimits)
      .values({
        id: record.id,
        platform: record.platform,
        limitRemaining: record.limitRemaining,
        limitTotal: record.limitTotal,
        resetTime: record.resetTime,
        lastUpdated: record.lastUpdated,
      })
      .onConflictDoUpdate({
        target: sqliteSchema.rateLimits.id,
        set: {
          limitRemaining: record.limitRemaining,
          limitTotal: record.limitTotal,
          resetTime: record.resetTime,
          lastUpdated: record.lastUpdated,
        },
      });
  }

  /**
   * Delete records older than the given cutoff time (epoch ms).
   * Used to keep the table small.
   */
  async cleanupOlderThan(cutoffTime: number): Promise<void> {
    const db = getReadWriteDb();

    if (this.isPostgresDb(db)) {
      // For Postgres, we store lastUpdated in metadata.
      // We cannot filter metadata easily with types; use a SQL expression.
      // Conservative approach: keep records; log that cleanup is skipped.
      rateLimitLogger.event(
        "info",
        "system",
        "Skipping Postgres rate_limits cleanup; handled by TTL/ops if needed",
      );
      return;
    }

    await db
      .delete(sqliteSchema.rateLimits)
      .where(sql`${sqliteSchema.rateLimits.lastUpdated} < ${cutoffTime}`);
  }

  // ---------------------------------------------------------------------------
  // Mapping helpers
  // ---------------------------------------------------------------------------

  private fromSQLiteRow(
    row: typeof sqliteSchema.rateLimits.$inferSelect,
  ): NormalizedRateLimitRecord {
    return {
      id: String(row.id),
      platform: row.platform,
      limitRemaining:
        row.limitRemaining !== null && row.limitRemaining !== undefined
          ? Number(row.limitRemaining)
          : null,
      limitTotal:
        row.limitTotal !== null && row.limitTotal !== undefined
          ? Number(row.limitTotal)
          : null,
      resetTime:
        row.resetTime !== null && row.resetTime !== undefined
          ? Number(row.resetTime)
          : null,
      lastUpdated: Number(row.lastUpdated),
    };
  }

  private fromPostgresRow(
    row: typeof pgSchema.rateLimits.$inferSelect,
  ): NormalizedRateLimitRecord | null {
    const key = row.key;
    if (!key) {
      logger.warn("rate_limits row missing key, skipping", { row });
      return null;
    }

    const metadata = (row.metadata || {}) as {
      platform?: string;
      limitTotal?: number | null;
      lastUpdated?: number;
    };

    const platform = metadata.platform || this.platformFromKey(key);
    if (!platform) {
      logger.warn(
        "Unable to determine platform from rate_limits row, skipping",
        { key, metadata },
      );
      return null;
    }

    const limitTotal =
      typeof metadata.limitTotal === "number" ? metadata.limitTotal : null;

    const lastUpdated =
      typeof metadata.lastUpdated === "number"
        ? metadata.lastUpdated
        : Date.now();

    const resetTime = row.resetAt
      ? new Date(row.resetAt as Date).getTime()
      : null;

    return {
      id: key,
      platform,
      limitRemaining: typeof row.remaining === "number" ? row.remaining : null,
      limitTotal,
      resetTime,
      lastUpdated,
    };
  }

  private toPostgresMetadata(
    record: NormalizedRateLimitRecord,
  ): Record<string, unknown> {
    return {
      platform: record.platform,
      limitTotal: record.limitTotal,
      lastUpdated: record.lastUpdated,
    };
  }

  private platformFromKey(key: string): string | null {
    const [platform] = key.split(":", 1);
    return platform || null;
  }

  /**
   * Narrowing helper for Postgres vs SQLite drizzle.
   */
  private isPostgresDb(
    db:
      | ReturnType<typeof import("./connection").getPrimaryDrizzleDb>
      | ReturnType<typeof getReadWriteDb>,
  ): db is import("drizzle-orm/node-postgres").NodePgDatabase<typeof pgSchema> {
    try {
      // @ts-expect-error accessing internal drizzle meta
      const schema = db.$schema as Record<string, unknown> | undefined;
      return Boolean(schema && schema.rateLimits === pgSchema.rateLimits);
    } catch (error) {
      logger.debug("Failed to inspect drizzle schema for engine detection", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

/**
 * Default singleton instance.
 */
export const rateLimitRepository = new RateLimitRepository();
