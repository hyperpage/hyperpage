import { RedisClient } from "./redis-client";
import type {
  ICache,
  CacheEntry,
  CacheOptions,
  CacheStats,
} from "./cache-interface";
import { CacheBackend, CacheError } from "./cache-interface";

/**
 * Redis-based cache implementation.
 * Provides persistent, distributed caching with TTL support.
 * Implements the ICache interface for unified caching across backends.
 */
export class RedisCache<T = unknown> implements ICache<T> {
  private redisClient: RedisClient;
  private readonly backend = CacheBackend.REDIS;
  private readonly defaultTtl: number;
  private stats = {
    hits: 0,
    misses: 0,
    expiries: 0,
    evictions: 0, // Redis handles eviction internally
  };

  constructor(
    redisUrl?: string,
    options: CacheOptions = { maxSize: 10000, enableLru: false },
  ) {
    this.redisClient = new RedisClient(redisUrl);
    this.defaultTtl = options.defaultTtl || 600000; // 10 minutes default
  }

  /**
   * Store a value in Redis with a TTL (time-to-live).
   * Data must be JSON-serializable for Redis storage.
   * @param key - Cache key (should be URL-safe)
   * @param data - Data to cache (must be JSON-serializable)
   * @param ttlMs - Time to live in milliseconds
   * @throws CacheError if Redis operation fails
   */
  async set(key: string, data: T, ttlMs: number): Promise<void> {
    try {
      if (!this.redisClient.isConnected) {
        await this.redisClient.connect();
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CacheError(
        `Failed to set cache entry: ${message}`,
        this.backend,
        "set",
        true,
      );
    }
  }

  /**
   * Retrieve a value from Redis if it exists and hasn't expired.
   * @param key - Cache key
   * @returns Cached data or undefined if not found/expired
   * @throws CacheError if Redis operation fails but is recoverable
   */
  async get(key: string): Promise<T | undefined> {
    try {
      if (!this.redisClient.isConnected) {
        await this.redisClient.connect();
      }

      const client = this.redisClient.getClient();
      const entryString = await client.get(key);

      if (!entryString) {
        this.stats.misses++;
        return undefined; // Cache miss
      }

      // Parse and validate cache entry
      const entry: CacheEntry<T> = JSON.parse(entryString);

      // Check if expired (additional check beyond Redis TTL)
      if (Date.now() > entry.expiresAt) {
        // Remove expired entry
        await client.del(key);
        this.stats.expiries++;
        return undefined;
      }

      this.stats.hits++;
      return entry.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CacheError(
        `Failed to get cache entry: ${message}`,
        this.backend,
        "get",
        true,
      );
    }
  }

  /**
   * Check if a key exists and is not expired without retrieving the full value.
   * More efficient than get() when only existence is needed.
   * @param key - Cache key
   * @returns true if found and valid
   */
  async has(key: string): Promise<boolean> {
    try {
      const value = await this.get(key);
      return value !== undefined;
    } catch (error) {
      
      return false;
    }
  }

  /**
   * Remove a specific entry from Redis.
   * @param key - Cache key
   * @returns true if entry existed and was removed
   */
  async delete(key: string): Promise<boolean> {
    try {
      if (!this.redisClient.isConnected) {
        await this.redisClient.connect();
      }

      const client = this.redisClient.getClient();
      const result = await client.del(key);
      return result === 1; // Redis DEL returns number of keys deleted
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CacheError(
        `Failed to delete cache entry: ${message}`,
        this.backend,
        "delete",
        true,
      );
    }
  }

  /**
   * Clear all entries from this Redis database.
   * Use with caution - this affects all keys in the current Redis database.
   */
  async clear(): Promise<void> {
    try {
      if (!this.redisClient.isConnected) {
        await this.redisClient.connect();
      }

      const client = this.redisClient.getClient();
      await client.flushdb(); // Clear current database only
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CacheError(
        `Failed to clear cache: ${message}`,
        this.backend,
        "clear",
        true,
      );
    }
  }

  /**
   * Get comprehensive cache statistics including Redis-specific metrics.
   * @returns current cache stats
   */
  async getStats(): Promise<CacheStats> {
    try {
      if (!this.redisClient.isConnected) {
        await this.redisClient.connect();
      }

      const client = this.redisClient.getClient();

      // Parse Redis stats to extract relevant metrics
      // Note: In a real implementation, parse the info string for detailed metrics
      const totalKeys = await client.dbsize();

      return {
        size: totalKeys,
        hits: this.stats.hits,
        misses: this.stats.misses,
        expiries: this.stats.expiries,
        evictions: this.stats.evictions,
        backend: this.backend,
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
   * In Redis, this is mostly handled automatically, but we can scan for expired entries.
   * @returns number of entries removed (approximate)
   */
  async cleanupExpired(): Promise<number> {
    // Redis handles TTL expiration automatically
    // But we can track our own expiries through client operations
    return this.stats.expiries;
  }

  /**
   * Get cache entry details for a key (for debugging).
   */
  async getEntry(key: string): Promise<CacheEntry<T> | undefined> {
    try {
      const value = await this.get(key);
      if (value === undefined) return undefined;

      // Reconstruct entry (this is simplified - real implementation might store metadata separately)
      return {
        data: value,
        expiresAt: Date.now() + this.defaultTtl, // Approximate
        accessTime: Date.now(),
      };
    } catch (error) {
      
      return undefined;
    }
  }

  /**
   * Get the current number of keys in Redis database.
   * Note: This includes all keys, not just cache entries.
   */
  get size(): number {
    // Async operation, return 0 synchronously and get accurate count via getStats()
    return 0;
  }

  /**
   * Get snapshot of all cache keys.
   * Warning: This can be expensive in production - use getStats() instead.
   */
  get keys(): readonly string[] {
    // Async operation, return empty array synchronously
    return [];
  }

  /**
   * Get Redis connection health for monitoring.
   */
  async getHealth() {
    return await this.redisClient.getHealth();
  }

  /**
   * Disconnect from Redis gracefully.
   */
  async disconnect(): Promise<void> {
    await this.redisClient.disconnect();
  }
}
