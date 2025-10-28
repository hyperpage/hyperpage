/**
 * Database connection management for Hyperpage
 *
 * Provides singleton database connections for both application use and internal operations.
 * Handles connection pooling, error handling, and graceful shutdown.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as schema from './schema';

type DrizzleInstance = ReturnType<typeof drizzle<typeof schema>>;

// Database configuration
export const DATABASE_PATH = process.env.DATABASE_PATH || './data/hyperpage.db';
export const DATABASE_DIR = path.dirname(DATABASE_PATH);

// Ensure database directory exists
try {
  if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
  }
} catch (error) {
  console.error('Failed to create database directory:', error);
  // Continue - the database will be created in the current directory if needed
}

// Application database connection (for business logic)
let _appDb: Database.Database | null = null;
let _appDrizzleDb: DrizzleInstance | null = null;

// Internal database connection (for migrations and system operations)
let _internalDb: Database.Database | null = null;

/**
 * Get the application database instance (singleton)
 * Used for all business logic operations
 */
export function getAppDatabase(): { sqlite: Database.Database; drizzle: DrizzleInstance } {
  if (!_appDb || !_appDrizzleDb) {
    _appDb = new Database(DATABASE_PATH, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
    });

    // Enable WAL mode for better concurrency
    _appDb.pragma('journal_mode = WAL');
    _appDb.pragma('synchronous = NORMAL');
    _appDb.pragma('cache_size = 1000000'); // 1GB cache
    _appDb.pragma('temp_store = memory'); // Temporary tables in memory

    // Set up Drizzle with schema
    _appDrizzleDb = drizzle(_appDb, { schema });

    console.info(`Application database initialized at ${DATABASE_PATH}`);
  }

  return { sqlite: _appDb, drizzle: _appDrizzleDb };
}

/**
 * Get the internal database instance (singleton)
 * Used for system operations like migrations
 */
export function getInternalDatabase(): Database.Database {
  if (!_internalDb) {
    _internalDb = new Database(DATABASE_PATH, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
    });

    // Enable WAL mode for internal operations too
    _internalDb.pragma('journal_mode = WAL');
    _internalDb.pragma('synchronous = NORMAL');

    console.info(`Internal database initialized at ${DATABASE_PATH}`);
  }

  return _internalDb;
}

// Convenience exports
export const internalDb = getInternalDatabase();
export const appDb = getAppDatabase;

/**
 * Close all database connections gracefully
 * Should be called during application shutdown
 */
export function closeAllConnections(): void {
  console.info('Closing database connections...');

  if (_appDb) {
    try {
      _appDb.close();
      console.info('Application database connection closed');
    } catch (error) {
      console.warn('Error closing application database:', error);
    }
    _appDb = null;
    _appDrizzleDb = null;
  }

  if (_internalDb) {
    try {
      _internalDb.close();
      console.info('Internal database connection closed');
    } catch (error) {
      console.warn('Error closing internal database:', error);
    }
    _internalDb = null;
  }
}

/**
 * Get database connection statistics
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
  } catch (error) {
    // File might not exist yet, that's fine
  }

  return {
    appDbConnected: _appDb !== null && !_appDb.readonly,
    internalDbConnected: _internalDb !== null && !_internalDb.readonly,
    databasePath: DATABASE_PATH,
    databaseSize,
  };
}

/**
 * Health check for database connectivity
 */
export function checkDatabaseConnectivity(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: Record<string, any>;
} {
  try {
    const internal = getInternalDatabase();

    // Simple connectivity test
    const result = internal.prepare('SELECT 1 as test').get() as { test: number };

    if (result.test === 1) {
      return {
        status: 'healthy',
        details: {
          message: 'Database connection successful',
          ...getDatabaseStats(),
        },
      };
    } else {
      return {
        status: 'degraded',
        details: {
          message: 'Database query returned unexpected result',
          ...getDatabaseStats(),
        },
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        message: 'Database connectivity check failed',
        error: (error as Error).message,
        ...getDatabaseStats(),
      },
    };
  }
}
