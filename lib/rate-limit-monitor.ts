// Rate limit cache and monitoring system

import { RateLimitStatus, RateLimitCache, RateLimitUsage, PlatformRateLimits, GitHubRateLimitResponse } from './types/rate-limit';
import { toolRegistry } from '../tools/registry';
import { db } from './database';
import { rateLimits, RateLimit } from './database/schema';
import { eq } from 'drizzle-orm';

// In-memory cache with TTL support
let rateLimitCache: RateLimitCache = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FRESHNESS_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes for "fresh" data

/**
 * Calculate rate limit usage percentage and status
 */
export function calculateLimitUsage(limit: number | null, remaining: number | null): Omit<RateLimitUsage, 'resetTime' | 'retryAfter'> {
  if (limit === null || remaining === null) {
    return {
      limit,
      remaining,
      used: null,
      usagePercent: null
    };
  }

  const used = limit - remaining;
  const usagePercent = limit > 0 ? (used / limit) * 100 : 0;

  return {
    limit,
    remaining,
    used: Math.max(0, used),
    usagePercent: Math.max(0, Math.min(100, usagePercent))
  };
}

/**
 * Determine overall rate limit status based on usage percentage
 */
export function calculateOverallStatus(limits: PlatformRateLimits): 'normal' | 'warning' | 'critical' | 'unknown' {
  const allUsages = Object.values(limits).flatMap(platformLimits =>
    Object.values(platformLimits || {}).map((usage: unknown) => (usage as RateLimitUsage).usagePercent)
  ).filter((percent): percent is number => percent !== null);

  if (allUsages.length === 0) return 'unknown';

  const maxUsage = Math.max(...allUsages);

  if (maxUsage >= 90) return 'critical';
  if (maxUsage >= 75) return 'warning';
  return 'normal';
}

/**
 * Transform GitHub rate limit API response to universal format
 */
export function transformGitHubLimits(data: unknown): PlatformRateLimits {
  const githubData = data as GitHubRateLimitResponse;
  return {
    github: {
      core: {
        ...calculateLimitUsage(githubData.resources?.core?.limit, githubData.resources?.core?.remaining),
        resetTime: githubData.resources?.core?.reset ? githubData.resources.core.reset * 1000 : null,
        retryAfter: null
      },
      search: {
        ...calculateLimitUsage(githubData.resources?.search?.limit, githubData.resources?.search?.remaining),
        resetTime: githubData.resources?.search?.reset ? githubData.resources.search.reset * 1000 : null,
        retryAfter: null
      },
      graphql: {
        ...calculateLimitUsage(githubData.resources?.graphql?.limit, githubData.resources?.graphql?.remaining),
        resetTime: githubData.resources?.graphql?.reset ? githubData.resources.graphql.reset * 1000 : null,
        retryAfter: null
      }
    }
  };
}

/**
 * Transform GitLab rate limit response (mainly retry-after based)
 */
export function transformGitLabLimits(gitLabResponse: unknown, retryAfter: number | null): PlatformRateLimits {
  // GitLab handler returns different format - extract retryAfter if available
  const response = gitLabResponse as { retryAfter?: string | number; statusCode?: number };

  // Check if retryAfter in response takes precedence
  let effectiveRetryAfter = retryAfter;
  if (response.retryAfter) {
    effectiveRetryAfter = typeof response.retryAfter === 'string'
      ? parseInt(response.retryAfter, 10)
      : response.retryAfter;
  }

  // Determine usage status based on response
  let usagePercent: number | null = null;
  if (response.statusCode === 429) {
    usagePercent = 100; // Rate limited = 100% usage
  } else if (effectiveRetryAfter || response.statusCode === 200) {
    usagePercent = effectiveRetryAfter ? 90 : 10; // High usage if retry-after present, low otherwise
  }

  return {
    gitlab: {
      global: {
        limit: null,
        remaining: null,
        used: null,
        usagePercent,
        resetTime: effectiveRetryAfter ? Date.now() + (effectiveRetryAfter * 1000) : null,
        retryAfter: effectiveRetryAfter
      }
    }
  };
}

/**
 * Transform Jira rate limit response (instance-specific)
 */
