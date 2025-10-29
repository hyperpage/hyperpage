/**
 * Migration Registry
 *
 * Central registry of all database migrations. Use static imports to avoid
 * webpack dynamic import warnings while maintaining migration functionality.
 *
 * To add a new migration:
 * 1. Create the migration file (e.g., 002_new_migration.ts)
 * 2. Add the static import above
 * 3. Add the migration to the MIGRATIONS_EXPORT registry below
 */

import * as initialSchema from './001_initial_schema';

/**
 * Migration interface - matches the export structure of migration files
 */
export interface Migration {
  up: string | ((db: any) => void);
  down: string | ((db: any) => void);
}

/**
 * Registry mapping migration names to their imported modules
 * Add new migrations here when they are created
 */
export const MIGRATIONS_REGISTRY: Record<string, Migration> = {
  '001_initial_schema': {
    up: initialSchema.up,
    down: initialSchema.down,
  },
};

/**
 * Get sorted list of migration names (alphabetically by filename)
 */
export function getMigrationNames(): string[] {
  return Object.keys(MIGRATIONS_REGISTRY).sort();
}
