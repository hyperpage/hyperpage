/**
 * Database migration system for Hyperpage
 *
 * Runs schema migrations in order to evolve the database structure safely.
 * Supports up/down migrations with transaction safety and rollback capabilities.
 */

import { internalDb } from "./connection";
import { MIGRATIONS_REGISTRY, getMigrationNames } from "./migrations";
import logger from "../logger";

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
    if (
      !errorMsg.includes("already exists") &&
      !errorMsg.includes("already_exists")
    ) {
      logger.error("Failed to create migration tracking table", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Get list of migration names (replaces getMigrationFiles with static registry)
function getMigrationNamesFromRegistry(): string[] {
  return getMigrationNames();
}

// Load migration from static registry (replaces dynamic imports)
function loadMigrationFromRegistry(migrationName: string): {
  up?: unknown;
  down?: unknown;
} {
  const migration = MIGRATIONS_REGISTRY[migrationName];

  if (!migration) {
    throw new Error(`Migration ${migrationName} not found in registry`);
  }

  if (!migration.up || !migration.down) {
    throw new Error(
      `Migration ${migrationName} must export both 'up' and 'down'`,
    );
  }

  return { up: migration.up, down: migration.down };
}

// Check if migration has been executed
async function isMigrationExecuted(migrationName: string): Promise<boolean> {
  try {
    const result = await internalDb
      .prepare("SELECT id FROM schema_migrations WHERE migration_name = ?")
      .get(migrationName);

    return !!result;
  } catch (error) {
    logger.warn(`Error checking migration status for ${migrationName}`, {
      error: error instanceof Error ? error.message : String(error),
      migrationName,
    });
    return false;
  }
}

// Record migration execution
async function recordMigrationExecuted(migrationName: string): Promise<void> {
  try {
    await internalDb
      .prepare("INSERT INTO schema_migrations (migration_name) VALUES (?)")
      .run(migrationName);
  } catch (error) {
    if (!(error as Error)?.message?.includes("UNIQUE constraint failed")) {
      logger.error("Failed to record migration execution", {
        error: error instanceof Error ? error.message : String(error),
        migrationName,
      });
      throw error;
    }
  }
}

// Remove migration record
async function removeMigrationRecord(migrationName: string): Promise<void> {
  try {
    await internalDb
      .prepare("DELETE FROM schema_migrations WHERE migration_name = ?")
      .run(migrationName);
  } catch (error) {
    logger.error("Failed to remove migration record", {
      error: error instanceof Error ? error.message : String(error),
      migrationName,
    });
    throw error;
  }
}

// Execute migration up
async function runMigrationUp(
  migrationName: string,
  sqlQuery: unknown,
  isDryRun = false,
): Promise<void> {
  logger.info(`Running migration up: ${migrationName}`, {
    migrationName,
    isDryRun,
    queryType: typeof sqlQuery,
  });

  if (!isDryRun) {
    try {
      // Run migration in a transaction (synchronous for better-sqlite3)
      internalDb.transaction(() => {
        if (typeof sqlQuery === "string") {
          internalDb.exec(sqlQuery);
        } else if (typeof sqlQuery === "function") {
          // Handle function-based migrations
          (sqlQuery as (db: typeof internalDb) => void)(internalDb);
        } else {
          throw new Error(`Unsupported migration format in ${migrationName}`);
        }

        recordMigrationExecuted(migrationName);
      })();

      logger.info(`✓ Migration ${migrationName} completed successfully`, {
        migrationName,
      });
    } catch (error) {
      logger.error(`Failed to execute migration ${migrationName}`, {
        error: error instanceof Error ? error.message : String(error),
        migrationName,
      });
      throw error;
    }
  } else {
    logger.info(`[DRY RUN] Migration ${migrationName} would be executed`, {
      migrationName,
    });
  }
}

// Execute migration down
async function runMigrationDown(
  migrationName: string,
  sqlQuery: unknown,
  isDryRun = false,
): Promise<void> {
  logger.info(`Rolling back migration: ${migrationName}`, {
    migrationName,
    isDryRun,
    queryType: typeof sqlQuery,
  });

  if (!isDryRun) {
    try {
      // Run migration rollback in a transaction (synchronous for better-sqlite3)
      internalDb.transaction(() => {
        if (typeof sqlQuery === "string") {
          internalDb.exec(sqlQuery);
        } else if (typeof sqlQuery === "function") {
          (sqlQuery as (db: typeof internalDb) => void)(internalDb);
        } else {
          throw new Error(`Unsupported migration format in ${migrationName}`);
        }

        removeMigrationRecord(migrationName);
      })();

      logger.info(
        `✓ Migration rollback ${migrationName} completed successfully`,
        { migrationName },
      );
    } catch (error) {
      logger.error(`Failed to rollback migration ${migrationName}`, {
        error: error instanceof Error ? error.message : String(error),
        migrationName,
      });
      throw error;
    }
  } else {
    logger.info(
      `[DRY RUN] Migration rollback ${migrationName} would be executed`,
      { migrationName },
    );
  }
}

/**
 * Run all pending migrations
 * @param isDryRun If true, only log what would be done without making changes
 */
export async function runMigrations(isDryRun = false): Promise<void> {
  logger.info("Starting database migration process", { isDryRun });

  try {
    // Ensure migration table exists
    ensureMigrationTable();

    const migrationNames = getMigrationNamesFromRegistry();
    if (migrationNames.length === 0) {
      logger.info("No migrations found in registry");
      return;
    }

    logger.info(`Found ${migrationNames.length} migration(s) to process`, {
      migrationCount: migrationNames.length,
      migrationNames,
    });

    for (const migrationName of migrationNames) {
      // Check if already executed
      const executed = await isMigrationExecuted(migrationName);
      if (executed) {
        if (process.env.NODE_ENV === "development") {
          logger.debug(
            `Migration ${migrationName} already executed, skipping`,
            { migrationName },
          );
        }
        continue;
      }

      // Load and execute migration
      const { up } = loadMigrationFromRegistry(migrationName);
      await runMigrationUp(migrationName, up, isDryRun);
    }

    logger.info("Database migration process completed successfully", {
      isDryRun,
    });
  } catch (error) {
    logger.error("Database migration process failed", {
      error: error instanceof Error ? error.message : String(error),
      isDryRun,
    });
    throw error;
  }
}

/**
 * Rollback the last N migrations
 * @param count Number of migrations to rollback (default: 1)
 * @param isDryRun If true, only log what would be done
 */
export async function rollbackMigrations(
  count = 1,
  isDryRun = false,
): Promise<void> {
  logger.info(`Rolling back ${count} migration(s)`, { count, isDryRun });

  try {
    ensureMigrationTable();

    // Get executed migrations in reverse order
    const executedMigrations = (await internalDb
      .prepare(
        "SELECT migration_name FROM schema_migrations ORDER BY executed_at DESC LIMIT ?",
      )
      .all(count)) as { migration_name: string }[];

    if (executedMigrations.length === 0) {
      logger.info("No executed migrations found to rollback");
      return;
    }

    for (let i = 0; i < Math.min(count, executedMigrations.length); i++) {
      const migrationName = executedMigrations[i].migration_name;

      try {
        const { down } = loadMigrationFromRegistry(migrationName);
        await runMigrationDown(migrationName, down, isDryRun);
      } catch (error) {
        logger.error("Failed to rollback migration", {
          error: error instanceof Error ? error.message : String(error),
          migrationName,
        });
        continue;
      }
    }

    logger.info("Migration rollback process completed", { count, isDryRun });
  } catch (error) {
    logger.error("Migration rollback process failed", {
      error: error instanceof Error ? error.message : String(error),
      count,
      isDryRun,
    });
    throw error;
  }
}

/**
 * Show migration status
 */
export async function showMigrationStatus(): Promise<void> {
  try {
    ensureMigrationTable();

    logger.info("Database migration status:");

    const migrationNames = getMigrationNamesFromRegistry();
    if (migrationNames.length === 0) {
      logger.info("No migrations found in registry");
      return;
    }

    for (const migrationName of migrationNames) {
      const executed = await isMigrationExecuted(migrationName);
      const status = executed ? "✅ Executed" : "⏳ Pending";
      logger.info(`${status} - ${migrationName}`);
    }
  } catch (error) {
    logger.error("Failed to show migration status", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
