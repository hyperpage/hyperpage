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
 * PostgreSQL rate limit repository.
 *
 * Uses pgSchema.rateLimits:
 *   - key: "${platform}:global"
 *   - remaining: maps to limitRemaining
 *   - resetAt: maps to resetTime
 *   - metadata (jsonb):
 *       {
 *         platform: string;
 *         limitTotal: number | null;
 *         lastUpdated: number;
 *       }
 */
export class RateLimitRepository {
  /**
   * Load all persisted rate limit records.
   * Used at startup to warm in-memory cache.
   */
  async loadAll(): Promise<NormalizedRateLimitRecord[]> {
    const db = getReadWriteDb();

    const rows = await db.select().from(pgSchema.rateLimits);

    return rows
      .map((row) => this.fromPostgresRow(row))
      .filter(
        (record): record is NormalizedRateLimitRecord => record !== null,
      );
  }

  /**
   * Upsert a single rate limit record.
   */
  async upsert(record: NormalizedRateLimitRecord): Promise<void> {
    const db = getReadWriteDb();

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
  }

  /**
   * Delete records older than the given cutoff time (epoch ms).
   * Retained for interface compatibility; Postgres cleanup is handled via ops/TTL.
   */
  async cleanupOlderThan(): Promise<void> {
    // For Postgres, cleanup is expected to be handled by TTL/ops if needed.
    rateLimitLogger.event(
      "info",
      "system",
      "Skipping Postgres rate_limits cleanup; handled by TTL/ops if needed",
    );
  }

  // ---------------------------------------------------------------------------
  // Mapping helpers
  // ---------------------------------------------------------------------------

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

}

/**
 * Default singleton instance.
 */
export const rateLimitRepository = new RateLimitRepository();
