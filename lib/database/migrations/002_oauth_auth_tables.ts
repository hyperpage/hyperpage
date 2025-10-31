/**
 * OAuth Authentication Tables Migration
 *
 * Creates OAuth authentication tables required for user OAuth flows:
 * - users: Stores authenticated user profiles from OAuth providers
 * - oauth_tokens: Securely stores encrypted OAuth access and refresh tokens
 * - user_sessions: Links HTTP sessions to authenticated users
 *
 * These tables support multi-provider OAuth authentication (GitHub, GitLab, Jira)
 * with secure token storage and session management.
 */

export const up = `
-- Users table for OAuth-authenticated users
CREATE TABLE users (
  id TEXT PRIMARY KEY, -- Format: provider:user_id (e.g., github:12345)
  provider TEXT NOT NULL, -- OAuth provider (github, gitlab, jira)
  provider_user_id TEXT NOT NULL, -- Raw provider user ID
  email TEXT, -- Optional user email from OAuth
  username TEXT, -- Optional username from OAuth
  display_name TEXT, -- Optional display name from OAuth
  avatar_url TEXT, -- Optional avatar URL from OAuth
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- OAuth tokens table for secure token storage
CREATE TABLE oauth_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  tool_name TEXT NOT NULL, -- Tool identifier (github, gitlab, jira)
  access_token TEXT NOT NULL, -- AES-256-GCM encrypted access token
  refresh_token TEXT, -- AES-256-GCM encrypted refresh token (when available)
  token_type TEXT DEFAULT 'Bearer' NOT NULL,
  expires_at INTEGER, -- Token expiry timestamp in milliseconds
  refresh_expires_at INTEGER, -- Refresh token expiry timestamp in milliseconds
  scopes TEXT, -- Space-separated granted scopes
  metadata TEXT, -- JSON additional OAuth response data
  iv_access TEXT NOT NULL, -- Initialization vector for access token encryption
  iv_refresh TEXT, -- Initialization vector for refresh token encryption
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE(user_id, tool_name) -- One token per user per tool
);

-- User sessions table linking HTTP sessions to authenticated users
CREATE TABLE user_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  last_activity INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Create indexes for better performance
CREATE INDEX idx_users_provider ON users(provider);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_oauth_tokens_user_id ON oauth_tokens(user_id);
CREATE INDEX idx_oauth_tokens_tool_name ON oauth_tokens(tool_name);
CREATE INDEX idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);

-- Record this migration as executed
INSERT INTO schema_migrations (migration_name) VALUES ('002_oauth_auth_tables');
`;

export const down = `
-- Drop OAuth authentication tables in reverse dependency order
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS oauth_tokens;
DROP TABLE IF EXISTS users;

-- Remove migration record (maintains migration table integrity)
DELETE FROM schema_migrations WHERE migration_name = '002_oauth_auth_tables';
`;
