/**
 * Database connection management for Hyperpage
 *
 * Legacy SQLite + new PostgreSQL wiring (incremental migration).
 *
 * Responsibilities:
 * - Provide existing SQLite-based APIs used across the codebase:
 *   - getAppDatabase, getInternalDatabase, appDb, internalDb
 *   - getDatabaseStats, checkDatabaseConnectivity
 *   - createTestDatabase, createTestDrizzle
 *   - closeAllConnections
 * - Expose a Postgres Drizzle client for new code paths (without breaking legacy callers):
 *   - getPostgresDrizzleDb
 */

import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as fs from "fs";
import * as path from "path";
import * as sqliteSchema from "./schema";
import * as pgSchema from "./pg-schema";
import { getPgPool, assertPostgresConnection } from "./client";
import logger from "@/lib/logger";

type SQLiteDrizzleInstance = ReturnType<
  typeof drizzleSqlite<typeof sqliteSchema>
>;
type PostgresDrizzleInstance = NodePgDatabase<typeof pgSchema>;

// ---------------------------------------------------------------------------
// Legacy SQLite configuration (unchanged behavior)
// ---------------------------------------------------------------------------

export const DATABASE_PATH = process.env.DATABASE_PATH || "./data/hyperpage.db";
export const DATABASE_DIR = path.dirname(DATABASE_PATH);

try {
  if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
  }
} catch (error) {
  logger.warn(
    "Failed to create database directory, continuing with current directory",
    {
      databaseDir: DATABASE_DIR,
      error: error instanceof Error ? error.message : String(error),
    },
  );
}

const IS_TEST_ENV =
  process.env.NODE_ENV === "test" || process.env.VITEST === "1";
const TEST_DB_PATH = IS_TEST_ENV ? ":memory:" : DATABASE_PATH;

let _appDb: Database.Database | null = null;
let _appDrizzleDb: SQLiteDrizzleInstance | null = null;
let _internalDb: Database.Database | null = null;

/**
 * Get the application database instance (SQLite)
 * Used for business logic callers that still depend on the legacy path.
 */
export function getAppDatabase(): {
  sqlite: Database.Database;
  drizzle: SQLiteDrizzleInstance;
} {
  if (!_appDb || !_appDrizzleDb) {
    const dbPath = IS_TEST_ENV ? TEST_DB_PATH : DATABASE_PATH;
    _appDb = new Database(dbPath);

    if (!IS_TEST_ENV) {
      _appDb.pragma("journal_mode = WAL");
      _appDb.pragma("synchronous = NORMAL");
      _appDb.pragma("cache_size = 1000000");
      _appDb.pragma("temp_store = memory");
    }

    _appDrizzleDb = drizzleSqlite(_appDb, { schema: sqliteSchema });

    logger.info("Application SQLite database connection established", {
      dbPath,
      isTestEnvironment: IS_TEST_ENV,
      isWALMode: !IS_TEST_ENV,
    });
  }

  return { sqlite: _appDb, drizzle: _appDrizzleDb };
}

/**
 * Get the internal database instance (SQLite)
 * Used for system operations (migrations, maintenance) in legacy flow.
 */
export function getInternalDatabase(): Database.Database {
  if (!_internalDb) {
    const dbPath = IS_TEST_ENV ? TEST_DB_PATH : DATABASE_PATH;
    _internalDb = new Database(dbPath);

    if (!IS_TEST_ENV) {
      _internalDb.pragma("journal_mode = WAL");
      _internalDb.pragma("synchronous = NORMAL");
    }

    logger.debug("Internal SQLite database connection established", {
      dbPath,
      isTestEnvironment: IS_TEST_ENV,
    });
  }

  return _internalDb;
}

export const internalDb = getInternalDatabase();
export const appDb = getAppDatabase;

/**
 * Close all database connections gracefully (SQLite)
 */
