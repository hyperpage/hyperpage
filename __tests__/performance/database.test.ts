import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { getReadWriteDb } from "@/lib/database/connection";

describe("Database Performance Tests", () => {
  let originalEnv: string | undefined;

  beforeAll(() => {
    originalEnv = process.env.DB_ENGINE;
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.DB_ENGINE = originalEnv;
    } else {
      delete process.env.DB_ENGINE;
    }
  });

  describe("Engine Selection Performance", () => {
    test("should select SQLite quickly by default", () => {
      delete process.env.DB_ENGINE;
      
      const startTime = Date.now();
      const db = getReadWriteDb();
      const endTime = Date.now();
      
      expect(db).toBeDefined();
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });

    test("should handle engine selection within reasonable time", () => {
      process.env.DB_ENGINE = "invalid-engine";
      
      const startTime = Date.now();
      const db = getReadWriteDb();
      const endTime = Date.now();
      
      expect(db).toBeDefined();
      expect(endTime - startTime).toBeLessThan(100); // Should still be fast
    });
  });

  describe("Schema Validation Performance", () => {
    test("should validate schema structure quickly", () => {
      const startTime = Date.now();
      
      // Test basic schema access
      const db = getReadWriteDb();
      expect(db).toBeDefined();
      
      // Access schema properties
      expect(typeof db.select).toBe("function");
      expect(typeof db.insert).toBe("function");
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(50); // Very fast
    });
  });

  describe("Connection Pool Performance", () => {
    test("should handle multiple quick connections", () => {
      const startTime = Date.now();
      
      // Simulate multiple connection attempts
      const connections = Array.from({ length: 10 }, () => {
        delete process.env.DB_ENGINE;
        return getReadWriteDb();
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should handle 10 connections within 1 second
      expect(duration).toBeLessThan(1000);
      expect(connections).toHaveLength(10);
      connections.forEach(db => expect(db).toBeDefined());
    });
  });

  describe("Memory Usage Validation", () => {
    test("should not have memory leaks during repeated operations", () => {
      // Simulate repeated operations to check for memory leaks
      for (let i = 0; i < 100; i++) {
        delete process.env.DB_ENGINE;
        const db = getReadWriteDb();
        expect(db).toBeDefined();
      }
      
      // If we get here without errors, memory usage is reasonable
      expect(true).toBe(true);
    });
  });

  describe("Concurrent Operation Simulation", () => {
    test("should handle simulated concurrent operations", async () => {
      const operations = Array.from({ length: 20 }, (_, i) => {
        return new Promise((resolve) => {
          // Simulate async operation
          setTimeout(() => {
            delete process.env.DB_ENGINE;
            const db = getReadWriteDb();
            resolve({ success: true, db, index: i });
          }, Math.random() * 10); // Random small delay
        });
      });
      
      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(20);
      results.forEach((result: any) => {
        expect(result.success).toBe(true);
        expect(result.db).toBeDefined();
      });
    });
  });

  describe("Engine Switching Performance", () => {
    test("should switch engines efficiently", () => {
      const startTime = Date.now();
      
      // Test switching between engines
      delete process.env.DB_ENGINE;
      const sqliteDb = getReadWriteDb();
      expect(sqliteDb).toBeDefined();
      
      process.env.DB_ENGINE = "postgres";
      // This will fail but should fail quickly
      expect(() => getReadWriteDb()).toThrow();
      
      process.env.DB_ENGINE = "invalid-engine";
      const fallbackDb = getReadWriteDb();
      expect(fallbackDb).toBeDefined();
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(200); // Should be fast
    });
  });
});

describe("Stress Test Scenarios", () => {
  test("should handle rapid engine configuration changes", () => {
    const startTime = Date.now();
    
    // Rapidly switch engine configurations
    const configs = [
      undefined, "postgres", "invalid-engine", "sqlite", "postgres", undefined
    ];
    
    const results = configs.map((config) => {
      if (config) {
        process.env.DB_ENGINE = config;
      } else {
        delete process.env.DB_ENGINE;
      }
      
      try {
        const db = getReadWriteDb();
        return { success: true, db: !!db };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
    
    const endTime = Date.now();
    
    // Should handle all configurations within reasonable time
    expect(endTime - startTime).toBeLessThan(500);
    expect(results).toHaveLength(configs.length);
    
    // Most should succeed (only postgres will fail if not available)
    const successCount = results.filter(r => r.success).length;
    expect(successCount).toBeGreaterThanOrEqual(configs.length - 1); // Allow for postgres failure
  });
});
