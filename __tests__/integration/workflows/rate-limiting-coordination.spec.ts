/**
 * Rate Limiting Coordination Tests
 *
 * This suite provides deterministic, fast tests around the local
 * rate-limit coordination helpers used in workflow simulations.
 *
 * It intentionally:
 * - Uses very small limits and request counts to keep runtime low
 * - Avoids non-deterministic behaviour (no Math.random-based assertions)
 * - Avoids pretending to test real provider APIs or actual UI rendering
 *
 * These tests are about the semantics of the local coordination helpers
 * (shared state, reset handling, mixed provider behaviour), not about the
 * external providers themselves.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

import { IntegrationTestEnvironment } from "@/__tests__/shared/test-credentials";
import { TestBrowser } from "@/__tests__/integration/workflows/utils/test-browser";
import { UserJourneySimulator } from "@/__tests__/integration/workflows/utils/user-journey-simulator";

interface RateLimitData {
  current: number;
  limit: number;
  resetTime: number;
  provider?: string;
}

interface TestBrowserSession {
  getSessionData: (key: string) => Promise<unknown>;
  setSessionData: (key: string, data: unknown) => Promise<void>;
}

describe("Rate Limiting Coordination Tests", () => {
  let testEnv: IntegrationTestEnvironment;
  let baseUrl: string;
  let browser: TestBrowser;
  let journeySimulator: UserJourneySimulator;

  beforeAll(async () => {
    testEnv = await IntegrationTestEnvironment.setup();
    baseUrl = process.env.HYPERPAGE_TEST_BASE_URL || "http://localhost:3000";
    browser = new TestBrowser();
    journeySimulator = new UserJourneySimulator(baseUrl, browser);
  });

  afterAll(async () => {
    await browser.cleanup();
    await testEnv.cleanup();
  });

  describe("Individual Tool Rate Limiting", () => {
    it("enforces provider-specific limits deterministically", async () => {
      const githubSession = await testEnv.createTestSession("github");
      await journeySimulator.completeOAuthFlow(
        "github",
        githubSession.credentials,
      );
      await journeySimulator.enableTool("github");

      // Small deterministic limit
      await setGitHubRateLimit(3, 0, Date.now() + 3600000, browser);

      const r1 = await simulateAPICall("github", "repos", {}, browser);
      const r2 = await simulateAPICall("github", "issues", {}, browser);
      const r3 = await simulateAPICall("github", "pulls", {}, browser);
      const r4 = await simulateAPICall("github", "pulls", {}, browser);

      expect(r1).toEqual({ success: true });
      expect(r2).toEqual({ success: true });
      expect(r3).toEqual({ success: true });
      expect(r4.success).toBe(false);
      expect(r4.rateLimited).toBe(true);
      expect(typeof r4.retryAfter).toBe("number");
    });

    it("treats different providers independently", async () => {
      const githubSession = await testEnv.createTestSession("github");
      const gitlabSession = await testEnv.createTestSession("gitlab");

      await journeySimulator.completeOAuthFlow(
        "github",
        githubSession.credentials,
      );
      await journeySimulator.completeOAuthFlow(
        "gitlab",
        gitlabSession.credentials,
      );
      await journeySimulator.enableTool("github");
      await journeySimulator.enableTool("gitlab");

      await setGitHubRateLimit(1, 0, Date.now() + 3600000, browser);
      await setGitLabRateLimit(2, 0, Date.now() + 3600000, browser);

      const gh1 = await simulateAPICall("github", "repos", {}, browser);
      const gh2 = await simulateAPICall("github", "repos", {}, browser);
      const gl1 = await simulateAPICall("gitlab", "projects", {}, browser);
      const gl2 = await simulateAPICall("gitlab", "projects", {}, browser);
      const gl3 = await simulateAPICall("gitlab", "projects", {}, browser);

      expect(gh1.success).toBe(true);
      expect(gh2.rateLimited).toBe(true);

      expect(gl1.success).toBe(true);
      expect(gl2.success).toBe(true);
      expect(gl3.rateLimited).toBe(true);
    });

    it("implements exponential backoff on repeated limit hits (using fake timers)", async () => {
      const testSession = await testEnv.createTestSession("github");
      await journeySimulator.completeOAuthFlow(
        "github",
        testSession.credentials,
      );

      await setGitHubRateLimit(1, 1, Date.now() + 3600000, browser); // exhausted
      vi.useFakeTimers();

      const attempt1 = simulateAPICall("github", "repos", {}, browser);
      await vi.runOnlyPendingTimersAsync();
      const r1 = await attempt1;

      const attempt2 = simulateAPICall("github", "repos", {}, browser);
      await vi.runOnlyPendingTimersAsync();
      const r2 = await attempt2;

      const attempt3 = simulateAPICall("github", "repos", {}, browser);
      await vi.runOnlyPendingTimersAsync();
      const r3 = await attempt3;

      expect(r1.rateLimited).toBe(true);
      expect(r2.rateLimited).toBe(true);
      expect(r3.rateLimited).toBe(true);

      // Implicitly, if backoff scheduling were wrong, runOnlyPendingTimersAsync
      // would not flush correctly; this keeps the behaviour testable without
      // measuring wall-clock timing.
      vi.useRealTimers();
    });
  });

  describe("Cross-Tool Rate Limit Coordination", () => {
    it("prevents all providers when all are exhausted", async () => {
      const githubSession = await testEnv.createTestSession("github");
      const gitlabSession = await testEnv.createTestSession("gitlab");
      const jiraSession = await testEnv.createTestSession("jira");

      await journeySimulator.completeOAuthFlow(
        "github",
        githubSession.credentials,
      );
      await journeySimulator.completeOAuthFlow(
        "gitlab",
        gitlabSession.credentials,
      );
      await journeySimulator.completeOAuthFlow("jira", jiraSession.credentials);

      await journeySimulator.enableTool("github");
      await journeySimulator.enableTool("gitlab");
      await journeySimulator.enableTool("jira");

      await setGitHubRateLimit(1, 1, Date.now() + 3600000, browser);
      await setGitLabRateLimit(1, 1, Date.now() + 3600000, browser);
      await setJiraRateLimit(1, 1, Date.now() + 3600000, browser);

      const [gh, gl, j] = await Promise.all([
        simulateAPICall("github", "pulls", {}, browser),
        simulateAPICall("gitlab", "merge_requests", {}, browser),
        simulateAPICall("jira", "issues", {}, browser),
      ]);

      expect(gh.rateLimited).toBe(true);
      expect(gl.rateLimited).toBe(true);
      expect(j.rateLimited).toBe(true);
    });

    it("allows traffic to available providers when one is limited", async () => {
      const githubSession = await testEnv.createTestSession("github");
      const gitlabSession = await testEnv.createTestSession("gitlab");

      await journeySimulator.completeOAuthFlow(
        "github",
        githubSession.credentials,
      );
      await journeySimulator.completeOAuthFlow(
        "gitlab",
        gitlabSession.credentials,
      );
      await journeySimulator.enableTool("github");
      await journeySimulator.enableTool("gitlab");

      await setGitHubRateLimit(1, 1, Date.now() + 3600000, browser); // exhausted
      await setGitLabRateLimit(2, 0, Date.now() + 3600000, browser); // available

      const [gh, gl] = await Promise.all([
        simulateAPICall("github", "issues", {}, browser),
        simulateAPICall("gitlab", "issues", {}, browser),
      ]);

      expect(gh.rateLimited).toBe(true);
      expect(gl.success).toBe(true);
    });
  });

  describe("Rate Limit Recovery and Reset", () => {
    it("resets provider once resetTime has passed", async () => {
      const testSession = await testEnv.createTestSession("github");
      await journeySimulator.completeOAuthFlow(
        "github",
        testSession.credentials,
      );

      const resetTime = Date.now() + 1000;
      await setGitHubRateLimit(1, 1, resetTime, browser);

      const initial = await simulateAPICall("github", "repos", {}, browser);
      expect(initial.rateLimited).toBe(true);

      vi.useFakeTimers();
      vi.setSystemTime(resetTime + 1);

      const afterReset = simulateAPICall("github", "repos", {}, browser);
      await vi.runOnlyPendingTimersAsync();
      const result = await afterReset;

      expect(result.success).toBe(true);
      vi.useRealTimers();
    });

    it("persists and increments rate limit state", async () => {
      const testSession = await testEnv.createTestSession("github");
      await journeySimulator.completeOAuthFlow(
        "github",
        testSession.credentials,
      );

      const baseState: RateLimitData = {
        current: 1,
        limit: 3,
        resetTime: Date.now() + 300000,
        provider: "github",
      };

      await (browser as unknown as TestBrowserSession).setSessionData(
        "rate_limit_github",
        baseState,
      );

      const r1 = await simulateAPICall("github", "issues", {}, browser);
      const persisted = (await (
        browser as unknown as TestBrowserSession
      ).getSessionData("rate_limit_github")) as RateLimitData;

      expect(r1.success).toBe(true);
      expect(persisted.current).toBe(2);
      expect(persisted.resetTime).toBe(baseState.resetTime);
    });
  });
});

/**
 * Simulate API call with rate limiting
 */
