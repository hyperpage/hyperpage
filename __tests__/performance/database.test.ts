import { describe, test, expect } from "vitest";
import { getReadWriteDb } from "@/lib/database/connection";

/**
 * Database Performance Tests (PostgreSQL-only, Optional CI/Performance Suite)
 *
 * This suite:
 * - Exercises getReadWriteDb() behavior in a lightweight timing-oriented way
 * - Assumes a properly configured PostgreSQL instance behind vitest.setup.ts
 *
 * It MUST be:
 * - Explicitly opt-in via PERFORMANCE_TESTS=1
 * - Treated as CI/enterprise-only coverage, never a default local blocker
 *
 * Default behavior:
 * - If PERFORMANCE_TESTS is not set to "1", this suite is fully skipped so default
 *   `vitest` runs remain focused on structural correctness and hermetic units.
 */
const shouldRunDatabasePerformanceSuite = process.env.PERFORMANCE_TESTS === "1";

const describeDatabasePerformance = shouldRunDatabasePerformanceSuite
  ? describe
  : describe.skip;

describeDatabasePerformance(
  "Database Performance Tests (PostgreSQL-only, Optional CI/Performance Suite)",
  () => {
    describe("Connection Initialization Performance", () => {
      test("should initialize getReadWriteDb quickly", () => {
        const startTime = Date.now();
        const db = getReadWriteDb();
        const endTime = Date.now();

        expect(db).toBeDefined();
        expect(typeof db.select).toBe("function");
        expect(endTime - startTime).toBeLessThan(500);
      });
    });

    describe("Schema Validation Performance", () => {
      test("should validate basic query interface quickly", () => {
        const startTime = Date.now();

        const db = getReadWriteDb();
        expect(db).toBeDefined();
        expect(typeof db.select).toBe("function");
        expect(typeof db.insert).toBe("function");

        const endTime = Date.now();
        expect(endTime - startTime).toBeLessThan(200);
      });
    });

    describe("Connection Pool Simulation", () => {
      test("should handle multiple sequential getReadWriteDb calls", () => {
        const startTime = Date.now();

        const connections = Array.from({ length: 10 }, () => getReadWriteDb());

        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(duration).toBeLessThan(1000);
        expect(connections).toHaveLength(10);
        connections.forEach((db) => expect(db).toBeDefined());
      });
    });

    describe("Concurrent Operation Simulation", () => {
      test("should handle simulated concurrent getReadWriteDb usage", async () => {
        const operations = Array.from({ length: 20 }, async () => {
          const db = getReadWriteDb();
          return { success: true, db };
        });

        const results = await Promise.all(operations);

        expect(results).toHaveLength(20);
        results.forEach((result) => {
          expect(result.success).toBe(true);
          expect(result.db).toBeDefined();
        });
      });
    });
  },
);
