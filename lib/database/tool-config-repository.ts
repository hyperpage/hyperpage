import { and, eq } from "drizzle-orm";

import * as pgSchema from "./pg-schema";
import { getReadWriteDb } from "./connection";

/**
 * Normalized tool configuration shape used by higher-level services.
 *
 * This is intentionally minimal and aligned with existing UserToolConfig semantics.
 */
export interface NormalizedToolConfig {
  toolName: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  refreshInterval?: number;
  notifications: boolean;
  updatedAt?: number;
}

/**
 * Owner scoping for Postgres tool_configs.
 *
 * For now we use a fixed global owner scope to keep behavior identical to
 * the legacy SQLite implementation (which is effectively global).
 *
 * This can be extended in future to support per-user / per-tenant ownership.
 */
const DEFAULT_OWNER_TYPE = "system";
const DEFAULT_OWNER_ID = "global";

/**
 * Repository for tool configuration persistence on PostgreSQL.
 *
 * Callers should depend on this repository instead of importing drizzle/db
 * or schema tables directly.
 */
export class ToolConfigRepository {
  /**
   * Load all tool configurations from Postgres.
   */
  async getAll(): Promise<NormalizedToolConfig[]> {
    const db = getReadWriteDb();

    const rows = await db
      .select()
      .from(pgSchema.toolConfigs)
      .where(
        and(
          eq(pgSchema.toolConfigs.ownerType, DEFAULT_OWNER_TYPE),
          eq(pgSchema.toolConfigs.ownerId, DEFAULT_OWNER_ID),
        ),
      );

    return rows.map((row) => this.fromPostgresRow(row));
  }

  /**
   * Get configuration for a single tool from Postgres.
   */
  async get(toolName: string): Promise<NormalizedToolConfig | null> {
    const db = getReadWriteDb();

    const rows = await db
      .select()
      .from(pgSchema.toolConfigs)
      .where(
        and(
          eq(pgSchema.toolConfigs.key, toolName),
          eq(pgSchema.toolConfigs.ownerType, DEFAULT_OWNER_TYPE),
          eq(pgSchema.toolConfigs.ownerId, DEFAULT_OWNER_ID),
        ),
      );

    const row = rows[0];
    return row ? this.fromPostgresRow(row) : null;
  }

  /**
   * Insert or update configuration for a tool.
   *
   * The merged tool configuration (enabled/config/refreshInterval/notifications)
   * is persisted in the appropriate backend.
   */
  async upsert(config: NormalizedToolConfig): Promise<void> {
    const db = getReadWriteDb();
    const now = new Date();

    await db
      .insert(pgSchema.toolConfigs)
      .values({
        key: config.toolName,
        ownerType: DEFAULT_OWNER_TYPE,
        ownerId: DEFAULT_OWNER_ID,
        config: this.toPostgresConfigPayload(config),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          pgSchema.toolConfigs.key,
          pgSchema.toolConfigs.ownerType,
          pgSchema.toolConfigs.ownerId,
        ],
        set: {
          config: this.toPostgresConfigPayload(config),
          updatedAt: now,
        },
      });
  }

  /**
   * Delete configuration for a tool.
   *
   * For Postgres this deletes the (key, ownerType, ownerId) row.
   */
  async delete(toolName: string): Promise<void> {
    const db = getReadWriteDb();

    await db
      .delete(pgSchema.toolConfigs)
      .where(
        and(
          eq(pgSchema.toolConfigs.key, toolName),
          eq(pgSchema.toolConfigs.ownerType, DEFAULT_OWNER_TYPE),
          eq(pgSchema.toolConfigs.ownerId, DEFAULT_OWNER_ID),
        ),
      );
  }

  // ---------------------------------------------------------------------------
  // Mapping helpers
  // ---------------------------------------------------------------------------

  private fromPostgresRow(
    row: typeof pgSchema.toolConfigs.$inferSelect,
  ): NormalizedToolConfig {
    const payload = row.config as {
      enabled?: boolean;
      config?: Record<string, unknown>;
      refreshInterval?: number;
      notifications?: boolean;
    };

    const enabled =
      typeof payload.enabled === "boolean" ? payload.enabled : false;
    const notifications =
      typeof payload.notifications === "boolean" ? payload.notifications : true;

    return {
      toolName: row.key,
      enabled,
      config: payload.config,
      refreshInterval:
        typeof payload.refreshInterval === "number"
          ? payload.refreshInterval
          : undefined,
      notifications,
      // Map updatedAt timestamp to epoch milliseconds for consumers that expect number
      updatedAt: row.updatedAt
        ? new Date(row.updatedAt as Date).getTime()
        : undefined,
    };
  }

  private toPostgresConfigPayload(
    config: NormalizedToolConfig,
  ): Record<string, unknown> {
    return {
      enabled: config.enabled,
      config: config.config ?? undefined,
      refreshInterval:
        typeof config.refreshInterval === "number"
          ? config.refreshInterval
          : undefined,
      notifications: config.notifications,
    };
  }
}

/**
 * Default singleton instance used by callers.
 */
export const toolConfigRepository = new ToolConfigRepository();
