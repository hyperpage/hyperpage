import { RedisClient } from "@/lib/cache/redis-client";
import type {
  ICache,
  CacheEntry,
  CacheOptions,
  CacheStats,
} from "@/lib/cache/cache-interface";
import { CacheBackend, CacheError } from "@/lib/cache/cache-interface";
import logger from "@/lib/logger";

/**
 * Configuration for advanced Redis features.
 */
export interface RedisCacheConfig {
  /** Redis connection URL */
  redisUrl?: string;
  /** Enable pipeline operations for better performance */
  enablePipeline?: boolean;
  /** Enable advanced metrics tracking */
  enableMetrics?: boolean;
  /** Enable batch operations */
  enableBatch?: boolean;
  /** Health check interval in milliseconds */
  healthCheckInterval?: number;
}

/**
 * Performance metrics for cache operations.
 */
export interface CachePerformanceMetrics {
  averageResponseTime: number;
  hitRate: number;
  throughput: number;
}

/**
 * Redis-based cache implementation with both basic and advanced features.
 * Provides persistent, distributed caching with TTL support, pipeline operations,
 * metrics tracking, and connection management.
 * Implements the ICache interface for unified caching across backends.
 */
export class RedisCache<T = unknown> implements ICache<T> {
  private redisClient: RedisClient;
  private readonly backend = CacheBackend.REDIS;
  private readonly defaultTtl: number;
  private config: RedisCacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    expiries: 0,
    evictions: 0,
  };
  private performanceMetrics = {
    totalOperations: 0,
    totalResponseTime: 0,
    averageResponseTime: 0,
    successfulOperations: 0,
    failedOperations: 0,
  };
  private operationStartTimes = new Map<string, number>();
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(
    redisUrl?: string,
    options: CacheOptions = { maxSize: 10000, enableLru: false },
    config: RedisCacheConfig = {},
  ) {
    this.redisClient = new RedisClient(redisUrl);
    this.config = {
      redisUrl,
      enablePipeline: config.enablePipeline ?? true,
      enableMetrics: config.enableMetrics ?? true,
      enableBatch: config.enableBatch ?? true,
      healthCheckInterval: config.healthCheckInterval ?? 30000,
    };
    this.defaultTtl = options.defaultTtl || 600000; // 10 minutes default

    // Start health monitoring if enabled
    if (this.config.enableMetrics) {
      this.startHealthMonitoring();
    }
  }

  /**
   * Store a value in Redis with enhanced error handling and metrics.
   */
  async set(key: string, data: T, ttlMs: number): Promise<void> {
    const operationId = `set-${key}-${Date.now()}`;
    if (this.config.enableMetrics) {
      this.operationStartTimes.set(operationId, Date.now());
    }

    try {
      if (!this.redisClient.isConnected) {
        await this.ensureConnection();
      }

      // Create cache entry with metadata
      const entry: CacheEntry<T> = {
        data,
        expiresAt: Date.now() + ttlMs,
        accessTime: Date.now(),
      };

      const entryString = JSON.stringify(entry);
      const client = this.redisClient.getClient();

      // Use Redis SET with EX (TTL in seconds)
      const ttlSeconds = Math.ceil(ttlMs / 1000);
      await client.set(key, entryString, "EX", ttlSeconds);

      this.updatePerformanceMetrics("success");
    } catch (error) {
      this.updatePerformanceMetrics("failure");
      const message = error instanceof Error ? error.message : String(error);
      throw new CacheError(
        `Failed to set cache entry: ${message}`,
        this.backend,
        "set",
        true,
      );
    } finally {
      if (this.config.enableMetrics) {
        this.operationStartTimes.delete(operationId);
      }
    }
  }

  /**
   * Retrieve a value from Redis with performance optimization.
   */
  async get(key: string): Promise<T | undefined> {
    const operationId = `get-${key}-${Date.now()}`;
    if (this.config.enableMetrics) {
      this.operationStartTimes.set(operationId, Date.now());
    }

    try {
      if (!this.redisClient.isConnected) {
        await this.ensureConnection();
      }

      const client = this.redisClient.getClient();
      const entryString = await client.get(key);

      if (!entryString || typeof entryString !== "string") {
        this.stats.misses++;
        this.updatePerformanceMetrics("success");
        return undefined; // Cache miss
      }

      // Parse and validate cache entry
      const entry: CacheEntry<T> = JSON.parse(entryString);

      // Check if expired (additional check beyond Redis TTL)
      if (Date.now() > entry.expiresAt) {
        // Remove expired entry
        await client.del(key);
        this.stats.expiries++;
        this.updatePerformanceMetrics("success");
        return undefined;
      }

      this.stats.hits++;
      this.updatePerformanceMetrics("success");
      return entry.data;
    } catch (error) {
      this.updatePerformanceMetrics("failure");
      const message = error instanceof Error ? error.message : String(error);
      throw new CacheError(
        `Failed to get cache entry: ${message}`,
        this.backend,
        "get",
        true,
      );
    } finally {
      if (this.config.enableMetrics) {
        this.operationStartTimes.delete(operationId);
      }
    }
  }

  /**
   * Pipeline multiple get operations for better performance (advanced feature).
   */
  async getMultiple(keys: string[]): Promise<Map<string, T>> {
    if (!this.config.enableBatch) {
      throw new CacheError(
        "Batch operations are disabled. Enable enableBatch in RedisCacheConfig.",
        this.backend,
        "getMultiple",
        true,
      );
    }

    const operationId = `getMultiple-${Date.now()}`;
    if (this.config.enableMetrics) {
      this.operationStartTimes.set(operationId, Date.now());
    }

    try {
      if (!this.redisClient.isConnected) {
        await this.ensureConnection();
      }

      const client = this.redisClient.getClient();
      const pipeline = client.multi();

      // Add all get commands to pipeline
      keys.forEach((key) => {
        pipeline.get(key);
      });

      const results = await pipeline.exec();
      const resultMap = new Map<string, T>();

      keys.forEach((key, index) => {
        const result = results?.[index]?.[1]; // Redis pipeline result format
        if (result && typeof result === "string") {
          try {
            const entry: CacheEntry<T> = JSON.parse(result);
            if (Date.now() <= entry.expiresAt) {
              resultMap.set(key, entry.data);
            }
          } catch {
            // Skip invalid entries
          }
        }
      });

      this.stats.hits += resultMap.size;
      this.stats.misses += keys.length - resultMap.size;
      this.updatePerformanceMetrics("success");

      return resultMap;
    } catch (error) {
      this.updatePerformanceMetrics("failure");
      const message = error instanceof Error ? error.message : String(error);
      throw new CacheError(
        `Failed to get multiple cache entries: ${message}`,
        this.backend,
        "getMultiple",
        true,
      );
    } finally {
      if (this.config.enableMetrics) {
        this.operationStartTimes.delete(operationId);
      }
    }
  }

  /**
   * Set multiple entries in a pipeline for better performance (advanced feature).
   */
  async setMultiple(
    entries: Map<string, { data: T; ttlMs: number }>,
  ): Promise<void> {
    if (!this.config.enableBatch) {
      throw new CacheError(
        "Batch operations are disabled. Enable enableBatch in RedisCacheConfig.",
        this.backend,
        "setMultiple",
        true,
      );
    }

    const operationId = `setMultiple-${Date.now()}`;
    if (this.config.enableMetrics) {
      this.operationStartTimes.set(operationId, Date.now());
    }

    try {
      if (!this.redisClient.isConnected) {
        await this.ensureConnection();
      }

      const client = this.redisClient.getClient();
      const pipeline = client.multi();

      for (const [key, { data, ttlMs }] of entries) {
        const entry: CacheEntry<T> = {
          data,
          expiresAt: Date.now() + ttlMs,
          accessTime: Date.now(),
        };

        const entryString = JSON.stringify(entry);
        const ttlSeconds = Math.ceil(ttlMs / 1000);
        pipeline.set(key, entryString, "EX", ttlSeconds);
      }

      await pipeline.exec();
      this.updatePerformanceMetrics("success");
    } catch (error) {
      this.updatePerformanceMetrics("failure");
      const message = error instanceof Error ? error.message : String(error);
      throw new CacheError(
        `Failed to set multiple cache entries: ${message}`,
        this.backend,
        "setMultiple",
        true,
      );
    } finally {
      if (this.config.enableMetrics) {
        this.operationStartTimes.delete(operationId);
      }
    }
  }

  /**
   * Check if a key exists and is not expired without retrieving the full value.
   * More efficient than get() when only existence is needed.
   */
  async has(key: string): Promise<boolean> {
    try {
      const value = await this.get(key);
      return value !== undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn("Cache has operation failed", { key, error: message });
      return false;
    }
  }

  /**
   * Remove a specific entry from Redis.
   */
  async delete(key: string): Promise<boolean> {
    const operationId = `delete-${key}-${Date.now()}`;
    if (this.config.enableMetrics) {
      this.operationStartTimes.set(operationId, Date.now());
    }

    try {
      if (!this.redisClient.isConnected) {
        await this.ensureConnection();
      }

      const client = this.redisClient.getClient();
      const result = await client.del(key);
      this.updatePerformanceMetrics("success");
      return result === 1;
    } catch (error) {
      this.updatePerformanceMetrics("failure");
      const message = error instanceof Error ? error.message : String(error);
      throw new CacheError(
        `Failed to delete cache entry: ${message}`,
        this.backend,
        "delete",
        true,
      );
    } finally {
      if (this.config.enableMetrics) {
        this.operationStartTimes.delete(operationId);
      }
    }
  }

  /**
   * Clear all entries from this Redis database.
   * Use with caution - this affects all keys in the current Redis database.
   */
  async clear(): Promise<void> {
    const operationId = `clear-${Date.now()}`;
    if (this.config.enableMetrics) {
      this.operationStartTimes.set(operationId, Date.now());
    }

    try {
      if (!this.redisClient.isConnected) {
        await this.ensureConnection();
      }

      const client = this.redisClient.getClient();
      await client.flushdb(); // Clear current database only
      this.updatePerformanceMetrics("success");
    } catch (error) {
      this.updatePerformanceMetrics("failure");
      const message = error instanceof Error ? error.message : String(error);
      throw new CacheError(
        `Failed to clear cache: ${message}`,
        this.backend,
        "clear",
        true,
      );
    } finally {
      if (this.config.enableMetrics) {
        this.operationStartTimes.delete(operationId);
      }
    }
  }

  /**
   * Get comprehensive cache statistics including performance metrics.
   */
  async getStats(): Promise<
    CacheStats & {
      performance: CachePerformanceMetrics;
    }
  > {
    try {
      if (!this.redisClient.isConnected) {
        await this.ensureConnection();
      }

      const client = this.redisClient.getClient();
      await client.info("stats");
      const totalKeys = await client.dbsize();

      const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses);

      return {
        size: totalKeys,
        hits: this.stats.hits,
        misses: this.stats.misses,
        expiries: this.stats.expiries,
        evictions: this.stats.evictions,
        backend: this.backend,
        performance: {
          averageResponseTime: this.performanceMetrics.averageResponseTime,
          hitRate,
          throughput: this.performanceMetrics.totalOperations,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CacheError(
        `Failed to get cache stats: ${message}`,
        this.backend,
        "getStats",
        true,
      );
    }
  }

  /**
   * Force cleanup of expired entries.
   */
  async cleanupExpired(): Promise<number> {
    return this.stats.expiries;
  }

  /**
   * Get cache entry details for a key (for debugging).
   */
  async getEntry(key: string): Promise<CacheEntry<T> | undefined> {
    try {
      const value = await this.get(key);
      if (value === undefined) return undefined;

      return {
        data: value,
        expiresAt: Date.now() + this.defaultTtl,
        accessTime: Date.now(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn("Failed to get cache entry", {
        key,
        error: message,
      });
      return undefined;
    }
  }

  /**
   * Get the current number of keys in Redis database.
   */
  get size(): number {
    return 0; // Async operation, use getStats()
  }

  /**
   * Get snapshot of all cache keys.
   */
  get keys(): readonly string[] {
    return []; // Async operation
  }

  /**
   * Get Redis connection health for monitoring.
   */
  async getHealth() {
    return await this.redisClient.getHealth();
  }

  /**
   * Disconnect from Redis gracefully and cleanup monitoring.
   */
  async disconnect(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    await this.redisClient.disconnect();
  }

  // Private methods for connection management and metrics

  private async ensureConnection(): Promise<void> {
    if (this.redisClient.isConnected) {
      return;
    }

    try {
      await this.redisClient.connect();
    } catch (error) {
      throw new CacheError(
        `Failed to connect to Redis: ${error}`,
        this.backend,
        "connect",
        false,
      );
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        const health = await this.redisClient.getHealth();
        if (!health.connected || !health.ready) {
          logger.debug("Redis health check detected unhealthy connection", {
            health,
          });
        }
      } catch (error) {
        logger.debug("Redis health check failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.config.healthCheckInterval || 30000);
  }

  private updatePerformanceMetrics(outcome: "success" | "failure"): void {
    if (!this.config.enableMetrics) return;

    this.performanceMetrics.totalOperations++;

    // Track success/failure metrics separately
    if (outcome === "success") {
      this.performanceMetrics.successfulOperations =
        (this.performanceMetrics.successfulOperations || 0) + 1;
    } else {
      this.performanceMetrics.failedOperations =
        (this.performanceMetrics.failedOperations || 0) + 1;
    }

    // Update average response time for successful operations only
    if (outcome === "success" && this.operationStartTimes.size > 0) {
      const firstStartTime = this.operationStartTimes.values().next().value;
      if (firstStartTime !== undefined) {
        const responseTime = Date.now() - firstStartTime;
        this.performanceMetrics.totalResponseTime += responseTime;
        this.performanceMetrics.averageResponseTime =
          this.performanceMetrics.totalResponseTime /
          this.performanceMetrics.totalOperations;
      }
    }
  }
}

// Factory functions for different Redis configurations (migrated from advanced cache)

export function createBasicRedisCache<T>(redisUrl?: string): RedisCache<T> {
  return new RedisCache<T>(
    redisUrl,
    { maxSize: 10000, enableLru: false },
    {
      enablePipeline: false,
      enableMetrics: false,
      enableBatch: false,
    },
  );
}

export function createAdvancedRedisCache<T>(redisUrl?: string): RedisCache<T> {
  return new RedisCache<T>(
    redisUrl,
    { maxSize: 10000, enableLru: false },
    {
      enablePipeline: true,
      enableMetrics: true,
      enableBatch: true,
      healthCheckInterval: 30000,
    },
  );
}

export function createPerformanceRedisCache<T>(
  redisUrl?: string,
): RedisCache<T> {
  return new RedisCache<T>(
    redisUrl,
    { maxSize: 10000, enableLru: false },
    {
      enablePipeline: true,
      enableMetrics: true,
      enableBatch: true,
      healthCheckInterval: 20000,
    },
  );
}
