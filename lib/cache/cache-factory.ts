import type {
  ICache,
  CacheFactoryConfig,
  CacheMetrics,
} from "@/lib/cache/cache-interface";
import { MemoryCache } from "@/lib/cache/memory-cache";
import { RedisCache } from "@/lib/cache/redis-cache";
import { CacheBackend, CacheError } from "@/lib/cache/cache-interface";
import logger from "@/lib/logger";

/**
 * Factory for creating and managing cache instances across different backends.
 * Supports seamless switching between memory and Redis caching with unified interface.
 *
 * Usage examples:
 * ```typescript
 * // Memory cache
 * const cache = await CacheFactory.create({ backend: CacheBackend.MEMORY });
 *
 * // Redis cache with URL
 * const redisCache = await CacheFactory.create({
 *   backend: CacheBackend.REDIS,
 *   redisUrl: 'redis://localhost:6379',
 *   enableFallback: true // Falls back to memory if Redis unavailable
 * });
 *
 * // Hybrid cache (attempts Redis, falls back to memory)
 * const hybridCache = await CacheFactory.create({
 *   backend: CacheBackend.HYBRID,
 *   redisUrl: process.env.REDIS_URL,
 *   cacheOptions: { maxSize: 5000, defaultTtl: 3600000 }
 * });
 * ```
 */
export class CacheFactory {
  private static instances = new Map<string, ICache<unknown>>();
  private static metrics = new Map<string, CacheMetrics>();

  /**
   * Create a cache instance based on configuration.
   * @param config - Cache factory configuration
   * @returns Configured cache instance
   * @throws CacheError if cache creation fails
   */
  static async create<T = unknown>(
    config: CacheFactoryConfig,
  ): Promise<ICache<T>> {
    const cacheKey = this.generateCacheKey(config);

    // Return existing instance if already created with same config
    if (this.instances.has(cacheKey)) {
      return this.instances.get(cacheKey)! as ICache<T>;
    }

    let cache: ICache<T>;

    try {
      // Merge cache options with defaults
      const defaultCacheOptions = {
        maxSize: 1000,
        enableLru: false,
        defaultTtl: 600000, // 10 minutes
      };
      const cacheOptions = { ...defaultCacheOptions, ...config.cacheOptions };

      switch (config.backend) {
        case CacheBackend.MEMORY:
          cache = new MemoryCache<T>(cacheOptions);
          break;

        case CacheBackend.REDIS:
          if (!config.redisUrl && !config.enableFallback) {
            throw new CacheError(
              "Redis backend requires redisUrl or enableFallback=true",
              CacheBackend.REDIS,
              "create",
              false,
            );
          }

          try {
            cache = new RedisCache<T>(config.redisUrl, cacheOptions);
          } catch (error) {
            if (config.enableFallback) {
              logger.warn(
                "Redis connection failed, falling back to memory cache",
                {
                  cacheKey,
                  backend: config.backend,
                  error: error instanceof Error ? error.message : String(error),
                  redisUrl: config.redisUrl || "not_provided",
                },
              );
              cache = new MemoryCache<T>(cacheOptions);
            } else {
              throw error;
            }
          }
          break;

        case CacheBackend.HYBRID:
          // Hybrid: Redis primary, memory fallback
          if (!config.redisUrl) {
            throw new CacheError(
              "Hybrid backend requires redisUrl",
              CacheBackend.HYBRID,
              "create",
              false,
            );
          }

          try {
            // Try Redis first
            cache = new RedisCache<T>(config.redisUrl, cacheOptions);
            logger.info(
              "Hybrid cache: Redis primary cache created successfully",
              {
                cacheKey,
                backend: config.backend,
                redisUrl: config.redisUrl,
              },
            );
          } catch (error) {
            logger.warn(
              "Hybrid cache: Redis failed, falling back to memory cache",
              {
                cacheKey,
                backend: config.backend,
                error: error instanceof Error ? error.message : String(error),
                redisUrl: config.redisUrl,
              },
            );
            cache = new MemoryCache<T>(cacheOptions);
          }
          break;

        default:
          throw new CacheError(
            `Unsupported cache backend: ${config.backend}`,
            config.backend as CacheBackend,
            "create",
            false,
          );
      }

      // Store instance for reuse
      this.instances.set(cacheKey, cache);

      // Initialize metrics tracking
      this.initializeMetrics(cacheKey, cache);

      logger.info("Cache instance created", {
        cacheKey,
        backend: config.backend,
        cacheOptions,
      });

      return cache;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CacheError(
        `Failed to create ${config.backend} cache: ${message}`,
        config.backend,
        "create",
        false,
      );
    }
  }

