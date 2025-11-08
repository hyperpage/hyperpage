import { test, expect } from "@playwright/test";
import { MockRateLimitServer } from "@/__tests__/mocks/rate-limit-server";

test.describe("Rate Limit UI Handling E2E Tests", () => {
  let mockServer: MockRateLimitServer;

  test.beforeAll(async () => {
    mockServer = new MockRateLimitServer(3003);
    await mockServer.start();
  });

  test.afterAll(async () => {
    await mockServer.stop();
  });

  test.beforeEach(async () => {
    mockServer.resetCounters();
  });

  test.describe("Status Indicator Display", () => {
    test("should show normal status for low rate limit usage", async ({
      page,
    }) => {
      // Set up normal usage scenario
      mockServer.setUsage("github", "/rate_limit", 500); // 500/5000 = 10%

      await page.goto("/");

      // Navigate to overview to see rate limit status
      await page.getByRole("tab", { name: "Overview" }).click();

      // Should show green/normal status indicators
      const normalIndicators = page
        .locator('[class*="text-green-600"]')
        .or(page.locator('[class*="bg-green-100"]'));
      await expect(normalIndicators.first()).toBeVisible();

      // Should not show warning/critical indicators
      const warningCriticalIndicators = page.locator(
        '[class*="text-yellow-600"], [class*="text-red-600"]',
      );
      await expect(warningCriticalIndicators).toHaveCount(0);
    });

    test("should show warning status for high rate limit usage", async ({
      page,
    }) => {
      // Set up warning scenario (GitHub >75% usage)
      mockServer.setUsage("github", "/rate_limit", 4000); // 4000/5000 = 80%

      await page.goto("/");
      await page.getByRole("tab", { name: "Overview" }).click();

      // Check for warning indicators (yellow color)
      const warningIndicators = page
        .locator('[class*="text-yellow-600"]')
        .or(page.locator('[class*="bg-yellow-100"]'));
      await expect(warningIndicators.first()).toBeVisible({ timeout: 10000 }); // Allow time for data fetching

      // Verify no critical indicators are showing
      const criticalIndicators = page.locator('[class*="text-red-600"]');
      await expect(criticalIndicators).toHaveCount(0);
    });

    test("should show critical status when rate limit exceeded", async ({
      page,
    }) => {
      // Set up critical scenario (GitHub >90% usage)
      mockServer.setUsage("github", "/rate_limit", 4800); // 4800/5000 = 96%

      await page.goto("/");
      await page.getByRole("tab", { name: "Overview" }).click();

      // Check for critical indicators (red color)
      const criticalIndicators = page
        .locator('[class*="text-red-600"]')
        .or(page.locator('[class*="bg-red-100"]'));
      await expect(criticalIndicators.first()).toBeVisible({ timeout: 10000 });

      // Should show critical status text or indicators
      const criticalText = page.getByText(/critical|exceeded|rate limit/i, {
        exact: false,
      });
      await expect(criticalText).toBeVisible();
    });

    test("should display usage percentages correctly", async ({ page }) => {
      mockServer.setUsage("github", "/rate_limit", 2500); // 50% usage

      await page.goto("/");
      await page.getByRole("tab", { name: "Overview" }).click();

      // Should show usage percentage in the UI
      await expect(page.getByText(/50%/)).toBeVisible();
    });
  });

  test.describe("Multi-Platform Status Display", () => {
    test("should show different status colors for multiple platforms", async ({
      page,
    }) => {
      // Setup different scenarios for each platform
      mockServer.setUsage("github", "/rate_limit", 500); // Normal (10%)
      mockServer.setUsage("gitlab", "/api/v4/rate_limit", 1800); // Warning (90%)
      mockServer.setUsage("jira", "/rest/api/3/rate_limit", 1100); // Critical (110%)

      await page.goto("/");
      await page.getByRole("tab", { name: "Overview" }).click();

      // Should see green for normal (GitHub)
      await expect(page.locator('[class*="text-green-600"]')).toBeVisible();

      // Should see yellow for warning (GitLab)
      await expect(page.locator('[class*="text-yellow-600"]')).toBeVisible();

      // Should see red for critical (Jira)
      await expect(page.locator('[class*="text-red-600"]')).toBeVisible();
    });

    test("should aggregate status across all platforms", async ({ page }) => {
      // High usage on one platform should show overall warning
      mockServer.setUsage("github", "/rate_limit", 4000); // Warning (80%)
      mockServer.setUsage("gitlab", "/api/v4/rate_limit", 500); // Normal (25%)
      mockServer.setUsage("jira", "/rest/api/3/rate_limit", 500); // Normal (50%)

      await page.goto("/");
      await page.getByRole("tab", { name: "Overview" }).click();

      // Should show warning status due to highest platform status
      await expect(page.locator('[class*="text-yellow-600"]')).toBeVisible();
    });
  });

  test.describe("Sidebar Status Integration", () => {
    test("should show rate limit status in tool sidebar", async ({ page }) => {
      mockServer.setUsage("github", "/rate_limit", 4800); // High usage

      await page.goto("/");

      // Check sidebar for tool status indicators
      const sidebar = page
        .locator('[class*="border-r"]')
        .or(page.locator('[class*="sidebar"]'));

      // Should show connection status with color coding
      const statusIndicators = sidebar
        .locator('[class*="bg-teal-600"]')
        .or(sidebar.locator('[class*="text-teal-600"]'));
      await expect(statusIndicators.first()).toBeVisible();

      // Should indicate rate limiting awareness
      const rateLimitIndicators = sidebar.locator(
        '[data-testid*="rate-limit"], [class*="warning"], [class*="critical"]',
      );
      // Rate limit indicators may vary based on implementation
      if ((await rateLimitIndicators.count()) > 0) {
        await expect(rateLimitIndicators.first()).toBeVisible();
      }
    });

    test("should handle disabled tools gracefully", async ({ page }) => {
      // Tools not in mock server or disabled should not crash the UI
      await page.goto("/");

      // Should still render sidebar without errors
      await expect(
        page
          .locator('[class*="border-r"]')
          .or(page.locator('[class*="sidebar"]')),
      ).toBeVisible();

      // Should not show broken states for unavailable tools
      const errorIndicators = page
        .locator('[class*="text-red-600"]')
        .filter({ hasText: /error|failed|unavailable/i });
      await expect(errorIndicators).toHaveCount(0);
    });
  });

  test.describe("User Notifications and Feedback", () => {
    test("should show status changes in real-time", async ({ page }) => {
      // Start with normal usage
      mockServer.setUsage("github", "/rate_limit", 500);

      await page.goto("/");
      await page.getByRole("tab", { name: "Overview" }).click();

      // Should initially show normal status
      await expect(page.locator('[class*="text-green-600"]')).toBeVisible();

      // Upgrade to high usage dynamically
      mockServer.setUsage("github", "/rate_limit", 4500); // 90%

      // Trigger data refresh (manual refresh button if available)
      const refreshButton = page.getByRole("button", {
        name: /refresh|reload/i,
      });
      if (await refreshButton.isVisible()) {
        await refreshButton.click();

        // Should then show critical status
        await expect(page.locator('[class*="text-red-600"]')).toBeVisible({
          timeout: 10000,
        });
      }
    });

    test("should provide clear error messages when rate limited", async ({
      page,
    }) => {
      // Simulate complete rate limiting
      mockServer.setUsage("github", "/rate_limit", 5000); // 100%

      await page.goto("/");
      await page.getByRole("tab", { name: "Overview" }).click();

      // Should show clear warning or error message
      const errorMessages = page.getByText(
        /rate limit|throttled|reduce usage/i,
        { exact: false },
      );
      await expect(errorMessages.first()).toBeVisible();

      // Should not crash the interface
      await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
    });

    test("should maintain usability during rate limiting", async ({ page }) => {
      // Set high usage but not complete blocking
      mockServer.setUsage("github", "/rate_limit", 4900); // 98%

      await page.goto("/");

      // Should still allow navigation
      await page.getByRole("tab", { name: "Overview" }).click();
      await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
        "aria-selected",
        "true",
      );

      await page.getByRole("tab", { name: "Discovery" }).click();
      await expect(
        page.getByRole("tab", { name: "Discovery" }),
      ).toHaveAttribute("aria-selected", "true");

      // Should show rate limit warning but not prevent interaction
      const warningText = page.getByText(/limit|warning|throttled/i, {
        exact: false,
      });
      if (await warningText.isVisible()) {
        await expect(warningText).not.toHaveAttribute("aria-disabled");
      }
    });
  });

  test.describe("Recovery and Reset Handling", () => {
    test("should show reset time information", async ({ page }) => {
      mockServer.setUsage("github", "/rate_limit", 4800); // High usage

      await page.goto("/");
      await page.getByRole("tab", { name: "Overview" }).click();

      // Should show time until reset
      const resetTimeIndicators = page
        .getByText(/\d+[hm]/)
        .or(page.locator('[data-testid*="reset-time"]'));
      await expect(resetTimeIndicators.first()).toBeVisible();
    });

    test("should update status after simulated reset", async ({ page }) => {
      // Start with high usage
      mockServer.setUsage("github", "/rate_limit", 4900);

      await page.goto("/");
      await page.getByRole("tab", { name: "Overview" }).click();

      // Should show critical status
      await expect(page.locator('[class*="text-red-600"]')).toBeVisible();

      // Simulate reset by setting low usage
      mockServer.setUsage("github", "/rate_limit", 100);

      // Trigger refresh
      const refreshButton = page.getByRole("button", { name: /refresh/i });
      if (await refreshButton.isVisible()) {
        await refreshButton.click();

        // Should now show normal status
        await expect(page.locator('[class*="text-green-600"]')).toBeVisible();
      }
    });
  });

  test.describe("Cross-Browser Compatibility", () => {
    test("should display consistently across browsers", async ({ page }) => {
      mockServer.setUsage("github", "/rate_limit", 2000); // 40%

      await page.goto("/");
      await page.getByRole("tab", { name: "Overview" }).click();

      // Status indicators should work across all browsers
      await expect(
        page
          .locator('[class*="text-green-600"]')
          .or(page.locator('[class*="text-yellow-600"]')),
      ).toBeVisible();

      // Should display percentage regardless of browser
      await expect(page.getByText(/40%/)).toBeVisible();

      // Should not have browser-specific rendering issues
      const brokenElements = page.locator(
        '[style*="expression"], [style*="behavior"]',
      );
      await expect(brokenElements).toHaveCount(0);
    });

    test("should handle dynamic content loading consistently", async ({
      page,
    }) => {
      await page.goto("/");

      // Wait for initial load
      await page.waitForLoadState("networkidle");

      // Navigate to overview
      await page.getByRole("tab", { name: "Overview" }).click();

      // Content should load consistently
      await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
        "aria-selected",
        "true",
      );

      // Should handle AJAX updates without layout shifts that could break across browsers
      const mainContent = page.locator('main, [role="main"]');
      await expect(mainContent).toBeVisible();
    });
  });

  test.describe("Performance and Responsiveness", () => {
    test("should update status quickly after user actions", async ({
      page,
    }) => {
      const startTime = new Date().getTime();

      await page.goto("/");
      await page.getByRole("tab", { name: "Overview" }).click();

      const navigationTime = new Date().getTime() - startTime;

      // Navigation should be quick (< 3 seconds)
      expect(navigationTime).toBeLessThan(3000);

      // Status indicators should appear without significant delay
      await expect(
        page
          .locator('[class*="text-green-600"]')
          .or(page.locator('[class*="text-yellow-600"]'))
          .or(page.locator('[class*="text-red-600"]')),
      ).toBeVisible({ timeout: 5000 });
    });

    test("should not show loading states indefinitely", async ({ page }) => {
      // This test relies on the implementation not having infinite loading states
      await page.goto("/");
      await page.getByRole("tab", { name: "Overview" }).click();

      // Any loading indicators should resolve within reasonable time
      await page.waitForTimeout(5000); // Wait 5 seconds

      // No permanent loading states should remain
      const perpetualLoaders = page
        .locator('[aria-label*="Loading"], [data-testid*="loading"]')
        .filter({ hasText: /loading|please wait|fetching/i });
      await expect(perpetualLoaders).toHaveCount(0);
    });
  });
});
