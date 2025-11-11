/**
 * Legacy SQLite schema for Hyperpage
 *
 * This file restores the original better-sqlite3 / drizzle-orm sqlite-core schema
 * so existing code and tests continue to compile while we introduce Postgres
 * via lib/database/pg-schema.ts incrementally.
 */

import { integer, text, sqliteTable } from "drizzle-orm/sqlite-core";

/**
 * Jobs
 */
export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(), // string IDs
  type: text("type").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  // Core payload/result fields (stored as JSON strings)
  payload: text("payload").notNull(),
  result: text("result"),
  // Optional tool metadata
  tool: text("tool"),
  endpoint: text("endpoint"),
  // Scheduling and timing fields
  priority: integer("priority").notNull().default(0),
  scheduledAt: integer("scheduledAt"), // ms timestamp (optional)
  startedAt: integer("startedAt"),
  completedAt: integer("completedAt"),
  // Retry and tracking fields
  retryCount: integer("retryCount").notNull().default(0),
  persistedAt: integer("persistedAt").notNull(),
  recoveryAttempts: integer("recoveryAttempts").notNull().default(0),
  // Legacy fields (kept for backward compatibility)
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  // Audit timestamps
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});

/**
 * Job insert type (used by memory job queue/tests)
 */
export type NewJob = typeof jobs.$inferInsert;
export type Job = typeof jobs.$inferSelect;

/**
 * Job History
 */
export const jobHistory = sqliteTable("job_history", {
  id: integer("id").primaryKey(),
  jobId: text("jobId").notNull(),
  status: text("status").notNull(),
  details: text("details"), // JSON string
  createdAt: integer("createdAt").notNull(),
});

/**
 * Tool Configs
 *
 * Snapshot-style configuration table referenced by persistence recovery tests
 * and tool-config-manager. Kept as-is for backward compatibility.
 */
export const toolConfigs = sqliteTable("tool_configs", {
  toolName: text("tool_name").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  config: text("config", { mode: "json" }).$type<Record<
    string,
    unknown
  > | null>(),
  refreshInterval: integer("refresh_interval"),
  notifications: integer("notifications", { mode: "boolean" })
    .notNull()
    .default(true),
  updatedAt: integer("updated_at").notNull().default(Math.floor(Date.now())),
});

/**
 * Rate Limits
 *
 * Legacy schema used by rate-limit-service and related tests.
 */
export const rateLimits = sqliteTable("rate_limits", {
  id: text("id").primaryKey(),
  platform: text("platform").notNull(),
  limitRemaining: integer("limit_remaining"),
  limitTotal: integer("limit_total"),
  resetTime: integer("reset_time"),
  lastUpdated: integer("last_updated").notNull(),
  createdAt: integer("created_at").notNull().default(Math.floor(Date.now())),
});

/**
 * App State
 */
export const appState = sqliteTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON string
});

/**
 * OAuth tokens (legacy, SQLite-backed)
 *
 * NOTE:
 * - Kept for compatibility with existing tests and any code that still uses this schema.
 * - The new Postgres-backed schema lives in lib/database/pg-schema.ts.
 */
export const oauthTokens = sqliteTable("oauth_tokens", {
  id: integer("id").primaryKey(),
  userId: text("userId").notNull(),
  toolName: text("toolName").notNull(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  tokenType: text("tokenType").notNull(),
  expiresAt: integer("expiresAt"),
  refreshExpiresAt: integer("refreshExpiresAt"),
  scopes: text("scopes"),
  metadata: text("metadata"),
  ivAccess: text("ivAccess").notNull(),
  ivRefresh: text("ivRefresh"),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});

/**
 * Users (legacy, SQLite-backed)
 *
 * Minimal user profile table required by the OAuth route when using SQLite.
 * This mirrors the shape expected in app/api/auth/oauth/[provider]/route.ts.
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  providerUserId: text("providerUserId").notNull(),
  email: text("email"),
  username: text("username"),
  displayName: text("displayName"),
  avatarUrl: text("avatarUrl"),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});
