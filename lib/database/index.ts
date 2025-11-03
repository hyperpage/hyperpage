/**
 * Database layer for Hyperpage data persistence
 *
 * Uses SQLite with Drizzle ORM for type-safe, efficient data operations.
 * Provides persistence for jobs, rate limits, configurations, and application state.
 */

import { runMigrations } from "./migrate";
import {
  getAppDatabase,
  closeAllConnections,
  getDatabaseStats,
  checkDatabaseConnectivity,
} from "./connection";
import { loadPersistedRateLimits } from "../rate-limit-service";
import { loadToolConfigurations } from "../tool-config-manager";

// Get application database instance (singleton)
const { drizzle: db } = getAppDatabase();

// Export the configured database instance
export { db };

// Export database types with proper schema typing
export type Database = typeof db;

/**
 * Close database connection gracefully
 * Should be called when application shuts down
 */
export function closeDatabase(): void {
  closeAllConnections();
}

/**
 * Initialize database connection
 * Runs any pending migrations
 */
export async function initializeDatabase(): Promise<void> {
  try {
    console.info("Initializing database...");

    // Run migrations to ensure schema is up to date
    await runMigrations();

    // Load persisted rate limit data into memory cache
    const loadedRateLimits = await loadPersistedRateLimits();
    console.info(`Loaded ${loadedRateLimits} persisted rate limit records`);

    // Load persisted tool configurations and apply to registry
    const loadedToolConfigs = await loadToolConfigurations();
    console.info(`Loaded ${loadedToolConfigs} tool configuration records`);

    // Verify database connectivity
    const connectivityCheck = checkDatabaseConnectivity();
    if (connectivityCheck.status !== "healthy") {
      throw new Error(
        `Database connectivity check failed: ${connectivityCheck.details.message}`,
      );
    }

    console.info("Database initialized successfully");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw new Error(
      `Database initialization failed: ${(error as Error).message}`,
    );
  }
}

/**
 * Check overall database health including connectivity and data
 */
export async function checkDatabaseHealth(): Promise<{
  status: "healthy" | "degraded" | "unhealthy";
  details: Record<string, unknown>;
}> {
  try {
    // First check connectivity
    const connectivity = checkDatabaseConnectivity();
    if (connectivity.status !== "healthy") {
      return connectivity;
    }

    // Note: Record counts would use proper database queries
    // For now, just return connectivity info
    const connectionStats = getDatabaseStats();

    return {
      status: "healthy",
      details: {
        ...connectionStats,
        note: "Database connected and ready. Record counting requires proper Drizzle setup.",
      },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      details: {
        error: (error as Error).message,
        connectivity: checkDatabaseConnectivity(),
      },
    };
  }
}
