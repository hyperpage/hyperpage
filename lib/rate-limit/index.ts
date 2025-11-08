/**
 * Unified Rate Limit Service
 *
 * Consolidates rate limit monitoring, server-side status, authentication rate limiting,
 * and utility functions into a single, cohesive service.
 *
 * This service replaces:
 * - rate-limit-monitor.ts (data transformation utilities)
 * - rate-limit-service.ts (server-side status and persistence)
 * - rate-limit-auth.ts (authentication rate limiting)
 * - rate-limit-utils.ts (platform detection and utilities)
 */

import type {
  RateLimitUsage,
  PlatformRateLimits,
  GitHubRateLimitResponse,
  RateLimitStatus,
} from "@/lib/types/rate-limit";
import { toolRegistry } from "@/tools/registry";
import { Tool } from "@/tools/tool-types";
import { db } from "@/lib/database";
import { rateLimits } from "@/lib/database/schema";
import { sql } from "drizzle-orm";
import { rateLimitLogger } from "@/lib/logger";
import type { NextRequest } from "next/server";

// Enhanced interfaces for unified service
export interface UnifiedRateLimitServiceOptions {
  maxAuthRequests: number;
  authWindowMs: number;
  cacheTtlMs?: number;
}

export interface PlatformHealthStatus {
  platform: string;
  status: "healthy" | "degraded" | "unhealthy";
  lastChecked: number;
  averageResponseTime: number;
  errorRate: number;
}

export interface RateLimitServiceConfig {
  // Authentication rate limiting
  maxAuthRequests: number;
  authWindowMs: number;

  // Cache configuration
  cacheTtlMs: number;
  maxCacheEntries: number;

  // Platform-specific settings
  refreshIntervals: Record<string, number>;
}

// In-memory cache with TTL support
class RateLimitCache {
  private cache: Map<string, { data: RateLimitStatus; expiresAt: number }> =
    new Map();
  private config: RateLimitServiceConfig;

  constructor(config: RateLimitServiceConfig) {
    this.config = config;
  }

  get(key: string): RateLimitStatus | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: RateLimitStatus, resetTime?: number): void {
    // Clean up old entries if cache is getting full
    if (this.cache.size >= this.config.maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    const expiresAt = resetTime
      ? Math.min(Date.now() + this.config.cacheTtlMs, resetTime)
      : Date.now() + this.config.cacheTtlMs;

    this.cache.set(key, { data, expiresAt });
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { totalEntries: number; oldestData: number | null } {
    const entries = Array.from(this.cache.values());
    if (entries.length === 0) {
      return { totalEntries: 0, oldestData: null };
    }

    const oldestData = Math.min(...entries.map((entry) => entry.expiresAt));

    return {
      totalEntries: entries.length,
      oldestData,
    };
  }
}

// Authentication rate limiter
class AuthRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  checkLimit(clientId: string): {
    allowed: boolean;
    resetTime: number;
    remaining: number;
  } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const clientRequests = this.requests.get(clientId) || [];

    // Clean old requests outside the window
    const validRequests = clientRequests.filter((time) => time > windowStart);

    if (validRequests.length >= this.maxRequests) {
      const resetTime = Math.min(...validRequests) + this.windowMs;
      return {
        allowed: false,
        resetTime,
        remaining: 0,
      };
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(clientId, validRequests);

    return {
      allowed: true,
      resetTime: now + this.windowMs,
      remaining: this.maxRequests - validRequests.length,
    };
  }
}

// Platform detector interface
interface PlatformDetector {
  canHandle(platform: string): boolean;
  getRefreshInterval(): number;
  transformLimits(
    data: unknown,
    retryAfter?: number | null,
  ): PlatformRateLimits;
}

// GitHub platform detector
class GitHubPlatformDetector implements PlatformDetector {
  canHandle(platform: string): boolean {
    return platform === "github";
  }

