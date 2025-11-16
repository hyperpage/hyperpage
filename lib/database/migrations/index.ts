/**
 * Migration Registry - Compatibility Layer
 *
 * The original project used a custom MIGRATIONS_REGISTRY with raw SQL strings.
 * Tests now use drizzle-orm/node-postgres migrator with TypeScript migrations
 * (e.g. 000_init_pg_schema.ts). MIGRATIONS_REGISTRY is retained only as a
 * fallback API for tools/tests that expect the legacy registry shape.
 */

import * as initPgSchema from "@/lib/database/migrations/000_init_pg_schema";

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
