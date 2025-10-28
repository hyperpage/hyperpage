/**
 * Database schema definitions for Hyperpage
 *
 * Defines all tables using Drizzle ORM syntax with proper typing.
 * Includes jobs, rate limits, configurations, and audit trails.
 */

import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// JOBS TABLES
// ============================================================================

/**
 * Core jobs table - persists background job state and recovery information
 */
export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // JobType enum as string
  name: text('name').notNull(),
  priority: integer('priority').notNull(), // JobPriority enum as number
  status: text('status').notNull(), // JobStatus enum as string
  tool: text('tool'), // JSON serialized tool info (optional)
  endpoint: text('endpoint'), // API endpoint for data refresh jobs (optional)
  payload: text('payload').notNull(), // JSON-serialized payload stored as text
  result: text('result'), // JSON-serialized result stored as text (optional)
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  startedAt: integer('started_at'),
  completedAt: integer('completed_at'),
  retryCount: integer('retry_count').default(0).notNull(),

  // Recovery and persistence fields
  persistedAt: integer('persisted_at')
    .default(sql`(unixepoch() * 1000)`).notNull(),
  recoveryAttempts: integer('recovery_attempts').default(0).notNull(),
});

/**
 * Job execution history table - audit trail for all job attempts
 */
export const jobHistory = sqliteTable('job_history', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  jobId: text('job_id').notNull().references(() => jobs.id),
  attempt: integer('attempt').notNull(),
  status: text('status').notNull(), // JobStatus enum as string
  startedAt: integer('started_at').notNull(),
  completedAt: integer('completed_at'),
  durationMs: integer('duration_ms'), // Calculated in milliseconds
  errorMessage: text('error_message'), // Truncated error message for audit
});

// ============================================================================
// RATE LIMITS TABLES
// ============================================================================

/**
 * Rate limits persistence table - maintains rate limit state across restarts
 */
export const rateLimits = sqliteTable('rate_limits', {
  id: text('id').primaryKey(), // Format: "platform:identifier" (e.g., "github:user123")
  platform: text('platform').notNull(), // Platform name (github, gitlab, etc.)
  limitRemaining: integer('limit_remaining'),
  limitTotal: integer('limit_total'),
  resetTime: integer('reset_time'),
  lastUpdated: integer('last_updated').notNull(),
  createdAt: integer('created_at')
    .default(sql`(unixepoch() * 1000)`).notNull(),
});

// ============================================================================
// CONFIGURATION TABLES
// ============================================================================

/**
 * Tool configurations table - user-configurable tool settings
 */
export const toolConfigs = sqliteTable('tool_configs', {
  toolName: text('tool_name').primaryKey(),
  enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
  config: text('config', { mode: 'json' }).$type<Record<string, any>>(), // User configuration overrides
  refreshInterval: integer('refresh_interval'), // Override default refresh interval
  notifications: integer('notifications', { mode: 'boolean' }).default(true).notNull(),
  updatedAt: integer('updated_at')
    .default(sql`(unixepoch() * 1000)`).notNull(),
});

// ============================================================================
// APPLICATION STATE TABLES
// ============================================================================

/**
 * Application state table - global configuration and state persistence
 */
export const appState = sqliteTable('app_state', {
  key: text('key').primaryKey(),
  value: text('value'), // Can store JSON or simple values
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(unixepoch() * 1000)`).notNull(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Type helpers for better TypeScript integration
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

export type JobHistoryEntry = typeof jobHistory.$inferSelect;
export type NewJobHistoryEntry = typeof jobHistory.$inferInsert;

export type RateLimit = typeof rateLimits.$inferSelect;
export type NewRateLimit = typeof rateLimits.$inferInsert;

export type ToolConfig = typeof toolConfigs.$inferSelect;
export type NewToolConfig = typeof toolConfigs.$inferInsert;

export type AppStateEntry = typeof appState.$inferSelect;
export type NewAppStateEntry = typeof appState.$inferInsert;
