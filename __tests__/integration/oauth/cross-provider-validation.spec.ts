/**
 * Cross-Provider OAuth Validation Tests
 *
 * Tests cross-provider authentication consistency, session isolation,
 * multi-tool workflows, and error recovery across GitHub, GitLab, and Jira.
 */

import { test, expect } from "@playwright/test";
import {
  IntegrationTestEnvironment,
  OAuthTestCredentials,
} from "../../shared/test-credentials";

describe("Cross-Provider OAuth Validation", () => {
  let testEnv: IntegrationTestEnvironment;
  let baseUrl: string;
  let githubSession: {
    userId: string;
    sessionId: string;
    credentials: OAuthTestCredentials;
  };
  let gitlabSession: {
    userId: string;
    sessionId: string;
    credentials: OAuthTestCredentials;
  };
  let jiraSession: {
    userId: string;
    sessionId: string;
    credentials: OAuthTestCredentials;
  };

  beforeAll(async () => {
    testEnv = await IntegrationTestEnvironment.setup();
    baseUrl = process.env.HYPERPAGE_TEST_BASE_URL || "http://localhost:3000";
  });

  beforeEach(async () => {
    // Create sessions for all three providers
    githubSession = await testEnv.createTestSession("github");
    gitlabSession = await testEnv.createTestSession("gitlab");
    jiraSession = await testEnv.createTestSession("jira");
  });

  afterEach(async () => {
    // Cleanup all sessions
    const sessions = [githubSession, gitlabSession, jiraSession];
    for (const session of sessions) {
      if (session?.sessionId) {
        try {
          await fetch(
            `${baseUrl}/api/sessions?sessionId=${session.sessionId}`,
            {
              method: "DELETE",
            },
          );
        } catch {
          // Ignore cleanup errors in tests
        }
      }
    }
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  test.describe("Session Isolation Validation", () => {
    test("should maintain separate sessions for each provider", async () => {
      // Verify each session has unique ID
      expect(githubSession.sessionId).not.toBe(gitlabSession.sessionId);
      expect(githubSession.sessionId).not.toBe(jiraSession.sessionId);
      expect(gitlabSession.sessionId).not.toBe(jiraSession.sessionId);

      // Verify session isolation by checking status endpoints
      const [githubStatus, gitlabStatus, jiraStatus] = await Promise.all([
        fetch(`${baseUrl}/api/auth/github/status`, {
          headers: { Cookie: `sessionId=${githubSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/auth/gitlab/status`, {
          headers: { Cookie: `sessionId=${gitlabSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/auth/jira/status`, {
          headers: { Cookie: `sessionId=${jiraSession.sessionId}` },
        }),
      ]);

      // All should return successful status (200)
      expect(githubStatus.status).toBe(200);
      expect(gitlabStatus.status).toBe(200);
      expect(jiraStatus.status).toBe(200);
    });

    test("should prevent cross-session data access", async () => {
      // Try to access GitHub data with GitLab session
      const response = await fetch(
        `${baseUrl}/api/tools/github/pull-requests`,
        {
          headers: { Cookie: `sessionId=${gitlabSession.sessionId}` },
        },
      );

      // Should be rejected (401/403)
      expect([401, 403]).toContain(response.status);

      // Try to access GitLab data with Jira session
      const gitlabResponse = await fetch(
        `${baseUrl}/api/tools/gitlab/merge-requests`,
        {
          headers: { Cookie: `sessionId=${jiraSession.sessionId}` },
        },
      );

      expect([401, 403]).toContain(gitlabResponse.status);

      // Try to access Jira data with GitHub session
      const jiraResponse = await fetch(`${baseUrl}/api/tools/jira/issues`, {
        headers: { Cookie: `sessionId=${githubSession.sessionId}` },
      });

      expect([401, 403]).toContain(jiraResponse.status);
    });
  });

  test.describe("OAuth Flow Consistency", () => {
    test("should maintain consistent OAuth state patterns across providers", async () => {
      // Test OAuth initiation for all providers
      const [githubRedirect, gitlabRedirect, jiraRedirect] = await Promise.all([
        fetch(`${baseUrl}/api/auth/github/initiate`),
        fetch(`${baseUrl}/api/auth/gitlab/initiate`),
        fetch(`${baseUrl}/api/auth/jira/initiate`),
      ]);

      // All should redirect (302) or handle gracefully (400)
      expect([302, 400]).toContain(githubRedirect.status);
      expect([302, 400]).toContain(gitlabRedirect.status);
      expect([302, 400]).toContain(jiraRedirect.status);
    });

    test("should validate state management across providers", async () => {
      // Test state validation for all providers
      const invalidStateTests = [
        fetch(`${baseUrl}/api/auth/github/initiate?state=invalid_state`),
        fetch(`${baseUrl}/api/auth/gitlab/initiate?state=invalid_state`),
        fetch(`${baseUrl}/api/auth/jira/initiate?state=invalid_state`),
      ];

      const responses = await Promise.all(invalidStateTests);

      // All should reject invalid state with 400
      responses.forEach((response) => {
        expect(response.status).toBe(400);
      });
    });
  });

  test.describe("Multi-Provider Authentication Workflows", () => {
    test("should maintain authentication status across providers", async () => {
      // Check authentication status for all providers
      const statusChecks = [
        fetch(`${baseUrl}/api/auth/github/status`, {
          headers: { Cookie: `sessionId=${githubSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/auth/gitlab/status`, {
          headers: { Cookie: `sessionId=${gitlabSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/auth/jira/status`, {
          headers: { Cookie: `sessionId=${jiraSession.sessionId}` },
        }),
      ];

      const responses = await Promise.all(statusChecks);
      const statusData = await Promise.all(responses.map((r) => r.json()));

      // All should return valid authentication status
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        const data = statusData[index];
        expect(data).toHaveProperty("authenticated");
        expect(data).toHaveProperty("provider");
      });
    });
  });

  test.describe("Error Recovery and Resilience", () => {
    test("should handle provider-specific errors independently", async () => {
      // Test error handling for each provider with invalid sessions
      const invalidSessions = [
        "invalid-github",
        "invalid-gitlab",
        "invalid-jira",
      ];
      const endpoints = [
        `${baseUrl}/api/tools/github/pull-requests`,
        `${baseUrl}/api/tools/gitlab/merge-requests`,
        `${baseUrl}/api/tools/jira/issues`,
      ];

      const errorTests = endpoints.map((endpoint, index) =>
        fetch(endpoint, {
          headers: { Cookie: `sessionId=${invalidSessions[index]}` },
        }),
      );

      const responses = await Promise.all(errorTests);

      // All should return authentication errors
      responses.forEach((response) => {
        expect(response.status).toBe(401);
      });
    });

    test("should maintain system stability during partial failures", async () => {
      // Test mixed valid/invalid requests
      const mixedRequests = [
        fetch(`${baseUrl}/api/tools/github/pull-requests`, {
          headers: { Cookie: `sessionId=${githubSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/gitlab/merge-requests`, {
          headers: { Cookie: "sessionId=invalid-session" },
        }),
        fetch(`${baseUrl}/api/tools/jira/issues`, {
          headers: { Cookie: `sessionId=${jiraSession.sessionId}` },
        }),
      ];

      const responses = await Promise.all(mixedRequests);

      // First and third should work (if authenticated), second should fail
      expect([200, 401, 403]).toContain(responses[0].status);
      expect(responses[1].status).toBe(401);
      expect([200, 401, 403]).toContain(responses[2].status);
    });
  });

  test.describe("Security and Data Isolation", () => {
    test("should enforce strict session boundaries", async () => {
      // Test that sessions cannot access other providers' data
      const crossAccessTests = [
        fetch(`${baseUrl}/api/tools/gitlab/merge-requests`, {
          headers: { Cookie: `sessionId=${githubSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/jira/issues`, {
          headers: { Cookie: `sessionId=${gitlabSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/github/pull-requests`, {
          headers: { Cookie: `sessionId=${jiraSession.sessionId}` },
        }),
      ];

      const responses = await Promise.all(crossAccessTests);

      // All cross-access attempts should be rejected
      responses.forEach((response) => {
        expect([401, 403]).toContain(response.status);
      });
    });

    test("should not expose sensitive data across providers", async () => {
      // Test that status endpoints don't leak provider-specific data
      const statusRequests = [
        fetch(`${baseUrl}/api/auth/github/status`, {
          headers: { Cookie: `sessionId=${githubSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/auth/gitlab/status`, {
          headers: { Cookie: `sessionId=${gitlabSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/auth/jira/status`, {
          headers: { Cookie: `sessionId=${jiraSession.sessionId}` },
        }),
      ];

      const responses = await Promise.all(statusRequests);
      const statusData = await Promise.all(responses.map((r) => r.json()));

      // Each status should only contain its provider's information
      expect(statusData[0].provider).toBe("github");
      expect(statusData[1].provider).toBe("gitlab");
      expect(statusData[2].provider).toBe("jira");

      // None should expose sensitive token data
      statusData.forEach((data) => {
        expect(data).not.toHaveProperty("accessToken");
        expect(data).not.toHaveProperty("refreshToken");
        expect(data).not.toHaveProperty("clientSecret");
      });
    });
  });
});
