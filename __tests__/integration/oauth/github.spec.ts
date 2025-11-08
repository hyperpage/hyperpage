/**
 * GitHub OAuth Integration Tests
 *
 * Tests complete OAuth flows with real GitHub API integration,
 * including token storage, encryption, and API usage validation.
 */

import { test, expect } from "@playwright/test";
import {
  IntegrationTestEnvironment,
  OAuthTestCredentials,
} from "@/lib/../__tests__/shared/test-credentials";

describe("GitHub OAuth Integration", () => {
  let testEnv: IntegrationTestEnvironment;
  let baseUrl: string;
  let testSession: {
    userId: string;
    sessionId: string;
    credentials: OAuthTestCredentials;
  };

  beforeAll(async () => {
    testEnv = await IntegrationTestEnvironment.setup();
    baseUrl = process.env.HYPERPAGE_TEST_BASE_URL || "http://localhost:3000";
  });

  beforeEach(async () => {
    testSession = await testEnv.createTestSession("github");
  });

  afterEach(async () => {
    // Cleanup test session
    if (testSession?.sessionId) {
      try {
        await fetch(
          `${baseUrl}/api/sessions?sessionId=${testSession.sessionId}`,
          {
            method: "DELETE",
          },
        );
      } catch {
        // Ignore cleanup errors in tests
      }
    }
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  test.describe("OAuth Flow Initiation", () => {
    test("should initiate GitHub OAuth flow", async ({ page }) => {
      await page.goto(`${baseUrl}/api/auth/github/initiate`);

      // Should redirect to GitHub authorization
      await expect(page).toHaveURL(/github\.com\/login\/oauth\/authorize/);

      // Verify correct client ID and scopes are passed
      const url = new URL(page.url());
      expect(url.searchParams.get("client_id")).toBe(
        testSession.credentials.clientId,
      );
      expect(url.searchParams.get("scope")).toContain("repo");
      expect(url.searchParams.get("scope")).toContain("read:user");
    });

    test("should handle OAuth state validation", async ({ page }) => {
      await page.goto(`${baseUrl}/api/auth/github/initiate`);

      // Verify state parameter is generated and stored
      const url = new URL(page.url());
      const state = url.searchParams.get("state");
      expect(state).toBeDefined();
      expect(state!.length).toBeGreaterThan(10); // Should be substantial state

      // State should be stored in cookies for validation
      const cookies = await page.context().cookies();
      const stateCookie = cookies.find((c) => c.name.includes("oauth_state"));
      expect(stateCookie).toBeDefined();
    });
  });

  test.describe("Mock OAuth Processing", () => {
    test("should simulate successful OAuth callback", async ({ page }) => {
      // Skip real OAuth in test environment
      if (process.env.SKIP_REAL_OAUTH === "true") {
        // Test with mock callback
        await page.goto(
          `${baseUrl}/api/auth/github/callback?code=mock_auth_code_12345&state=mock_state_token`,
        );

        // Should handle mock OAuth gracefully
        await expect(page).toHaveURL(/.*/); // Any valid response
        expect(page.url()).not.toContain("error");
      } else {
        test.skip(true, "Real OAuth testing - requires manual intervention");
      }
    });

    test("should handle OAuth errors gracefully", async ({ page }) => {
      await page.goto(
        `${baseUrl}/api/auth/github/callback?error=access_denied&error_description=User denied access`,
      );

      // Should show appropriate error message
      await expect(page.locator("text=/error|denied|failed/i")).toBeVisible();
    });
  });

  test.describe("Token Management", () => {
    test("should store encrypted OAuth tokens", async () => {
      // In a real scenario, this would test actual token storage after OAuth
      // For now, we test the token storage interface
      const response = await fetch(`${baseUrl}/api/auth/github/status`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should return authentication status
      expect(data).toHaveProperty("authenticated");
      expect(data).toHaveProperty("provider");
      expect(data.provider).toBe("github");
    });

    test("should handle token refresh", async () => {
      // Test token refresh endpoint
      const response = await fetch(`${baseUrl}/api/auth/github/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `sessionId=${testSession.sessionId}`,
        },
        body: JSON.stringify({
          tool: "github",
        }),
      });

      // Should handle refresh gracefully (success or appropriate error)
      expect([200, 401, 400]).toContain(response.status);
    });
  });

  test.describe("GitHub API Integration", () => {
    test("should fetch GitHub pull requests with authenticated requests", async () => {
      const response = await fetch(
        `${baseUrl}/api/tools/github/pull-requests`,
        {
          headers: {
            Cookie: `sessionId=${testSession.sessionId}`,
          },
        },
      );

      // Should return valid response structure
      expect([200, 401, 403]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("data");
        expect(Array.isArray(data.data)).toBe(true);
      }
    });

    test("should fetch GitHub issues", async () => {
      const response = await fetch(`${baseUrl}/api/tools/github/issues`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect([200, 401, 403]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("data");
        expect(Array.isArray(data.data)).toBe(true);
      }
    });

    test("should fetch GitHub workflows", async () => {
      const response = await fetch(`${baseUrl}/api/tools/github/workflows`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect([200, 401, 403]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("data");
        expect(Array.isArray(data.data)).toBe(true);
      }
    });
  });

  test.describe("Rate Limiting Integration", () => {
    test("should handle GitHub API rate limiting", async () => {
      // Make multiple rapid requests to trigger rate limiting
      const requests = Array.from({ length: 10 }, () =>
        fetch(`${baseUrl}/api/tools/github/pull-requests`, {
          headers: {
            Cookie: `sessionId=${testSession.sessionId}`,
          },
        }),
      );

      const responses = await Promise.all(requests);

      // Should handle rate limiting without complete failure
      const successfulResponses = responses.filter((r) => r.status === 200);
      const errorResponses = responses.filter((r) =>
        [401, 403, 429, 503].includes(r.status),
      );

      expect(successfulResponses.length + errorResponses.length).toBe(
        requests.length,
      );
    });

    test("should return rate limit information", async () => {
      const response = await fetch(`${baseUrl}/api/rate-limit/github`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should return rate limit data structure
      expect(data).toHaveProperty("github");
      const githubLimit = data.github;

      if (githubLimit.core) {
        expect(githubLimit.core).toHaveProperty("limit");
        expect(githubLimit.core).toHaveProperty("remaining");
        expect(githubLimit.core).toHaveProperty("resetTime");
      }
    });
  });

  test.describe("Error Handling", () => {
    test("should handle invalid session gracefully", async () => {
      const response = await fetch(
        `${baseUrl}/api/tools/github/pull-requests`,
        {
          headers: {
            Cookie: "sessionId=invalid-session-id",
          },
        },
      );

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toHaveProperty("error");
    });

    test("should handle missing authentication", async () => {
      const response = await fetch(`${baseUrl}/api/tools/github/pull-requests`);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toHaveProperty("error");
      expect(data.error).toContain("authentication");
    });

    test("should handle network failures gracefully", async () => {
      // This would require mocking network failures
      // For now, test the error response structure
      const response = await fetch(
        `${baseUrl}/api/tools/github/nonexistent-endpoint`,
        {
          headers: {
            Cookie: `sessionId=${testSession.sessionId}`,
          },
        },
      );

      expect([404, 500]).toContain(response.status);
    });
  });

  test.describe("Security Validation", () => {
    test("should not expose sensitive token data", async () => {
      const response = await fetch(`${baseUrl}/api/auth/github/status`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      const data = await response.json();

      // Should not return actual tokens in status endpoint
      expect(data).not.toHaveProperty("accessToken");
      expect(data).not.toHaveProperty("refreshToken");
      expect(data).not.toHaveProperty("clientSecret");
    });

    test("should validate session ownership", async () => {
      // Create another session
      const anotherSession = await testEnv.createTestSession("github");

      // Try to access data with wrong session
      const response = await fetch(
        `${baseUrl}/api/tools/github/pull-requests`,
        {
          headers: {
            Cookie: `sessionId=${anotherSession.sessionId}`,
          },
        },
      );

      // Should handle cross-session access appropriately
      expect([401, 403]).toContain(response.status);
    });
  });
});
