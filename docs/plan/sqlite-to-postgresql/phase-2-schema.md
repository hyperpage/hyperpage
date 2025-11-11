# Phase 2: Schema Conversion

**Duration:** 3-4 hours  
**Status:** Ready for Implementation  
**Prerequisites:** Phase 1 completed

## Overview

This phase converts the SQLite database schema to PostgreSQL, including auto-increment fields, JSON handling, timestamps, and adding proper indexes for performance.

## Schema Conversion Strategy

### Core Changes

1. **Auto-increment**: `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
2. **JSON handling**: `text` with JSON mode → `jsonb`
3. **Timestamps**: Unix epoch integers → PostgreSQL TIMESTAMP WITH TIME ZONE
4. **Indexes**: Add PostgreSQL-specific indexes for better performance
5. **Data types**: Map SQLite types to PostgreSQL equivalents

## Implementation Steps

### Step 1: Update Schema Imports

#### Current: lib/database/schema.ts (SQLite imports)

```typescript
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
```

#### Target: lib/database/schema.ts (PostgreSQL imports)

```typescript
import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
```

### Step 2: Convert Jobs Table

#### SQLite Version

```typescript
export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  priority: integer("priority").notNull(),
  status: text("status").notNull(),
  tool: text("tool"), // JSON stored as text
  endpoint: text("endpoint"),
  payload: text("payload", { mode: "json" }).notNull(),
  result: text("result", { mode: "json" }),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  startedAt: integer("started_at"),
  completedAt: integer("completed_at"),
  retryCount: integer("retry_count").default(0).notNull(),
  persistedAt: integer("persisted_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  recoveryAttempts: integer("recovery_attempts").default(0).notNull(),
});
```

#### PostgreSQL Version

```typescript
export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    priority: integer("priority").notNull(),
    status: text("status").notNull(),
    tool: text("tool"), // JSON stored as text
    endpoint: text("endpoint"),
    payload: jsonb("payload").notNull(),
    result: jsonb("result"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    retryCount: integer("retry_count").default(0).notNull(),
    persistedAt: timestamp("persisted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    recoveryAttempts: integer("recovery_attempts").default(0).notNull(),
  },
  (table) => ({
    statusIdx: index("jobs_status_idx").on(table.status),
    createdAtIdx: index("jobs_created_at_idx").on(table.createdAt),
    toolIdx: index("jobs_tool_idx").on(table.tool),
  }),
);
```

### Step 3: Convert Job History Table

#### SQLite Version

```typescript
export const jobHistory = sqliteTable("job_history", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  jobId: text("job_id").notNull(),
  attempt: integer("attempt").notNull(),
  status: text("status").notNull(),
  startedAt: integer("started_at").notNull(),
  completedAt: integer("completed_at"),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
});
```

#### PostgreSQL Version

```typescript
export const jobHistory = pgTable(
  "job_history",
  {
    id: serial("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id),
    attempt: integer("attempt").notNull(),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    errorMessage: text("error_message"),
  },
  (table) => ({
    jobIdIdx: index("job_history_job_id_idx").on(table.jobId),
    statusIdx: index("job_history_status_idx").on(table.status),
  }),
);
```

### Step 4: Convert Rate Limits Table

#### SQLite Version

```typescript
export const rateLimits = sqliteTable("rate_limits", {
  id: text("id").primaryKey(),
  platform: text("platform").notNull(),
  limitRemaining: integer("limit_remaining"),
  limitTotal: integer("limit_total"),
  resetTime: integer("reset_time"),
  lastUpdated: integer("last_updated").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});
```

#### PostgreSQL Version

```typescript
export const rateLimits = pgTable(
  "rate_limits",
  {
    id: text("id").primaryKey(),
    platform: text("platform").notNull(),
    limitRemaining: integer("limit_remaining"),
    limitTotal: integer("limit_total"),
    resetTime: timestamp("reset_time", { withTimezone: true }),
    lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    platformIdx: index("rate_limits_platform_idx").on(table.platform),
  }),
);
```

### Step 5: Convert Tool Configs Table

#### SQLite Version

```typescript
export const toolConfigs = sqliteTable("tool_configs", {
  toolName: text("tool_name").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).default(1).notNull(),
  config: text("config", { mode: "json" }),
  refreshInterval: integer("refresh_interval"),
  notifications: integer("notifications", { mode: "boolean" })
    .default(1)
    .notNull(),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});
```

#### PostgreSQL Version

```typescript
export const toolConfigs = pgTable("tool_configs", {
  toolName: text("tool_name").primaryKey(),
  enabled: boolean("enabled").default(true).notNull(),
  config: jsonb("config"),
  refreshInterval: integer("refresh_interval"),
  notifications: boolean("notifications").default(true).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

### Step 6: Convert App State Table

#### SQLite Version

```typescript
export const appState = sqliteTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value"), // Can store JSON or simple values
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});
```

#### PostgreSQL Version

```typescript
export const appState = pgTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value"), // Can store JSON or simple values
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

### Step 7: Convert Authentication Tables

#### Users Table - SQLite

```typescript
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  providerUserId: text("provider_user_id").notNull(),
  email: text("email"),
  username: text("username"),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});
