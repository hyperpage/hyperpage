import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RedisClient, redisClient } from "@/lib/cache/redis-client";
import logger from "@/lib/logger";

// Mock the logger
vi.mock("@/lib/logger", () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  },
}));

// Mock ioredis
const mockRedis = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  quit: vi.fn(),
  ping: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  flushdb: vi.fn(),
  dbsize: vi.fn(),
  info: vi.fn(),
  on: vi.fn(),
  status: "ready",
};

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => mockRedis),
}));

describe("RedisClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("constructor", () => {
    it("should create client with default URL when no URL provided", () => {
      const client = new RedisClient();
      expect(client).toBeDefined();
    });

    it("should create client with custom URL", () => {
      const customUrl = "redis://custom-host:6380";
      const client = new RedisClient(customUrl);
      expect(client).toBeDefined();
    });

    it("should create client with custom URL and options", () => {
      const customUrl = "redis://custom-host:6380";
      const options = {
        host: "custom-host",
        port: 6380,
        password: "secret",
        db: 1,
      };
      const client = new RedisClient(customUrl, options);
      expect(client).toBeDefined();
    });
  });

  describe("connect", () => {
    it("should connect successfully", async () => {
      const client = new RedisClient();
      mockRedis.connect.mockResolvedValue(undefined);

      await client.connect();

      expect(mockRedis.connect).toHaveBeenCalled();
    });

    it("should throw error when connect fails", async () => {
      const client = new RedisClient();
      mockRedis.connect.mockRejectedValue(new Error("Connection failed"));

      await expect(client.connect()).rejects.toThrow(
        "Redis connection failed: Connection failed",
      );
    });
  });

  describe("disconnect", () => {
    it("should disconnect gracefully", async () => {
      const client = new RedisClient();
      mockRedis.quit.mockResolvedValue("OK");

      await client.disconnect();

      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it("should force disconnect when quit fails", async () => {
      const client = new RedisClient();
      mockRedis.quit.mockRejectedValue(new Error("Quit failed"));
      mockRedis.disconnect.mockResolvedValue(undefined);

      await client.disconnect();

      expect(mockRedis.quit).toHaveBeenCalled();
      expect(mockRedis.disconnect).toHaveBeenCalled();
    });
  });

  // Type for accessing private properties during testing
  interface TestableRedisClient {
    isConnecting: boolean;
    connectionStartTime: number | null;
    client: unknown;
    getClient(): unknown;
    get isConnected(): boolean;
    get isConnectingToRedis(): boolean;
    getConnectionInfo(): {
      url: string;
      status: string;
      uptimeSeconds?: number;
      lastError?: string;
    };
  }

  describe("getClient", () => {
    it("should return underlying Redis client", () => {
      const client = new RedisClient();
      const redis = client.getClient();
      expect(redis).toBe(mockRedis);
    });

    it("should throw error if client not initialized", () => {
      const client = new RedisClient() as unknown as TestableRedisClient;
      // Mock client as null
      client.client = null;

      expect(() => client.getClient()).toThrow("Redis client not initialized");
    });
  });

  describe("isConnected", () => {
    it("should return true when client is ready", () => {
      const client = new RedisClient();
      expect(client.isConnected).toBe(false);

      // Mock status as ready
      mockRedis.status = "ready";
      expect(client.isConnected).toBe(true);
    });
  });

  describe("isConnectingToRedis", () => {
    it("should return true when connecting", () => {
      const client = new RedisClient() as unknown as TestableRedisClient;
      // Access private property through proper typing
      client.isConnecting = true;
      expect(client.isConnectingToRedis).toBe(true);
    });
  });

  describe("getHealth", () => {
    it("should return health status when connected", async () => {
      const client = new RedisClient();
      mockRedis.status = "ready";
      mockRedis.ping.mockResolvedValue("PONG");

      const health = await client.getHealth();

      expect(health.connected).toBe(true);
      expect(health.ready).toBe(true);
      expect(health.pingLatency).toBeDefined();
    });

    it("should return health status when disconnected", async () => {
      const client = new RedisClient();
      mockRedis.status = "disconnected";

      const health = await client.getHealth();

      expect(health.connected).toBe(false);
      expect(health.ready).toBe(false);
    });

    it("should handle ping failure", async () => {
      const client = new RedisClient();
      mockRedis.status = "ready";
      mockRedis.ping.mockRejectedValue(new Error("Ping failed"));

      const health = await client.getHealth();

      expect(health.connected).toBe(false);
      expect(health.ready).toBe(false);
      expect(health.lastError).toBe("Ping failed");
    });
  });

  describe("ping", () => {
    it("should return true when ping succeeds", async () => {
      const client = new RedisClient();
      mockRedis.status = "ready";
      mockRedis.ping.mockResolvedValue("PONG");

      const result = await client.ping();

      expect(result).toBe(true);
    });

    it("should return false when ping fails", async () => {
      const client = new RedisClient();
      mockRedis.status = "ready";
      mockRedis.ping.mockRejectedValue(new Error("Ping failed"));

      const result = await client.ping();

      expect(result).toBe(false);
    });

    it("should return false when not connected", async () => {
      const client = new RedisClient();
      mockRedis.status = "disconnected";

      const result = await client.ping();

      expect(result).toBe(false);
    });
  });

  describe("getConnectionInfo", () => {
    it("should return connection information", () => {
      const customUrl = "redis://custom-host:6380";
      const client = new RedisClient(
        customUrl,
      ) as unknown as TestableRedisClient;
      mockRedis.status = "ready";
      // Access private property through proper typing
      client.connectionStartTime = Date.now() - 5000;

      const info = client.getConnectionInfo();

      expect(info.url).toBe(customUrl);
      expect(info.status).toBe("ready");
      expect(info.uptimeSeconds).toBeGreaterThanOrEqual(5);
    });
  });

  describe("event handling", () => {
    it("should set up event handlers on construction", () => {
      new RedisClient();

      expect(mockRedis.on).toHaveBeenCalledWith(
        "connect",
        expect.any(Function),
      );
      expect(mockRedis.on).toHaveBeenCalledWith("ready", expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith("close", expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith(
        "reconnecting",
        expect.any(Function),
      );
    });
  });

  describe("error handling", () => {
    it("should handle connection errors", async () => {
      const client = new RedisClient();
      const error = new Error("Connection refused");
      mockRedis.connect.mockRejectedValue(error);

      await expect(client.connect()).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        "Redis connection failed",
        expect.objectContaining({
          error: "Connection refused",
        }),
      );
    });
  });

  describe("graceful degradation", () => {
    it("should not throw during connection failures but handle gracefully", async () => {
      const client = new RedisClient();
      mockRedis.connect.mockRejectedValue(new Error("Connection failed"));

      await expect(client.connect()).rejects.toThrow("Redis connection failed");

      // Should not crash the application
      expect(client.isConnected).toBe(false);
    });
  });

  describe("configuration options", () => {
    it("should handle custom connection options", () => {
      const options = {
        host: "custom-host",
        port: 6380,
        password: "secret",
        db: 1,
        connectTimeout: 10000,
      };

      const client = new RedisClient("redis://localhost:6379", options);
      expect(client).toBeDefined();
    });
  });

  describe("singleton instance", () => {
    it("should provide default redisClient instance", () => {
      expect(redisClient).toBeDefined();
      expect(redisClient).toBeInstanceOf(RedisClient);
    });
  });
});