  getRefreshInterval(): number {
    return 5 * 60 * 1000; // 5 minutes
  }

  transformLimits(data: unknown): PlatformRateLimits {
    const githubData = data as GitHubRateLimitResponse;
    return {
      github: {
        core: {
          ...this.calculateLimitUsage(
            githubData.resources?.core?.limit,
            githubData.resources?.core?.remaining,
          ),
          resetTime: githubData.resources?.core?.reset
            ? githubData.resources.core.reset * 1000
            : null,
          retryAfter: null,
        },
        search: {
          ...this.calculateLimitUsage(
            githubData.resources?.search?.limit,
            githubData.resources?.search?.remaining,
          ),
          resetTime: githubData.resources?.search?.reset
            ? githubData.resources.search.reset * 1000
            : null,
          retryAfter: null,
        },
        graphql: {
          ...this.calculateLimitUsage(
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

  private calculateLimitUsage(
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
}

// GitLab platform detector
class GitLabPlatformDetector implements PlatformDetector {
  canHandle(platform: string): boolean {
    return platform === "gitlab";
  }

  getRefreshInterval(): number {
    return 3 * 60 * 1000; // 3 minutes
  }

  transformLimits(
    data: unknown,
    retryAfter?: number | null,
  ): PlatformRateLimits {
    const response = data as {
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
      usagePercent = effectiveRetryAfter ? 90 : 10;
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
          retryAfter: effectiveRetryAfter || null,
        },
      },
    };
  }
}

// Jira platform detector
class JiraPlatformDetector implements PlatformDetector {
  canHandle(platform: string): boolean {
    return platform === "jira";
  }

  getRefreshInterval(): number {
    return 10 * 60 * 1000; // 10 minutes
  }

  transformLimits(data: unknown): PlatformRateLimits {
    const response = data as { retryAfter?: string; statusCode?: number };

    let usagePercent: number | null = null;
    let effectiveRetryAfter: number | null = null;

    if (response.statusCode === 429) {
      usagePercent = 100;
      if (response.retryAfter) {
        effectiveRetryAfter = parseInt(response.retryAfter, 10);
      }
    } else if (response.statusCode === 200) {
      usagePercent = 10;
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
}

/**
 * Unified Rate Limit Service
 *
 * Consolidates all rate limit functionality into a single, maintainable service.
 */
export class UnifiedRateLimitService {
  private cache: RateLimitCache;
  private authLimiter: AuthRateLimiter;
  private platformDetectors: Map<string, PlatformDetector>;
  private config: RateLimitServiceConfig;

  constructor(options: UnifiedRateLimitServiceOptions) {
    this.config = {
      maxAuthRequests: options.maxAuthRequests,
      authWindowMs: options.authWindowMs,
      cacheTtlMs: options.cacheTtlMs || 5 * 60 * 1000, // 5 minutes
      maxCacheEntries: 100,
      refreshIntervals: {
        github: 5 * 60 * 1000, // 5 minutes
        gitlab: 3 * 60 * 1000, // 3 minutes
        jira: 10 * 60 * 1000, // 10 minutes
      },
    };

    this.authLimiter = new AuthRateLimiter(
      options.maxAuthRequests,
      options.authWindowMs,
    );
    this.cache = new RateLimitCache(this.config);

    this.platformDetectors = new Map([
      ["github", new GitHubPlatformDetector()],
      ["gitlab", new GitLabPlatformDetector()],
      ["jira", new JiraPlatformDetector()],
    ]);
  }

  /**
   * Get rate limit status for a platform
   */
  async getRateLimitStatus(
    platform: string,
    baseUrl?: string,
  ): Promise<RateLimitStatus | null> {
    // Check cache first
    const cached = this.cache.get(platform);
    if (cached) {
      return cached;
    }

    // Check if platform supports rate limiting
    const tool = toolRegistry[platform];
    if (!tool || !tool.capabilities?.includes("rate-limit")) {
      return null;
    }

    // Get fresh data from server
    const status = await this.getServerRateLimitStatus(platform, baseUrl);
    if (status) {
      this.cache.set(platform, status);
    }

    return status;
  }

  /**
   * Server-only function to get rate limit status for a platform
   * Fetches fresh data from external APIs via the tool's handler
   */
  private async getServerRateLimitStatus(
    platform: string,
    baseUrl?: string,
  ): Promise<RateLimitStatus | null> {
    const tool = toolRegistry[platform];

    if (!tool || !tool.capabilities?.includes("rate-limit")) {
      return null;
    }

    const mockRequest = new Request(
      `${baseUrl || "http://localhost:3000"}/api/rate-limit/${platform}`,
    );

    const rateLimitHandler = (tool as Tool).handlers["rate-limit"];
    if (!rateLimitHandler) {
      rateLimitLogger.event(
        "warn",
        platform,
        "No rate-limit handler found for platform",
      );
      return null;
    }

    try {
      const result = await rateLimitHandler(
        mockRequest,
        (tool as Tool).config!,
      );

      if (!result.rateLimit) {
        rateLimitLogger.event(
          "warn",
          platform,
          "No rate limit data returned from handler",
        );
        return null;
      }

      // Transform platform-specific data to universal format
      const limits = this.transformPlatformLimits(platform, result.rateLimit);

      // Calculate overall status
      const status: "normal" | "warning" | "critical" | "unknown" =
        this.calculateOverallStatus(limits);

      return {
        platform,
        lastUpdated: Date.now(),
        dataFresh: true,
        status,
        limits,
      };
    } catch (error) {
      rateLimitLogger.event(
        "error",
        platform,
        "Failed to get rate limit status",
        { error },
      );
      return null;
    }
  }

  /**
   * Transform platform-specific data using appropriate detector
   */
  private transformPlatformLimits(
    platform: string,
    data: unknown,
    retryAfter?: number | null,
  ): PlatformRateLimits {
    const detector = this.platformDetectors.get(platform);
    if (!detector) {
      rateLimitLogger.event(
        "warn",
        platform,
        "No rate limit detector found for platform",
        { platform },
      );
      return {};
    }

    return detector.transformLimits(data, retryAfter);
  }

  /**
   * Determine overall rate limit status based on usage percentage
   */
  private calculateOverallStatus(
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
   * Check authentication rate limit for a request
   */
  checkAuthRateLimit(request: NextRequest): Response | null {
    const clientId = this.getClientIdentifier(request);
    const limitCheck = this.authLimiter.checkLimit(clientId);

    if (!limitCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          message:
            "Too many authentication attempts. Please wait before trying again.",
          resetTime: limitCheck.resetTime,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": this.config.maxAuthRequests.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": Math.ceil(
              limitCheck.resetTime / 1000,
            ).toString(),
            "Retry-After": Math.ceil(
              (limitCheck.resetTime - Date.now()) / 1000,
            ).toString(),
          },
        },
      );
    }

    return null;
  }

  /**
   * Calculate optimal refresh interval for a platform
   */
  calculateOptimalInterval(
    platform: string,
    limits: PlatformRateLimits,
  ): number {
    const baseInterval =
      this.config.refreshIntervals[platform] || 5 * 60 * 1000;

    // Get highest usage percentage
    const allUsages = Object.values(limits)
      .flatMap((platformLimits) =>
        Object.values(platformLimits || {}).map(
          (usage: unknown) => (usage as RateLimitUsage).usagePercent,
        ),
      )
      .filter((percent): percent is number => percent !== null);

    if (allUsages.length === 0) return baseInterval;

    const maxUsage = Math.max(...allUsages);

    // Adjust interval based on usage
    if (maxUsage >= 90) {
      return baseInterval * 2; // Double interval when critical
    } else if (maxUsage >= 75) {
      return Math.floor(baseInterval * 1.5); // 50% longer when warning
    }

    return baseInterval;
  }

  /**
   * Get platform health status
   */
  getPlatformHealth(platform: string): PlatformHealthStatus {
    const lastStatus = this.cache.get(platform);

    return {
      platform,
      status: lastStatus ? "healthy" : "unhealthy",
      lastChecked: lastStatus?.lastUpdated || Date.now(),
      averageResponseTime: 0, // TODO: Implement response time tracking
      errorRate: 0, // TODO: Implement error rate tracking
    };
  }

  /**
   * Get all platforms health status
   */
  getAllPlatformsHealth(): PlatformHealthStatus[] {
    return Array.from(this.platformDetectors.keys()).map((platform) =>
      this.getPlatformHealth(platform),
    );
  }

  /**
   * Refresh rate limit data for a platform
   */
  async refreshPlatformLimits(platform: string): Promise<void> {
    const status = await this.getRateLimitStatus(platform);
    if (status) {
      // Also persist to database
      await this.saveRateLimitStatus(status);
    }
  }

  /**
   * Save rate limit status to database for persistence
   */
  private async saveRateLimitStatus(
    rateLimitStatus: RateLimitStatus,
  ): Promise<void> {
    try {
      const platform = rateLimitStatus.platform;

      let platformLimits: {
        remaining?: number | null;
        limit?: number | null;
        resetTime?: number | null;
      };

      if (platform === "github" && rateLimitStatus.limits.github) {
        platformLimits = rateLimitStatus.limits.github.core || {};
      } else if (platform === "gitlab" && rateLimitStatus.limits.gitlab) {
        platformLimits = rateLimitStatus.limits.gitlab.global || {};
      } else if (platform === "jira" && rateLimitStatus.limits.jira) {
        platformLimits = rateLimitStatus.limits.jira.global || {};
      } else {
        rateLimitLogger.event(
          "warn",
          platform,
          "No rate limit data found for platform, skipping persistence",
        );
        return;
      }

      const limitRecord = {
        id: `${platform}:global`,
        platform,
        limitRemaining: platformLimits.remaining ?? null,
        limitTotal: platformLimits.limit ?? null,
        resetTime: platformLimits.resetTime ?? null,
        lastUpdated: rateLimitStatus.lastUpdated,
      };

      await db
        .insert(rateLimits)
        .values(limitRecord)
        .onConflictDoUpdate({
          target: rateLimits.id,
          set: {
            limitRemaining: limitRecord.limitRemaining,
            limitTotal: limitRecord.limitTotal,
            resetTime: limitRecord.resetTime,
            lastUpdated: limitRecord.lastUpdated,
          },
        });

      // Clean up old rate limit records
      const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000;
      await db
        .delete(rateLimits)
        .where(sql`${rateLimits.lastUpdated} < ${cutoffTime}`);
    } catch (error) {
      rateLimitLogger.event(
        "error",
        rateLimitStatus.platform,
        "Failed to save rate limit status",
        { error },
      );
    }
  }

  /**
   * Load persisted rate limit data from database at application startup
   */
  async loadPersistedRateLimits(): Promise<number> {
    try {
      rateLimitLogger.event(
        "info",
        "system",
        "Loading persisted rate limits from database",
      );
      const persistedLimits = await db.select().from(rateLimits);

      let loadedCount = 0;
      const now = Date.now();

      for (const limit of persistedLimits) {
        try {
          const lastUpdatedMs = Number(limit.lastUpdated);
          if (now - lastUpdatedMs > 24 * 60 * 60 * 1000) {
            continue; // Skip stale data
          }

          const platform = limit.platform;
          const existing = this.cache.get(platform);
          if (existing && existing.lastUpdated > lastUpdatedMs) {
            continue; // Skip if we have fresher data
          }

          const rateLimitStatus = this.reconstructRateLimitStatus(
            limit,
            lastUpdatedMs,
          );
          this.cache.set(platform, rateLimitStatus);
          loadedCount++;
        } catch (error) {
          rateLimitLogger.event(
            "error",
            limit.platform,
            "Failed to load persisted rate limit",
            { error },
          );
          continue;
        }
      }

      rateLimitLogger.event(
        "info",
        "system",
        `Successfully loaded ${loadedCount} persisted rate limit records`,
        { loadedCount },
      );
      return loadedCount;
    } catch (error) {
      rateLimitLogger.event(
        "error",
        "system",
        "Failed to load persisted rate limits",
        { error },
      );
      return 0;
    }
  }

  /**
   * Reconstruct rate limit status from persisted database data
   */
  private reconstructRateLimitStatus(
    limit: {
      platform: string;
      limitTotal?: number | null;
      limitRemaining?: number | null;
      resetTime?: number | null;
    },
    lastUpdatedMs: number,
  ): RateLimitStatus {
    const platform = limit.platform;
    const limitTotal = limit.limitTotal ? Number(limit.limitTotal) : null;
    const limitRemaining = limit.limitRemaining
      ? Number(limit.limitRemaining)
      : null;
    const resetTime: number | null = limit.resetTime
      ? Number(limit.resetTime)
      : null;

    let status: "normal" | "warning" | "critical" | "unknown" = "unknown";
    if (limitRemaining !== null && limitTotal !== null) {
      const usagePercent = ((limitTotal - limitRemaining) / limitTotal) * 100;
      status =
        usagePercent >= 90
          ? "critical"
          : usagePercent >= 75
            ? "warning"
            : "normal";
    }

    const limitsObject: PlatformRateLimits = {};

    // Reconstruct based on platform
    if (platform === "github") {
      limitsObject.github = {
        core: this.createLimitEntry(limitTotal, limitRemaining, resetTime),
        search: this.createLimitEntry(limitTotal, limitRemaining, resetTime),
        graphql: this.createLimitEntry(limitTotal, limitRemaining, resetTime),
      };
    } else if (platform === "gitlab") {
      limitsObject.gitlab = {
        global: this.createLimitEntry(limitTotal, limitRemaining, resetTime),
      };
    } else if (platform === "jira") {
      limitsObject.jira = {
        global: this.createLimitEntry(limitTotal, limitRemaining, resetTime),
      };
    }

    return {
      platform,
      lastUpdated: lastUpdatedMs,
      dataFresh: false,
      status,
      limits: limitsObject,
    };
  }

  /**
   * Create a limit entry from total, remaining, and reset time
   */
  private createLimitEntry(
    limit: number | null,
    remaining: number | null,
    resetTime: number | null,
  ) {
    return {
      limit,
      remaining,
      used: limit && remaining ? Math.max(0, limit - remaining) : null,
      usagePercent:
        limit && remaining
          ? Math.min(100, ((limit - remaining) / limit) * 100)
          : null,
      resetTime,
      retryAfter: null,
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { totalEntries: number; oldestData: number | null } {
    return this.cache.getStats();
  }

  /**
   * Clear the rate limit cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Extract client identifier from request for rate limiting
   */
  private getClientIdentifier(request: NextRequest): string {
    // Try to get IP address
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");

    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }

    if (realIp) {
      return realIp;
    }

    // Fallback to a default identifier
    return "unknown";
  }

  /**
   * Get active platforms from registry
   */
  getActivePlatforms(): string[] {
    return Object.entries(toolRegistry)
      .filter((entry) => {
        const tool = entry[1];
        return (
          tool && tool.enabled && tool.capabilities?.includes("rate-limit")
        );
      })
      .map((entry) => {
        return entry[0];
      });
  }

  /**
   * Enhanced get rate limit status that works on both client and server
   */
  async getRateLimitStatusClient(
    platform: string,
    baseUrl?: string,
  ): Promise<RateLimitStatus | null> {
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
}
