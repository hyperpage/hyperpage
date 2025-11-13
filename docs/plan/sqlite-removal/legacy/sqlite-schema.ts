/**
 * Legacy SQLite schema snapshot.
 *
 * This file captures the final better-sqlite3 / drizzle-orm sqlite-core schema
 * used before the Phase 1 PostgreSQL-only transition.
 *
 * It is retained under docs/plan/sqlite-removal/legacy for offline reference,
 * data migration tooling, and historical debugging only. It MUST NOT be used
 * as a runtime dependency in the application code.
 */

import { integer, text, sqliteTable } from "drizzle-orm/sqlite-core";

/**
 * Jobs table - legacy SQLite schema
 */
export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(), // string IDs
  type: text("type").notNull(), // job type slug
  payload: text("payload").notNull(), // JSON payload as string
  status: text("status").notNull(), // pending, running, completed, failed, etc.
  priority: integer("priority").notNull().default(0), // numeric priority
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  scheduledAt: integer("scheduled_at"), // ms since epoch
  startedAt: integer("started_at"),
  completedAt: integer("completed_at"),
  failedAt: integer("failed_at"),
  lastError: text("last_error"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

/**
 * Job history table - legacy SQLite schema
 */
export const jobHistory = sqliteTable("job_history", {
  id: integer("id").primaryKey(),
  jobId: text("job_id").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  message: text("message"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

/**
 * Tool configuration table - legacy SQLite schema
 */
export const toolConfigs = sqliteTable("tool_configs", {
  toolName: text("tool_name").primaryKey(),
  config: text("config").notNull(), // JSON string
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

/**
 * Rate limits table - legacy SQLite schema
 */
export const rateLimits = sqliteTable("rate_limits", {
  id: text("id").primaryKey(),
  remaining: integer("remaining").notNull(),
  resetAt: integer("reset_at").notNull(),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

/**
 * App state table - legacy SQLite schema
 */
export const appState = sqliteTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

/**
 * OAuth tokens table - legacy SQLite schema
 */
export const oauthTokens = sqliteTable("oauth_tokens", {
  id: integer("id").primaryKey(),
  userId: text("user_id").notNull(),
  toolName: text("tool_name").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: integer("expires_at"),
  refreshExpiresAt: integer("refresh_expires_at"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

/**
 * Users table - legacy SQLite schema
 *
 * Note: OAuth flow used integer timestamps for createdAt/updatedAt in this schema.
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  profile: text("profile").notNull(), // JSON profile
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

/**
 * User sessions table - legacy SQLite schema
 */
export const userSessions = sqliteTable("user_sessions", {
  sessionId: text("session_id").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

/**
 * Helper: log a reminder when this module is imported at runtime.
 * This is defensive only; application code MUST NOT import this file.
 */
export function warnLegacySQLiteSchemaUsage(): void {
  // This module is docs-only and MUST NOT be used at runtime.
  // Using console here violates global logging rules, so this helper is intentionally a no-op.
}
