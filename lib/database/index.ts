/**
 * Database layer for Hyperpage data persistence
 *
 * Phase 1+: PostgreSQL-only runtime.
 *
 * Uses PostgreSQL with Drizzle ORM for type-safe, efficient data operations.
 * Provides persistence for jobs, rate limits, configurations, and application state.
 *
 * IMPORTANT:
 * - This module MUST NOT import or depend on any SQLite/better-sqlite3 helpers.
 * - Legacy SQLite helpers have been removed; this module only exposes the Postgres layer.
 */

import {
  getReadWriteDb,
  checkPostgresConnectivity,
} from "@/lib/database/connection";
import { loadPersistedRateLimits } from "@/lib/rate-limit-service";
import { loadToolConfigurations } from "@/lib/tool-config-manager";

const db = getReadWriteDb();

// Export the configured database instance
export { db };

// Export database types with proper schema typing
export type Database = typeof db;

/**
 * Close database connection gracefully
 * Should be called when application shuts down
 */
export function closeDatabase(): void {
  // Connection pooling is managed by pg; explicit close is handled by process lifecycle in this runtime.
}

/**
 * Initialize database connection
 * Runs any pending migrations
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // NOTE: Schema migrations are managed by dedicated migration tooling.
    // Runtime initialization assumes PostgreSQL schema has already been migrated.

    // Load persisted rate limit data into memory cache
    await loadPersistedRateLimits();

    // Load persisted tool configurations and apply to registry
    await loadToolConfigurations();

    // Verify PostgreSQL connectivity
    const connectivityCheck = await checkPostgresConnectivity();
    if (connectivityCheck.status !== "healthy") {
      throw new Error(
        `PostgreSQL connectivity check failed: ${connectivityCheck.details?.message ?? "unknown error"}`,
      );
    }
  } catch (error) {
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
    // First check PostgreSQL connectivity
    const connectivity = await checkPostgresConnectivity();
    if (connectivity.status !== "healthy") {
      return {
        status: connectivity.status,
        details: connectivity.details ?? {},
      };
    }

    return {
      status: "healthy",
      details: {
        note: "PostgreSQL database connected and ready.",
      },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      details: {
        error: (error as Error).message,
      },
    };
  }
}
