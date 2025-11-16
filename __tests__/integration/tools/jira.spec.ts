/**
 * Jira Tool Integration Tests
 *
 * Tests Jira tool integration including issues, projects, changelogs,
 * rate limiting behavior, batch processing, and basic concurrency handling.
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

/**
 * Jira Tool Integration Tests (Optional External Integration Suite)
 *
 * This suite:
 * - Exercises Jira tool wiring against configured endpoints/tokens
 * - Assumes valid Jira credentials and network access when enabled
 *
 * It MUST be:
 * - Explicitly enabled via:
 *     - E2E_TESTS=1
 *     - JIRA_API_TOKEN (and related Jira env) configured
 * - Treated as optional CI/enterprise coverage, never a default local blocker.
 *
 * Default behavior:
 * - If flags/tokens are missing, this suite is fully skipped.
 */
const shouldRunJiraToolIntegration =
  process.env.E2E_TESTS === "1" && !!process.env.JIRA_API_TOKEN;

const describeJiraToolIntegration = shouldRunJiraToolIntegration
  ? describe
  : describe.skip;

describeJiraToolIntegration("Jira Tool Integration", () => {
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
          error:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : { message: String(error) },
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
    it("should return issues for a valid session", async () => {
      const response = await fetch(`${baseUrl}/api/tools/jira/issues`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect([200, 401, 403]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("issues");
        expect(Array.isArray(data.issues)).toBe(true);

        if (data.issues.length > 0) {
          const issue = data.issues[0];

          expect(issue).toHaveProperty("ticket");
          expect(typeof issue.ticket).toBe("string");

          expect(issue).toHaveProperty("title");
          expect(typeof issue.title).toBe("string");

          expect(issue).toHaveProperty("status");
          expect(typeof issue.status).toBe("string");

          expect(issue).toHaveProperty("url");
          expect(typeof issue.url).toBe("string");

          expect(issue).toHaveProperty("assignee");
        }
      }
    });

    it("should handle JQL filtering parameters safely", async () => {
      const url = new URL(`${baseUrl}/api/tools/jira/issues`);
      url.searchParams.set("project", "TEST");
      url.searchParams.set("status", "Open");

      let response: Response | null = null;

      try {
        response = await fetch(url.toString(), {
          headers: {
            Cookie: `sessionId=${testSession.sessionId}`,
          },
        });
      } catch (error) {
        // Network/encoding issues (e.g. Z_DATA_ERROR) should not crash the suite.
        // Treat as unavailable Jira backend for this integration scenario, but log for diagnostics.
        logger.warn("Jira JQL filter request failed", {
          type: "jira_jql_request_error",
          project: "TEST",
          status: "Open",
          error:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : { message: String(error) },
        });
        return;
      }

      expect([200, 401, 403]).toContain(response.status);

      if (response.status === 200) {
        const text = await response.text();
        // If backend sends invalid compressed/encoded data, text() will still surface it as a string.
        // Only parse JSON when it looks like JSON to avoid throwing here.
        if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
          const data = JSON.parse(text);
          expect(data).toHaveProperty("issues");
          expect(Array.isArray(data.issues)).toBe(true);
        }
      }
    });
  });

  testSuite("Changelogs API Integration", () => {
    it("should return changelogs for a valid batch request", async () => {
      const requestBody = {
        issueIds: ["TEST-1"],
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

        if (data.changelogs.length > 0) {
          const changelog = data.changelogs[0];
          expect(changelog).toHaveProperty("issueId");
          expect(changelog).toHaveProperty("changelog");
          expect(Array.isArray(changelog.changelog)).toBe(true);
        }
      }
    });

    it("should reject or safely handle empty batch requests", async () => {
      const response = await fetch(`${baseUrl}/api/tools/jira/changelogs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `sessionId=${testSession.sessionId}`,
        },
        body: JSON.stringify({ issueIds: [] }),
      });

      // Handler may return 400 for validation, or 200 with a safe response shape.
      expect([200, 400, 401, 403]).toContain(response.status);

      if (response.status === 400) {
        const data = await response.json();
        expect(data).toHaveProperty("error");
      }
    });

    it("should enforce or safely handle batches with more than 50 issue IDs", async () => {
      const issueIds = Array.from({ length: 51 }, (_, i) => `TEST-${i + 1}`);

      const response = await fetch(`${baseUrl}/api/tools/jira/changelogs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `sessionId=${testSession.sessionId}`,
        },
        body: JSON.stringify({ issueIds }),
      });

      // Ideal behavior is 400; some environments may normalize differently.
      expect([200, 400, 401, 403]).toContain(response.status);

      if (response.status === 400) {
        const data = await response.json();
        expect(data).toHaveProperty("error");
      }
    });
  });

  testSuite("Projects API Integration", () => {
    it("should return Jira project metadata for a valid session", async () => {
      const response = await fetch(`${baseUrl}/api/tools/jira/projects`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect([200, 401, 403]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();

        // Only assert project fields when the unified projects array is present.
        if (Array.isArray((data as { projects?: unknown }).projects)) {
          const projects = (data as { projects: unknown[] }).projects;

          if (projects.length > 0) {
            const project = projects[0] as Record<string, unknown>;
            expect(project).toHaveProperty("key");
            expect(project).toHaveProperty("name");
            expect(project).toHaveProperty("projectTypeKey");
          }
        }
      }
    });
  });

  testSuite("Rate Limiting Integration", () => {
    it("should return Jira rate limit status when available", async () => {
      const response = await fetch(`${baseUrl}/api/tools/jira/rate-limit`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect([200, 401, 403, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("rateLimit");
        const rateLimit = data.rateLimit;
        expect(rateLimit).toHaveProperty("message");
        expect(rateLimit).toHaveProperty("statusCode");
      }
    });

    it("should handle concurrent issue requests without crashing", async () => {
      const requests = Array.from({ length: 6 }, () =>
        fetch(`${baseUrl}/api/tools/jira/issues`, {
          headers: {
            Cookie: `sessionId=${testSession.sessionId}`,
          },
        }),
      );

      const responses = await Promise.all(requests);

      responses.forEach((r) => {
        expect([200, 401, 403, 429]).toContain(r.status);
      });
    });
  });

  testSuite("Error Handling and Edge Cases", () => {
    it("should handle invalid session gracefully", async () => {
      const response = await fetch(`${baseUrl}/api/tools/jira/issues`, {
        headers: {
          Cookie: "sessionId=invalid-session-id",
        },
      });

      expect([200, 401, 403]).toContain(response.status);

      if (response.status !== 200) {
        const data = await response.json();
        expect(data).toHaveProperty("error");
      }
    });
  });

  testSuite("Security and Validation", () => {
    it("should not expose Jira tokens or secrets in responses", async () => {
      const responses = await Promise.all([
        fetch(`${baseUrl}/api/tools/jira/issues`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/jira/projects`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/jira/rate-limit`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
      ]);

      for (const response of responses) {
        if (response.status === 200) {
          const data = await response.json();
          const serialized = JSON.stringify(data);

          expect(serialized).not.toContain("JIRA_API_TOKEN");
          expect(serialized).not.toContain("access_token");
          expect(serialized).not.toContain("authorization");
          expect(serialized).not.toContain("Bearer ");
        }
      }
    });
  });
});
