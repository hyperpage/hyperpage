import { NextRequest, NextResponse } from 'next/server';
import { defaultCache } from '../../cache/cache-factory';
import { generateCacheKey } from '../../cache/memory-cache';

export interface InvalidationRule {
  /** Pattern to match cache keys for invalidation */
  pattern?: string | RegExp;
  /** HTTP methods that trigger this rule */
  methods?: ('POST' | 'PUT' | 'PATCH' | 'DELETE')[];
  /** Specific paths to invalidate */
  paths?: string[];
  /** TTL to set on new cached items (ms) */
  newTtl?: number;
  /** Whether to invalidate related resources */
  invalidateRelated?: boolean;
}

export interface CacheInvalidationOptions {
  /** Time-to-live for responses (ms) */
  defaultTtl?: number;
  /** Stale-while-revalidate window (ms) */
  staleWhileRevalidate?: number;
  /** Invalidation rules */
  invalidationRules?: InvalidationRule[];
  /** Whether to enable smart invalidation */
  smartInvalidation?: boolean;
  /** Tags for cache tagging */
  tags?: string[];
}

/**
 * Advanced cache invalidation middleware with smart invalidation rules
 * Supports cache tagging, stale-while-revalidate, and triggered invalidation
 */
export class CacheInvalidationMiddleware {
  private options: CacheInvalidationOptions;

  constructor(options: Partial<CacheInvalidationOptions> = {}) {
    this.options = {
      defaultTtl: 300000, // 5 minutes
      staleWhileRevalidate: 60000, // 1 minute
      smartInvalidation: true,
      invalidationRules: this.getDefaultInvalidationRules(),
      ...options,
    };
  }

  /**
   * Apply smart caching with invalidation rules
   */
  async applySmartCaching(
    request: NextRequest,
    response: NextResponse,
    tags: string[] = []
  ): Promise<NextResponse> {
    const url = new URL(request.url);
    const method = request.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

    // Only apply caching to GET requests
    if (method !== 'GET') {
      // Handle invalidation for write operations
      await this.handleInvalidation(request, method, url.pathname);
      return response;
    }

    // Generate cache key
    const queryParams = Object.fromEntries(url.searchParams);
    const cacheKey = generateCacheKey('api', url.pathname, queryParams);

    // Add cache tags to response headers
    const allTags = [...(this.options.tags || []), ...tags];
    if (allTags.length > 0) {
      response.headers.set('X-Cache-Tags', allTags.join(','));
    }

    // Set cache-control headers based on stale-while-revalidate
    const maxAge = Math.floor((this.options.defaultTtl || 300000) / 1000);
    const staleWhileRevalidate = Math.floor((this.options.staleWhileRevalidate || 60000) / 1000);
    response.headers.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);

    // Add to cache with TTL
    const ttl = this.options.defaultTtl || 300000;
    const responseData = await response.clone().json();
    await defaultCache.set(cacheKey, responseData, ttl);

    response.headers.set('X-Cache-Status', 'FRESH');
    response.headers.set('X-Cache-Key', cacheKey);