```

#### Users Table - PostgreSQL

```typescript
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    email: text("email"),
    username: text("username"),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    providerIdx: index("users_provider_idx").on(table.provider),
    emailIdx: index("users_email_idx").on(table.email),
  }),
);
```

#### OAuth Tokens Table - SQLite

```typescript
export const oauthTokens = sqliteTable("oauth_tokens", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  toolName: text("tool_name").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenType: text("token_type").default("Bearer").notNull(),
  expiresAt: integer("expires_at"),
  refreshExpiresAt: integer("refresh_expires_at"),
  scopes: text("scopes"),
  metadata: text("metadata", { mode: "json" }),
  ivAccess: text("iv_access").notNull(),
  ivRefresh: text("iv_refresh"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});
```

#### OAuth Tokens Table - PostgreSQL

```typescript
export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    toolName: text("tool_name").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    tokenType: text("token_type").default("Bearer").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }),
    scopes: text("scopes"),
    metadata: jsonb("metadata"),
    ivAccess: text("iv_access").notNull(),
    ivRefresh: text("iv_refresh"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index("oauth_tokens_user_id_idx").on(table.userId),
    toolNameIdx: index("oauth_tokens_tool_name_idx").on(table.toolName),
  }),
);
```

#### User Sessions Table - SQLite

```typescript
export const userSessions = sqliteTable("user_sessions", {
  sessionId: text("session_id").primaryKey(),
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  lastActivity: integer("last_activity")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});
```

#### User Sessions Table - PostgreSQL

```typescript
export const userSessions = pgTable(
  "user_sessions",
  {
    sessionId: text("session_id").primaryKey(),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActivity: timestamp("last_activity", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index("user_sessions_user_id_idx").on(table.userId),
    providerIdx: index("user_sessions_provider_idx").on(table.provider),
  }),
);
```

### Step 8: Update Type Exports

```typescript
// Keep existing type exports but they will now work with PostgreSQL
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

export type JobHistoryEntry = typeof jobHistory.$inferSelect;
export type NewJobHistoryEntry = typeof jobHistory.$inferInsert;

// ... continue for all other types
```

## Data Migration Notes

### Timestamp Conversion Logic

The system will need to convert Unix epoch timestamps:

```typescript
// During data migration, convert:
function convertTimestamp(unixEpochMs: number): Date {
  return new Date(unixEpochMs);
}
```

### JSON Data Handling

JSON data in SQLite `text` fields will be automatically handled by JSONB in PostgreSQL.

### Foreign Key Relationships

PostgreSQL will enforce referential integrity. Ensure all foreign key relationships are correct.

## Testing Schema Conversion

### Create Test Database

```sql
-- Create a test database for validation
CREATE DATABASE hyperpage_test;

-- Test schema creation
\c hyperpage_test

-- Verify all tables can be created
-- (This will be tested by the migration scripts)
```

### Validate Schema

```typescript
// Test schema creation
describe("PostgreSQL Schema", () => {
  test("should create all tables successfully", async () => {
    const { drizzle } = getAppDatabase();

    // This will fail if schema is incorrect
    const result = await drizzle.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    expect(result).toBeDefined();
  });
});
```

## Common Conversion Issues

### 1. Timestamp Format Issues

**Problem**: Unix epoch integers vs PostgreSQL timestamps
**Solution**: Convert all timestamp operations to use Date objects

### 2. JSON Data Type Mismatches

**Problem**: Text-based JSON vs JSONB
**Solution**: Update queries to use JSONB operators

### 3. Auto-Increment Sequence Issues

**Problem**: SERIAL sequences need proper initialization
**Solution**: Ensure sequences start from appropriate values

### 4. Index Performance

**Problem**: Missing or incorrect indexes
**Solution**: Add PostgreSQL-specific indexes for common queries

## Files to Modify

1. **`lib/database/schema.ts`** - Complete schema conversion
2. **Type definition files** - Update for new schema
3. **Query files** - Update for new field types and JSONB

## Validation Checklist

### Schema Structure

- [ ] All tables converted to PostgreSQL syntax
- [ ] Auto-increment fields using SERIAL
- [ ] JSON fields using JSONB
- [ ] Timestamps using TIMESTAMP WITH TIME ZONE
- [ ] Boolean fields using proper boolean type
- [ ] Foreign key relationships established
- [ ] Indexes created for performance

### Data Types

- [ ] Text fields properly mapped
- [ ] Integer fields properly mapped
- [ ] Boolean fields properly mapped
- [ ] JSON fields using JSONB
- [ ] Timestamp fields using proper format

### Performance

- [ ] Indexes created for common query patterns
- [ ] Foreign key indexes created
- [ ] Performance testing completed

## Success Criteria

✅ **All 8 tables successfully converted to PostgreSQL**  
✅ **Schema creation works without errors**  
✅ **Data types properly mapped**  
✅ **Foreign key relationships working**  
✅ **Performance indexes in place**  
✅ **All TypeScript types updated**  
✅ **Migration script can create database**

## Next Phase Prerequisites

- Schema successfully converted to PostgreSQL
- Database creation working
- All data types properly mapped
- Foreign key relationships established
- Performance indexes created

---

**Phase 2 Status**: Ready for Implementation  
**Next**: [Phase 3: Database Connection Overhaul](phase-3-connection.md)