  /**
   * Create cache from environment variables.
   * Automatically detects Redis URL and chooses appropriate backend.
   * @param defaultMemory - Fall back to memory cache if no suitable backend available
   * @returns Configured cache instance
   */
  static async createFromEnv<T = unknown>(
    defaultMemory: boolean = true,
  ): Promise<ICache<T>> {
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      // Use hybrid mode to attempt Redis with memory fallback
      return await this.create<T>({
        backend: CacheBackend.HYBRID,
        redisUrl,
        enableFallback: true,
      });
    } else {
      // No Redis configured, use memory
      if (defaultMemory) {
        logger.info("No Redis URL configured, using memory cache", {
          defaultMemory,
        });
        return await this.create<T>({
          backend: CacheBackend.MEMORY,
        });
      } else {
        throw new CacheError(
          "No cache backend available and defaultMemory=false",
          CacheBackend.MEMORY,
          "createFromEnv",
          false,
        );
      }
    }
  }

  /**
   * Get cached metrics for a specific cache instance.
   * @param cacheKey - Key returned by generateCacheKey()
   * @returns Last known metrics or undefined if not found
   */
  static getMetrics(cacheKey: string): CacheMetrics | undefined {
    return this.metrics.get(cacheKey);
  }

  /**
   * Get all cache instances currently managed by the factory.
   * @returns Map of cache keys to cache instances
   */
  static getInstances(): Map<string, ICache<unknown>> {
    return new Map(this.instances);
  }

  /**
   * Clear all cached instances from factory management.
   * Instances remain functional but are no longer tracked by factory.
   */
  static clearInstances(): void {
    const instanceCount = this.instances.size;
    this.instances.clear();
    this.metrics.clear();

    logger.info("Cache factory instances cleared", { instanceCount });
  }

  /**
   * Dispose of all cache instances gracefully.
   * Should be called during application shutdown.
   */
  static async disposeAll(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [cacheKey, cache] of this.instances.entries()) {
      try {
        // Redis caches need disconnection, memory caches are no-ops
        if ("disconnect" in cache && typeof cache.disconnect === "function") {
          promises.push(cache.disconnect());
        }
      } catch (error) {
        logger.warn("Error during cache disposal", {
          cacheKey,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await Promise.allSettled(promises);
    this.clearInstances();

    logger.info("All cache instances disposed successfully");
  }

  /**
   * Generate a unique key for cache instance identification.
   * @param config - Factory configuration
   * @returns Cache key string
   */
  private static generateCacheKey(config: CacheFactoryConfig): string {
    // Create a stable key based on configuration
    const keyParts = [
      config.backend,
      config.redisUrl || "no-redis",
      config.enableFallback ? "fallback-yes" : "fallback-no",
      JSON.stringify(config.cacheOptions || {}),
    ];

    return keyParts.join("|");
  }

  /**
   * Initialize metrics tracking for a cache instance.
   * @param cacheKey - Unique cache identifier
   * @param cache - Cache instance to track
   */
  private static async initializeMetrics(
    cacheKey: string,
    cache: ICache<unknown>,
  ): Promise<void> {
    try {
      const stats = await cache.getStats();

      const metrics: CacheMetrics = {
        totalHits: stats.hits,
        totalMisses: stats.misses,
        hitRate:
          stats.hits + stats.misses > 0
            ? stats.hits / (stats.hits + stats.misses)
            : 0,
        operationsCompleted: stats.hits + stats.misses,
        lastOperationTimestamp: Date.now(),
      };

      this.metrics.set(cacheKey, metrics);
    } catch (error) {
      logger.warn("Failed to initialize metrics for cache", {
        cacheKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update metrics for ongoing operations.
   * Called internally by cache operations to track performance.
   * @param cacheKey - Cache instance key
   * @param operation - Operation type (hit, miss, error)
   * @param responseTimeMs - Optional operation response time
   */
  public static updateMetrics(
    cacheKey: string,
    operation: "hit" | "miss" | "error",
    responseTimeMs?: number,
  ): void {
    const metrics = this.metrics.get(cacheKey);
    if (!metrics) return;

    metrics.operationsCompleted++;

    switch (operation) {
      case "hit":
        metrics.totalHits++;
        break;
      case "miss":
        metrics.totalMisses++;
        break;
    }

    // Recalculate hit rate
    const totalOperations = metrics.totalHits + metrics.totalMisses;
    metrics.hitRate =
      totalOperations > 0 ? metrics.totalHits / totalOperations : 0;

    // Update response time (rolling average)
    if (responseTimeMs !== undefined) {
      const prevAvg = metrics.avgResponseTimeMs || responseTimeMs;
      // Simple exponential moving average with alpha=0.1
      metrics.avgResponseTimeMs = prevAvg * 0.9 + responseTimeMs * 0.1;
    }

    metrics.lastOperationTimestamp = Date.now();
  }
}

/**
 * Default cache instance created from environment.
 * Can be used directly or as a fallback.
 */
export const defaultCache = await CacheFactory.createFromEnv();

/**
 * Helper function to get cache backend type name for logging.
 */
export function getCacheBackendName(backend: CacheBackend): string {
  switch (backend) {
    case CacheBackend.MEMORY:
      return "Memory";
    case CacheBackend.REDIS:
      return "Redis";
    case CacheBackend.HYBRID:
      return "Hybrid (Redis/Memory)";
    default:
      return "Unknown";
  }
}
