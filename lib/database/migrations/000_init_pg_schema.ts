import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import logger from "@/lib/logger";

// Match drizzle's runtime DB shape so migrate() can call our migration directly.
type Database = NodePgDatabase;

/**
 * Initial PostgreSQL schema migration for Hyperpage test harness.
 *
 * This migration creates tables that match lib/database/pg-schema.ts so that:
 * - drizzle-orm/node-postgres migrator can manage schema
 * - vitest.setup.ts can seed via pgSchema without 42P01 errors
 */

export async function up(db: Database) {
  // Users
  logger.info("[migrations] DATABASE_URL", {
    databaseUrl: process.env.DATABASE_URL ?? "(not set)",
  });
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "email" varchar(320) NOT NULL,
      "name" varchar(255),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique"
      ON "users" ("email");
  `);

  // OAuth Tokens
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "oauth_tokens" (
      "id" bigserial PRIMARY KEY,
      "user_id" uuid NOT NULL,
      "provider" varchar(100) NOT NULL,
      "scope" text,
      "access_token" text NOT NULL,
      "refresh_token" text,
      "expires_at" timestamptz,
      "token_type" varchar(50),
      "raw" jsonb,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "oauth_tokens_user_provider_idx"
      ON "oauth_tokens" ("user_id", "provider");
  `);

  // Tool Configs
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "tool_configs" (
      "id" bigserial PRIMARY KEY,
      "key" varchar(255) NOT NULL,
      "owner_type" varchar(50) NOT NULL,
      "owner_id" varchar(255) NOT NULL,
      "config" jsonb NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "tool_configs_key_owner_unique"
      ON "tool_configs" ("key", "owner_type", "owner_id");
  `);

  // Rate Limits
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "rate_limits" (
      "id" bigserial PRIMARY KEY,
      "key" varchar(255) NOT NULL,
      "remaining" integer NOT NULL,
      "reset_at" timestamptz NOT NULL,
      "metadata" jsonb,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "rate_limits_key_idx"
      ON "rate_limits" ("key");
  `);

  // Jobs
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "jobs" (
      "id" bigserial PRIMARY KEY,
      "type" varchar(100) NOT NULL,
      "payload" jsonb NOT NULL,
      "status" varchar(50) NOT NULL,
      "scheduled_at" timestamptz NOT NULL DEFAULT now(),
      "started_at" timestamptz,
      "completed_at" timestamptz,
      "attempts" integer NOT NULL DEFAULT 0,
      "last_error" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "jobs_status_idx"
      ON "jobs" ("status");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "jobs_scheduled_at_idx"
      ON "jobs" ("scheduled_at");
  `);

  // Job History
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "job_history" (
      "id" bigserial PRIMARY KEY,
      "job_id" bigint NOT NULL,
      "status" varchar(50) NOT NULL,
      "details" jsonb,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "job_history_job_id_idx"
      ON "job_history" ("job_id");
  `);

  // App State
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "app_state" (
      "key" varchar(255) PRIMARY KEY,
      "value" jsonb NOT NULL,
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
  `);

  // User Sessions
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "user_sessions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL,
      "session_token" varchar(255) NOT NULL,
      "expires_at" timestamptz NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "user_sessions_user_id_idx"
      ON "user_sessions" ("user_id");
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_session_token_unique"
      ON "user_sessions" ("session_token");
  `);
}

export async function down(db: Database) {
  await db.execute(sql`DROP TABLE IF EXISTS "user_sessions" CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS "app_state" CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS "job_history" CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS "jobs" CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS "rate_limits" CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS "tool_configs" CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS "oauth_tokens" CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS "users" CASCADE;`);
}
