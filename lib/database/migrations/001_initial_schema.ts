/**
 * Initial Schema Migration
 *
 * Creates all core tables for Hyperpage data persistence:
 * - jobs: Background job state and recovery
 * - job_history: Audit trail for job executions
 * - rate_limits: Rate limit state across restarts
 * - tool_configs: User-configurable tool settings
 * - app_state: Global application state
 */

export const up = `
-- Jobs table for background job persistence
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL,
  status TEXT NOT NULL,
  tool TEXT,
  endpoint TEXT,
  payload TEXT NOT NULL,
  result TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  persisted_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL,
  recovery_attempts INTEGER DEFAULT 0 NOT NULL
);

-- Job execution history for audit trails
CREATE TABLE job_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  duration_ms INTEGER,
  error_message TEXT,
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

-- Rate limits persistence for cross-restart continuity
CREATE TABLE rate_limits (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  limit_remaining INTEGER,  -- Nullable for platforms that don't provide limits
  limit_total INTEGER,      -- Nullable for platforms that don't provide limits
  reset_time INTEGER,       -- Nullable for retry-after logic
  last_updated INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL
);

-- Tool configurations for user settings
CREATE TABLE tool_configs (
  tool_name TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1 NOT NULL,
  config TEXT,
  refresh_interval INTEGER,
  notifications INTEGER DEFAULT 1 NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL
);

-- Application state for global configuration
CREATE TABLE app_state (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at);
CREATE INDEX idx_jobs_persisted_at ON jobs(persisted_at);
CREATE INDEX idx_job_history_job_id ON job_history(job_id);
CREATE INDEX idx_job_history_started_at ON job_history(started_at);
CREATE INDEX idx_rate_limits_platform ON rate_limits(platform);
CREATE INDEX idx_rate_limits_reset_time ON rate_limits(reset_time);
CREATE INDEX idx_tool_configs_enabled ON tool_configs(enabled);

-- Migration tracking (for future migrations)
CREATE TABLE schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  migration_name TEXT NOT NULL UNIQUE,
  executed_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL
);

-- Record this migration as executed
INSERT INTO schema_migrations (migration_name) VALUES ('001_initial_schema');
`;

export const down = `
-- Drop all tables in reverse order (respecting foreign keys)
DROP TABLE IF EXISTS job_history;
DROP TABLE IF EXISTS jobs;
DROP TABLE IF EXISTS rate_limits;
DROP TABLE IF EXISTS tool_configs;
DROP TABLE IF EXISTS app_state;
DROP TABLE IF EXISTS schema_migrations;
`;
