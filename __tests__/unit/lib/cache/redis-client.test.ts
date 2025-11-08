import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedisClient, redisClient, Redis } from "@/lib/cache/redis-client";
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

/**
 * Mock ioredis.
 *
 * IMPORTANT (Vitest hoisting rule):
 * - vi.mock() is hoisted to the top of the file.
 * - The factory must NOT reference variables defined outside itself.
 * - We define the mocks entirely inside the factory and also return them
 *   as named exports so tests can access them without touching uninitialized
 *   top-level variables.
 */
vi.mock("ioredis", () => {
  const instance = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    quit: vi.fn(),
    ping: vi.fn(),
    on: vi.fn(),
    status: "ready",
  };

  const ctor = vi.fn().mockImplementation(() => instance);

  return {
    default: ctor,
    // Named exports for test assertions
    __mockInstance: instance,
    __mockCtor: ctor,
  };
});

// Import the named test-only exports from the mocked module
const { __mockInstance: mockRedis, __mockCtor: RedisCtorMock } = vi.mocked(
  (await import("ioredis")) as unknown as {
    __mockInstance: {
      connect: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
      quit: ReturnType<typeof vi.fn>;
      ping: ReturnType<typeof vi.fn>;
      on: ReturnType<typeof vi.fn>;
      status: string;
    };
    __mockCtor: ReturnType<typeof vi.fn>;
  },
);

