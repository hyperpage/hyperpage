import { describe, it, expect, vi, beforeEach, afterEach, test } from "vitest";
import {
  calculateLimitUsage,
  calculateOverallStatus,
  transformGitHubLimits,
  transformGitLabLimits,
  transformJiraLimits,
  getRateLimitStatus,
  clearRateLimitCache,
  getCacheStats,
} from "../../../lib/rate-limit-monitor";

import {
  getDynamicInterval,
  detectBusinessHours,
  TOOL_PLATFORM_MAP,
  getActivePlatforms,
  getMaxUsageForPlatform,
  getActivityAccelerationFactor,
  clampInterval,
  formatInterval,
} from "../../../lib/rate-limit-utils";

import { PlatformRateLimits } from "../../../lib/types/rate-limit";
import type { RateLimitStatus } from "../../../lib/types/rate-limit";

import { toolRegistry } from "../../../tools/registry";
import { Tool } from "../../../tools/tool-types";

// TypeScript-safe global fetch access
const safeGlobal = globalThis as unknown as { fetch?: unknown };

describe("Rate Limit System - Comprehensive Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimitCache();
    // Ensure global.fetch is not mocked by previous tests
    safeGlobal.fetch = undefined;
  });

  afterEach(() => {
    clearRateLimitCache();
  });

  // === RATE LIMIT MONITOR TESTS ===

  describe("calculateLimitUsage", () => {
    it("should calculate usage with valid limits and remaining", () => {
      const result = calculateLimitUsage(1000, 200);

      expect(result).toEqual({
        limit: 1000,
        remaining: 200,
        used: 800,
        usagePercent: 80,
      });
    });

    it("should handle null limit", () => {
      const result = calculateLimitUsage(null, 100);

      expect(result).toEqual({
        limit: null,
        remaining: 100,
        used: null,
        usagePercent: null,
      });
    });

    it("should handle null remaining", () => {
      const result = calculateLimitUsage(1000, null);

      expect(result).toEqual({
        limit: 1000,
        remaining: null,
        used: null,
        usagePercent: null,
      });
    });

    it("should handle both null values", () => {
      const result = calculateLimitUsage(null, null);

      expect(result).toEqual({
        limit: null,
        remaining: null,
        used: null,
        usagePercent: null,
      });
    });

    it("should handle zero limit gracefully", () => {
      const result = calculateLimitUsage(0, 10);

      expect(result).toEqual({
        limit: 0,
        remaining: 10,
        used: 0,
        usagePercent: 0,
      });
    });

    it("should cap usagePercent at 100%", () => {
      const result = calculateLimitUsage(100, 200); // Used would be -100

      expect(result.usagePercent).toBe(0); // Can't go below 0
    });
  });

  describe("calculateOverallStatus", () => {
    it('should return "unknown" when no usage data', () => {
      const limits: PlatformRateLimits = {};

      expect(calculateOverallStatus(limits)).toBe("unknown");
    });

    it('should return "normal" for low usage', () => {
      const limits: PlatformRateLimits = {
        github: {
          core: {
            limit: 1000,
            remaining: 850,
            used: 150,
            usagePercent: 15,
            resetTime: null,
            retryAfter: null,
          },
          search: {
            limit: 1000,
            remaining: 850,
            used: 150,
            usagePercent: 15,
            resetTime: null,
            retryAfter: null,
          },
          graphql: {
            limit: 1000,
            remaining: 850,
            used: 150,
            usagePercent: 15,
            resetTime: null,
            retryAfter: null,
          },
        },
      };

      expect(calculateOverallStatus(limits)).toBe("normal");
    });

    it('should return "warning" for medium-high usage', () => {
      const limits: PlatformRateLimits = {
        github: {
          core: {
            limit: 1000,
            remaining: 250,
            used: 750,
            usagePercent: 75,
            resetTime: null,
            retryAfter: null,
          },
          search: {
            limit: 1000,
            remaining: 250,
            used: 750,
            usagePercent: 75,
            resetTime: null,
            retryAfter: null,
          },
          graphql: {
            limit: 1000,
            remaining: 250,
            used: 750,
            usagePercent: 75,
            resetTime: null,
            retryAfter: null,
          },
        },
      };

      expect(calculateOverallStatus(limits)).toBe("warning");
    });

    it('should return "critical" for very high usage', () => {
      const limits: PlatformRateLimits = {
        github: {
          core: {
            limit: 1000,
            remaining: 10,
            used: 990,
            usagePercent: 99,
            resetTime: null,
            retryAfter: null,
          },
          search: {
            limit: 1000,
            remaining: 10,
            used: 990,
            usagePercent: 99,
            resetTime: null,
            retryAfter: null,
          },
          graphql: {
            limit: 1000,
            remaining: 10,
            used: 990,
            usagePercent: 99,
            resetTime: null,
            retryAfter: null,
          },
        },
      };

      expect(calculateOverallStatus(limits)).toBe("critical");
    });

    it("should return highest severity across multiple platforms", () => {
      const limits: PlatformRateLimits = {
        github: {
          core: {
            limit: 1000,
            remaining: 900,
            used: 100,
            usagePercent: 10,
            resetTime: null,
            retryAfter: null,
          },
          search: {
            limit: 1000,
            remaining: 900,
            used: 100,
            usagePercent: 10,
            resetTime: null,
            retryAfter: null,
          },
          graphql: {
            limit: 1000,
            remaining: 900,
            used: 100,
            usagePercent: 10,
            resetTime: null,
            retryAfter: null,
          },
        },
        gitlab: {
          global: {
            limit: 1000,
            remaining: 100,
            used: 900,
            usagePercent: 90,
            resetTime: null,
            retryAfter: null,
          },
        },
      };

      const result = calculateOverallStatus(limits);
      expect(result).toBe("critical");
    });
  });

  describe("transformGitHubLimits", () => {
    it("should transform GitHub API response to universal format", () => {
      const githubResponse = {
        resources: {
          core: { limit: 5000, remaining: 4990, reset: 1640995200 },
          search: { limit: 30, remaining: 27, reset: 1640995200 },
          graphql: { limit: 5000, remaining: 4995, reset: 1640995200 },
        },
      };

      const result = transformGitHubLimits(githubResponse);

      expect(result.github!).toEqual({
        core: {
          limit: 5000,
          remaining: 4990,
          used: 10,
          usagePercent: 0.2,
          resetTime: 1640995200 * 1000,
          retryAfter: null,
        },
        search: {
          limit: 30,
          remaining: 27,
          used: 3,
          usagePercent: 10,
          resetTime: 1640995200 * 1000,
          retryAfter: null,
        },
        graphql: {
          limit: 5000,
          remaining: 4995,
          used: 5,
          usagePercent: 0.1,
          resetTime: 1640995200 * 1000,
          retryAfter: null,
        },
      });
    });
  });

  describe("transformGitLabLimits", () => {
    it("should return GitLab global limits with retryAfter", () => {
      const gitlabResponse = { message: "Rate limit exceeded" };

      const result = transformGitLabLimits(gitlabResponse, 60);

      expect(result.gitlab!).toEqual({
        global: {
          limit: null,
          remaining: null,
          used: null,
          usagePercent: 90, // High usage when retry-after is present (indicates API stress)
          resetTime: Date.now() + 60 * 1000,
          retryAfter: 60,
        },
      });
    });

    it("should handle null retryAfter", () => {
      const result = transformGitLabLimits({}, null);

      expect(result.gitlab!.global.resetTime).toBeNull();
      expect(result.gitlab!.global.retryAfter).toBeNull();
    });
  });

  describe("transformJiraLimits", () => {
    it("should return Jira global limits structure", () => {
      const jiraResponse = { message: "Rate limit exceeded" };

      const result = transformJiraLimits(jiraResponse);

      expect(result.jira!).toEqual({
        global: {
          limit: null,
          remaining: null,
          used: null,
          usagePercent: null,
          resetTime: null,
          retryAfter: null,
        },
      });
    });
  });

  // === RATE LIMIT UTILITIES TESTS ===

  describe("getDynamicInterval", () => {
    const baseInterval = 300000; // 5 minutes

    it("returns base interval when usage is low (0%)", () => {
      expect(getDynamicInterval(0, baseInterval, false)).toBe(baseInterval);
    });

    it("returns base interval when usage is under 50%", () => {
      expect(getDynamicInterval(49, baseInterval, false)).toBe(baseInterval);
    });

    it("slows down by 1.5x when usage is 50-74% (no business hours)", () => {
      const result = getDynamicInterval(50, baseInterval, false);
      expect(result).toBeGreaterThan(baseInterval);
      expect(result).toBe(baseInterval * 1.5);
    });

    it("slows down by 1.5x when usage is exactly 50% (no business hours)", () => {
      expect(getDynamicInterval(50, baseInterval, false)).toBe(
        baseInterval * 1.5,
      );
    });

    it("slows down by 2x when usage is 75-89% (no business hours)", () => {
      expect(getDynamicInterval(75, baseInterval, false)).toBe(
        baseInterval * 2,
      );
    });

    it("slows down by 4x when usage is 90%+ (no business hours)", () => {
      expect(getDynamicInterval(90, baseInterval, false)).toBe(
        baseInterval * 4,
      );
      expect(getDynamicInterval(95, baseInterval, false)).toBe(
        baseInterval * 4,
      );
      expect(getDynamicInterval(100, baseInterval, false)).toBe(
        baseInterval * 4,
      );
    });

    it("applies business hours slowdown during business hours", () => {
      // Mock business hours
      const result = getDynamicInterval(50, baseInterval, true);
      expect(result).toBe(baseInterval * 1.5 * 1.2); // Both factors
    });

    it("clamps to minimum 30 seconds", () => {
      expect(getDynamicInterval(100, 1000, false)).toBe(30000); // 1s * 4x = 4s, clamped to 30s
    });
  });

  describe("detectBusinessHours", () => {
    const originalDate = global.Date;
    const mockDate = (dateString: string) => {
      const mockClass = class extends originalDate {
        constructor(...args: [string | number] | []) {
          if (args.length === 0) {
            super(dateString);
          } else {
            super(args[0] as string);
          }
        }
      };
      global.Date = mockClass as typeof global.Date;
    };

    afterEach(() => {
      global.Date = originalDate;
    });

    it("returns true during business hours (Mon-Fri, 9AM-6PM)", () => {
      // Monday 10AM
      mockDate("2025-01-06T10:00:00"); // Monday
      expect(detectBusinessHours()).toBe(true);
    });

    it("returns false outside business hours", () => {
      // Monday 8AM (too early)
      mockDate("2025-01-06T08:00:00");
      expect(detectBusinessHours()).toBe(false);

      // Monday 7PM (too late)
      mockDate("2025-01-06T19:00:00");
      expect(detectBusinessHours()).toBe(false);

      // Saturday 10AM (weekend)
      mockDate("2025-01-11T10:00:00");
      expect(detectBusinessHours()).toBe(false);

      // Sunday 10AM (weekend)
      mockDate("2025-01-05T10:00:00");
      expect(detectBusinessHours()).toBe(false);
    });
  });

  describe("TOOL_PLATFORM_MAP", () => {
    test("maps GitHub tool to github platform", () => {
      expect(TOOL_PLATFORM_MAP.github).toBe("github");
    });

    test("maps GitLab tool to gitlab platform", () => {
      expect(TOOL_PLATFORM_MAP.gitlab).toBe("gitlab");
    });

    test("maps Jira tool to jira platform", () => {
      expect(TOOL_PLATFORM_MAP.jira).toBe("jira");
    });
  });

  describe("getActivePlatforms", () => {
    test("returns empty array when no tools have rate-limit capability", () => {
      const tools = [{ slug: "github", capabilities: ["pull-requests"] }];
      expect(getActivePlatforms(tools)).toEqual([]);
    });

    test("returns platform for tools with rate-limit capability", () => {
      const tools = [
        { slug: "github", capabilities: ["pull-requests", "rate-limit"] },
        { slug: "gitlab", capabilities: ["issues", "rate-limit"] },
      ];
      expect(getActivePlatforms(tools)).toEqual(["github", "gitlab"]);
    });

    test("deduplicates platforms", () => {
      const tools = [
        { slug: "github", capabilities: ["pull-requests", "rate-limit"] },
        { slug: "github", capabilities: ["issues", "rate-limit"] }, // duplicate
      ];
      expect(getActivePlatforms(tools)).toEqual(["github"]);
    });

    test("ignores unknown tools without platform mapping", () => {
      const tools = [
        { slug: "github", capabilities: ["rate-limit"] },
        { slug: "unknown-tool", capabilities: ["rate-limit"] },
      ];
      expect(getActivePlatforms(tools)).toEqual(["github"]);
    });
  });

  describe("getMaxUsageForPlatform", () => {
    test("returns 0 when no rate limit status provided", () => {
      expect(getMaxUsageForPlatform(null as unknown as RateLimitStatus)).toBe(
        0,
      );
      expect(getMaxUsageForPlatform({} as RateLimitStatus)).toBe(0);
    });

    test("returns 0 when platform has no limits", () => {
      const status: RateLimitStatus = {
        platform: "github",
        lastUpdated: Date.now(),
        dataFresh: true,
        status: "normal",
        limits: {},
      };
      expect(getMaxUsageForPlatform(status)).toBe(0);
    });

    test("returns maximum usage percentage across all endpoints", () => {
      const status: RateLimitStatus = {
        platform: "github",
        lastUpdated: Date.now(),
        dataFresh: true,
        status: "normal",
        limits: {
          github: {
            core: {
              limit: 5000,
              remaining: 2500,
              used: 2500,
              usagePercent: 50,
              resetTime: Date.now() + 3600000,
              retryAfter: null,
            },
            search: {
              limit: 30,
              remaining: 3,
              used: 27,
              usagePercent: 90,
              resetTime: Date.now() + 3600000,
              retryAfter: null,
            },
            graphql: {
              limit: 5000,
              remaining: 3500,
              used: 1500,
              usagePercent: 30,
              resetTime: Date.now() + 3600000,
              retryAfter: null,
            },
          },
        },
      };
      expect(getMaxUsageForPlatform(status)).toBe(90);
    });
  });

  describe("getActivityAccelerationFactor", () => {
    test("returns 1 when tab is visible and user is active", () => {
      expect(getActivityAccelerationFactor(true, true)).toBe(1);
    });

    test("slows down by 2x when tab is not visible", () => {
      expect(getActivityAccelerationFactor(false, true)).toBe(2);
      expect(getActivityAccelerationFactor(false, false)).toBe(2);
    });

    test("slows down by 1.5x when user is inactive but tab is visible", () => {
      expect(getActivityAccelerationFactor(true, false)).toBe(1.5);
    });

    test("slows down by 3x when tab is hidden (isInBackground=true)", () => {
      expect(getActivityAccelerationFactor(false, true, true)).toBe(3);
      expect(getActivityAccelerationFactor(false, false, true)).toBe(3);
    });
  });

  describe("clampInterval", () => {
    test("returns interval unchanged when within bounds", () => {
      expect(clampInterval(60000)).toBe(60000); // 1 minute
      expect(clampInterval(3600000)).toBe(3600000); // 1 hour
    });

    test("clamps to minimum 30 seconds", () => {
      expect(clampInterval(1000)).toBe(30000); // 1 second -> 30 seconds
      expect(clampInterval(0)).toBe(30000);
      expect(clampInterval(-1000)).toBe(30000);
    });

    test("clamps to maximum 24 hours", () => {
      const maxMs = 24 * 60 * 60 * 1000; // 24 hours
      expect(clampInterval(maxMs + 1000)).toBe(maxMs);
    });
  });

  describe("formatInterval", () => {
    test("formats seconds correctly", () => {
      expect(formatInterval(30000)).toBe("30s");
      expect(formatInterval(59000)).toBe("59s");
    });

    test("formats minutes correctly", () => {
      expect(formatInterval(60000)).toBe("1m");
      expect(formatInterval(300000)).toBe("5m");
      expect(formatInterval(3540000)).toBe("59m"); // 3540 seconds = 59 minutes exactly
    });

    test("formats hours correctly", () => {
      expect(formatInterval(3600000)).toBe("1h");
      expect(formatInterval(7200000)).toBe("2h");
      const twentyFourHours = 24 * 60 * 60 * 1000;
      expect(formatInterval(twentyFourHours)).toBe("24h");
    });
  });

  describe("getRateLimitStatus", () => {
    const mockRateLimitHandler = vi.fn();

    const mockTool: Tool = {
      name: "GitHub",
      slug: "github",
      enabled: true,
      capabilities: ["rate-limit"],
      ui: { color: "", icon: "GitHubIcon" },
      widgets: [],
      apis: {},
      config: {},
      handlers: {
        "rate-limit": mockRateLimitHandler,
      },
    };

    beforeEach(() => {
      (toolRegistry as Record<string, Tool>).github = mockTool;
      mockRateLimitHandler.mockResolvedValue({
        rateLimit: {
          resources: {
            core: { limit: 5000, remaining: 4000, reset: 1640995200 },
            search: { limit: 30, remaining: 25, reset: 1640995200 },
            graphql: { limit: 5000, remaining: 4990, reset: 1640995200 },
          },
        },
      });
    });

    afterEach(() => {
      delete (toolRegistry as Record<string, Tool>).github;
    });

    it("should return null for tools without rate-limit capability", async () => {
      const tool = (toolRegistry as Record<string, Tool>).github;
      if (tool) {
        tool.capabilities = [];
      }

      const result = await getRateLimitStatus("github");

      expect(result).toBeNull();
    });

    it("should return null for non-existent tools", async () => {
      const result = await getRateLimitStatus("nonexistent");

      expect(result).toBeNull();
    });

    it("should handle API errors gracefully", async () => {
      safeGlobal.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await getRateLimitStatus("github");

      expect(result).toBeNull();
    });

    it("should handle network errors gracefully", async () => {
      safeGlobal.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await getRateLimitStatus("github");

      expect(result).toBeNull();
    });
  });

  describe("Cache Management", () => {
    it("should track cache statistics", () => {
      const stats = getCacheStats();

      expect(stats).toEqual({
        totalEntries: 0,
        oldestData: null,
      });
    });

    it("should clear cache on demand", () => {
      clearRateLimitCache();
      const stats = getCacheStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.oldestData).toBeNull();
    });
  });
});
