import {
  pgTable,
  bigserial,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * PostgreSQL schema for Hyperpage
 *
 * This file is dedicated to the Postgres schema used for drizzle-kit migrations.
 * The legacy SQLite schema has been archived under docs/plan/sqlite-removal/legacy.
 *
 * IMPORTANT:
 * - All runtime callers must use these Postgres tables.
 * - Changes to the schema should go through new drizzle migrations.
 */

/**
 * Users
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    emailUniqueIdx: uniqueIndex("users_email_unique").on(table.email),
  }),
);

/**
 * OAuth Tokens
 */
export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    userId: uuid("user_id").notNull(),
    provider: varchar("provider", { length: 100 }).notNull(),
    scope: text("scope"),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    tokenType: varchar("token_type", { length: 50 }),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userProviderIdx: index("oauth_tokens_user_provider_idx").on(
      table.userId,
      table.provider,
    ),
  }),
);

/**
 * Tool Configurations
 *
 * Store full config in jsonb; higher-level code can map to/from
 * existing logical structures during migration.
 */
export const toolConfigs = pgTable(
  "tool_configs",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    key: varchar("key", { length: 255 }).notNull(),
    ownerType: varchar("owner_type", { length: 50 }).notNull(),
    ownerId: varchar("owner_id", { length: 255 }).notNull(),
    config: jsonb("config").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    keyOwnerUniqueIdx: uniqueIndex("tool_configs_key_owner_unique").on(
      table.key,
      table.ownerType,
      table.ownerId,
    ),
  }),
);

/**
 * Rate Limits
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    key: varchar("key", { length: 255 }).notNull(),
    remaining: integer("remaining").notNull(),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    keyIdx: index("rate_limits_key_idx").on(table.key),
  }),
);

/**
 * Jobs
 */
export const jobs = pgTable(
  "jobs",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    type: varchar("type", { length: 100 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    statusIdx: index("jobs_status_idx").on(table.status),
    scheduledAtIdx: index("jobs_scheduled_at_idx").on(table.scheduledAt),
  }),
);

/**
 * Job History
 */
export const jobHistory = pgTable(
  "job_history",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    jobId: bigserial("job_id", { mode: "bigint" }).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    jobIdIdx: index("job_history_job_id_idx").on(table.jobId),
  }),
);

/**
 * App State
 */
export const appState = pgTable("app_state", {
  key: varchar("key", { length: 255 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * User Sessions
 */
export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    sessionToken: varchar("session_token", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index("user_sessions_user_id_idx").on(table.userId),
    sessionTokenUniqueIdx: uniqueIndex("user_sessions_session_token_unique").on(
      table.sessionToken,
    ),
  }),
);
