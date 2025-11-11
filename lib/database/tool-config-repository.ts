import { and, eq } from "drizzle-orm";
import * as sqliteSchema from "./schema";
import * as pgSchema from "./pg-schema";
import { getReadWriteDb } from "./connection";
import logger from "@/lib/logger";

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
 * Repository providing a dual-engine abstraction for tool configuration
 * persistence across SQLite (legacy) and PostgreSQL (new).
 *
 * Callers should depend on this repository instead of importing drizzle/db
 * or schema tables directly. Selection of the underlying engine is based on
 * getReadWriteDb(), which is configured by DB_ENGINE.
 */
export class ToolConfigRepository {
  /**
   * Load all tool configurations.
   *
   * - SQLite: reads from sqliteSchema.toolConfigs
   * - Postgres: reads from pgSchema.toolConfigs scoped to (system, global)
   */
  async getAll(): Promise<NormalizedToolConfig[]> {
    const db = getReadWriteDb();

    if (this.isPostgresDb(db)) {
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

    const rows = await db.select().from(sqliteSchema.toolConfigs);
    return rows.map((row) => this.fromSQLiteRow(row));
  }

  /**
   * Get configuration for a single tool.
   */
  async get(toolName: string): Promise<NormalizedToolConfig | null> {
    const db = getReadWriteDb();

    if (this.isPostgresDb(db)) {
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

    const rows = await db
      .select()
      .from(sqliteSchema.toolConfigs)
      .where(eq(sqliteSchema.toolConfigs.toolName, toolName));

    const row = rows[0];
    return row ? this.fromSQLiteRow(row) : null;
  }

  /**
   * Insert or update configuration for a tool.
   *
   * The merged tool configuration (enabled/config/refreshInterval/notifications)
   * is persisted in the appropriate backend.
   */
  async upsert(config: NormalizedToolConfig): Promise<void> {
    const db = getReadWriteDb();

    if (this.isPostgresDb(db)) {
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

      return;
    }

    await db
      .insert(sqliteSchema.toolConfigs)
      .values({
        toolName: config.toolName,
        enabled: config.enabled,
        config: config.config ?? null,
        refreshInterval:
          typeof config.refreshInterval === "number"
            ? config.refreshInterval
            : null,
        notifications: config.notifications,
        updatedAt: Date.now(),
      })
      .onConflictDoUpdate({
        target: sqliteSchema.toolConfigs.toolName,
        set: {
          enabled: config.enabled,
          config: config.config ?? null,
          refreshInterval:
            typeof config.refreshInterval === "number"
              ? config.refreshInterval
              : null,
          notifications: config.notifications,
          updatedAt: Date.now(),
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

    if (this.isPostgresDb(db)) {
      await db
        .delete(pgSchema.toolConfigs)
        .where(
          and(
            eq(pgSchema.toolConfigs.key, toolName),
            eq(pgSchema.toolConfigs.ownerType, DEFAULT_OWNER_TYPE),
            eq(pgSchema.toolConfigs.ownerId, DEFAULT_OWNER_ID),
          ),
        );
      return;
    }

    await db
      .delete(sqliteSchema.toolConfigs)
      .where(eq(sqliteSchema.toolConfigs.toolName, toolName));
  }

  // ---------------------------------------------------------------------------
  // Mapping helpers
  // ---------------------------------------------------------------------------

  private fromSQLiteRow(
    row: typeof sqliteSchema.toolConfigs.$inferSelect,
  ): NormalizedToolConfig {
    return {
      toolName: row.toolName,
      enabled: Boolean(row.enabled),
      config: (row.config as Record<string, unknown> | null) || undefined,
      refreshInterval:
        row.refreshInterval !== null && row.refreshInterval !== undefined
          ? Number(row.refreshInterval)
          : undefined,
      notifications: Boolean(row.notifications),
      updatedAt:
        row.updatedAt !== null && row.updatedAt !== undefined
          ? Number(row.updatedAt)
          : undefined,
    };
  }

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

  /**
   * Narrowing helper: distinguish NodePgDatabase (Postgres) from SQLite drizzle.
   *
   * We detect Postgres via the presence of the pgSchema table metadata.
   */
  private isPostgresDb(
    db:
      | ReturnType<typeof import("./connection").getPrimaryDrizzleDb>
      | ReturnType<typeof getReadWriteDb>,
  ): db is import("drizzle-orm/node-postgres").NodePgDatabase<typeof pgSchema> {
    // Heuristic: Postgres drizzle instance exposes the pgSchema tables we passed in.
    // SQLite instance uses sqliteSchema instead. We check for one of the pgSchema
    // table names on the db object via symbol metadata.
    try {
      // @ts-expect-error accessing internal drizzle meta
      const schema = db.$schema as Record<string, unknown> | undefined;
      return Boolean(schema && schema.toolConfigs === pgSchema.toolConfigs);
    } catch (error) {
      logger.debug("Failed to inspect drizzle schema for engine detection", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

/**
 * Default singleton instance used by callers.
 */
export const toolConfigRepository = new ToolConfigRepository();
