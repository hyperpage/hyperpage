// Server-only rate limit service
// This module should only be used by API routes and server-side code

import { toolRegistry } from '../tools/registry';
import { transformGitHubLimits, transformGitLabLimits, transformJiraLimits, calculateOverallStatus } from './rate-limit-monitor';
import { Tool } from '../tools/tool-types';
import { PlatformRateLimits, RateLimitStatus } from './types/rate-limit';
import { db } from './database';
import { rateLimits, RateLimit } from './database/schema';
import { eq } from 'drizzle-orm';

// In-memory cache with TTL support for server-side use only
const rateLimitCache: { [key: string]: { data: RateLimitStatus; expiresAt: number } } = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FRESHNESS_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes for "fresh" data

/**
 * Server-only function to get rate limit status for a platform
 * Fetches fresh data from external APIs via the tool's handler
 */
export async function getServerRateLimitStatus(platform: string, baseUrl?: string): Promise<RateLimitStatus | null> {
  const tool = toolRegistry[platform];

  if (!tool || !tool.capabilities?.includes('rate-limit')) {
    return null;
  }

  // Create a mock request object for the handler
  const mockRequest = new Request(`${baseUrl || 'http://localhost:3000'}/api/rate-limit/${platform}`);

  // Call the tool's rate-limit handler directly
  const rateLimitHandler = (tool as Tool).handlers['rate-limit'];
  if (!rateLimitHandler) {
    console.warn(`Rate limit handler not found for platform ${platform}`);
    return null;
  }

  try {
    const result = await rateLimitHandler(mockRequest, (tool as Tool).config!);

    if (!result.rateLimit) {
      console.warn(`Tool handler returned no rate limit data for ${platform}`);
      return null;
    }

    // Transform platform-specific data to universal format
    let limits: PlatformRateLimits;
    switch (platform) {
      case 'github':
        limits = transformGitHubLimits(result.rateLimit);
        break;
      case 'gitlab':
        limits = transformGitLabLimits(result.rateLimit, null);
        break;
      case 'jira':
        limits = transformJiraLimits(result.rateLimit);
        break;
      default:
        console.warn(`Rate limit transformation not implemented for platform: ${platform}`);
        return null;
    }

    // Calculate overall status
    const status: 'normal' | 'warning' | 'critical' | 'unknown' = calculateOverallStatus(limits);

    return {
      platform,
      lastUpdated: Date.now(),
      dataFresh: true,
      status,
      limits
    };

  } catch (error) {
    console.error(`Error fetching rate limit status for ${platform}:`, error);
    return null;
  }
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
    let platformLimits: any;

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