    return response;
  }

  /**
   * Check if cached data should be served (with smart invalidation)
   */
  async checkSmartCache(
    request: NextRequest
  ): Promise<{ cached: boolean; response?: NextResponse; data?: unknown }> {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams);
    const cacheKey = generateCacheKey('api', url.pathname, queryParams);

    // Check cache bypass headers
    const cacheControl = request.headers.get('cache-control');
    const bypassCache = cacheControl === 'no-cache' ||
                       cacheControl === 'max-age=0' ||
                       request.headers.has('x-cache-bypass');

    if (bypassCache) {
      return { cached: false };
    }

    // Get cached data
    const cachedData = await defaultCache.get(cacheKey);
    if (!cachedData) {
      return { cached: false };
    }

    // Create cached response
    const cachedResponse = NextResponse.json(cachedData, {
      headers: {
        'X-Cache-Status': 'HIT',
        'X-Cache-Key': cacheKey,
        'Cache-Control': 'public, max-age=30',
      },
    });

    return {
      cached: true,
      response: cachedResponse,
      data: cachedData,
    };
  }

  /**
   * Handle cache invalidation based on request and rules
   */
  private async handleInvalidation(
    request: NextRequest,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string
  ): Promise<void> {
    if (!this.options.smartInvalidation) {
      return;
    }

    const invalidationPromises: Promise<void>[] = [];

    // Apply each invalidation rule
    for (const rule of this.options.invalidationRules || []) {
      if (this.matchesInvalidationRule(rule, method, path)) {
        const promise = this.invalidateByRule(rule);
        invalidationPromises.push(promise);
      }
    }

    // Wait for all invalidations to complete
    await Promise.allSettled(invalidationPromises);
  }

  /**
   * Check if a request matches an invalidation rule
   */
  private matchesInvalidationRule(
    rule: InvalidationRule,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string
  ): boolean {
    // Check method
    if (rule.methods && !rule.methods.includes(method)) {
      return false;
    }

    // Check exact paths
    if (rule.paths && rule.paths.includes(path)) {
      return true;
    }

    // Check pattern
    if (rule.pattern) {
      if (typeof rule.pattern === 'string') {
        return path.includes(rule.pattern);
      } else {
        return rule.pattern.test(path);
      }
    }

    return false;
  }

  /**
   * Invalidate cache entries based on a rule
   */
  private async invalidateByRule(
    rule: InvalidationRule
  ): Promise<void> {
    try {
      // Get all cache keys (this is a simplified approach - in production you'd want a more efficient method)
      const cacheKeys = defaultCache.keys;
      if (!cacheKeys || !Array.isArray(cacheKeys)) {
        return;
      }

      const keysToDelete: string[] = [];

      for (const key of cacheKeys) {
        if (typeof key === 'string') {
          let shouldInvalidate = false;

          // Check pattern matching
          if (rule.pattern) {
            if (typeof rule.pattern === 'string') {
              shouldInvalidate = key.includes(rule.pattern);
            } else {
              shouldInvalidate = rule.pattern.test(key);
            }
          }

          // Invalidate related resources
          if (rule.invalidateRelated && !shouldInvalidate) {
            shouldInvalidate = this.isRelatedResource(key, rule.pattern as string);
          }

          if (shouldInvalidate) {
            keysToDelete.push(key);
          }
        }
      }

      // Delete matched keys
      if (keysToDelete.length > 0) {
        console.debug(`Invalidating ${keysToDelete.length} cache entries:`, keysToDelete);
        await Promise.allSettled(keysToDelete.map(key => defaultCache.delete(key)));
      }

    } catch (error) {
      console.warn('Cache invalidation error:', error);
      // Don't throw - invalidation failures shouldn't break the main request
    }
  }

  /**
   * Check if a cache key represents a related resource
   */
  private isRelatedResource(cacheKey: string, triggerPattern: string): boolean {
    // Extract resource types from common patterns
    const resourcePatterns = [
      /\/tools\/([^\/]+)/,    // Tool-specific resources
      /\/([^\/]+)\/[^\/]+$/,  // General resource patterns
    ];

    for (const pattern of resourcePatterns) {
      const triggerMatch = triggerPattern.match(pattern);
      const keyMatch = cacheKey.match(pattern);

      if (triggerMatch && keyMatch && triggerMatch[1] === keyMatch[1]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      const cacheKeys = defaultCache.keys;
      if (!cacheKeys || !Array.isArray(cacheKeys)) {
        return;
      }

      const keysToDelete: string[] = [];

      for (const key of cacheKeys) {
        if (typeof key === 'string') {
          // Check cached response for tags (this is simplified - you'd want to store tags metadata)
          const cachedData = await defaultCache.get(key);
          if (cachedData && typeof cachedData === 'object') {
            // If we had stored tags with the cached data, we could check here
            // For now, use pattern-based invalidation
            for (const tag of tags) {
              if (key.includes(tag.toLowerCase())) {
                keysToDelete.push(key);
                break;
              }
            }
          }
        }
      }

      if (keysToDelete.length > 0) {
        console.debug(`Invalidating ${keysToDelete.length} cache entries by tags:`, tags);
        await Promise.allSettled(keysToDelete.map(key => defaultCache.delete(key)));
      }

    } catch (error) {
      console.warn('Tag-based cache invalidation error:', error);
    }
  }

  /**
   * Get default invalidation rules for common patterns
   */
  private getDefaultInvalidationRules(): InvalidationRule[] {
    return [
      // Invalidate all tool data when any tool endpoint is modified
      {
        pattern: /^\/api\/tools\/[^\/]+/,
        methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
        invalidateRelated: true,
      },
      // Invalidate health/metrics when system state changes
      {
        pattern: /^\/api\/(health|metrics)/,
        methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
      },
      // Invalidate config when settings are changed
      {
        paths: ['/api/tools/config'],
        methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
        invalidateRelated: true,
      },
      // Invalidate enabled tools list when tool states change
      {
        paths: ['/api/tools/enabled'],
        methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
        invalidateRelated: true,
      },
    ];
  }

  /**
   * Get cache statistics and configuration
   */
  getCacheStats(): {
    enabled: boolean;
    defaultTtl: number;
    staleWhileRevalidate: number;
    smartInvalidation: boolean;
    invalidationRules: number;
  } {
    return {
      enabled: true,
      defaultTtl: this.options.defaultTtl || 300000,
      staleWhileRevalidate: this.options.staleWhileRevalidate || 60000,
      smartInvalidation: this.options.smartInvalidation || true,
      invalidationRules: this.options.invalidationRules?.length || 0,
    };
  }
}

// Default cache invalidation middleware instance
export const defaultCacheInvalidationMiddleware = new CacheInvalidationMiddleware();

/**
 * Helper function to apply smart caching to any response
 */
export async function applySmartCaching(
  request: NextRequest,
  response: NextResponse,
  tags: string[] = [],
  options?: Partial<CacheInvalidationOptions>
): Promise<NextResponse> {
  const middleware = options ? new CacheInvalidationMiddleware(options) : defaultCacheInvalidationMiddleware;
  return middleware.applySmartCaching(request, response, tags);
}

/**
 * Helper function to check smart cache
 */
export async function checkSmartCache(
  request: NextRequest,
  options?: Partial<CacheInvalidationOptions>
): Promise<{ cached: boolean; response?: NextResponse; data?: unknown }> {
  const middleware = options ? new CacheInvalidationMiddleware(options) : defaultCacheInvalidationMiddleware;
  return middleware.checkSmartCache(request);
}

/**
 * Helper function to invalidate cache by tags
 */
export async function invalidateCacheByTags(
  tags: string[],
  options?: Partial<CacheInvalidationOptions>
): Promise<void> {
  const middleware = options ? new CacheInvalidationMiddleware(options) : defaultCacheInvalidationMiddleware;
  return middleware.invalidateByTags(tags);
}
