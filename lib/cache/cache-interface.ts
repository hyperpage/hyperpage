/**
 * Cache entry representation shared across different cache backends.
 */
export interface CacheEntry<T = unknown> {
  data: T;
  expiresAt: number; // Unix timestamp in milliseconds
  accessTime?: number; // For LRU tracking (optional)
}

/**
 * Configuration options for cache initialization.
 */
export interface CacheOptions {
  /** Maximum number of entries before eviction starts */
  maxSize: number;
  /** Whether to enable LRU tracking for access-based eviction */
  enableLru: boolean;
  /** Default TTL for cache entries (optional) */
  defaultTtl?: number;
}

/**
 * Cache performance and usage statistics.
 */
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
  /** Cache backend type (e.g., 'memory', 'redis') */
  backend: string;
}

/**
 * Metrics and monitoring hooks for advanced cache operations.
 * Used by factory for cache backend switching and metrics tracking.
 */
export interface CacheMetrics {
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  operationsCompleted: number;
  avgResponseTimeMs?: number;
  lastOperationTimestamp: number;
}

/**
 * Unified cache interface that all cache backends must implement.
 * Enables seamless switching between memory, Redis, and other cache backends.
 */
export interface ICache<T = unknown> {
  /**
   * Store a value in the cache with a TTL (time-to-live).
   * @param key - Cache key (should be URL-safe)
   * @param data - Data to cache (must be JSON-serializable for Redis)
   * @param ttlMs - Time to live in milliseconds
   */
  set(key: string, data: T, ttlMs: number): Promise<void>;

  /**
   * Retrieve a value from the cache if it exists and hasn't expired.
   * Automatically cleans up expired entries on cache miss if supported.
   * @param key - Cache key
   * @returns Cached data or undefined if not found/expired
   */
  get(key: string): Promise<T | undefined>;

  /**
   * Check if a key exists and is not expired without retrieving the full value.
   * More efficient than get() when only existence is needed.
   * @param key - Cache key
   * @returns true if found and valid
   */
  has(key: string): Promise<boolean>;

  /**
   * Remove a specific entry from the cache.
   * @param key - Cache key
   * @returns true if entry existed and was removed
   */
  delete(key: string): Promise<boolean>;

  /**
   * Clear all entries from the cache.
   * Implementations should handle this gracefully even if cache is unavailable.
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics for monitoring and debugging.
   * @returns current cache stats
   */
  getStats(): Promise<CacheStats>;

  /**
   * Force cleanup of all expired entries.
   * Returns number of entries removed for monitoring.
   * @returns number of entries removed
   */
  cleanupExpired(): Promise<number>;

  /**
   * Get the current number of entries in the cache.
   * For accurate counts of valid entries, implementations should
   * consider expired entries unless they have auto-cleanup.
   */
  get size(): number;

  /**
   * Get snapshot of all cache keys (for debugging/admin purposes).
   * Implementations may limit this for performance in production.
   */
  get keys(): readonly string[];

  /**
   * Get cache entry details for a key (for debugging).
   * May return undefined if key doesn't exist or for performance reasons.
   */
  getEntry(key: string): Promise<CacheEntry<T> | undefined>;
}

/**
 * Cache backend types supported by the factory.
 */
export enum CacheBackend {
  MEMORY = 'memory',
  REDIS = 'redis',
  HYBRID = 'hybrid'
}

/**
 * Factory configuration for creating cache instances.
 */
export interface CacheFactoryConfig {
  /** Backend type to use */
  backend: CacheBackend;
  /** Redis URL (required if backend includes Redis) */
  redisUrl?: string;
  /** Cache options */
  cacheOptions?: Partial<CacheOptions>;
  /** Whether to fall back gracefully if Redis is unavailable */
  enableFallback?: boolean;
}

/**
 * Error thrown when cache operations fail but are recoverable.
 */
export class CacheError extends Error {
  constructor(
    message: string,
    public readonly backend: CacheBackend,
    public readonly operation: string,
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = 'CacheError';
  }
}

/**
 * Custom TTL values for different cache entry types.
 */
export const DEFAULT_TTL = {
  /** Short-term caching for frequently changing data (5 minutes) */
  SHORT: 5 * 60 * 1000,
  /** Standard API response caching (10 minutes) */
  STANDARD: 10 * 60 * 1000,
  /** Long-term caching for stable data (1 hour) */
  LONG: 60 * 60 * 1000,
  /** Very long-term caching (1 day) - use sparingly */
  VERY_LONG: 24 * 60 * 60 * 1000,
} as const;
