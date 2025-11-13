/**
 * Database connection management for Hyperpage
 *
 * Phase 1+: PostgreSQL-only wiring.
 *
 * Responsibilities:
 * - Provide a single Postgres Drizzle entrypoint for all runtime code:
 *   - getPostgresDrizzleDb
 *   - getPrimaryDrizzleDb
 *   - getReadWriteDb
 * - Provide a clear Postgres health check:
 *   - checkPostgresConnectivity
 *
 * Legacy SQLite behavior has been removed from runtime. The historical schema
 * is preserved under:
 *   - docs/plan/sqlite-removal/legacy/sqlite-schema.ts
 */

import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as pgSchema from "./pg-schema";
import { getPgPool, assertPostgresConnection } from "./client";
import logger from "@/lib/logger";

type PostgresDrizzleInstance = NodePgDatabase<typeof pgSchema>;

/**
 * Note: Legacy SQLite helpers and dual-engine switching have been removed.
 * Tests and migration tooling that relied on SQLite must be updated to use
 * Postgres harnesses or the archived legacy schema reference.
 */

/**
 * Primary database: PostgreSQL
 *
 * All runtime callers must use the Postgres Drizzle database. This module no
 * longer consults DB_ENGINE or exposes SQLite connections.
 */
// ---------------------------------------------------------------------------
// PostgreSQL Drizzle client
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
 * Get the primary Drizzle database.
 *
 * Phase 1+: Always PostgreSQL.
 */
export function getPrimaryDrizzleDb(): PostgresDrizzleInstance {
  return getPostgresDrizzleDb();
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
