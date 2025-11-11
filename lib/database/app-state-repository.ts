import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getAppDatabase, getReadWriteDb } from "./connection";
import * as sqliteSchema from "./schema";
import * as pgSchema from "./pg-schema";
import logger from "../logger";

export interface AppStateRepository {
  getState<T = unknown>(key: string): Promise<T | null>;
  setState<T = unknown>(key: string, value: T): Promise<void>;
  deleteState(key: string): Promise<void>;
}

/**
 * SQLite implementation
 *
 * Backed by legacy app_state table with JSON-serialized values.
 * This preserves existing semantics and is the current source of truth.
 */
class SqliteAppStateRepository implements AppStateRepository {
  private readonly db = getAppDatabase().drizzle;
  private readonly table = sqliteSchema.appState;

  async getState<T = unknown>(key: string): Promise<T | null> {
    const row = await this.db
      .select({ value: this.table.value })
      .from(this.table)
      .where(eq(this.table.key, key))
      .get();

    if (!row) {
      return null;
    }

    try {
      return JSON.parse(row.value) as T;
    } catch (error) {
      logger.warn(
        `Failed to parse SQLite app state value as JSON for key=${key}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async setState<T = unknown>(key: string, value: T): Promise<void> {
    const serialized = JSON.stringify(value);

    const existing = await this.db
      .select({ key: this.table.key })
      .from(this.table)
      .where(eq(this.table.key, key))
      .get();

    if (existing) {
      await this.db
        .update(this.table)
        .set({ value: serialized })
        .where(eq(this.table.key, key))
        .run();
      return;
    }

    await this.db.insert(this.table).values({ key, value: serialized }).run();
  }

  async deleteState(key: string): Promise<void> {
    await this.db.delete(this.table).where(eq(this.table.key, key)).run();
  }
}

/**
 * Postgres implementation placeholder
 *
 * The pgSchema.appState table exists, but concrete semantics and migration
 * strategy are not finalized. To avoid incorrect behavior and type hacks,
 * this repository is an explicit no-op for now.
 */
export class PostgresAppStateRepository implements AppStateRepository {
  constructor(private readonly db: NodePgDatabase<typeof pgSchema>) {}

  async getState<T = unknown>(key: string): Promise<T | null> {
    try {
      const rows = await this.db
        .select({ value: pgSchema.appState.value })
        .from(pgSchema.appState)
        .where(eq(pgSchema.appState.key, key))
        .limit(1);

      const row = rows[0];
      if (!row) return null;

      return row.value as T;
    } catch (error) {
      logger.error("PostgresAppStateRepository.getState failed", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async setState<T = unknown>(key: string, value: T): Promise<void> {
    const now = new Date();

    try {
      const result = await this.db
        .update(pgSchema.appState)
        .set({
          value,
          updatedAt: now,
        })
        .where(eq(pgSchema.appState.key, key));

      const rowsAffected =
        (result as { rowsAffected?: number }).rowsAffected ?? 0;

      if (rowsAffected === 0) {
        await this.db.insert(pgSchema.appState).values({
          key,
          value,
          updatedAt: now,
        });
      }
    } catch (error) {
      logger.error("PostgresAppStateRepository.setState failed", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error("Failed to persist app state");
    }
  }

  async deleteState(key: string): Promise<void> {
    try {
      await this.db
        .delete(pgSchema.appState)
        .where(eq(pgSchema.appState.key, key));
    } catch (error) {
      logger.error("PostgresAppStateRepository.deleteState failed", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error("Failed to delete app state");
    }
  }
}

let appStateRepositorySingleton: AppStateRepository | null = null;

function isPostgresDb(db: unknown): db is NodePgDatabase<typeof pgSchema> {
  try {
    if (!db || typeof db !== "object") return false;
    // @ts-expect-error drizzle internal shape
    const schema = db.$schema as Record<string, unknown> | undefined;
    return Boolean(schema && schema.appState === pgSchema.appState);
  } catch {
    return false;
  }
}

/**
 * getAppStateRepository
 *
 * - Returns a singleton.
 * - Uses drizzle schema inspection on getReadWriteDb() to decide engine.
 * - SQLite: fully functional implementation.
 * - Postgres: explicit placeholder to prevent accidental misuse until
 *   proper semantics are defined and implemented.
 */
export function getAppStateRepository(): AppStateRepository {
  if (appStateRepositorySingleton) {
    return appStateRepositorySingleton;
  }

  const db = getReadWriteDb();

  if (isPostgresDb(db)) {
    logger.info("Using PostgresAppStateRepository for app_state");
    appStateRepositorySingleton = new PostgresAppStateRepository(db);
  } else {
    logger.info("Using SqliteAppStateRepository for app_state");
    appStateRepositorySingleton = new SqliteAppStateRepository();
  }

  return appStateRepositorySingleton;
}