describe("RedisClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.status = "ready";
    mockRedis.connect.mockReset();
    mockRedis.disconnect.mockReset();
    mockRedis.quit.mockReset();
    mockRedis.ping.mockReset();
    mockRedis.on.mockReset();
    (logger.error as unknown as { mockReset?: () => void }).mockReset?.();
  });

  describe("constructor", () => {
    it("should create client with default URL and lazy options when no URL provided", () => {
      const client = new RedisClient();

      expect(client).toBeInstanceOf(RedisClient);
      expect(RedisCtorMock).toHaveBeenCalledTimes(1);

      const [url, options] = RedisCtorMock.mock.calls[0];

      expect(url).toMatch(/^redis:\/\//);
      expect(options).toEqual(
        expect.objectContaining({
          lazyConnect: true,
          retryDelayOnFailover: 500,
          maxRetriesPerRequest: 3,
          connectTimeout: 5000,
          commandTimeout: 2000,
          family: 4,
        }),
      );
    });

    it("should create client with custom URL", () => {
      const customUrl = "redis://custom-host:6380";
      new RedisClient(customUrl);

      const [url, options] =
        RedisCtorMock.mock.calls[RedisCtorMock.mock.calls.length - 1];

      expect(url).toBe(customUrl);
      expect(options).toEqual(
        expect.objectContaining({
          lazyConnect: true,
        }),
      );
    });

    it("should merge custom options", () => {
      const customUrl = "redis://custom-host:6380";
      const options = {
        host: "custom-host",
        port: 6380,
        password: "secret",
        db: 1,
        connectTimeout: 10000,
      };

      new RedisClient(customUrl, options);

      const [url, merged] =
        RedisCtorMock.mock.calls[RedisCtorMock.mock.calls.length - 1];

      expect(url).toBe(customUrl);
      expect(merged).toEqual(
        expect.objectContaining({
          host: "custom-host",
          port: 6380,
          password: "secret",
          db: 1,
          connectTimeout: 10000,
          lazyConnect: true,
        }),
      );
    });
  });

  describe("connect", () => {
    it("should connect successfully when not already connected or connecting", async () => {
      const client = new RedisClient();
      mockRedis.status = "connecting";
      mockRedis.connect.mockResolvedValue(undefined);

      await client.connect();

      expect(mockRedis.connect).toHaveBeenCalledTimes(1);
    });

    it("should not call connect when already connected", async () => {
      const client = new RedisClient();
      mockRedis.status = "ready";

      await client.connect();

      expect(mockRedis.connect).not.toHaveBeenCalled();
    });

    it("should surface error and log when connect fails", async () => {
      const client = new RedisClient();
      const error = new Error("Connection failed");
      mockRedis.status = "connecting";
      mockRedis.connect.mockRejectedValue(error);

      await expect(client.connect()).rejects.toThrow(
        "Redis connection failed: Connection failed",
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Redis connection failed",
        expect.objectContaining({
          error: "Connection failed",
        }),
      );
    });
  });

  describe("disconnect", () => {
    it("should disconnect gracefully via quit", async () => {
      const client = new RedisClient();
      mockRedis.quit.mockResolvedValue("OK");

      await client.disconnect();

      expect(mockRedis.quit).toHaveBeenCalledTimes(1);
      expect(mockRedis.disconnect).not.toHaveBeenCalled();
    });

    it("should log and force disconnect when quit fails", async () => {
      const client = new RedisClient();
      const quitError = new Error("Quit failed");

      mockRedis.quit.mockRejectedValue(quitError);

      await client.disconnect();

      expect(mockRedis.quit).toHaveBeenCalledTimes(1);
      expect(mockRedis.disconnect).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        "Redis disconnect error",
        expect.objectContaining({
          error: "Quit failed",
        }),
      );
    });

    it("should no-op when client is already null", async () => {
      const client = new RedisClient() as unknown as {
        disconnect: () => Promise<void>;
        client: Redis | null;
      };
      client.client = null;

      await client.disconnect();

      expect(mockRedis.quit).not.toHaveBeenCalled();
      expect(mockRedis.disconnect).not.toHaveBeenCalled();
    });
  });

  // Type for limited internal access in edge-case tests
  interface TestableRedisClient {
    client: Redis | null;
  }

  describe("getClient", () => {
    it("should return underlying Redis client", () => {
      const client = new RedisClient();
      const redis = client.getClient();
      expect(redis).toBe(mockRedis);
    });

    it("should throw error if client not initialized", () => {
      const client = new RedisClient() as unknown as TestableRedisClient;
      client.client = null;

      expect(() => (client as unknown as RedisClient).getClient()).toThrow(
        "Redis client not initialized",
      );
    });
  });

  describe("isConnected", () => {
    it("should reflect underlying client ready status", () => {
      const client = new RedisClient();

      mockRedis.status = "ready";
      expect(client.isConnected).toBe(true);

      mockRedis.status = "disconnected";
      expect(client.isConnected).toBe(false);
    });
  });

  describe("isConnectingToRedis", () => {
    it("should return true when client status is connecting", () => {
      const client = new RedisClient();
      mockRedis.status = "connecting";

      expect(client.isConnectingToRedis).toBe(true);
    });

    it("should return false when not connecting", () => {
      const client = new RedisClient();
      mockRedis.status = "ready";

      expect(client.isConnectingToRedis).toBe(false);
    });
  });

  describe("getHealth", () => {
    it("should return healthy status and ping latency when connected", async () => {
      const client = new RedisClient();
      mockRedis.status = "ready";
      mockRedis.ping.mockResolvedValue("PONG");

      const health = await client.getHealth();

      expect(health.connected).toBe(true);
      expect(health.ready).toBe(true);
      expect(health.pingLatency).toEqual(expect.any(Number));
      expect(health.lastError).toBeUndefined();
    });

    it("should return disconnected health when not ready", async () => {
      const client = new RedisClient();
      mockRedis.status = "disconnected";

      const health = await client.getHealth();

      expect(health.connected).toBe(false);
      expect(health.ready).toBe(false);
    });

    it("should mark health as failed when ping throws", async () => {
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
    it("should return basic connection information", () => {
      const customUrl = "redis://custom-host:6380";
      const client = new RedisClient(customUrl);

      mockRedis.status = "ready";

      const info = client.getConnectionInfo();

      expect(info.url).toBe(customUrl);
      expect(info.status).toBe("ready");
    });
  });

  describe("event handling", () => {
    it("should register core event handlers on construction", () => {
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

    it("should log structured error when error event is emitted", () => {
      new RedisClient();

      const errorHandler = (
        mockRedis.on as unknown as { mock: { calls: [unknown, unknown][] } }
      ).mock.calls.find(([event]) => event === "error")?.[1] as (
        err: Error,
      ) => void;

      const error = Object.assign(new Error("boom"), {
        code: "ECONNREFUSED",
        errno: 111,
        syscall: "connect",
        hostname: "redis",
      });

      errorHandler(error);

      expect(logger.error).toHaveBeenCalledWith(
        "Redis client error",
        expect.objectContaining({
          error: "boom",
          code: "ECONNREFUSED",
          errno: 111,
          syscall: "connect",
          hostname: "redis",
        }),
      );
    });
  });

  describe("graceful degradation semantics", () => {
    it("should expose failed connection via rejected promise and not mark as connected", async () => {
      const client = new RedisClient();
      mockRedis.status = "connecting";
      mockRedis.connect.mockRejectedValue(new Error("Connection failed"));

      await expect(client.connect()).rejects.toThrow(
        "Redis connection failed: Connection failed",
      );

      expect(client.isConnected).toBe(false);
    });
  });

  describe("singleton instance", () => {
    it("should provide default redisClient instance", () => {
      expect(redisClient).toBeDefined();
      expect(redisClient).toBeInstanceOf(RedisClient);
    });
  });
});