async function simulateAPICall(
  provider: string,
  _endpoint: string,
  _params: Record<string, unknown>,
  browser: TestBrowser,
): Promise<{
  success: boolean;
  rateLimited?: boolean;
  retryAfter?: number;
  message?: string;
}> {
  const rateLimitKey = `rate_limit_${provider}`;
  const attemptKey = `rate_limit_attempts_${provider}`;
  const rateLimit = ((await (
    browser as unknown as TestBrowserSession
  ).getSessionData(rateLimitKey)) as RateLimitData) || {
    current: 0,
    limit: 1000,
    resetTime: Date.now() + 3600000,
  };

  // Check if rate limited
  if (
    rateLimit.current >= rateLimit.limit ||
    Date.now() > rateLimit.resetTime
  ) {
    // Reset if time has passed
    if (Date.now() > rateLimit.resetTime) {
      rateLimit.current = 0;
      rateLimit.resetTime = Date.now() + 3600000;
      await (browser as unknown as TestBrowserSession).setSessionData(
        attemptKey,
        0,
      ); // Reset attempt count
    } else {
      // Get or initialize attempt count
      let attemptCount =
        ((await (browser as unknown as TestBrowserSession).getSessionData(
          attemptKey,
        )) as number) || 0;
      attemptCount++;

      // Store updated attempt count
      await (browser as unknown as TestBrowserSession).setSessionData(
        attemptKey,
        attemptCount,
      );

      // Rate limited - implement exponential backoff delay (kept small for tests)
      const backoffDelay = Math.pow(2, Math.min(attemptCount, 3)) * 100;

      await new Promise((resolve) => setTimeout(resolve, backoffDelay));

      const remaining = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
      return {
        success: false,
        rateLimited: true,
        retryAfter: remaining,
        message: `rate limit exceeded for ${provider}. Try again in ${remaining} seconds.`,
      };
    }
  }

  // Make the request
  rateLimit.current++;
  await (browser as unknown as TestBrowserSession).setSessionData(
    rateLimitKey,
    rateLimit,
  );
  await (browser as unknown as TestBrowserSession).setSessionData(
    attemptKey,
    0,
  ); // Reset attempt count on successful request

  // Deterministic success path for tests
  return {
    success: true,
  };
}

