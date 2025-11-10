# Phase 4: Migration System Updates

**Duration:** 1-2 hours  
**Status:** Ready for Implementation  
**Prerequisites:** Phase 1-3 completed

## Overview

This phase updates the existing migration system to work with PostgreSQL instead of SQLite, including migration table structure, transaction handling, and PostgreSQL-specific migration functions.

## Migration System Architecture

### Current SQLite Migration System

- Migration metadata stored in `__drizzle_migrations` table
- SQLite-specific syntax and operations
- Simple file-based migration tracking
- Limited transaction support

### Target PostgreSQL Migration System

- PostgreSQL migration metadata table
- Full transaction support
- Migration state tracking
- Rollback capabilities
- Concurrent migration safety

## Implementation Steps

### Step 1: Update Migration Configuration

#### lib/database/migrate.ts - PostgreSQL Migration System

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getAppDatabase } from "./connection";

export class MigrationManager {
  private drizzle: ReturnType<typeof drizzle>;
  private pool: Pool;

  constructor() {
    const { drizzle, pool } = getAppDatabase();
    this.drizzle = drizzle;
    this.pool = pool;
  }

  async runMigrations(): Promise<void> {
    try {
      console.log("🚀 Starting PostgreSQL migrations...");

      // Run migrations using Drizzle migrator
      await migrate(this.drizzle, {
        migrationsFolder: "./lib/database/migrations/postgres",
      });

      console.log("✅ Migrations completed successfully");
    } catch (error) {
      console.error("❌ Migration failed:", error);
      throw error;
    }
  }

  async createMigration(name: string, sql: string): Promise<string> {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\..+/, "");
    const fileName = `${timestamp}_${name}.sql`;
    const filePath = `./lib/database/migrations/postgres/${fileName}`;

    // Write migration file
    await this.writeMigrationFile(filePath, sql);

    return fileName;
  }

  private async writeMigrationFile(path: string, sql: string): Promise<void> {
    const fs = await import("fs/promises");
    await fs.writeFile(path, sql);
  }

  async getMigrationStatus(): Promise<{
    total: number;
    applied: number;
    pending: number;
    migrations: Array<{
      name: string;
      status: "applied" | "pending";
      applied_at?: string;
    }>;
  }> {
    try {
      // Query Drizzle migration table (schema/columns depend on Drizzle version)
      const result = await this.drizzle.execute(
        `SELECT name, created_at, executed_at FROM "__drizzle_migrations" ORDER BY created_at DESC`,
      );

      const rows = Array.isArray(result) ? result : (result.rows ?? []);
      const migrations = rows.map((row: any) => ({
        name: row.name,
        status: row.executed_at ? ("applied" as const) : ("pending" as const),
        applied_at: row.executed_at
          ? new Date(row.executed_at).toISOString()
          : undefined,
      }));

      return {
        total: migrations.length,
        applied: migrations.filter((m) => m.status === "applied").length,
        pending: migrations.filter((m) => m.status === "pending").length,
        migrations,
      };
    } catch (error) {
      console.error("Failed to get migration status:", error);
      return {
        total: 0,
        applied: 0,
        pending: 0,
        migrations: [],
      };
    }
  }

  async rollbackMigration(_migrationName: string): Promise<void> {
    // NOTE:
    // Automated down-migrations are intentionally not implemented here.
    // Design explicit, tested down-migrations if you require rollback via SQL.
    console.warn(
      "rollbackMigration is not implemented. Use forward-only migrations plus backups/restore.",
    );
  }

  async createMigrationTable(): Promise<void> {
    const sql = `
      -- Migration metadata table (example; align with Drizzle's actual schema)
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        executed_at TIMESTAMPTZ
      );
    `;

    await this.drizzle.execute(sql);
    console.log("✅ Migration table created/verified");
  }
}

// Export migration manager
export const migrationManager = new MigrationManager();

// Migration execution function
export async function runMigrations() {
  await migrationManager.runMigrations();
}
```

### Step 2: Create PostgreSQL Migration Files

#### Initial Migration: lib/database/migrations/postgres/001_initial_schema.sql

```sql
-- Initial database schema migration
-- Generated: 2025-01-11
-- Description: Create all Hyperpage tables with PostgreSQL syntax

