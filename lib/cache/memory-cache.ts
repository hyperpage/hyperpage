import type {
  ICache,
  CacheEntry,
  CacheOptions,
  CacheStats,
} from "./cache-interface";

/**
 * In-memory cache with TTL support for API response caching.
 * Implements LRU eviction when cache exceeds maximum size.
 * Automatically cleans up expired entries on cache miss.
 * Implements the ICache interface for unified caching across backends.
 */
export class MemoryCache<T = unknown> implements ICache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private stats = {
    hits: 0,
    misses: 0,
    expiries: 0,
    evictions: 0,
  };
  private maxSize: number;

  constructor(options: CacheOptions = { maxSize: 1000, enableLru: false }) {
    this.maxSize = options.maxSize;
  }

  /**
   * Store a value in the cache with a TTL (time-to-live).
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttlMs - Time to live in milliseconds
   */
  async set(key: string, data: T, ttlMs: number): Promise<void> {
    // Clean up expired entries if over 90% capacity
    const capacityRatio = this.cache.size / this.maxSize;
    if (capacityRatio > 0.9) {
      await this.cleanupExpired();
    }

    // Enforce size limit using simple FIFO eviction if needed
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
      }
    }

    // Don't cache if TTL is zero or negative
    if (ttlMs <= 0) {
      return;
    }

    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, {
      data,
      expiresAt,
      accessTime: Date.now(), // Track access time for potential LRU
    });
  }

  /**
   * Retrieve a value from the cache if it exists and hasn't expired.
   * Automatically cleans up expired entries on cache miss.
   * @param key - Cache key
   * @returns Cached data or undefined if not found/expired
   */
  async get(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      // Expired, remove and return undefined
      this.cache.delete(key);
      this.stats.expiries++;
      this.stats.misses++;
      return undefined;
    }

    // Valid entry
    this.stats.hits++;
    // Update access time
    entry.accessTime = Date.now();
    return entry.data;
  }

  /**
   * Check if a key exists and is not expired.
   * @param key - Cache key
   * @returns true if found and valid
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== undefined;
  }

  /**
   * Remove a specific entry from the cache.
   * @param key - Cache key
   * @returns true if entry existed and was removed
   */
  async delete(key: string): Promise<boolean> {
    const existed = this.cache.delete(key);
    if (existed) {
      this.stats.evictions++; // Count as eviction since manually removed
    }
    return existed;
  }

  /**
   * Clear all entries from the cache.
   */
  async clear(): Promise<void> {
    this.cache.clear();
    // Reset stats but keep hit/miss ratio metrics
    this.stats.expiries = 0;
    this.stats.evictions = 0;
  }

  /**
   * Get cache statistics.
   * @returns current cache stats
   */
  async getStats(): Promise<CacheStats> {
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      expiries: this.stats.expiries,
      evictions: this.stats.evictions,
      backend: "memory",
    };
  }

  /**
   * Force cleanup of all expired entries.
   * @returns number of entries removed
   */
  async cleanupExpired(): Promise<number> {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
        this.stats.expiries++;
      }
    }

    return removed;
  }

  /**
   * Get cache entry details for a key (for debugging).
   */
  async getEntry(key: string): Promise<CacheEntry<T> | undefined> {
    return this.cache.get(key);
  }

  /**
   * Get the current number of entries in the cache (including expired).
   * For accurate count of valid entries, implementations should
   * consider expired entries unless they have auto-cleanup.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get snapshot of all cache keys (for debugging/admin purposes).
   * Implementations may limit this for performance in production.
   */
  get keys(): readonly string[] {
    return Array.from(this.cache.keys());
  }
}

// Export a default cache instance for global use
export const defaultMemoryCache = new MemoryCache();

// Export alias for backward compatibility with existing API routes
export const defaultCache = defaultMemoryCache;

/**
 * Utility function to generate a cache key from tool, endpoint, and query params.
 * This ensures consistent key generation across the application.
 * @param toolName - Tool name (e.g., 'github')
 * @param endpoint - API endpoint (e.g., 'pull-requests')
 * @param queryParams - Query string or hash of query parameters
 * @returns Cache key string
 */
export function generateCacheKey(
  toolName: string,
  endpoint: string,
  queryParams: string | Record<string, unknown>,
): string {
  let paramsHash: string;
  if (typeof queryParams === "string") {
    paramsHash = queryParams;
  } else {
    // Sort keys for consistent hashing
    paramsHash = JSON.stringify(queryParams, Object.keys(queryParams).sort());
  }
  return `${toolName}:${endpoint}:${Buffer.from(paramsHash).toString("base64")}`;
}
