/**
 * Migration Registry - Compatibility Layer
 *
 * The original project used a custom MIGRATIONS_REGISTRY with raw SQL strings.
 * Tests now use drizzle-orm/node-postgres migrator with TypeScript migrations
 * (e.g. 000_init_pg_schema.ts), but application code (lib/database/migrate.ts)
 * still imports MIGRATIONS_REGISTRY and getMigrationNames.
 *
 * To maintain compatibility:
 * - Expose MIGRATIONS_REGISTRY and getMigrationNames backed by the new
 *   drizzle-style migration(s). This keeps the runtime API stable while
 *   enabling the Postgres test harness.
 */

import * as initPgSchema from "./000_init_pg_schema";

export interface Database {
  execute: (query: unknown) => Promise<unknown>;
}

export interface Migration {
  up: (db: Database) => Promise<void>;
  down: (db: Database) => Promise<void>;
}

export const MIGRATIONS_REGISTRY: Record<string, Migration> = {
  "000_init_pg_schema": {
    up: initPgSchema.up as (db: Database) => Promise<void>,
    down: initPgSchema.down as (db: Database) => Promise<void>,
  },
};

export function getMigrationNames(): string[] {
  return Object.keys(MIGRATIONS_REGISTRY).sort();
}
