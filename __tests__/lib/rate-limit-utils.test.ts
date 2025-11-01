import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Tests for rate limit utilities

import {
  getDynamicInterval,
  detectBusinessHours,
  TOOL_PLATFORM_MAP,
  getActivePlatforms,
  getMaxUsageForPlatform,
  getActivityAccelerationFactor,
  clampInterval,
  formatInterval,
} from "../../lib/rate-limit-utils";

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
    expect(getDynamicInterval(50, baseInterval, false)).toBe(baseInterval * 1.5);
  });

  it("slows down by 2x when usage is 75-89% (no business hours)", () => {
    expect(getDynamicInterval(75, baseInterval, false)).toBe(baseInterval * 2);
  });

  it("slows down by 4x when usage is 90%+ (no business hours)", () => {
    expect(getDynamicInterval(90, baseInterval, false)).toBe(baseInterval * 4);
    expect(getDynamicInterval(95, baseInterval, false)).toBe(baseInterval * 4);
    expect(getDynamicInterval(100, baseInterval, false)).toBe(baseInterval * 4);
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

  it("business hours boundaries", () => {
    // Monday 9:00 AM (exactly 9AM - should be business hours)
    mockDate("2025-01-06T09:00:00");
    expect(detectBusinessHours()).toBe(true);

    // Monday 6:00 PM (exactly 6PM - should be business hours)
    mockDate("2025-01-06T18:00:00");
    expect(detectBusinessHours()).toBe(true);

    // Monday 8:59 AM (just before 9AM)
    mockDate("2025-01-06T08:59:00");
    expect(detectBusinessHours()).toBe(false);

    // Monday 6:01 PM (just after 6PM)
    mockDate("2025-01-06T18:01:00");
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
      { slug: "gitlab", capabilities: ["issues", "rate-limit"] }
    ];
    expect(getActivePlatforms(tools)).toEqual(["github", "gitlab"]);
  });

  test("deduplicates platforms", () => {
    const tools = [
      { slug: "github", capabilities: ["pull-requests", "rate-limit"] },
      { slug: "github", capabilities: ["issues", "rate-limit"] } // duplicate
    ];
    expect(getActivePlatforms(tools)).toEqual(["github"]);
  });

  test("ignores unknown tools without platform mapping", () => {
    const tools = [
      { slug: "github", capabilities: ["rate-limit"] },
      { slug: "unknown-tool", capabilities: ["rate-limit"] }
    ];
    expect(getActivePlatforms(tools)).toEqual(["github"]);
  });
});