export function transformJiraLimits(jiraResponse: unknown): PlatformRateLimits {
  // Jira handler returns different format - check for rate limiting indicators
  const response = jiraResponse as { retryAfter?: string; statusCode?: number };

  // Determine usage status based on response
  let usagePercent: number | null = null;
  let effectiveRetryAfter: number | null = null;

  if (response.statusCode === 429) {
    usagePercent = 100; // Rate limited = 100% usage
    if (response.retryAfter) {
      effectiveRetryAfter = parseInt(response.retryAfter, 10);
    }
  } else if (response.statusCode === 200) {
    usagePercent = 10; // Normal usage when API is accessible
  }

  return {
    jira: {
      global: {
        limit: null,
        remaining: null,
        used: null,
        usagePercent,
        resetTime: effectiveRetryAfter ? Date.now() + (effectiveRetryAfter * 1000) : null,
        retryAfter: effectiveRetryAfter
      }
    }
  };
}

/**
 * Get rate limit status from cache or fetch fresh
 */
export async function getRateLimitStatus(platform: string, baseUrl?: string): Promise<RateLimitStatus | null> {
  const tool = toolRegistry[platform];

  if (!tool || !tool.capabilities?.includes('rate-limit')) {
    return null; // Tool doesn't support rate limit monitoring
  }

  const cacheKey = platform;
  const now = Date.now();
  const cached = rateLimitCache[cacheKey];

  // Return cached data if still fresh
  if (cached && cached.expiresAt > now) {
    const age = now - cached.data.lastUpdated;
    cached.data.dataFresh = age < FRESHNESS_THRESHOLD_MS;
    return cached.data;
  }

  // Fetch fresh data from tool's rate-limit API
  try {
    const actualBaseUrl = baseUrl || (process.env.NODE_ENV === 'production'
      ? process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      : 'http://localhost:3000');

    const response = await fetch(`${actualBaseUrl}/api/rate-limit/${platform}`);

    if (!response || !response.ok) {
      console.warn(`Rate limit API call failed for ${platform}: ${response ? response.status : 'no response'}`);
      // Return stale cache if available, otherwise return null
      return cached?.data || null;
    }

    const rateLimitStatus = await response.json() as RateLimitStatus;

    // Cache the result
    rateLimitCache[cacheKey] = {
      data: rateLimitStatus,
      expiresAt: now + CACHE_TTL_MS
    };

    // Persist rate limit data to database for recovery
    saveRateLimitStatus(rateLimitStatus).catch(error =>
      console.error('Failed to persist rate limit data:', error)
    );

    return rateLimitStatus;
  } catch (error) {
    console.error(`Error fetching rate limit status for ${platform}:`, error);
    // Return stale cache if available
    return cached?.data || null;
  }
}

/**
 * Clear all cached rate limit data
 */
export function clearRateLimitCache(): void {
  rateLimitCache = {};
}

/**
 * Load persisted rate limit data from database at application startup
 */