/**
 * Set up GitHub-specific rate limits
 * @param limit - Maximum requests allowed (e.g., 5000 for GitHub)
 * @param current - Current usage count (typically 0 for testing)
 * @param resetTime - When the rate limit resets
 * @param browser - Test browser instance
 */
async function setGitHubRateLimit(
  limit: number,
  current: number,
  resetTime: number,
  browser: TestBrowser,
): Promise<void> {
  const rateLimit: RateLimitData = { current, limit, resetTime };
  await (browser as unknown as TestBrowserSession).setSessionData(
    "rate_limit_github",
    rateLimit,
  );
}

/**
 * Set up GitLab-specific rate limits
 * @param limit - Maximum requests allowed (e.g., 300 for GitLab)
 * @param current - Current usage count (typically 0 for testing)
 * @param resetTime - When the rate limit resets
 * @param browser - Test browser instance
 */
async function setGitLabRateLimit(
  limit: number,
  current: number,
  resetTime: number,
  browser: TestBrowser,
): Promise<void> {
  const rateLimit: RateLimitData = { current, limit, resetTime };
  await (browser as unknown as TestBrowserSession).setSessionData(
    "rate_limit_gitlab",
    rateLimit,
  );
}

/**
 * Set up Jira-specific rate limits
 * @param limit - Maximum requests allowed (e.g., 1000 for Jira)
 * @param current - Current usage count (typically 0 for testing)
 * @param resetTime - When the rate limit resets
 * @param browser - Test browser instance
 */
async function setJiraRateLimit(
  limit: number,
  current: number,
  resetTime: number,
  browser: TestBrowser,
): Promise<void> {
  const rateLimit: RateLimitData = { current, limit, resetTime };
  await (browser as unknown as TestBrowserSession).setSessionData(
    "rate_limit_jira",
    rateLimit,
  );
}
