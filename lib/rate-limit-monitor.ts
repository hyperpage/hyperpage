// Rate limit data transformation utilities
// Pure functions for transforming platform-specific rate limit data to universal format

import type {
  RateLimitCache,
  RateLimitUsage,
  PlatformRateLimits,
  GitHubRateLimitResponse,
  RateLimitStatus,
} from "./types/rate-limit";
import { toolRegistry } from "@/tools/registry";

// In-memory cache with TTL support
let rateLimitCache: RateLimitCache = {};

/**
 * Calculate rate limit usage percentage and status
 */
export function calculateLimitUsage(
  limit: number | null,
  remaining: number | null,
): Omit<RateLimitUsage, "resetTime" | "retryAfter"> {
  if (limit === null || remaining === null) {
    return {
      limit,
      remaining,
      used: null,
      usagePercent: null,
    };
  }

  const used = limit - remaining;
  const usagePercent = limit > 0 ? (used / limit) * 100 : 0;

  return {
    limit,
    remaining,
    used: Math.max(0, used),
    usagePercent: Math.max(0, Math.min(100, usagePercent)),
  };
}

/**
 * Determine overall rate limit status based on usage percentage
 */
export function calculateOverallStatus(
  limits: PlatformRateLimits,
): "normal" | "warning" | "critical" | "unknown" {
  const allUsages = Object.values(limits)
    .flatMap((platformLimits) =>
      Object.values(platformLimits || {}).map(
        (usage: unknown) => (usage as RateLimitUsage).usagePercent,
      ),
    )
    .filter((percent): percent is number => percent !== null);

  if (allUsages.length === 0) return "unknown";

  const maxUsage = Math.max(...allUsages);

  if (maxUsage >= 90) return "critical";
  if (maxUsage >= 75) return "warning";
  return "normal";
}

/**
 * Transform GitHub rate limit API response to universal format
 */
export function transformGitHubLimits(data: unknown): PlatformRateLimits {
  const githubData = data as GitHubRateLimitResponse;
  return {
    github: {
      core: {
        ...calculateLimitUsage(
          githubData.resources?.core?.limit,
          githubData.resources?.core?.remaining,
        ),
        resetTime: githubData.resources?.core?.reset
          ? githubData.resources.core.reset * 1000
          : null,
        retryAfter: null,
      },
      search: {
        ...calculateLimitUsage(
          githubData.resources?.search?.limit,
          githubData.resources?.search?.remaining,
        ),
        resetTime: githubData.resources?.search?.reset
          ? githubData.resources.search.reset * 1000
          : null,
        retryAfter: null,
      },
      graphql: {
        ...calculateLimitUsage(
          githubData.resources?.graphql?.limit,
          githubData.resources?.graphql?.remaining,
        ),
        resetTime: githubData.resources?.graphql?.reset
          ? githubData.resources.graphql.reset * 1000
          : null,
        retryAfter: null,
      },
    },
  };
}

/**
 * Transform GitLab rate limit response (mainly retry-after based)
 */
export function transformGitLabLimits(
  gitLabResponse: unknown,
  retryAfter: number | null,
): PlatformRateLimits {
  // GitLab handler returns different format - extract retryAfter if available
  const response = gitLabResponse as {
    retryAfter?: string | number;
    statusCode?: number;
  };

  // Check if retryAfter in response takes precedence
  let effectiveRetryAfter = retryAfter;
  if (response.retryAfter) {
    effectiveRetryAfter =
      typeof response.retryAfter === "string"
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
        resetTime: effectiveRetryAfter
          ? Date.now() + effectiveRetryAfter * 1000
          : null,
        retryAfter: effectiveRetryAfter,
      },
    },
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
        resetTime: effectiveRetryAfter
          ? Date.now() + effectiveRetryAfter * 1000
          : null,
        retryAfter: effectiveRetryAfter,
      },
    },
  };
}

/**
 * Clear the rate limit cache (for testing purposes)
 */
export function clearRateLimitCache(): void {
  rateLimitCache = {};
}

/**
 * Get cache statistics for testing purposes
 */
export function getCacheStats(): {
  totalEntries: number;
  oldestData: number | null;
} {
  const entries = Object.values(rateLimitCache);
  if (entries.length === 0) {
    return { totalEntries: 0, oldestData: null };
  }

  const oldestData = Math.min(
    ...entries.map((entry) => entry.data.lastUpdated),
  );

  return {
    totalEntries: entries.length,
    oldestData,
  };
}

/**
 * Get rate limit status for a platform
 * This is a client-side function that fetches from the API
 */
export async function getRateLimitStatus(
  platform: string,
  baseUrl?: string,
): Promise<RateLimitStatus | null> {
  // Check if platform supports rate limiting
  const tool = toolRegistry[platform];
  if (!tool || !tool.capabilities?.includes("rate-limit")) {
    return null;
  }

  try {
    const url = baseUrl
      ? `${baseUrl}/api/rate-limit/${platform}`
      : `/api/rate-limit/${platform}`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as RateLimitStatus;
    return data;
  } catch {
    return null;
  }
}
