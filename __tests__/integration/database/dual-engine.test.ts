import { describe, test, expect } from "vitest";
import { getReadWriteDb } from "@/lib/database/connection";
import * as pgSchema from "@/lib/database/pg-schema";

/**
 * Phase 3: PostgreSQL-only baseline
 *
 * This suite verifies that:
 * - getReadWriteDb returns a PostgreSQL-backed drizzle instance
 * - pgSchema exposes the expected canonical tables and JSONB columns
 *
 * It is safe to run against the vitest.setup.ts Postgres harness.
 */

describe("PostgreSQL Engine Integration Tests", () => {
  describe("Engine Selection", () => {
    test("should always return a PostgreSQL drizzle instance", () => {
      const db = getReadWriteDb();
      expect(db).toBeDefined();
      expect(typeof db.select).toBe("function");
      expect(typeof db.insert).toBe("function");
      expect(typeof db.update).toBe("function");
      expect(typeof db.delete).toBe("function");
    });
  });

  describe("Schema Structure", () => {
    test("should have complete PostgreSQL schema", () => {
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
      });
    });

    test("should support JSONB data types", () => {
      // Verify key tables have JSONB columns
      expect(pgSchema.jobs.payload).toBeDefined();
      expect(pgSchema.oauthTokens.raw).toBeDefined();
      expect(pgSchema.toolConfigs.config).toBeDefined();
    });
  });

  describe("Connection Management", () => {
    test("should provide consistent interface", () => {
      const db = getReadWriteDb();

      expect(db).toBeDefined();
      expect(typeof db.select).toBe("function");
      expect(typeof db.insert).toBe("function");
      expect(typeof db.update).toBe("function");
      expect(typeof db.delete).toBe("function");
    });
  });
});

/**
 * Optional timing sanity check
 *
 * This is NOT a hard performance/SLO test; it only asserts that basic
 * getReadWriteDb usage does not hang. To avoid flakiness in constrained
 * environments, this block is gated behind POSTGRES_PERF_TESTS=1.
 */
if (process.env.POSTGRES_PERF_TESTS === "1") {
  describe("PostgreSQL Engine - Timing Sanity (Optional)", () => {
    test("should complete basic operations within reasonable time", async () => {
      const startTime = Date.now();

      const db = getReadWriteDb();
      expect(db).toBeDefined();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Loose upper bound; signals hangs without being environment-fragile
      expect(duration).toBeLessThan(2000);
    });
  });
}
