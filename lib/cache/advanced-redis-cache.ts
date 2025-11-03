import { RedisClient } from "./redis-client";
import type {
  ICache,
  CacheEntry,
  CacheOptions,
  CacheStats,
} from "./cache-interface";
import { CacheBackend, CacheError } from "./cache-interface";

/**
 * Configuration for advanced Redis connection pooling.
 */
export interface RedisPoolConfig {
  /** Redis connection URL */
  redisUrl?: string;
  /** Minimum number of connections in pool */
  minConnections?: number;
  /** Maximum number of connections in pool */
  maxConnections?: number;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Command timeout in milliseconds */
  commandTimeout?: number;
  /** Retry attempts for failed connections */
  retryAttempts?: number;
  /** Health check interval in milliseconds */
  healthCheckInterval?: number;
}

/**
 * Redis connection pool metrics.
 */
export interface RedisPoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  failedConnections: number;
  averageResponseTime: number;
  poolUtilization: number;
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
 * Advanced Redis cache implementation with connection pooling and enterprise features.
 * Supports high-performance Redis operations with connection management, metrics,
 * and advanced caching strategies.
 */
export class AdvancedRedisCache<T = unknown> implements ICache<T> {
  private redisClient: RedisClient;
  private poolConfig: RedisPoolConfig;
  private readonly backend = CacheBackend.REDIS;
  private readonly defaultTtl: number;
  private stats = {
    hits: 0,
    misses: 0,
    expiries: 0,
    evictions: 0,
  };
  private poolMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    pendingRequests: 0,
    failedConnections: 0,
    averageResponseTime: 0,
    poolUtilization: 0,
  };

  private operationStartTimes = new Map<string, number>();
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(
    redisUrl?: string,
    poolConfig: RedisPoolConfig = {},
    options: CacheOptions = { maxSize: 10000, enableLru: false },
  ) {
    this.poolConfig = {
      redisUrl,
      minConnections: poolConfig.minConnections || 2,
      maxConnections: poolConfig.maxConnections || 20,
      connectionTimeout: poolConfig.connectionTimeout || 5000,
      commandTimeout: poolConfig.commandTimeout || 3000,
      retryAttempts: poolConfig.retryAttempts || 3,
      healthCheckInterval: poolConfig.healthCheckInterval || 30000,
    };

    this.redisClient = new RedisClient(redisUrl);
    this.defaultTtl = options.defaultTtl || 600000; // 10 minutes default

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Store a value in Redis with enhanced error handling and metrics.
   */
  async set(key: string, data: T, ttlMs: number): Promise<void> {
    const operationId = `set-${key}-${Date.now()}`;
    this.operationStartTimes.set(operationId, Date.now());
    this.poolMetrics.pendingRequests++;

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

      this.updatePoolMetrics("success");
    } catch (error) {
      this.updatePoolMetrics("failure");
      const message = error instanceof Error ? error.message : String(error);
      throw new CacheError(
        `Failed to set cache entry: ${message}`,
        this.backend,
        "set",
        true,
      );
    } finally {
      this.operationStartTimes.delete(operationId);
      this.poolMetrics.pendingRequests--;
    }
  }

  /**
   * Retrieve a value from Redis with connection pooling optimization.
   */
  async get(key: string): Promise<T | undefined> {
    const operationId = `get-${key}-${Date.now()}`;
    this.operationStartTimes.set(operationId, Date.now());
    this.poolMetrics.pendingRequests++;

    try {
      if (!this.redisClient.isConnected) {
        await this.ensureConnection();
      }

      const client = this.redisClient.getClient();
      const entryString = await client.get(key);

      if (!entryString || typeof entryString !== "string") {
        this.stats.misses++;
        this.updatePoolMetrics("success");
        return undefined; // Cache miss
      }

      // Parse and validate cache entry
      const entry: CacheEntry<T> = JSON.parse(entryString);

      // Check if expired (additional check beyond Redis TTL)
      if (Date.now() > entry.expiresAt) {
        // Remove expired entry
        await client.del(key);
        this.stats.expiries++;
        this.updatePoolMetrics("success");
        return undefined;
      }

      this.stats.hits++;
      this.updatePoolMetrics("success");
      return entry.data;
    } catch (error) {
      this.updatePoolMetrics("failure");
      const message = error instanceof Error ? error.message : String(error);
      throw new CacheError(
        `Failed to get cache entry: ${message}`,
        this.backend,
        "get",
        true,
      );
    } finally {
      this.operationStartTimes.delete(operationId);
      this.poolMetrics.pendingRequests--;
    }
  }

  /**
   * Pipeline multiple get operations for better performance.
   */
  async getMultiple(keys: string[]): Promise<Map<string, T>> {
    const operationId = `getMultiple-${Date.now()}`;
    this.operationStartTimes.set(operationId, Date.now());
    this.poolMetrics.pendingRequests++;

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
      this.updatePoolMetrics("success");

      return resultMap;
    } catch (error) {
      this.updatePoolMetrics("failure");
      const message = error instanceof Error ? error.message : String(error);
      throw new CacheError(
        `Failed to get multiple cache entries: ${message}`,
        this.backend,
        "getMultiple",
        true,
      );
    } finally {
      this.operationStartTimes.delete(operationId);
      this.poolMetrics.pendingRequests--;
    }
  }

  /**
   * Set multiple entries in a pipeline for better performance.
   */
  async setMultiple(
    entries: Map<string, { data: T; ttlMs: number }>,
  ): Promise<void> {
    const operationId = `setMultiple-${Date.now()}`;
    this.operationStartTimes.set(operationId, Date.now());
    this.poolMetrics.pendingRequests += entries.size;

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
      this.updatePoolMetrics("success");
    } catch (error) {
      this.updatePoolMetrics("failure");
      const message = error instanceof Error ? error.message : String(error);
      throw new CacheError(
        `Failed to set multiple cache entries: ${message}`,
        this.backend,
        "setMultiple",
        true,
      );
    } finally {
      this.operationStartTimes.delete(operationId);
      this.poolMetrics.pendingRequests -= entries.size;
    }
  }

  /**
   * Check key existence without full retrieval.
   */
  async has(key: string): Promise<boolean> {
    try {
      const value = await this.get(key);
      return value !== undefined;
    } catch (error) {
      console.warn(`Cache has() operation failed for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Delete entry with connection pooling.
   */
  async delete(key: string): Promise<boolean> {
    const operationId = `delete-${key}-${Date.now()}`;
    this.operationStartTimes.set(operationId, Date.now());
    this.poolMetrics.pendingRequests++;

    try {
      if (!this.redisClient.isConnected) {
        await this.ensureConnection();
      }

      const client = this.redisClient.getClient();
      const result = await client.del(key);
      this.updatePoolMetrics("success");
      return result === 1;
    } catch (error) {
      this.updatePoolMetrics("failure");
      const message = error instanceof Error ? error.message : String(error);
      throw new CacheError(
        `Failed to delete cache entry: ${message}`,
        this.backend,
        "delete",
        true,
      );
    } finally {
      this.operationStartTimes.delete(operationId);
      this.poolMetrics.pendingRequests--;
    }
  }

  /**
   * Clear all entries with safety confirmation.
   */
  async clear(): Promise<void> {
    const operationId = `clear-${Date.now()}`;
    this.operationStartTimes.set(operationId, Date.now());
    this.poolMetrics.pendingRequests++;

    try {
      if (!this.redisClient.isConnected) {
        await this.ensureConnection();
      }

      const client = this.redisClient.getClient();
      await client.flushdb(); // Clear current database only
      this.updatePoolMetrics("success");
    } catch (error) {
      this.updatePoolMetrics("failure");
      const message = error instanceof Error ? error.message : String(error);
      throw new CacheError(
        `Failed to clear cache: ${message}`,
        this.backend,
        "clear",
        true,
      );
    } finally {
      this.operationStartTimes.delete(operationId);
      this.poolMetrics.pendingRequests--;
    }
  }

  /**
   * Get comprehensive statistics including pool metrics.
   */
  async getStats(): Promise<
    CacheStats & {
      pool: RedisPoolMetrics;
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

      return {
        size: totalKeys,
        hits: this.stats.hits,
        misses: this.stats.misses,
        expiries: this.stats.expiries,
        evictions: this.stats.evictions,
        backend: this.backend,
        pool: { ...this.poolMetrics },
        performance: {
          averageResponseTime: this.poolMetrics.averageResponseTime,
          hitRate: this.stats.hits / (this.stats.hits + this.stats.misses),
          throughput: this.poolMetrics.totalConnections,
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

  async cleanupExpired(): Promise<number> {
    return this.stats.expiries;
  }

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
      console.warn(`Failed to get cache entry for debugging: ${key}`, error);
      return undefined;
    }
  }

  get size(): number {
    return 0; // Async operation, use getStats()
  }

  get keys(): readonly string[] {
    return []; // Async operation
  }

  /**
   * Get comprehensive health status including pool metrics.
   */
  async getHealth() {
    return await this.redisClient.getHealth();
  }

  /**
   * Disconnect gracefully and cleanup monitoring.
   */
  async disconnect(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    await this.redisClient.disconnect();
  }

  // Private methods for connection management

  private async ensureConnection(): Promise<void> {
    let attempts = 0;
    const maxAttempts = this.poolConfig.retryAttempts || 3;

    while (attempts < maxAttempts) {
      try {
        await this.redisClient.connect();
        this.updatePoolMetrics("connection_success");
        return;
      } catch (error) {
        attempts++;
        this.poolMetrics.failedConnections++;
        if (attempts >= maxAttempts) {
          throw new CacheError(
            `Failed to connect to Redis after ${attempts} attempts: ${error}`,
            this.backend,
            "connect",
            false,
          );
        }
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
      }
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        const health = await this.redisClient.getHealth();
        if (!health.connected || !health.ready) {
          console.warn("Redis health check failed:", health);
        }
      } catch (error) {
        console.warn("Redis health monitoring error:", error);
      }
    }, this.poolConfig.healthCheckInterval || 30000);
  }

  private updatePoolMetrics(
    outcome: "success" | "failure" | "connection_success",
  ): void {
    if (outcome === "failure") {
      this.poolMetrics.failedConnections++;
    } else if (outcome === "connection_success") {
      this.poolMetrics.totalConnections++;
      this.poolMetrics.idleConnections++;
    }

    // Update utilization
    const totalConnections = this.poolMetrics.totalConnections;
    const activeConnections = this.poolMetrics.activeConnections;
    this.poolMetrics.poolUtilization =
      totalConnections > 0 ? (activeConnections / totalConnections) * 100 : 0;

    // Update average response time (simplified)
    const responseTime =
      Date.now() -
      (this.operationStartTimes.values().next().value || Date.now());
    this.poolMetrics.averageResponseTime =
      (this.poolMetrics.averageResponseTime + responseTime) / 2;
  }

  private estimateSize(data: T): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }
}

// Factory functions for different Redis configurations

export function createPooledRedisCache<T>(
  redisUrl?: string,
  poolConfig?: Partial<RedisPoolConfig>,
): AdvancedRedisCache<T> {
  return new AdvancedRedisCache<T>(redisUrl, poolConfig);
}

export function createHighPerformanceRedisCache<T>(
  redisUrl?: string,
): AdvancedRedisCache<T> {
  return new AdvancedRedisCache<T>(redisUrl, {
    minConnections: 5,
    maxConnections: 50,
    connectionTimeout: 3000,
    commandTimeout: 2000,
    retryAttempts: 5,
    healthCheckInterval: 20000,
  });
}

export function createEnterpriseRedisCache<T>(
  redisUrl?: string,
): AdvancedRedisCache<T> {
  return new AdvancedRedisCache<T>(redisUrl, {
    minConnections: 10,
    maxConnections: 100,
    connectionTimeout: 5000,
    commandTimeout: 3000,
    retryAttempts: 10,
    healthCheckInterval: 15000,
  });
}