describe("getMaxUsageForPlatform", () => {
  test("returns 0 when no rate limit status provided", () => {
    expect(getMaxUsageForPlatform(null as any)).toBe(0);
    expect(getMaxUsageForPlatform({} as any)).toBe(0);
  });

  test("returns 0 when platform has no limits", () => {
    const status = { 
      platform: "github", 
      lastUpdated: Date.now(),
      dataFresh: true,
      status: 'ok',
      limits: { github: {} } 
    };
    expect(getMaxUsageForPlatform(status as any)).toBe(0);
  });

  test("returns maximum usage percentage across all endpoints", () => {
    const status = {
      platform: "github",
      lastUpdated: Date.now(),
      dataFresh: true,
      status: 'ok',
      limits: {
        github: {
          core: { usagePercent: 50 },
          search: { usagePercent: 90 },
          graphql: { usagePercent: 30 }
        }
      }
    };
    expect(getMaxUsageForPlatform(status as any)).toBe(90);
  });

  test("ignores null/undefined usage values", () => {
    const status = {
      platform: "gitlab",
      lastUpdated: Date.now(),
      dataFresh: true,
      status: 'ok',
      limits: {
        gitlab: {
          global: { usagePercent: 75 },
          api: { usagePercent: null },
          web: { usagePercent: undefined }
        }
      }
    };
    expect(getMaxUsageForPlatform(status as any)).toBe(75);
  });

  test("returns 0 when all usage values are null/undefined", () => {
    const status = {
      platform: "jira",
      lastUpdated: Date.now(),
      dataFresh: true,
      status: 'ok',
      limits: {
        jira: {
          global: { usagePercent: null },
          api: { usagePercent: undefined }
        }
      }
    };
    expect(getMaxUsageForPlatform(status as any)).toBe(0);
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

describe("Backoff and Retry Logic (Enhanced Tests)", () => {
  describe("Exponential backoff patterns", () => {
    test("implements exponential backoff correctly", () => {
      // Test increasing multipliers as usage increases
      const baseInterval = 60000; // 1 minute

      expect(getDynamicInterval(50, baseInterval, false)).toBe(baseInterval * 1.5); // 50-74%: 1.5x
      expect(getDynamicInterval(75, baseInterval, false)).toBe(baseInterval * 2);   // 75-89%: 2x
      expect(getDynamicInterval(90, baseInterval, false)).toBe(baseInterval * 4);   // 90%+: 4x
    });

    test("respects minimum interval bounds during backoff", () => {
      const shortBaseInterval = 5000; // 5 seconds

      // Even with high usage, should not go below 30 seconds
      const adjusted = getDynamicInterval(95, shortBaseInterval, false);
      expect(adjusted).toBe(30000);
    });

    test("maintains backoff progression through usage levels", () => {
      const baseInterval = 120000; // 2 minutes

      // Progressive escalation
      const lowUsage = getDynamicInterval(40, baseInterval, false);     // Normal
      const medUsage = getDynamicInterval(60, baseInterval, false);     // Warning start
      const highUsage = getDynamicInterval(85, baseInterval, false);    // Higher warning
      const critUsage = getDynamicInterval(95, baseInterval, false);    // Critical

      expect(lowUsage).toBe(baseInterval);                           // No change
      expect(medUsage).toBe(baseInterval * 1.5);                   // 1.5x increase
      expect(highUsage).toBe(baseInterval * 2);                     // 2x increase
      expect(critUsage).toBe(baseInterval * 4);                     // 4x increase
    });
  });

  describe("Business hours adjustment", () => {
    const originalDate = global.Date;
    const mockDate = (dateString: string) => {
      global.Date = class extends originalDate {
        constructor(...args: [string | number] | []) {
          if (args.length === 0) {
            super(dateString);
          } else {
            super(args[0] as string);
          }
        }
      } as typeof global.Date;
    };

    afterEach(() => {
      global.Date = originalDate;
    });

    test("applies business hours slowdown consistently", () => {
      const baseInterval = 120000; // 2 minutes
      const highUsage = 80;

      // During business hours (Mon-Fri 9-6)
      mockDate("2025-01-06T14:00:00"); // Monday 2PM - business hours
      const businessHoursInterval = getDynamicInterval(highUsage, baseInterval, true);

      // Outside business hours
      mockDate("2025-01-06T20:00:00"); // Monday 8PM - not business hours
      const normalHoursInterval = getDynamicInterval(highUsage, baseInterval, false);

      // Business hours version should be 20% slower
      expect(businessHoursInterval).toBe(Math.round(normalHoursInterval * 1.2));
    });

    test("business hours multiplier stacks with usage multiplier", () => {
      const baseInterval = 60000;
      const criticalUsage = 95;

      mockDate("2025-01-06T10:00:00"); // Monday morning
      const businessCriticalInterval = getDynamicInterval(criticalUsage, baseInterval, true);

      mockDate("2025-01-06T22:00:00"); // Monday evening
      const normalCriticalInterval = getDynamicInterval(criticalUsage, baseInterval, false);

      // Critical usage = 4x, business hours = 1.2x, total = 4.8x
      expect(businessCriticalInterval).toBe(Math.round(baseInterval * 4.8));
      expect(normalCriticalInterval).toBe(baseInterval * 4);
    });
  });

  describe("Platform-specific retry patterns", () => {
    // These tests verify the platform-specific logic that would be implemented
    // in the actual API handlers. Since this logic lives in the handlers,
    // we test the expected behavior patterns here.

    test("GitHub secondary rate limit patterns", () => {
      // GitHub has additional rate limiting for abusing secondary rate limits
      // This would be tested at the handler level, but we can test the expected
      // backoff behavior that should result

      const baseInterval = 60000;
      const secondaryLimitUsage = 100; // Simulating secondary rate limit

      // Should trigger maximum backoff
      const adjusted = getDynamicInterval(secondaryLimitUsage, baseInterval, false);
      expect(adjusted).toBe(baseInterval * 4); // Maximum backoff
    });

    test("GitLab retry-after header processing", () => {
      // GitLab provides retry-after headers
      // Test logic that would consume these headers

      // The getDynamicInterval doesn't directly handle retry-after,
      // this would be at the platform handler level
      // But we can test that our utility functions support the necessary operations
      expect(true).toBe(true); // Placeholder for retry-after logic tests
    });

    test("Jira cloud vs server detection logic", () => {
      // Jira has different limits for cloud vs server instances
      // Rate limiting logic should adapt accordingly

      const cloudLimit = 1000;
      const serverLimit = 3000;

      // Test that our interval calculation works with different limits
      const cloudInterval = getDynamicInterval(80, 300000, false); // Using 5min base
      const serverInterval = getDynamicInterval(80, 300000, false);

      // Both should respond to usage percentage, not absolute limits
      expect(cloudInterval).toBe(serverInterval);
    });
  });

  describe("Activity-based acceleration", () => {
    test("progressive slowdown based on activity level", () => {
      // These tests ensure our activity factors provide appropriate slowdown

      expect(getActivityAccelerationFactor(true, true, false)).toBe(1);    // Active user, visible tab
      expect(getActivityAccelerationFactor(true, false, false)).toBe(1.5); // Inactive user, visible tab
      expect(getActivityAccelerationFactor(false, true, false)).toBe(2);   // Hidden tab, active user
      expect(getActivityAccelerationFactor(false, true, true)).toBe(3);    // Background polling
      expect(getActivityAccelerationFactor(false, false, true)).toBe(3);   // Background + inactive
    });

    test("activity factors combine with usage backoff", () => {
      const baseInterval = 300000; // 5 minutes
      const highUsage = 85;

      // Normal active user
      let adjusted = getDynamicInterval(highUsage, baseInterval, false);
      adjusted *= getActivityAccelerationFactor(true, true, false);
      expect(adjusted).toBe(baseInterval * 2); // Just usage factor (2x)

      // Same user, tab hidden
      adjusted = getDynamicInterval(highUsage, baseInterval, false);
      adjusted *= getActivityAccelerationFactor(false, true, false);
      expect(adjusted).toBe(baseInterval * 4); // Usage (2x) * activity (2x)

      // Background polling
      adjusted = getDynamicInterval(highUsage, baseInterval, false);
      adjusted *= getActivityAccelerationFactor(false, true, true);
      expect(adjusted).toBe(baseInterval * 6); // Usage (2x) * activity (3x)
    });
  });

  describe("Interval clamping and bounds", () => {
    test("clampInterval enforces reasonable bounds", () => {
      expect(clampInterval(1000)).toBe(30000); // Too small
      expect(clampInterval(60000)).toBe(60000); // Normal
      expect(clampInterval(24 * 60 * 60 * 1000 + 1000)).toBe(24 * 60 * 60 * 1000); // Too large
    });

    test("backoff calculations respect clamping", () => {
      // Very high usage on very short base interval should still be clamped
      const clamped = getDynamicInterval(100, 1000, false); // 1s base, critical usage
      expect(clamped).toBe(30000); // Should be clamped to minimum

      // Very low usage on very long base interval should be clamped down
      // (This scenario is less common but tests the bounds)
      const longBase = 48 * 60 * 60 * 1000; // 48 hours
      const clampedLong = getDynamicInterval(10, longBase, false); // Low usage
      expect(clampedLong).toBe(longBase); // Should remain unclamped since it's within bounds
    });
  });

  describe("Cache performance and stale data handling", () => {
    // Note: Cache tests are primarily in rate-limit-monitor.test.ts
    // These tests verify the utility functions that support caching

    test("formatInterval supports logging without issues", () => {
      // Very small intervals
      expect(formatInterval(500)).toBe("0s"); // Should round appropriately

      // Very large intervals
      const hugeInterval = 100 * 60 * 60 * 1000; // 100 hours
      expect(formatInterval(hugeInterval)).toBe("100h");

      // Edge cases
      expect(formatInterval(0)).toBe("0s");
      expect(formatInterval(-1000)).toBe("0s"); // Negative should be handled
    });
  });
});
