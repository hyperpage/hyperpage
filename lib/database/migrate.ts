/**
 * Database migration system for Hyperpage
 *
 * Runs schema migrations in order to evolve the database structure safely.
 * Supports up/down migrations with transaction safety and rollback capabilities.
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { DATABASE_PATH, internalDb } from './connection';
import { MIGRATIONS_REGISTRY, getMigrationNames } from './migrations';

// Migration tracking table (simplified version for internal use)
const schemaMigrations = sqliteTable('schema_migrations', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  migrationName: text('migration_name').notNull().unique(),
  executedAt: integer('executed_at', { mode: 'timestamp_ms' })
    .default(sql`(unixepoch() * 1000)`).notNull(),
});

import { sql } from 'drizzle-orm';

type InternalDb = typeof internalDb;

// Create migration tracking table if it doesn't exist
function ensureMigrationTable() {
  try {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT NOT NULL UNIQUE,
        executed_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL
      );
    `;
    internalDb.exec(createTableSql);
  } catch (error) {
    // Don't treat "table already exists" as an error during initialization
    const errorMsg = (error as Error).message;
    if (!errorMsg.includes('already exists') && !errorMsg.includes('already_exists')) {
      console.warn('Failed to create migration table:', error);
    }
  }
}

// Get list of migration names (replaces getMigrationFiles with static registry)
function getMigrationNamesFromRegistry(): string[] {
  return getMigrationNames();
}

// Load migration from static registry (replaces dynamic imports)
function loadMigrationFromRegistry(migrationName: string): { up?: unknown; down?: unknown } {
  const migration = MIGRATIONS_REGISTRY[migrationName];

  if (!migration) {
    throw new Error(`Migration ${migrationName} not found in registry`);
  }

  if (!migration.up || !migration.down) {
    throw new Error(`Migration ${migrationName} must export both 'up' and 'down'`);
  }

  return { up: migration.up, down: migration.down };
}

// Check if migration has been executed
async function isMigrationExecuted(migrationName: string): Promise<boolean> {
  try {
    const result = await internalDb.prepare(
      'SELECT id FROM schema_migrations WHERE migration_name = ?'
    ).get(migrationName);

    return !!result;
  } catch (error) {
    console.warn(`Error checking migration status for ${migrationName}:`, error);
    return false;
  }
}

// Record migration execution
async function recordMigrationExecuted(migrationName: string): Promise<void> {
  try {
    await internalDb.prepare(
      'INSERT INTO schema_migrations (migration_name) VALUES (?)'
    ).run(migrationName);
  } catch (error) {
    if (!((error as Error)?.message?.includes('UNIQUE constraint failed'))) {
      console.error(`Error recording migration ${migrationName}:`, error);
      throw error;
    }
  }
}

// Remove migration record
async function removeMigrationRecord(migrationName: string): Promise<void> {
  try {
    await internalDb.prepare(
      'DELETE FROM schema_migrations WHERE migration_name = ?'
    ).run(migrationName);
  } catch (error) {
    console.error(`Error removing migration record ${migrationName}:`, error);
    throw error;
  }
}

// Execute migration up
async function runMigrationUp(migrationName: string, sqlQuery: unknown, isDryRun = false): Promise<void> {
  console.info(`${isDryRun ? '[DRY RUN] ' : ''}Running migration up: ${migrationName}`);

  if (!isDryRun) {
    try {
      // Run migration in a transaction (synchronous for better-sqlite3)
      internalDb.transaction(() => {
        if (typeof sqlQuery === 'string') {
          internalDb.exec(sqlQuery);
        } else if (typeof sqlQuery === 'function') {
          // Handle function-based migrations
          (sqlQuery as (db: typeof internalDb) => void)(internalDb);
        } else {
          throw new Error(`Unsupported migration format in ${migrationName}`);
        }

        recordMigrationExecuted(migrationName);
      })();

      console.info(`✓ Migration ${migrationName} completed successfully`);
    } catch (error) {
      console.error(`✗ Migration ${migrationName} failed:`, error);
      throw error;
    }
  } else {
    console.info(`[DRY RUN] Would execute: ${migrationName}`);
  }
}

// Execute migration down
async function runMigrationDown(migrationName: string, sqlQuery: unknown, isDryRun = false): Promise<void> {
  console.info(`${isDryRun ? '[DRY RUN] ' : ''}Rolling back migration: ${migrationName}`);

  if (!isDryRun) {
    try {
      // Run migration rollback in a transaction (synchronous for better-sqlite3)
      internalDb.transaction(() => {
        if (typeof sqlQuery === 'string') {
          internalDb.exec(sqlQuery);
        } else if (typeof sqlQuery === 'function') {
          (sqlQuery as (db: typeof internalDb) => void)(internalDb);
        } else {
          throw new Error(`Unsupported migration format in ${migrationName}`);
        }

        removeMigrationRecord(migrationName);
      })();

      console.info(`✓ Migration rollback ${migrationName} completed successfully`);
    } catch (error) {
      console.error(`✗ Migration rollback ${migrationName} failed:`, error);
      throw error;
    }
  } else {
    console.info(`[DRY RUN] Would rollback: ${migrationName}`);
  }
}

/**
 * Run all pending migrations
 * @param isDryRun If true, only log what would be done without making changes
 */
