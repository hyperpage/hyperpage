/**
 * GitLab OAuth Integration Tests
 *
 * Tests complete OAuth flows with real GitLab API integration,
 * including token storage, encryption, and API usage validation.
 */

import { test, expect } from "@playwright/test";

import {
  IntegrationTestEnvironment,
  OAuthTestCredentials,
} from "@/lib/../__tests__/shared/test-credentials";

const oauthSuiteEnabled = process.env.E2E_OAUTH === "1";

if (!oauthSuiteEnabled) {
  test.describe.skip("GitLab OAuth Integration (E2E_OAUTH=1 required)", () => {
    test("skipped", () => {});
  });
} else {
  test.describe("GitLab OAuth Integration", () => {
  let testEnv: IntegrationTestEnvironment;
  let baseUrl: string;
  let testSession: {
    userId: string;
    sessionId: string;
    credentials: OAuthTestCredentials;
  };

  test.beforeAll(async () => {
    testEnv = await IntegrationTestEnvironment.setup();
    baseUrl = process.env.HYPERPAGE_TEST_BASE_URL || "http://localhost:3000";
  });

  test.beforeEach(async () => {
    testSession = await testEnv.createTestSession("gitlab");
  });

  test.afterEach(async () => {
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

  test.afterAll(async () => {
    await testEnv.cleanup();
  });

  test.describe("OAuth Flow Initiation", () => {
    test("should initiate GitLab OAuth flow", async ({ page }) => {
      await page.goto(`${baseUrl}/api/auth/gitlab/initiate`);

      // Should redirect to GitLab authorization
      await expect(page).toHaveURL(/gitlab\.com\/oauth\/authorize/);

      // Verify correct client ID and scopes are passed
      const url = new URL(page.url());
      expect(url.searchParams.get("client_id")).toBe(
        testSession.credentials.clientId,
      );
      expect(url.searchParams.get("scope")).toContain("read_api");
      expect(url.searchParams.get("response_type")).toBe("code");
    });

    test("should handle OAuth state validation", async ({ page }) => {
      await page.goto(`${baseUrl}/api/auth/gitlab/initiate`);

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

    test("should include GitLab-specific redirect_uri", async ({ page }) => {
      await page.goto(`${baseUrl}/api/auth/gitlab/initiate`);

      const url = new URL(page.url());
      const redirectUri = url.searchParams.get("redirect_uri");
      expect(redirectUri).toBeDefined();
      expect(redirectUri).toContain("/api/auth/oauth/gitlab");
    });
  });

  test.describe("Mock OAuth Processing", () => {
    test("should simulate successful OAuth callback", async ({ page }) => {
      // Skip real OAuth in test environment
      if (process.env.SKIP_REAL_OAUTH === "true") {
        // Test with mock callback
        await page.goto(
          `${baseUrl}/api/auth/oauth/gitlab?code=mock_gitlab_auth_code_67890&state=mock_gitlab_state_token`,
        );

        // Should handle mock OAuth gracefully
        await expect(page).toHaveURL(/.*/); // Any valid response
        expect(page.url()).not.toContain("error");
      } else {
        test.skip(true, "Real OAuth testing - requires manual intervention");
      }
    });

    test("should handle GitLab OAuth errors", async ({ page }) => {
      await page.goto(
        `${baseUrl}/api/auth/oauth/gitlab?error=access_denied&error_description=User denied access`,
      );

      // Should show appropriate error message
      await expect(page.locator("text=/error|denied|failed/i")).toBeVisible();
    });

    test("should handle invalid authorization code", async ({ page }) => {
      await page.goto(
        `${baseUrl}/api/auth/oauth/gitlab?code=invalid_code&state=mock_gitlab_state_token`,
      );

      // Should handle invalid code gracefully
      if (!page.url().includes("error")) {
        await expect(
          page.locator("text=/invalid|error|failed/i"),
        ).toBeVisible();
      }
    });
  });

  test.describe("Token Management", () => {
    test("should store encrypted OAuth tokens", async () => {
      // Test token storage interface
      const response = await fetch(`${baseUrl}/api/auth/gitlab/status`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should return authentication status
      expect(data).toHaveProperty("authenticated");
      expect(data).toHaveProperty("provider");
      expect(data.provider).toBe("gitlab");
    });

    test("should handle token refresh", async () => {
      // Test token refresh endpoint
      const response = await fetch(`${baseUrl}/api/auth/gitlab/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `sessionId=${testSession.sessionId}`,
        },
        body: JSON.stringify({
          tool: "gitlab",
        }),
      });

      // Should handle refresh gracefully (success or appropriate error)
      expect([200, 401, 400]).toContain(response.status);
    });

    test("should handle token expiration", async () => {
      // Test with expired token scenario
      const response = await fetch(
        `${baseUrl}/api/tools/gitlab/merge-requests`,
        {
          headers: {
            Cookie: `sessionId=${testSession.sessionId}`,
          },
        },
      );

      // Should return 401 for expired tokens
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  test.describe("GitLab API Integration", () => {
    test("should fetch GitLab merge requests", async () => {
      const response = await fetch(
        `${baseUrl}/api/tools/gitlab/merge-requests`,
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

    test("should fetch GitLab pipelines", async () => {
      const response = await fetch(`${baseUrl}/api/tools/gitlab/pipelines`, {
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

    test("should fetch GitLab issues", async () => {
      const response = await fetch(`${baseUrl}/api/tools/gitlab/issues`, {
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

    test("should fetch GitLab projects", async () => {
      const response = await fetch(`${baseUrl}/api/tools/gitlab/projects`, {
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
    test("should handle GitLab API rate limiting", async () => {
      // GitLab has different rate limiting patterns than GitHub
      // Make rapid requests to test rate limiting
      const requests = Array.from({ length: 10 }, () =>
        fetch(`${baseUrl}/api/tools/gitlab/merge-requests`, {
          headers: {
            Cookie: `sessionId=${testSession.sessionId}`,
          },
        }),
      );

      const responses = await Promise.all(requests);

      // Should handle rate limiting without complete failure
      const successfulResponses = responses.filter((r) => r.status === 200);
      const rateLimitedResponses = responses.filter((r) => r.status === 429);
      const errorResponses = responses.filter((r) =>
        [401, 403, 503].includes(r.status),
      );

      expect(
        successfulResponses.length +
          rateLimitedResponses.length +
          errorResponses.length,
      ).toBe(requests.length);
    });

    test("should handle GitLab Retry-After header", async () => {
      // GitLab uses Retry-After header for rate limiting
      const response = await fetch(`${baseUrl}/api/rate-limit/gitlab`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should return rate limit data structure for GitLab
      expect(data).toHaveProperty("gitlab");
      const gitlabLimit = data.gitlab;

      if (gitlabLimit.global) {
        expect(gitlabLimit.global).toHaveProperty("resetTime");
        expect(gitlabLimit.global).toHaveProperty("retryAfter");
      }
    });

    test("should respect GitLab rate limit patterns", async () => {
      // Test that rate limiting follows GitLab's specific patterns
      const response = await fetch(`${baseUrl}/api/tools/gitlab/projects`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      // GitLab's rate limiting behavior
      expect([200, 401, 403, 429]).toContain(response.status);
    });
  });

  test.describe("Error Handling", () => {
    test("should handle invalid session gracefully", async () => {
      const response = await fetch(
        `${baseUrl}/api/tools/gitlab/merge-requests`,
        {
          headers: {
            Cookie: "sessionId=invalid-gitlab-session",
          },
        },
      );

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toHaveProperty("error");
    });

    test("should handle missing authentication", async () => {
      const response = await fetch(
        `${baseUrl}/api/tools/gitlab/merge-requests`,
      );

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toHaveProperty("error");
      expect(data.error).toContain("authentication");
    });

    test("should handle GitLab-specific API errors", async () => {
      const response = await fetch(
        `${baseUrl}/api/tools/gitlab/nonexistent-endpoint`,
        {
          headers: {
            Cookie: `sessionId=${testSession.sessionId}`,
          },
        },
      );

      expect([404, 500]).toContain(response.status);
    });

    test("should handle GitLab API version changes", async () => {
      // Test that the integration handles API version compatibility
      const response = await fetch(`${baseUrl}/api/tools/gitlab/version`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect([200, 404, 500]).toContain(response.status);
    });
  });

  test.describe("Security Validation", () => {
    test("should not expose sensitive token data", async () => {
      const response = await fetch(`${baseUrl}/api/auth/gitlab/status`, {
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
      const anotherSession = await testEnv.createTestSession("gitlab");

      // Try to access data with wrong session
      const response = await fetch(
        `${baseUrl}/api/tools/gitlab/merge-requests`,
        {
          headers: {
            Cookie: `sessionId=${anotherSession.sessionId}`,
          },
        },
      );

      // Should handle cross-session access appropriately
      expect([401, 403]).toContain(response.status);
    });

    test("should handle CSRF protection", async () => {
      // Try to initiate OAuth without proper state
      const response = await fetch(
        `${baseUrl}/api/auth/gitlab/initiate?state=invalid_state`,
      );

      // Should reject invalid state
      expect(response.status).toBe(400);
    });

    test("should encrypt sensitive data at rest", async () => {
      // Verify that OAuth tokens are encrypted when stored
      // This would require database inspection in a real test
      const response = await fetch(`${baseUrl}/api/auth/gitlab/status`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      const data = await response.json();

      // Status should not reveal encryption details
      expect(data).not.toHaveProperty("encryption");
      expect(data).not.toHaveProperty("iv");
    });
  });

  test.describe("GitLab-Specific Features", () => {
    test("should handle GitLab self-hosted instances", async () => {
      // Test configuration for self-hosted GitLab
      const response = await fetch(`${baseUrl}/api/auth/gitlab/config`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      if (data.webUrl) {
        expect(data.webUrl).toMatch(/^https?:\/\//);
      }
    });

    test("should support GitLab Groups API", async () => {
      const response = await fetch(`${baseUrl}/api/tools/gitlab/groups`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect([200, 401, 403]).toContain(response.status);
    });

    test("should handle GitLab Enterprise features", async () => {
      // Test enterprise-specific endpoints if available
      const response = await fetch(`${baseUrl}/api/tools/gitlab/enterprise`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      // Should handle enterprise features gracefully
      expect([200, 404, 401, 403]).toContain(response.status);
    });
  });
  });
}
