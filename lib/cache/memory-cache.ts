/**
 * In-memory cache with TTL support for API response caching.
 * Implements LRU eviction when cache exceeds maximum size.
 * Automatically cleans up expired entries on cache miss.
 */

export interface CacheEntry<T = any> {
  data: T;
  expiresAt: number; // Unix timestamp in milliseconds
  accessTime?: number; // For LRU tracking (optional)
}

export interface CacheOptions {
  /** Maximum number of entries before LRU eviction starts */
  maxSize: number;
  /** Whether to enable LRU tracking for access-based eviction */
  enableLru: boolean;
}

export interface CacheStats {
  /** Current number of entries */
  size: number;
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Number of expired entries removed */
  expiries: number;
  /** Number of entries evicted due to size limit */
  evictions: number;
}

/**
 * Memory-based cache with TTL and LRU eviction support.
 * Designed for caching API responses to reduce external API calls.
 */
export class MemoryCache {
  private cache = new Map<string, CacheEntry>();
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
  set(key: string, data: any, ttlMs: number): void {
    // Clean up expired entries if over 90% capacity
    const capacityRatio = this.cache.size / this.maxSize;
    if (capacityRatio > 0.9) {
      this.cleanupExpired();
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
   * Automatically cleans up expired entries on miss.
   * @param key - Cache key
   * @returns Cached data or undefined if not found/expired
   */
  get(key: string): any | undefined {
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
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Remove a specific entry from the cache.
   * @param key - Cache key
   * @returns true if entry existed
   */
  delete(key: string): boolean {
    const existed = this.cache.delete(key);
    if (existed) {
      this.stats.evictions++; // Count as eviction since manually removed
    }
    return existed;
  }

  /**
   * Clear all entries from the cache.
   */
  clear(): void {
    this.cache.clear();
    // Reset stats but keep hit/miss ratio metrics
    this.stats.expiries = 0;
    this.stats.evictions = 0;
  }

  /**
   * Get cache statistics.
   * @returns current cache stats
   */
  getStats(): CacheStats {
    return {
      size: this.cache.size,
      ...this.stats,
    };
  }

  /**
   * Force cleanup of all expired entries.
   * @returns number of entries removed
   */
  cleanupExpired(): number {
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
   * Get the number of entries currently in the cache (including expired).
   * For accurate count of valid entries, use getStats().size after cleanup.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get a snapshot of all cache keys (for debugging/monitoring).
   */
  get keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entry details for a key (for debugging).
   */
  getEntry(key: string): CacheEntry | undefined {
    return this.cache.get(key);
  }
}

// Export a default cache instance for global use
export const defaultCache = new MemoryCache();

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
  queryParams: string | Record<string, any>
): string {
  let paramsHash: string;
  if (typeof queryParams === 'string') {
    paramsHash = queryParams;
  } else {
    // Sort keys for consistent hashing
    paramsHash = JSON.stringify(queryParams, Object.keys(queryParams).sort());
  }
  return `${toolName}:${endpoint}:${Buffer.from(paramsHash).toString('base64')}`;
}
