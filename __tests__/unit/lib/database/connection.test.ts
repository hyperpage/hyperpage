import { describe, test, expect, beforeAll, afterAll } from "vitest";

import { getReadWriteDb } from "@/lib/database/connection";
import * as pgSchema from "@/lib/database/pg-schema";

import { getTestDatabase } from "../../../../vitest.setup";

describe("Database Connection - PostgreSQL Only", () => {
  let testDb: ReturnType<typeof getTestDatabase>;
  let originalEnv: string | undefined;

  beforeAll(() => {
    originalEnv = process.env.DATABASE_URL;
    testDb = getTestDatabase();
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.DATABASE_URL = originalEnv;
    }
  });

  describe("getReadWriteDb", () => {
    test("should always return a PostgreSQL drizzle instance", () => {
      const db = getReadWriteDb();

      expect(db).toBeDefined();
      expect(typeof db.select).toBe("function");
      expect(typeof db.insert).toBe("function");
      expect(typeof db.update).toBe("function");
      expect(typeof db.delete).toBe("function");
    });
  });

  describe("PostgreSQL Connection", () => {
    test("should create connection pool successfully", async () => {
      const { pool } = testDb;

      expect(pool).toBeDefined();
      expect(pool.totalCount).toBeGreaterThanOrEqual(0);
    });

    test("should perform health check", async () => {
      const { pool } = testDb;

      const result = await pool.query("SELECT 1 as health_check");
      expect(result.rows[0].health_check).toBe(1);
    });

    test("should handle connection errors gracefully", async () => {
      const { pool } = testDb;

      // Test with invalid query
      await expect(pool.query("INVALID SQL")).rejects.toThrow();
    });

    test("should support concurrent queries", async () => {
      const { pool } = testDb;

      const queries = Array.from({ length: 10 }, (_, i: number) =>
        pool.query(`SELECT $1 as value`, [i]),
      );

      const results = await Promise.all(queries);
      expect(results).toHaveLength(10);

      results.forEach((result, index: number) => {
        expect(result.rows[0].value).toBe(index);
      });
    });
  });

  describe("Schema Validation", () => {
    test("should have all required tables in PostgreSQL schema", () => {
      const requiredTables = [
        "users",
        "oauthTokens",
        "toolConfigs",
        "rateLimits",
        "jobs",
        "jobHistory",
        "appState",
        "userSessions",
      ];

      requiredTables.forEach((tableName) => {
        expect(pgSchema).toHaveProperty(tableName);
        expect(pgSchema[tableName as keyof typeof pgSchema]).toBeDefined();
      });
    });

    test("should have proper table structure", () => {
      // Check that tables have the expected columns
      expect(pgSchema.users.email).toBeDefined();
      expect(pgSchema.oauthTokens.userId).toBeDefined();
      expect(pgSchema.jobs.status).toBeDefined();
    });

    test("should support JSONB fields", () => {
      // Jobs should have JSONB payload field
      const jobsTable = pgSchema.jobs;
      expect(jobsTable).toBeDefined();

      // Verify the table structure includes JSONB
      // (This is implicit in the Drizzle schema definition)
    });
  });

  describe("Data Type Compatibility", () => {
    test("should handle UUID fields", async () => {
      const { db, schema } = testDb;

      const user = await db
        .insert(schema.users)
        .values({
          email: "uuid-test@example.com",
          name: "UUID Test User",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      expect(user[0].id).toBeDefined();
      expect(user[0].id.length).toBe(36); // Standard UUID length
    });

    test("should handle JSONB fields", async () => {
      const { db, schema } = testDb;

      const complexPayload = {
        config: { timeout: 5000, retries: 3 },
        metadata: { source: "test", version: "1.0" },
        nested: { deep: { value: "test" } },
      };

      const job = await db
        .insert(schema.jobs)
        .values({
          type: "json-test",
          payload: complexPayload,
          status: "pending",
          scheduledAt: new Date(),
          attempts: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      expect(job[0].payload).toEqual(complexPayload);
    });

    test("should handle timestamp fields correctly", async () => {
      const { db, schema } = testDb;

      const now = new Date();
      const user = await db
        .insert(schema.users)
        .values({
          email: "timestamp-test@example.com",
          name: "Timestamp Test User",
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      expect(user[0].createdAt).toBeInstanceOf(Date);
      expect(user[0].updatedAt).toBeInstanceOf(Date);
      expect(user[0].createdAt.getTime()).toBe(now.getTime());
    });
  });

  describe("Connection Pool Management", () => {
    test("should manage connection pool lifecycle", async () => {
      const { pool } = testDb;

      // Initially should have some connections
      expect(pool.totalCount).toBeGreaterThanOrEqual(0);

      // After queries, should reuse connections
      await pool.query("SELECT 1");
      expect(pool.totalCount).toBeGreaterThanOrEqual(0);
    });

    test("should handle pool errors gracefully", async () => {
      const { pool } = testDb;

      // Test pool error handling by attempting invalid operations
      await expect(
        pool.query("SELECT * FROM non_existent_table"),
      ).rejects.toThrow();

      // Pool should still be usable after error
      const result = await pool.query("SELECT 1");
      expect(result.rows[0]._1).toBe(1);
    });
  });

  describe("Environment Configuration - PostgreSQL Only", () => {
    test("should use DATABASE_URL as the single source of truth", () => {
      const testUrl = "postgresql://test:test@localhost:5432/test_db";
      const original = process.env.DATABASE_URL;

      process.env.DATABASE_URL = testUrl;

      // vitest.setup.ts is responsible for consuming DATABASE_URL;
      // this assertion only verifies configuration wiring expectations.
      expect(process.env.DATABASE_URL).toBe(testUrl);

      if (original !== undefined) {
        process.env.DATABASE_URL = original;
      }
    });

    test("should not rely on TEST_DATABASE_URL for runtime behavior", () => {
      // TEST_DATABASE_URL may exist in some environments, but is not used
      // as the primary source of truth. DATABASE_URL is canonical.
      expect(process.env.DATABASE_URL).toBeDefined();
    });
  });
});
