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

  test("returns base interval when usage is low (0%)", () => {
    expect(getDynamicInterval(0, baseInterval, false)).toBe(baseInterval);
  });

  test("returns base interval when usage is under 50%", () => {
    expect(getDynamicInterval(49, baseInterval, false)).toBe(baseInterval);
  });

  test("slows down by 1.5x when usage is 50-74% (no business hours)", () => {
    const result = getDynamicInterval(50, baseInterval, false);
    expect(result).toBeGreaterThan(baseInterval);
    expect(result).toBe(baseInterval * 1.5);
  });

  test("slows down by 1.5x when usage is exactly 50% (no business hours)", () => {
    expect(getDynamicInterval(50, baseInterval, false)).toBe(baseInterval * 1.5);
  });

  test("slows down by 2x when usage is 75-89% (no business hours)", () => {
    expect(getDynamicInterval(75, baseInterval, false)).toBe(baseInterval * 2);
  });

  test("slows down by 4x when usage is 90%+ (no business hours)", () => {
    expect(getDynamicInterval(90, baseInterval, false)).toBe(baseInterval * 4);
    expect(getDynamicInterval(95, baseInterval, false)).toBe(baseInterval * 4);
    expect(getDynamicInterval(100, baseInterval, false)).toBe(baseInterval * 4);
  });

  test("applies business hours slowdown during business hours", () => {
    // Mock business hours
    const result = getDynamicInterval(50, baseInterval, true);
    expect(result).toBe(baseInterval * 1.5 * 1.2); // Both factors
  });

  test("clamps to minimum 30 seconds", () => {
    expect(getDynamicInterval(100, 1000, false)).toBe(30000); // 1s * 4x = 4s, clamped to 30s
  });
});

describe("detectBusinessHours", () => {
  const originalDate = global.Date;
  const mockDate = (dateString: string) => {
    global.Date = class extends originalDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(dateString);
        } else {
          super(...args);
        }
      }
    } as typeof global.Date;
  };

  afterEach(() => {
    global.Date = originalDate;
  });

  test("returns true during business hours (Mon-Fri, 9AM-6PM)", () => {
    // Monday 10AM
    mockDate("2025-01-06T10:00:00"); // Monday
    expect(detectBusinessHours()).toBe(true);
  });

  test("returns false outside business hours", () => {
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

  test("business hours boundaries", () => {
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
    expect(getMaxUsageForPlatform(null)).toBe(0);
    expect(getMaxUsageForPlatform({})).toBe(0);
  });

  test("returns 0 when platform has no limits", () => {
    const status = { platform: "github", limits: { github: {} } };
    expect(getMaxUsageForPlatform(status)).toBe(0);
  });

  test("returns maximum usage percentage across all endpoints", () => {
    const status = {
      platform: "github",
      limits: {
        github: {
          core: { usagePercent: 50 },
          search: { usagePercent: 90 },
          graphql: { usagePercent: 30 }
        }
      }
    };
    expect(getMaxUsageForPlatform(status)).toBe(90);
  });

  test("ignores null/undefined usage values", () => {
    const status = {
      platform: "gitlab",
      limits: {
        gitlab: {
          global: { usagePercent: 75 },
          api: { usagePercent: null },
          web: { usagePercent: undefined }
        }
      }
    };
    expect(getMaxUsageForPlatform(status)).toBe(75);
  });

  test("returns 0 when all usage values are null/undefined", () => {
    const status = {
      platform: "jira",
      limits: {
        jira: {
          global: { usagePercent: null },
          api: { usagePercent: undefined }
        }
      }
    };
    expect(getMaxUsageForPlatform(status)).toBe(0);
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
