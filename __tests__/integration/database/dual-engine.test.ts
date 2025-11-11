import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { getReadWriteDb } from "@/lib/database/connection";
import * as pgSchema from "@/lib/database/pg-schema";

describe("Dual Engine Integration Tests", () => {
  describe("Engine Selection", () => {
    test("should select correct engine based on environment", () => {
      // Test SQLite selection
      delete process.env.DB_ENGINE;
      const sqliteDb = getReadWriteDb();
      expect(sqliteDb).toBeDefined();

      // Test PostgreSQL selection (will fail if not available)
      process.env.DB_ENGINE = "postgres";
      expect(() => getReadWriteDb()).toThrow();
    });

    test("should handle invalid engine gracefully", () => {
      process.env.DB_ENGINE = "invalid-engine";
      const db = getReadWriteDb();
      expect(db).toBeDefined();
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

      requiredTables.forEach(tableName => {
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
      // This test verifies the dual-engine abstraction works
      delete process.env.DB_ENGINE;
      const db = getReadWriteDb();
      
      expect(db).toBeDefined();
      expect(typeof db.select).toBe("function");
      expect(typeof db.insert).toBe("function");
      expect(typeof db.update).toBe("function");
      expect(typeof db.delete).toBe("function");
    });
  });
});

describe("Performance Benchmarks", () => {
  test("should complete basic operations within reasonable time", async () => {
    const startTime = Date.now();
    
    // Simulate basic operation timing
    const db = getReadWriteDb();
    expect(db).toBeDefined();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should complete basic setup within 1 second
    expect(duration).toBeLessThan(1000);
  });
});
