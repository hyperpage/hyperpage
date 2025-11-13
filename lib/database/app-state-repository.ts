import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import logger from "../logger";

import { getReadWriteDb } from "./connection";
import * as pgSchema from "./pg-schema";

export interface AppStateRepository {
  getState<T = unknown>(key: string): Promise<T | null>;
  setState<T = unknown>(key: string, value: T): Promise<void>;
  deleteState(key: string): Promise<void>;
}

/**
 * PostgreSQL implementation using pgSchema.appState.
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

/**
 * getAppStateRepository
 *
 * - Returns a singleton PostgreSQL-backed repository.
 */
export function getAppStateRepository(): AppStateRepository {
  if (appStateRepositorySingleton) {
    return appStateRepositorySingleton;
  }

  const db = getReadWriteDb() as NodePgDatabase<typeof pgSchema>;
  logger.info("Using PostgresAppStateRepository for app_state");
  appStateRepositorySingleton = new PostgresAppStateRepository(db);

  return appStateRepositorySingleton;
}
