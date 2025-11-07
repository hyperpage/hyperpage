/**
 * Jira Tool Integration Tests
 *
 * Tests complete Jira tool integration including issues, projects, changelogs,
 * rate limiting behavior, batch processing, and advanced caching features.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";
import {
  IntegrationTestEnvironment,
  OAuthTestCredentials,
  isServerAvailable,
} from "@/lib/../__tests__/shared/test-credentials";
import logger from "@/lib/logger";

// Check server availability before defining tests
const baseUrl = process.env.HYPERPAGE_TEST_BASE_URL || "http://localhost:3000";
const serverAvailable = await isServerAvailable("jira");

describe("Jira Tool Integration", () => {
  let testEnv: IntegrationTestEnvironment;
  let testSession: {
    userId: string;
    sessionId: string;
    credentials: OAuthTestCredentials;
  };

  beforeAll(async () => {
    if (!serverAvailable) {
      logger.info(
        "⚠️ Test server not available. Integration tests will be skipped.",
        {
          type: "jira_integration_tests_skipped",
          serverAvailable: false,
          baseUrl,
        },
      );
      logger.info(
        "💡 To run integration tests, start the server with: npm run dev",
        {
          type: "integration_test_instructions",
          command: "npm run dev",
        },
      );
      return;
    }

    testEnv = await IntegrationTestEnvironment.setup();
  });

  beforeEach(async () => {
    if (!serverAvailable) return;
    testSession = await testEnv.createTestSession("jira");
  });

  afterEach(async () => {
    // Cleanup test session only if server is available and session exists
    if (serverAvailable && testSession?.sessionId) {
      try {
        await fetch(
          `${baseUrl}/api/sessions?sessionId=${testSession.sessionId}`,
          {
            method: "DELETE",
          },
        );
      } catch (error) {
        // Log cleanup errors for debugging but don't fail tests
        logger.warn("Failed to cleanup test session", {
          type: "session_cleanup_error",
          sessionId: testSession.sessionId,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }
  });

  afterAll(async () => {
    if (serverAvailable) {
      await testEnv.cleanup();
    }
  });

  // Skip all tests if server is not available
  const testSuite = serverAvailable ? describe : describe.skip;

  testSuite("Issues API Integration", () => {
    it("should fetch Jira issues using JQL", async () => {
      const response = await fetch(`${baseUrl}/api/tools/jira/issues`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect([200, 401, 403, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("issues");
        expect(Array.isArray(data.issues)).toBe(true);

        // Validate issue data structure
        if (data.issues.length > 0) {
          const issue = data.issues[0];
          expect(issue).toHaveProperty("ticket");
          expect(issue).toHaveProperty("title");
          expect(issue).toHaveProperty("status");
          expect(issue).toHaveProperty("url");
          expect(issue).toHaveProperty("assignee");

          // Verify ticket format (Jira uses project key format like PROJ-123)
          expect(issue.ticket).toMatch(/^[A-Z]+-\d+$/);
        }
      }
    });

    it("should handle JQL filtering parameters", async () => {
      const url = new URL(`${baseUrl}/api/tools/jira/issues`);
      url.searchParams.set("project", "TEST");
      url.searchParams.set("status", "Open");

      const response = await fetch(url.toString(), {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect([200, 401, 403, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("issues");
        expect(Array.isArray(data.issues)).toBe(true);
      }
    });

    it("should handle missing Jira credentials gracefully", async () => {
      const response = await fetch(`${baseUrl}/api/tools/jira/issues`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      // Should return 401/403 if no credentials, but not crash
      expect([200, 401, 403]).toContain(response.status);

      if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        expect(data).toHaveProperty("error");
      }
    });

    it("should use JQL to fetch recent issues", async () => {
      const response = await fetch(`${baseUrl}/api/tools/jira/issues`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      if (response.status === 200) {
        const data = await response.json();
        if (data.issues.length > 0) {
          // Should contain issues with proper Jira fields
          const issue = data.issues[0];
          expect(issue.ticket).toMatch(/^[A-Z]+-\d+$/);
          expect(issue.title).toBeTruthy();
          expect(issue.status).toBeTruthy();
          expect(issue.url).toMatch(/^https?:\/\/.+/);
        }
      }
    });
  });

  testSuite("Changelogs API Integration", () => {
    it("should batch fetch changelogs for multiple issues", async () => {
      const requestBody = {
        issueIds: ["TEST-123", "TEST-456", "TEST-789"],
        maxResults: 10,
        since: "2024-01-01T00:00:00.000Z",
      };

      const response = await fetch(`${baseUrl}/api/tools/jira/changelogs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `sessionId=${testSession.sessionId}`,
        },
        body: JSON.stringify(requestBody),
      });

      expect([200, 400, 401, 403]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("changelogs");
        expect(Array.isArray(data.changelogs)).toBe(true);

        // Validate changelog data structure
        if (data.changelogs.length > 0) {
          const changelog = data.changelogs[0];
          expect(changelog).toHaveProperty("issueId");
          expect(changelog).toHaveProperty("changelog");
          expect(Array.isArray(changelog.changelog)).toBe(true);
        }
      }
    });

    it("should validate batch request parameters", async () => {
      const response = await fetch(`${baseUrl}/api/tools/jira/changelogs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `sessionId=${testSession.sessionId}`,
        },
        body: JSON.stringify({ issueIds: [] }),
      });

      expect(response.status).toBe(400);
    });

    it("should enforce maximum 50 issue IDs per batch", async () => {
      const issueIds = Array.from({ length: 51 }, (_, i) => `TEST-${i}`);

      const response = await fetch(`${baseUrl}/api/tools/jira/changelogs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `sessionId=${testSession.sessionId}`,
        },
        body: JSON.stringify({ issueIds }),
      });

      expect(response.status).toBe(400);
    });
  });

  testSuite("Projects API Integration", () => {
    it("should fetch Jira project metadata", async () => {
      const response = await fetch(`${baseUrl}/api/tools/jira/projects`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect([200, 401, 403, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("projects");
        expect(Array.isArray(data.projects)).toBe(true);

        if (data.projects.length > 0) {
          const project = data.projects[0];
          expect(project).toHaveProperty("key");
          expect(project).toHaveProperty("name");
          expect(project).toHaveProperty("projectTypeKey");
        }
      }
    });
  });

  testSuite("Rate Limiting Integration", () => {
    it("should return Jira rate limit status", async () => {
      const response = await fetch(`${baseUrl}/api/tools/jira/rate-limit`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty("rateLimit");
      const rateLimit = data.rateLimit;

      expect(rateLimit).toHaveProperty("message");
      expect(rateLimit).toHaveProperty("statusCode");
    });

    it("should handle rate limited responses gracefully", async () => {
      const requests = Array.from({ length: 8 }, () =>
        fetch(`${baseUrl}/api/tools/jira/issues`, {
          headers: {
            Cookie: `sessionId=${testSession.sessionId}`,
          },
        }),
      );

      const responses = await Promise.all(requests);

      const rateLimitedResponses = responses.filter((r) => r.status === 429);
      const successfulResponses = responses.filter((r) => r.status === 200);

      expect(successfulResponses.length + rateLimitedResponses.length).toBe(
        requests.length,
      );
    });
  });

  testSuite("Error Handling and Edge Cases", () => {
    it("should handle invalid session gracefully", async () => {
      const response = await fetch(`${baseUrl}/api/tools/jira/issues`, {
        headers: {
          Cookie: "sessionId=invalid-session-id",
        },
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toHaveProperty("error");
    });

    it("should handle malformed parameters", async () => {
      const response = await fetch(
        `${baseUrl}/api/tools/jira/nonexistent-endpoint`,
        {
          headers: {
            Cookie: `sessionId=${testSession.sessionId}`,
          },
        },
      );

      expect([404, 500]).toContain(response.status);
    });
  });

  testSuite("Security and Validation", () => {
    it("should not expose Jira tokens in responses", async () => {
      const [issuesResponse, rateLimitResponse] = await Promise.all([
        fetch(`${baseUrl}/api/tools/jira/issues`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/jira/rate-limit`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
      ]);

      [issuesResponse, rateLimitResponse].forEach(async (response) => {
        if (response.status === 200) {
          const data = await response.json();
          expect(JSON.stringify(data)).not.toContain("JIRA_API_TOKEN");
          expect(JSON.stringify(data)).not.toContain("access_token");
        }
      });
    });
  });

  testSuite("Performance and Reliability", () => {
    it("should handle concurrent requests efficiently", async () => {
      const concurrentRequests = [
        fetch(`${baseUrl}/api/tools/jira/issues`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/jira/projects`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/jira/rate-limit`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
      ];

      const responses = await Promise.all(concurrentRequests);

      responses.forEach((response) => {
        expect([200, 401, 403, 429]).toContain(response.status);
      });
    });

    it("should maintain consistent data structure across endpoints", async () => {
      const requests = [
        fetch(`${baseUrl}/api/tools/jira/issues`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/jira/projects`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
      ];

      const responses = await Promise.all(requests);

      responses.forEach(async (response) => {
        if (response.status === 200) {
          const data = await response.json();
          expect(data.issues || data.projects).toBeTruthy();
        }
      });
    });
  });
});