export function closeAllConnections(): void {
  logger.info("Closing SQLite database connections");

  if (_appDb) {
    try {
      _appDb.close();
      logger.debug("Application SQLite database connection closed");
    } catch (error) {
      logger.error("Failed to close application SQLite database connection", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    _appDb = null;
    _appDrizzleDb = null;
  }

  if (_internalDb) {
    try {
      _internalDb.close();
      logger.debug("Internal SQLite database connection closed");
    } catch (error) {
      logger.error("Failed to close internal SQLite database connection", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    _internalDb = null;
  }
}

/**
 * Get SQLite database connection statistics
 */
export function getDatabaseStats(): {
  appDbConnected: boolean;
  internalDbConnected: boolean;
  databasePath: string;
  databaseSize?: number;
} {
  let databaseSize: number | undefined;

  try {
    const stats = fs.statSync(DATABASE_PATH);
    databaseSize = stats.size;
  } catch {
    // File might not exist yet
  }

  return {
    appDbConnected: _appDb !== null && !_appDb.readonly,
    internalDbConnected: _internalDb !== null && !_internalDb.readonly,
    databasePath: DATABASE_PATH,
    databaseSize,
  };
}

/**
 * Health check for SQLite connectivity
 */
export function checkDatabaseConnectivity(): {
  status: "healthy" | "degraded" | "unhealthy";
  details: Record<string, unknown>;
} {
  try {
    const internal = getInternalDatabase();

    const result = internal.prepare("SELECT 1 as test").get() as {
      test: number;
    };

    if (result.test === 1) {
      return {
        status: "healthy",
        details: {
          message: "SQLite database connection successful",
          ...getDatabaseStats(),
        },
      };
    }

    return {
      status: "degraded",
      details: {
        message: "SQLite database query returned unexpected result",
        ...getDatabaseStats(),
      },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      details: {
        message: "SQLite database connectivity check failed",
        error: error instanceof Error ? error.message : String(error),
        ...getDatabaseStats(),
      },
    };
  }
}

/**
 * Create a fresh in-memory SQLite database connection for testing
 */
export function createTestDatabase(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = MEMORY");
  db.pragma("synchronous = NORMAL");
  return db;
}

/**
 * Create a test Drizzle instance with SQLite schema for testing
 */
export function createTestDrizzle(db: Database.Database) {
  return drizzleSqlite(db, { schema: sqliteSchema });
}

/**
 * Resolve configured primary database engine.
 * Defaults to SQLite to preserve existing behavior.
 */
function getConfiguredDbEngine(): "sqlite" | "postgres" {
  const engine = (process.env.DB_ENGINE || "").toLowerCase();
  return engine === "postgres" ? "postgres" : "sqlite";
}

// ---------------------------------------------------------------------------
// New: PostgreSQL Drizzle client for incremental migration
// ---------------------------------------------------------------------------

let _pgDrizzleDb: PostgresDrizzleInstance | null = null;

/**
 * Get the PostgreSQL Drizzle database instance.
 *
 * This uses:
 * - pg Pool from lib/database/client.ts
 * - Postgres schema from lib/database/pg-schema.ts
 *
 * Existing callers remain on SQLite; new code paths can opt into this.
 */
export function getPostgresDrizzleDb(): PostgresDrizzleInstance {
  if (_pgDrizzleDb) {
    return _pgDrizzleDb;
  }

  const pool = getPgPool();
  _pgDrizzleDb = drizzlePostgres(pool, { schema: pgSchema });

  logger.info("PostgreSQL Drizzle client initialized");

  return _pgDrizzleDb;
}

/**
 * Get the primary Drizzle database based on configured engine.
 *
 * - Default (no DB_ENGINE or unknown): SQLite drizzle from getAppDatabase()
 * - DB_ENGINE=postgres: Postgres Drizzle via getPostgresDrizzleDb()
 *
 * This is the preferred entrypoint for new code to allow seamless migration.
 */
export function getPrimaryDrizzleDb():
  | SQLiteDrizzleInstance
  | PostgresDrizzleInstance {
  const engine = getConfiguredDbEngine();

  if (engine === "postgres") {
    return getPostgresDrizzleDb();
  }

  const { drizzle } = getAppDatabase();
  return drizzle;
}

/**
 * Alias for read/write operations to emphasize intent.
 * Currently identical to getPrimaryDrizzleDb().
 */
export const getReadWriteDb = getPrimaryDrizzleDb;

/**
 * Health check for PostgreSQL connectivity
 */
export async function checkPostgresConnectivity(): Promise<{
  status: "healthy" | "unhealthy";
  details: Record<string, unknown>;
}> {
  try {
    await assertPostgresConnection();
    return {
      status: "healthy",
      details: {
        message: "PostgreSQL connection successful",
      },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      details: {
        message: "PostgreSQL connectivity check failed",
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
