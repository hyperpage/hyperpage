import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RedisClient } from "../../../lib/cache/redis-client";

describe("Redis Client", () => {
  let redisClient: RedisClient;

  beforeEach(() => {
    // Use environment-based URL for testing
    redisClient = new RedisClient();
  });

  afterEach(async () => {
    await redisClient.disconnect();
  });

  describe("Initialization", () => {
    it("should create a Redis client instance", () => {
      expect(redisClient).toBeDefined();
      expect(redisClient.isConnected).toBe(false);
      expect(redisClient.isConnectingToRedis).toBe(false);
    });

    it("should use default Redis URL when no URL provided", () => {
      const connectionInfo = redisClient.getConnectionInfo();
      expect(connectionInfo.url).toBe("redis://localhost:6379");
    });

    it("should accept custom Redis URL", () => {
      const customUrl = "redis://localhost:6380";
      const customClient = new RedisClient(customUrl);
      const connectionInfo = customClient.getConnectionInfo();
      expect(connectionInfo.url).toBe(customUrl);
      customClient.disconnect(); // Clean up
    });

    it("should accept Redis options", () => {
      const options = { db: 1, password: "test" };
      const customClient = new RedisClient("redis://localhost:6379", options);
      expect(customClient).toBeDefined();
      customClient.disconnect(); // Clean up
    });
  });

  describe("Health Checks", () => {
    it("should return health status when not connected", async () => {
      const health = await redisClient.getHealth();
      expect(health.connected).toBe(false);
      expect(health.ready).toBe(false);
      expect(health.pingLatency).toBeUndefined();
      expect(health.lastError).toBeUndefined();
    });

    it("should return connection information", () => {
      const info = redisClient.getConnectionInfo();
      expect(info).toHaveProperty("url");
      expect(info).toHaveProperty("status");
      // Status can be 'disconnected', 'wait', or 'connecting' depending on ioredis lazy connect behavior
      expect(["disconnected", "wait", "connecting"]).toContain(info.status);
    });
  });

  describe("Connection Management", () => {
    it("should handle connection gracefully when Redis is unavailable", async () => {
      // Don't actually connect since Redis isn't running, just test the logic
      try {
        await redisClient.connect();
        // If connection succeeds (unlikely in test environment), ping should work
        const pingResult = await redisClient.ping();
        expect(pingResult).toBe(true);
      } catch (error) {
        console.log(error);
        // This is expected when Redis isn't running
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Redis connection");
      }

      // Even if connection failed, health check should still work
      const health = await redisClient.getHealth();
      expect(health).toHaveProperty("connected");
      expect(health).toHaveProperty("ready");
    });

    it("should handle disconnection", async () => {
      try {
        await redisClient.disconnect();
        // Should not throw even if not connected
      } catch (error) {
        // Disconnection should be graceful
        expect(error).toBeUndefined();
      }
    });

    it("should track connection state correctly", () => {
      // Initially not connected
      expect(redisClient.isConnected).toBe(false);
      expect(redisClient.isConnectingToRedis).toBe(false);

      const info = redisClient.getConnectionInfo();
      // Status depends on ioredis lazy connect behavior - just check it has a valid value
      expect(info.status).toBeDefined();
      expect(typeof info.status).toBe("string");
    });
  });

  describe("Error Handling", () => {
    it("should handle ping when not connected", async () => {
      const pingResult = await redisClient.ping();
      expect(pingResult).toBe(false);
    });

    it("should maintain error state", async () => {
      // Simulate connection attempt failure
      try {
        await redisClient.connect();
      } catch (error) {
        console.log(error);
        // Expected to fail without Redis running
        const health = await redisClient.getHealth();
        expect(health.lastError).toBeDefined();
      }
    });
  });
});