-- Create tables
CREATE TABLE IF NOT EXISTS public.jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL,
  status TEXT NOT NULL,
  tool TEXT,
  endpoint TEXT,
  payload JSONB NOT NULL,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  persisted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recovery_attempts INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.job_history (
  id SERIAL PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES public.jobs(id),
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  limit_remaining INTEGER,
  limit_total INTEGER,
  reset_time TIMESTAMPTZ,
  last_updated TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tool_configs (
  tool_name TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT true NOT NULL,
  config JSONB,
  refresh_interval INTEGER,
  notifications BOOLEAN DEFAULT true NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_state (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  email TEXT,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer' NOT NULL,
  expires_at TIMESTAMPTZ,
  refresh_expires_at TIMESTAMPTZ,
  scopes TEXT,
  metadata JSONB,
  iv_access TEXT NOT NULL,
  iv_refresh TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs (created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_tool ON public.jobs (tool);

CREATE INDEX IF NOT EXISTS idx_job_history_job_id ON public.job_history (job_id);
CREATE INDEX IF NOT EXISTS idx_job_history_status ON public.job_history (status);

CREATE INDEX IF NOT EXISTS idx_rate_limits_platform ON public.rate_limits (platform);

CREATE INDEX IF NOT EXISTS idx_users_provider ON public.users (provider);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_id ON public.oauth_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_tool_name ON public.oauth_tokens (tool_name);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_provider ON public.user_sessions (provider);

-- Insert initial data
INSERT INTO public.app_state (key, value) VALUES
  ('version', '1.0.0'),
  ('migration_version', '001')
ON CONFLICT (key) DO NOTHING;
```

### Step 3: Update Migration Scripts

#### scripts/migrate.ts - TypeScript Migration Script

```typescript
import { migrationManager, runMigrations } from "@/lib/database/migrate";
import { getAppDatabase } from "@/lib/database/connection";

async function main() {
  try {
    console.log("🔧 Starting migration process...");

    // Initialize database connection
    const { drizzle } = getAppDatabase();

    // Create migration table if it doesn't exist
    await migrationManager.createMigrationTable();

    // Get current migration status
    const status = await migrationManager.getMigrationStatus();
    console.log(
      `📊 Migration status: ${status.applied}/${status.total} applied`,
    );

    if (status.pending > 0) {
      console.log(`⏳ Running ${status.pending} pending migrations...`);
      await runMigrations();
    } else {
      console.log("✅ All migrations are up to date");
    }

    // Verify final status
    const finalStatus = await migrationManager.getMigrationStatus();
    console.log(
      `✅ Final status: ${finalStatus.applied}/${finalStatus.total} applied`,
    );

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  main();
}

export { main as runMigration };
```

#### scripts/migrate.js - JavaScript Runner

```javascript
#!/usr/bin/env node

import("./dist/scripts/migrate.js")
  .then(({ runMigration }) => {
    return runMigration();
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
```

### Step 4: Test Database Setup

#### Update vitest.setup.ts for Test Database

```typescript
import { beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as schema from "@/lib/database/schema";

// Test database configuration
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://hyperpage_test:password@localhost:5432/hyperpage_test";

let testPool: Pool | null = null;
let testDb: ReturnType<typeof drizzle> | null = null;

export async function setupTestDatabase() {
  try {
    console.log("🧪 Setting up test database...");

    // Create connection pool for test database
    testPool = new Pool({
      connectionString: TEST_DATABASE_URL,
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    testDb = drizzle(testPool, { schema });

    // Run migrations
    await migrate(testDb, {
      migrationsFolder: "./lib/database/migrations/postgres",
    });

    console.log("✅ Test database setup complete");
  } catch (error) {
    console.error("❌ Test database setup failed:", error);
    throw error;
  }
}

export async function cleanupTestDatabase() {
  try {
    if (testPool) {
      await testPool.end();
      testPool = null;
      testDb = null;
    }
    console.log("🧹 Test database cleanup complete");
  } catch (error) {
    console.error("❌ Test database cleanup failed:", error);
  }
}

export function getTestDatabase() {
  if (!testDb || !testPool) {
    throw new Error(
      "Test database not initialized. Call setupTestDatabase() first.",
    );
  }
  return { drizzle: testDb, pool: testPool };
}

// Setup and cleanup hooks
beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await cleanupTestDatabase();
});
```

### Step 5: Environment Configuration

#### Test Environment Variables

```env
# Test Database Configuration
TEST_DATABASE_URL=postgresql://hyperpage_test:password@localhost:5432/hyperpage_test
TEST_POSTGRES_HOST=localhost
TEST_POSTGRES_PORT=5432
TEST_POSTGRES_DB=hyperpage_test
TEST_POSTGRES_USER=hyperpage_test
TEST_POSTGRES_PASSWORD=password
```

#### Development Environment Variables

```env
# Development Database
DATABASE_URL=postgresql://hyperpage:password@localhost:5432/hyperpage_dev
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=hyperpage_dev
POSTGRES_USER=hyperpage
POSTGRES_PASSWORD=password

# Migration Settings
MIGRATION_TIMEOUT=30000
MIGRATION_BATCH_SIZE=10
```

## Migration Safety Features

### Transaction Support

```typescript
// Execute migrations in transactions
async function runMigrationsWithTransaction() {
  const client = await this.pool.connect();

  try {
    await client.query("BEGIN");

    // Run migration within transaction
    await client.query(migrationSql);

    // Update migration metadata within same transaction
    await client.query(
      "INSERT INTO __drizzle_migrations (name, executed_at) VALUES (?, NOW())",
      [migrationName],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
```

### Concurrent Migration Protection

```typescript
// Lock mechanism to prevent concurrent migrations
async function acquireMigrationLock(): Promise<boolean> {
  const result = await this.drizzle.execute(`
    SELECT pg_try_advisory_lock(12345) as acquired
  `);

  return result.rows[0].acquired;
}

async function releaseMigrationLock(): Promise<void> {
  await this.drizzle.execute(`
    SELECT pg_advisory_unlock(12345)
  `);
}
```

## Validation Checklist

### Migration System

- [ ] Migration table created successfully
- [ ] Initial schema migration working
- [ ] Migration status tracking functional
- [ ] Transaction support implemented
- [ ] Concurrent migration safety working

### Test Database

- [ ] Test database setup working
- [ ] Migrations run in test environment
- [ ] Test cleanup functions working
- [ ] Test database isolation maintained

### Environment Configuration

- [ ] Development database variables set
- [ ] Test database variables configured
- [ ] Migration scripts executable
- [ ] Error handling robust

## Success Criteria

✅ **Migration system working with PostgreSQL**  
✅ **Initial schema created successfully**  
✅ **Migration status tracking functional**  
✅ **Test database setup working**  
✅ **Transaction support implemented**  
✅ **Migration scripts executable**

## Next Phase Prerequisites

- Migration system fully functional
- Test database working
- Initial schema created
- Migration status tracking operational
- Environment variables configured

---

**Phase 4 Status**: Ready for Implementation  
**Next**: [Phase 5: Kubernetes Configuration](phase-5-kubernetes.md)