export async function loadPersistedRateLimits(): Promise<number> {
  try {
    console.info('Loading persisted rate limit data...');
    const persistedLimits = await db.select().from(rateLimits);

    let loadedCount = 0;
    const now = Date.now();

    for (const limit of persistedLimits) {
      try {
        // Only load data that's not too old (within 24 hours)
        const lastUpdatedMs = Number(limit.lastUpdated);
        if (now - lastUpdatedMs > 24 * 60 * 60 * 1000) {
          continue; // Skip stale data
        }

        const platform = limit.platform;
        const cacheKey = platform;

        // Check if we have fresh data already loaded
        const existing = rateLimitCache[cacheKey];
        if (existing && existing.data.lastUpdated > lastUpdatedMs) {
          continue; // Skip if we have fresher data
        }

        // Reconstruct rate limit status from persisted data
        const limitTotal = limit.limitTotal ? Number(limit.limitTotal) : null;
        const limitRemaining = limit.limitRemaining ? Number(limit.limitRemaining) : null;
        const resetTime = limit.resetTime ? Number(limit.resetTime) : null;

        let status: 'normal' | 'warning' | 'critical' | 'unknown' = 'unknown';
        if (limitRemaining !== null && limitTotal !== null) {
          const usagePercent = ((limitTotal - limitRemaining) / limitTotal) * 100;
          status = usagePercent >= 90 ? 'critical' : usagePercent >= 75 ? 'warning' : 'normal';
        }

        const limitsObject: PlatformRateLimits = {};
        if (platform === 'github') {
          limitsObject.github = {
            global: {
              limit: limitTotal,
              remaining: limitRemaining,
              used: limitTotal && limitRemaining ? limitTotal - limitRemaining : null,
              usagePercent: limitTotal && limitRemaining ?
                Math.min(100, ((limitTotal - limitRemaining) / limitTotal) * 100) : null,
              resetTime,
              retryAfter: null
            }
          } as any; // GitHub has global limit as approximation
        } else if (platform === 'gitlab') {
          limitsObject.gitlab = {
            global: {
              limit: limitTotal,
              remaining: limitRemaining,
              used: limitTotal && limitRemaining ? limitTotal - limitRemaining : null,
              usagePercent: limitTotal && limitRemaining ?
                Math.min(100, ((limitTotal - limitRemaining) / limitTotal) * 100) : null,
              resetTime,
              retryAfter: null
            }
          };
        } else if (platform === 'jira') {
          limitsObject.jira = {
            global: {
              limit: limitTotal,
              remaining: limitRemaining,
              used: limitTotal && limitRemaining ? limitTotal - limitRemaining : null,
              usagePercent: limitTotal && limitRemaining ?
                Math.min(100, ((limitTotal - limitRemaining) / limitTotal) * 100) : null,
              resetTime,
              retryAfter: null
            }
          };
        }

        const rateLimitStatus: RateLimitStatus = {
          platform,
          lastUpdated: lastUpdatedMs,
          dataFresh: false, // Data from restart isn't fresh
          status,
          limits: limitsObject
        };

        // Cache the persisted data
        rateLimitCache[cacheKey] = {
          data: rateLimitStatus,
          expiresAt: resetTime ? Math.min(now + CACHE_TTL_MS, resetTime) : (now + CACHE_TTL_MS)
        };

        loadedCount++;
      } catch (error) {
        console.error(`Failed to load persisted rate limit for ${limit.platform}:`, error);
        continue;
      }
    }

    console.info(`Successfully loaded ${loadedCount} persisted rate limit records`);
    return loadedCount;
  } catch (error) {
    console.error('Failed to load persisted rate limits:', error);
    return 0;
  }
}

/**
 * Save rate limit status to database for persistence
 */
export async function saveRateLimitStatus(rateLimitStatus: RateLimitStatus): Promise<void> {
  try {
    const platform = rateLimitStatus.platform;

    // Extract limit data by checking known platform types
    let platformLimits: RateLimitUsage | undefined;

    if (platform === 'github' && rateLimitStatus.limits.github) {
      // For GitHub, use core limits as primary (most restrictive)
      platformLimits = rateLimitStatus.limits.github.core;
    } else if (platform === 'gitlab' && rateLimitStatus.limits.gitlab) {
      platformLimits = rateLimitStatus.limits.gitlab.global;
    } else if (platform === 'jira' && rateLimitStatus.limits.jira) {
      platformLimits = rateLimitStatus.limits.jira.global;
    }

    if (!platformLimits) {
      console.warn(`No rate limit data found for platform ${platform}, skipping persistence`);
      return;
    }

    const limitRecord = {
      id: `${platform}:global`, // Use consistent format: platform:resource_type
      platform,
      limitRemaining: platformLimits.remaining,
      limitTotal: platformLimits.limit,
      resetTime: platformLimits.resetTime,
      lastUpdated: rateLimitStatus.lastUpdated,
    };

    // Upsert the rate limit record
    await db.insert(rateLimits)
      .values(limitRecord)
      .onConflictDoUpdate({
        target: rateLimits.id,
        set: {
          limitRemaining: limitRecord.limitRemaining,
          limitTotal: limitRecord.limitTotal,
          resetTime: limitRecord.resetTime,
          lastUpdated: limitRecord.lastUpdated,
        }
      });

    // Also clean up old rate limit records (older than 7 days)
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
    await db.delete(rateLimits).where(
      eq(rateLimits.lastUpdated as any, cutoffTime) // Simplified comparison
    );

  } catch (error) {
    console.error(`Failed to save rate limit status for ${rateLimitStatus.platform}:`, error);
    // Don't throw - persistence failures shouldn't break rate limit monitoring
  }
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(): { totalEntries: number; oldestData: number | null } {
  const entries = Object.entries(rateLimitCache);
  return {
    totalEntries: entries.length,
    oldestData: entries.length > 0
      ? Math.min(...entries.map(([, value]) => value.data.lastUpdated))
      : null
  };
}