export async function runMigrations(isDryRun = false): Promise<void> {
  console.info(`${isDryRun ? '[DRY RUN] ' : ''}Running database migrations...`);

  try {
    // Ensure migration table exists
    ensureMigrationTable();

    const migrationNames = getMigrationNamesFromRegistry();
    if (migrationNames.length === 0) {
      console.info('No migration files found');
      return;
    }

    console.info(`Found ${migrationNames.length} migration files`);

    for (const migrationName of migrationNames) {
      // Check if already executed
      const executed = await isMigrationExecuted(migrationName);
      if (executed) {
        if (process.env.NODE_ENV === 'development') {
          console.info(`Skipping already executed migration: ${migrationName}`);
        }
        continue;
      }

      // Load and execute migration
      const { up } = loadMigrationFromRegistry(migrationName);
      await runMigrationUp(migrationName, up, isDryRun);
    }

    console.info(`${isDryRun ? '[DRY RUN] ' : ''}Migration process completed`);
  } catch (error) {
    console.error('Migration process failed:', error);
    throw error;
  }
}

/**
 * Rollback the last N migrations
 * @param count Number of migrations to rollback (default: 1)
 * @param isDryRun If true, only log what would be done
 */
export async function rollbackMigrations(count = 1, isDryRun = false): Promise<void> {
  console.info(`${isDryRun ? '[DRY RUN] ' : ''}Rolling back ${count} migration(s)...`);

  try {
    ensureMigrationTable();

    // Get executed migrations in reverse order
    const executedMigrations = await internalDb.prepare(
      'SELECT migration_name FROM schema_migrations ORDER BY executed_at DESC LIMIT ?'
    ).all(count) as { migration_name: string }[];

    if (executedMigrations.length === 0) {
      console.info('No migrations to rollback');
      return;
    }

    for (let i = 0; i < Math.min(count, executedMigrations.length); i++) {
      const migrationName = executedMigrations[i].migration_name;

      try {
        const { down } = loadMigrationFromRegistry(migrationName);
        await runMigrationDown(migrationName, down, isDryRun);
      } catch (error) {
        console.error(`Failed to load migration ${migrationName} for rollback:`, error);
        continue;
      }
    }

    console.info(`${isDryRun ? '[DRY RUN] ' : ''}Rollback process completed`);
  } catch (error) {
    console.error('Migration rollback process failed:', error);
    throw error;
  }
}

/**
 * Show migration status
 */
export async function showMigrationStatus(): Promise<void> {
  try {
    ensureMigrationTable();

    console.info('Migration Status:');
    console.info('=================');

    const migrationNames = getMigrationNamesFromRegistry();
    if (migrationNames.length === 0) {
      console.info('No migration files found');
      return;
    }

    for (const migrationName of migrationNames) {
      const executed = await isMigrationExecuted(migrationName);
      const status = executed ? '✅ Executed' : '⏳ Pending';
      console.info(`${status}: ${migrationName}`);
    }

  } catch (error) {
    console.error('Failed to show migration status:', error);
  }
}
