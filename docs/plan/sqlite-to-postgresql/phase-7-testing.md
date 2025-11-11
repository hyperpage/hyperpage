# Phase 7: Testing & Validation

**Duration:** 3-4 hours  
**Status:** Ready for Implementation  
**Prerequisites:** Phase 1-6 completed

## Overview

This phase updates the testing framework to work with PostgreSQL, including unit tests, integration tests, performance validation, and comprehensive testing of all database functionality.

## Testing Strategy

### Test Categories

1. **Unit Tests**: Database operations and schema validation
2. **Integration Tests**: End-to-end database workflows
3. **Performance Tests**: Query performance and connection pooling
4. **Migration Tests**: Data integrity during migration
5. **API Tests**: Application API functionality with PostgreSQL

### Test Database Setup

- Separate test database for isolation
- Automated test data setup/teardown
- Migration testing with real data
- Performance benchmarking

## Implementation Steps

### Step 1: Update Test Database Configuration

#### vitest.setup.ts - PostgreSQL Test Setup

```typescript
import { beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as fs from "fs";
import * as path from "path";

// Test database configuration
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://hyperpage_test:password@localhost:5432/hyperpage_test";

let testPool: Pool | null = null;
let testDb: ReturnType<typeof drizzle> | null = null;

// Test utilities
export class TestDatabase {
  private pool: Pool;
  private db: ReturnType<typeof drizzle>;

  constructor() {
    this.pool = new Pool({
      connectionString: TEST_DATABASE_URL,
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    this.db = drizzle(this.pool);
  }

  async setup(): Promise<void> {
    try {
      console.log("🧪 Setting up test database...");

      // Drop and recreate test database
      await this.dropDatabase();
      await this.createDatabase();
      await this.runMigrations();

      console.log("✅ Test database setup complete");
    } catch (error) {
      console.error("❌ Test database setup failed:", error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      console.log("🧹 Cleaning up test database...");
      await this.dropDatabase();
      await this.pool.end();
      console.log("✅ Test database cleanup complete");
    } catch (error) {
      console.error("❌ Test database cleanup failed:", error);
    }
  }

  private async createDatabase(): Promise<void> {
    const tempPool = new Pool({
      connectionString: TEST_DATABASE_URL.replace(
        "/hyperpage_test",
        "/postgres",
      ),
      max: 1,
    });

    try {
      await tempPool.query(`CREATE DATABASE hyperpage_test`);
    } catch (error) {
      // Database might already exist
      console.log("Test database already exists");
    } finally {
      await tempPool.end();
    }
  }

  private async dropDatabase(): Promise<void> {
    const tempPool = new Pool({
      connectionString: TEST_DATABASE_URL.replace(
        "/hyperpage_test",
        "/postgres",
      ),
      max: 1,
    });

    try {
      // Terminate all connections to test database
      await tempPool.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = 'hyperpage_test'
        AND pid <> pg_backend_pid()
      `);

      await tempPool.query(`DROP DATABASE IF EXISTS hyperpage_test`);
    } catch (error) {
      console.log("Database cleanup: No existing database to drop");
    } finally {
      await tempPool.end();
    }
  }

  private async runMigrations(): Promise<void> {
    await migrate(this.db, {
      migrationsFolder: "./lib/database/migrations/postgres",
    });
  }

  async seedTestData(): Promise<void> {
    // Insert test data for all tables
    const testData = this.getTestData();

    for (const [tableName, data] of Object.entries(testData)) {
      if (data.length > 0) {
        const columns = Object.keys(data[0]);
        const values = data.map((row) => columns.map((col) => row[col]));

        await this.db.execute(
          `
          INSERT INTO ${tableName} (${columns.join(", ")})
          VALUES ${values
            .map(
              (_, i) =>
                `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(", ")})`,
            )
            .join(", ")}
        `,
          values.flat(),
        );
      }
    }
  }

  private getTestData(): Record<string, any[]> {
    return {
      app_state: [
        { key: "version", value: "1.0.0", updated_at: new Date() },
        { key: "test_key", value: "test_value", updated_at: new Date() },
      ],
      jobs: [
        {
          id: "test-job-1",
          type: "test",
          name: "Test Job 1",
          priority: 1,
          status: "pending",
          payload: { test: true },
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      users: [
        {
          id: "test-user-1",
          provider: "github",
          provider_user_id: "12345",
          email: "test@example.com",
          username: "testuser",
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    };
  }

  getDb() {
    return this.db;
  }

  getPool() {
    return this.pool;
  }
}

export const testDatabase = new TestDatabase();

// Setup hooks
beforeAll(async () => {
  await testDatabase.setup();
});

afterAll(async () => {
  await testDatabase.cleanup();
});

// Reset data between tests
beforeEach(async () => {
  // Clear all tables before each test
  const { pool } = { pool: testDatabase.getPool() };

  const tables = [
    "jobs",
    "job_history",
    "rate_limits",
    "tool_configs",
    "app_state",
    "users",
    "oauth_tokens",
    "user_sessions",
  ];

  for (const table of tables) {
    try {
      await pool.query(`DELETE FROM ${table}`);
    } catch (error) {
      // Table might not exist yet
    }
  }

  // Reset sequences
  try {
    await pool.query("ALTER SEQUENCE job_history_id_seq RESTART WITH 1");
    await pool.query("ALTER SEQUENCE oauth_tokens_id_seq RESTART WITH 1");
  } catch (error) {
    // Sequences might not exist
  }
});

// Mock database connection for tests
export function mockDatabase() {
  return {
    db: testDatabase.getDb(),
    pool: testDatabase.getPool(),
  };
}
```

### Step 2: Database Unit Tests

#### **tests**/unit/lib/database/connection.test.ts

```typescript
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { testDatabase } from "../../../vitest.setup";

describe("Database Connection", () => {
  beforeEach(async () => {
    // Setup test database for each test
    await testDatabase.setup();
  });

  afterEach(async () => {
    await testDatabase.cleanup();
  });

  test("should create connection pool successfully", async () => {
    const { pool } = mockDatabase();

    expect(pool).toBeDefined();
    expect(pool.totalCount).toBeGreaterThanOrEqual(0);
  });

  test("should perform health check", async () => {
    const { pool } = mockDatabase();

    const result = await pool.query("SELECT 1 as health_check");
    expect(result.rows[0].health_check).toBe(1);
  });

  test("should handle connection errors gracefully", async () => {
    const { pool } = mockDatabase();

    // Test with invalid query
    await expect(pool.query("INVALID SQL")).rejects.toThrow();
  });

  test("should support concurrent queries", async () => {
    const { pool } = mockDatabase();

    const queries = Array.from({ length: 10 }, (_, i) =>
      pool.query(`SELECT ${i} as value`),
    );

    const results = await Promise.all(queries);
    expect(results).toHaveLength(10);

    results.forEach((result, index) => {
      expect(result.rows[0].value).toBe(index);
    });
  });
});
```

#### **tests**/unit/lib/database/schema.test.ts

```typescript
import { describe, test, expect, beforeEach } from "vitest";
import { testDatabase } from "../../../vitest.setup";
import * as schema from "@/lib/database/schema";

describe("Database Schema", () => {
  let db: ReturnType<typeof testDatabase.getDb>;

  beforeEach(async () => {
    db = testDatabase.getDb();
    await testDatabase.seedTestData();
  });

  describe("Jobs Table", () => {
    test("should create job record", async () => {
      const newJob = {
        id: "test-job-123",
        type: "test",
        name: "Test Job",
        priority: 1,
        status: "pending",
        payload: { test: true },
        created_at: new Date(),
        updated_at: new Date(),
      };

      const result = await db.insert(schema.jobs).values(newJob).returning();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("test-job-123");
      expect(result[0].status).toBe("pending");
    });

    test("should retrieve job record", async () => {
      const result = await db.select().from(schema.jobs);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("test-job-1");
    });

    test("should update job status", async () => {
      await db
        .update(schema.jobs)
        .set({ status: "completed", updated_at: new Date() })
        .where(schema.jobs.id.eq("test-job-1"))
        .returning();

      const updated = await db
        .select()
        .from(schema.jobs)
        .where(schema.jobs.id.eq("test-job-1"));
      expect(updated[0].status).toBe("completed");
    });

    test("should handle JSONB payload", async () => {
      const complexPayload = {
        config: { timeout: 5000, retries: 3 },
        metadata: { source: "test", version: "1.0" },
      };

      const result = await db
        .insert(schema.jobs)
        .values({
          id: "json-test-job",
          type: "json",
          name: "JSON Test",
          priority: 1,
          status: "pending",
          payload: complexPayload,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning();

      expect(result[0].payload).toEqual(complexPayload);
    });
  });

  describe("Users Table", () => {
    test("should create user record", async () => {
      const newUser = {
        id: "user-123",
        provider: "github",
        provider_user_id: "github-123",
        email: "user@example.com",
        username: "testuser",
        created_at: new Date(),
        updated_at: new Date(),
      };

      const result = await db.insert(schema.users).values(newUser).returning();
      expect(result).toHaveLength(1);
      expect(result[0].provider).toBe("github");
    });

    test("should handle timestamps correctly", async () => {
      const user = await db
        .select()
        .from(schema.users)
        .where(schema.users.id.eq("test-user-1"));
      expect(user[0].created_at).toBeInstanceOf(Date);
      expect(user[0].updated_at).toBeInstanceOf(Date);
    });
  });

  describe("Foreign Key Relationships", () => {
    test("should enforce job history foreign key", async () => {
      // This should succeed - valid job_id
      const jobHistory = {
        job_id: "test-job-1",
        attempt: 1,
        status: "started",
        started_at: new Date(),
      };

      const result = await db
        .insert(schema.jobHistory)
        .values(jobHistory)
        .returning();
      expect(result).toHaveLength(1);
    });

    test("should reject invalid job_id foreign key", async () => {
      const invalidJobHistory = {
        job_id: "non-existent-job",
        attempt: 1,
        status: "started",
        started_at: new Date(),
      };

      await expect(
        db.insert(schema.jobHistory).values(invalidJobHistory),
      ).rejects.toThrow();
    });
  });

  describe("Indexes", () => {
    test("should use indexes for common queries", async () => {
      // Test status index
      const result = await db
        .select()
        .from(schema.jobs)
        .where(schema.jobs.status.eq("pending"));
      expect(result).toHaveLength(1);
    });

    test("should support created_at sorting", async () => {
      const result = await db
        .select()
        .from(schema.jobs)
        .orderBy(schema.jobs.createdAt);
      expect(result).toBeSortedBy("createdAt", { ascending: true });
    });
  });
});
```

### Step 3: Integration Tests

#### **tests**/integration/database/migration.test.ts

```typescript
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { Pool } from "pg";
import { exportSQLiteData } from "@/lib/database/export-sqlite";
import { importPostgreSQLData } from "@/lib/database/import-postgresql";
import { testDatabase } from "../../../vitest.setup";

describe("Database Migration Integration", () => {
  let sqliteDb: Database.Database;
  let pgPool: Pool;
  let tempSqlitePath: string;
  let tempExportPath: string;

  beforeAll(async () => {
    // Setup temporary files
    tempSqlitePath = "./temp-test-sqlite.db";
    tempExportPath = "./temp-test-export.sql";

    // Create SQLite database with test data
    sqliteDb = new Database(tempSqlitePath);

    // Create tables matching the original schema
    sqliteDb.exec(`
      CREATE TABLE jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        priority INTEGER NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        result TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        provider_user_id TEXT NOT NULL,
        email TEXT,
        username TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Insert test data
    const now = Date.now();
    sqliteDb
      .prepare(
        `
      INSERT INTO jobs (id, type, name, priority, status, payload, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        "test-job-1",
        "test",
        "Test Job",
        1,
        "pending",
        JSON.stringify({ test: true }),
        now,
        now,
      );

    sqliteDb
      .prepare(
        `
      INSERT INTO users (id, provider, provider_user_id, email, username, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run("user-1", "github", "123", "test@example.com", "testuser", now, now);

    // Setup PostgreSQL test database
    await testDatabase.setup();
    pgPool = testDatabase.getPool();
  });

  afterAll(async () => {
    // Cleanup
    sqliteDb.close();
    await testDatabase.cleanup();

    // Remove temporary files
    try {
      const fs = await import("fs/promises");
      await fs.unlink(tempSqlitePath);
      await fs.unlink(tempExportPath);
    } catch (error) {
      // Files might not exist
    }
  });

  test("should export data from SQLite", async () => {
    await exportSQLiteData(tempSqlitePath, tempExportPath, {
      includeSchema: false,
      outputFormat: "sql",
    });

    const fs = await import("fs/promises");
    const exportContent = await fs.readFile(tempExportPath, "utf8");

    expect(exportContent).toContain("INSERT INTO jobs");
    expect(exportContent).toContain("INSERT INTO users");
    expect(exportContent).toContain("Test Job");
    expect(exportContent).toContain("testuser");
  });

  test("should import data into PostgreSQL", async () => {
    const importResult = await importPostgreSQLData(pgPool, tempExportPath);

    expect(importResult.success).toBe(true);
    expect(importResult.tablesImported).toBeGreaterThan(0);
    expect(importResult.totalRowsImported).toBeGreaterThan(0);
  });

  test("should maintain data integrity during migration", async () => {
    // Verify data was imported correctly
    const jobsResult = await pgPool.query("SELECT COUNT(*) as count FROM jobs");
    const usersResult = await pgPool.query(
      "SELECT COUNT(*) as count FROM users",
    );

    expect(parseInt(jobsResult.rows[0].count)).toBe(1);
    expect(parseInt(usersResult.rows[0].count)).toBe(1);

    // Verify specific data
    const jobResult = await pgPool.query("SELECT * FROM jobs WHERE id = $1", [
      "test-job-1",
    ]);
    expect(jobResult.rows[0].name).toBe("Test Job");
    expect(jobResult.rows[0].status).toBe("pending");

    const userResult = await pgPool.query("SELECT * FROM users WHERE id = $1", [
      "user-1",
    ]);
    expect(userResult.rows[0].email).toBe("test@example.com");
    expect(userResult.rows[0].username).toBe("testuser");
  });

  test("should convert timestamps correctly", async () => {
    const jobResult = await pgPool.query(
      "SELECT created_at FROM jobs WHERE id = $1",
      ["test-job-1"],
    );
    const createdAt = jobResult.rows[0].created_at;

    expect(createdAt).toBeInstanceOf(Date);
    expect(createdAt.getTime()).toBeGreaterThan(0);
  });
});
```

#### **tests**/integration/api/database.test.ts

```typescript
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { testDatabase } from "../../../vitest.setup";
import * as schema from "@/lib/database/schema";

describe("API Database Integration", () => {
  let db: ReturnType<typeof testDatabase.getDb>;

  beforeAll(async () => {
    await testDatabase.setup();
    db = testDatabase.getDb();
  });

  afterAll(async () => {
    await testDatabase.cleanup();
  });

  test("should handle complete job workflow", async () => {
    // 1. Create job
    const newJob = await db
      .insert(schema.jobs)
      .values({
        id: "workflow-test-job",
        type: "workflow",
        name: "Workflow Test Job",
        priority: 2,
        status: "pending",
        payload: { workflow: "test" },
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    expect(newJob[0].id).toBe("workflow-test-job");
    expect(newJob[0].status).toBe("pending");

    // 2. Update job status
    const updatedJob = await db
      .update(schema.jobs)
      .set({
        status: "processing",
        started_at: new Date(),
        updated_at: new Date(),
      })
      .where(schema.jobs.id.eq("workflow-test-job"))
      .returning();

    expect(updatedJob[0].status).toBe("processing");
    expect(updatedJob[0].started_at).toBeInstanceOf(Date);

    // 3. Create job history
    await db.insert(schema.jobHistory).values({
      job_id: "workflow-test-job",
      attempt: 1,
      status: "processing",
      started_at: new Date(),
    });

    // 4. Complete job
    const completedJob = await db
      .update(schema.jobs)
      .set({
        status: "completed",
        completed_at: new Date(),
        updated_at: new Date(),
        result: { success: true },
      })
      .where(schema.jobs.id.eq("workflow-test-job"))
      .returning();

    expect(completedJob[0].status).toBe("completed");

    // 5. Verify job history
    const history = await db
      .select()
      .from(schema.jobHistory)
      .where(schema.jobHistory.jobId.eq("workflow-test-job"));

    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("processing");
  });

  test("should handle user authentication workflow", async () => {
    // 1. Create user
    const newUser = await db
      .insert(schema.users)
      .values({
        id: "auth-test-user",
        provider: "github",
        provider_user_id: "github-456",
        email: "authtest@example.com",
        username: "authtest",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    expect(newUser[0].id).toBe("auth-test-user");

    // 2. Create OAuth token
    await db.insert(schema.oauthTokens).values({
      user_id: "auth-test-user",
      tool_name: "github",
      access_token: "test-access-token",
      token_type: "Bearer",
      iv_access: "test-iv",
      created_at: new Date(),
      updated_at: new Date(),
    });

    // 3. Create session
    await db.insert(schema.userSessions).values({
      session_id: "test-session-123",
      user_id: "auth-test-user",
      provider: "github",
      created_at: new Date(),
      last_activity: new Date(),
    });

    // 4. Verify relationships
    const tokens = await db
      .select()
      .from(schema.oauthTokens)
      .where(schema.oauthTokens.userId.eq("auth-test-user"));

    expect(tokens).toHaveLength(1);
    expect(tokens[0].toolName).toBe("github");

    const sessions = await db
      .select()
      .from(schema.userSessions)
      .where(schema.userSessions.userId.eq("auth-test-user"));

    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe("test-session-123");
  });

  test("should handle rate limiting", async () => {
    // 1. Set rate limit
    await db.insert(schema.rateLimits).values({
      id: "github-rate-limit",
      platform: "github",
      limit_remaining: 5000,
      limit_total: 5000,
      reset_time: new Date(Date.now() + 3600000), // 1 hour from now
      last_updated: new Date(),
      created_at: new Date(),
    });

    // 2. Update rate limit
    await db
      .update(schema.rateLimits)
      .set({
        limit_remaining: 4999,
        last_updated: new Date(),
      })
      .where(schema.rateLimits.id.eq("github-rate-limit"))
      .returning();

    // 3. Verify rate limit
    const rateLimit = await db
      .select()
      .from(schema.rateLimits)
      .where(schema.rateLimits.id.eq("github-rate-limit"));

    expect(rateLimit[0].limitRemaining).toBe(4999);
    expect(rateLimit[0].platform).toBe("github");
  });
});
```

### Step 4: Performance Tests

#### **tests**/performance/database.test.ts

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { testDatabase } from '../../../vitest.setup';
import * as schema from '@/lib/database/schema';

describe('Database Performance', () => {
  let db: ReturnType<typeof testDatabase.getDb>;
  let pool: ReturnType<typeof testDatabase.getPool>;

  beforeAll(async () => {
    await testDatabase.setup();
    db = testDatabase.getDb();
    pool = testDatabase.getPool();
  });

  afterAll(async () => {
    await testDatabase.cleanup();
  });

  test('should handle concurrent connections', async () => {
    const startTime = Date.now();
    const concurrentQueries = 50;

    const queries = Array.from({ length: concurrentQueries }, async (_, i) => {
      const start = Date.now();
      await pool.query('SELECT $1 as test, NOW() as timestamp', [i]);
      return Date.now() - start;
    });

    const results = await Promise.all(queries);
    const averageTime = results.reduce((a, b) => a + b, 0) / results.length;
    const totalTime = Date.now() - startTime;

    console.log(`Concurrent queries (${concurrentQueries}):`);
    console.log(`Average: ${averageTime}ms, Total: ${totalTime}ms`);

    expect(averageTime).toBeLessThan(1000); // Should be under 1 second average
    expect(totalTime).toBeLessThan(10000); // Total should be under 10 seconds
  });

  test('should efficiently handle bulk inserts', async () => {
    const bulkSize = 1000;
    const startTime = Date.now();

    const jobs = Array.from({ length: bulkSize }, (_, i) => ({
      id: `bulk-job-${i}`,
      type: 'bulk',
      name: `Bulk Job ${i}`,
      priority: 1,
      status: 'pending',
      payload: { index: i },
      created_at: new Date(),
      updated_at: new Date()
    }));

    await db.insert(schema.jobs).values(jobs);
    const duration = Date.now() - startTime;

    console.log(`Bulk insert (${bulkSize} records): ${duration}ms`);

    expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds

    // Verify all records were inserted
    const count = await db.select().from(schema.jobs).where(schema.jobs.type.eq('bulk'));
    expect(count).toHaveLength(bulkSize);
  });

  test('should use indexes effectively', async () => {
    // Create test data
    const jobs = Array.from({ length: 100 }, (_, i) => ({
      id: `index-test-job-${i}`,
      type: 'index-test',
      name: `Index Test Job ${i}`,
      priority: i % 3, // 0, 1, or 2
      status: i % 2 === 0 ? 'pending' : 'processing',
      payload: { index: i },
      created_at: new Date(Date.now() - i * 1000),
      updated_at: new Date(Date.now() - i * 1000)
    }));

    await db.insert(schema.jobs).values(jobs);

    // Test status index performance
    const startTime = Date.now();
    const pendingJobs = await db.select()
      .from(schema.jobs)
      .where(schema.jobs.status.eq('pending'))
      .orderBy(schema.jobs.createdAt);
    const statusQueryTime = Date.now() - startTime;

    console.log(`Status index query: ${statusQueryTime}ms`);
    expect(statusQueryTime).toBeLessThan(100); // Should be very fast with index

    // Test created_at index performance
    startTime = Date.now();
    const recentJobs = await db.select()
      .from(schema.jobs)
      .where(schema.jobs.createdAt.gt(new Date(Date.now() - 50000))) // Last 50 seconds
      .orderBy(schema.jobs.createdAt);
    const timeQueryTime = Date.now() - startTime;

    console.log(`Time index query: ${timeQueryTime}ms`);
    expect(timeQueryTime).toBeLessThan(100); // Should be very fast with index
  });

  test('should handle complex queries efficiently', async () => {
    // Create test data
    await testDatabase.seedTestData();

    // Add some job history
    const histories = Array.from({ length: 50 }, (_, i) => ({
      job_id: 'test-job-1',
      attempt: i + 1,
      status: i % 2 === 0 ? 'success' : 'failed',
      started_at: new Date(Date.now() - i * 1000),
      duration_ms: Math.floor(Math.random() * 10000) + 1000
    }));

    await db.insert(schema.jobHistory).values(histories);

    // Complex query with joins
    const startTime = Date.now();
    const result = await db.execute(`
      SELECT
        j.id,
        j.name,
        j.status,
        COUNT(jh.id) as attempt_count,
        AVG(jh.duration_ms) as avg_duration
      FROM jobs j
      LEFT JOIN job_history jh ON j.id = jh.job_id
      WHERE j.type = 'test'
      GROUP BY j.id, j.name, j.status
      ORDER BY j.created_at DESC
    `);
    const queryTime = Date.now() - startTime;

    console.log(`Complex join query: ${queryTime}ms`);
    expect(queryTime).toBeLessThan(500); // Should complete in under 0.5 seconds
    expect(result.rows).toBeDefined();
  });

  test('should handle JSONB operations efficiently', async () => {
    const startTime = Date.now();

    // Create jobs with complex JSON payloads
    const jsonJobs = Array.from({ length: 100 }, (_, i) => ({
      id: `json-test-${i}`,
      type: 'json-perf',
      name: `JSON Performance Test ${i}`,
      priority: 1,
      status: 'pending',
      payload: {
        config: {
          timeout: 5000 + i,
          retries: Math.floor(Math.random() * 5) + 1,
          endpoints: Array.from({ length: 10 }, (_, j) => `endpoint-${j}`)
        },
        metadata: {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          tags: [`tag-${i}`, 'performance', 'test']
        }
      },
      created_at: new Date(),
      updated_at: new Date()
    }));

    await db.insert(schema.jobs).values(jsonJobs);
    const insertTime = Date.now() - startTime;

    console.log(`JSONB insert (100 records): ${insertTime}ms`);
    expect(insertTime).toBeLessThan(3000); // Should complete in under 3 seconds

    // Test JSONB query performance
    const queryStartTime = Date.now();
    const jsonResults = await db.select()
      .from(schema.jobs)
      .where(schema.jobs.payload->>'metadata.version'.eq('1.0.0'));
    const queryTime = Date.now() - queryStartTime;

    console.log(`JSONB query (100 records): ${queryTime}ms`);
    expect(queryTime).toBeLessThan(200); // Should be fast with JSONB index
    expect(jsonResults).toHaveLength(100);
  });
});
```

### Step 5: Test Scripts

#### package.json Test Scripts

```json
{
  "scripts": {
    "test:db": "vitest run --config vitest.config.ts tests/database",
    "test:db:unit": "vitest run --config vitest.config.ts tests/unit/lib/database",
    "test:db:integration": "vitest run --config vitest.config.ts tests/integration/database",
    "test:db:performance": "vitest run --config vitest.config.ts tests/performance/database",
    "test:db:watch": "vitest --config vitest.config.ts tests/database --watch",
    "test:migration": "npm run test:db:integration",
    "test:coverage:db": "vitest run --config vitest.config.ts tests/database --coverage"
  }
}
```

## Validation Checklist

### Test Database

- [ ] Test database setup working
- [ ] Test data seeding functional
- [ ] Database isolation maintained
- [ ] Cleanup procedures working

### Unit Tests

- [ ] Database connection tests passing
- [ ] Schema validation tests working
- [ ] CRUD operations tested
- [ ] Foreign key constraints tested
- [ ] Index performance verified

### Integration Tests

- [ ] Migration tests passing
- [ ] API database integration working
- [ ] Complex workflows tested
- [ ] Data integrity maintained

### Performance Tests

- [ ] Connection pooling performance verified
- [ ] Bulk operations tested
- [ ] Index effectiveness confirmed
- [ ] JSONB operations optimized
- [ ] Concurrent query handling verified

## Success Criteria

✅ **All database tests passing**  
✅ **Test database isolation working**  
✅ **Migration tests successful**  
✅ **Performance benchmarks met**  
✅ **API integration verified**  
✅ **Data integrity maintained**

## Next Phase Prerequisites

- All tests passing
- Performance benchmarks established
- Migration testing completed
- Database functionality verified
- Test coverage adequate

---

**Phase 7 Status**: Ready for Implementation  
**Next**: [Phase 8: Production Deployment](phase-8-deployment.md)
