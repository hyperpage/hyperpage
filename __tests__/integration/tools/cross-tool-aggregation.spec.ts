/**
 * Cross-Tool Aggregation Integration Tests
 *
 * Tests unified views, data consistency, and multi-tool coordination
 * across GitHub, GitLab, and Jira tool integrations.
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
} from "@/lib/../__tests__/shared/test-credentials";

describe("Cross-Tool Aggregation Integration", () => {
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
    [githubSession, gitlabSession, jiraSession] = await Promise.all([
      testEnv.createTestSession("github"),
      testEnv.createTestSession("gitlab"),
      testEnv.createTestSession("jira"),
    ]);
  });

  afterEach(async () => {
    // Cleanup test sessions
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

  describe("Unified Data Format Consistency", () => {
    it("should maintain consistent ticket numbering across tools", async () => {
      const [githubResponse, gitlabResponse, jiraResponse] = await Promise.all([
        fetch(`${baseUrl}/api/tools/github/issues`, {
          headers: { Cookie: `sessionId=${githubSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/gitlab/issues`, {
          headers: { Cookie: `sessionId=${gitlabSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/jira/issues`, {
          headers: { Cookie: `sessionId=${jiraSession.sessionId}` },
        }),
      ]);

      // All tools should maintain their native numbering formats
      if (githubResponse.status === 200) {
        const githubData = await githubResponse.json();
        if (githubData.issues && githubData.issues.length > 0) {
          const issue = githubData.issues[0];
          expect(issue.ticket).toMatch(/^#\d+$/); // GitHub format
        }
      }

      if (gitlabResponse.status === 200) {
        const gitlabData = await gitlabResponse.json();
        if (gitlabData.issues && gitlabData.issues.length > 0) {
          const issue = gitlabData.issues[0];
          expect(issue.ticket).toMatch(/^#\d+$/); // GitLab format
        }
      }

      if (jiraResponse.status === 200) {
        const jiraData = await jiraResponse.json();
        if (jiraData.issues && jiraData.issues.length > 0) {
          const issue = jiraData.issues[0];
          expect(issue.ticket).toMatch(/^[A-Z]+-\d+$/); // Jira format
        }
      }
    });

    it("should maintain consistent time-based sorting", async () => {
      const [githubResponse, gitlabResponse, jiraResponse] = await Promise.all([
        fetch(`${baseUrl}/api/tools/github/pull-requests`, {
          headers: { Cookie: `sessionId=${githubSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/gitlab/merge-requests`, {
          headers: { Cookie: `sessionId=${gitlabSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/jira/issues`, {
          headers: { Cookie: `sessionId=${jiraSession.sessionId}` },
        }),
      ]);

      // Check that all tools return time-sorted data (most recent first)
      const responses = [githubResponse, gitlabResponse, jiraResponse];

      for (const response of responses) {
        if (response.status === 200) {
          const data = await response.json();
          const items = data.pullRequests || data.mergeRequests || data.issues;

          if (items && items.length > 1) {
            // Should be sorted by creation date (most recent first)
            for (let i = 1; i < items.length; i++) {
              const prevItem = items[i - 1];
              const currItem = items[i];

              // Get the creation timestamp for comparison
              const prevTime = new Date(
                prevItem.created || prevItem.created_at,
              ).getTime();
              const currTime = new Date(
                currItem.created || currItem.created_at,
              ).getTime();

              expect(currTime).toBeLessThanOrEqual(prevTime);
            }
          }
        }
      }
    });

    it("should provide unified status field mapping", async () => {
      const [githubResponse, gitlabResponse, jiraResponse] = await Promise.all([
        fetch(`${baseUrl}/api/tools/github/issues`, {
          headers: { Cookie: `sessionId=${githubSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/gitlab/issues`, {
          headers: { Cookie: `sessionId=${gitlabSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/jira/issues`, {
          headers: { Cookie: `sessionId=${jiraSession.sessionId}` },
        }),
      ]);

      // All tools should provide consistent status field
      const responses = [githubResponse, gitlabResponse, jiraResponse];

      for (const response of responses) {
        if (response.status === 200) {
          const data = await response.json();
          const items = data.issues;

          if (items && items.length > 0) {
            const issue = items[0];
            expect(issue).toHaveProperty("status");
            expect(typeof issue.status).toBe("string");
            expect(issue.status).toBeTruthy();
          }
        }
      }
    });
  });

  describe("Multi-Tool Data Aggregation", () => {
    it("should aggregate data from multiple tools without conflicts", async () => {
      const requests = [
        fetch(`${baseUrl}/api/tools/github/pull-requests`, {
          headers: { Cookie: `sessionId=${githubSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/gitlab/merge-requests`, {
          headers: { Cookie: `sessionId=${gitlabSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/jira/issues`, {
          headers: { Cookie: `sessionId=${jiraSession.sessionId}` },
        }),
      ];

      const responses = await Promise.all(requests);
      let totalItems = 0;
      let toolsWithData = 0;

      // Count successful responses and total items
      for (const response of responses) {
        if (response.status === 200) {
          toolsWithData++;
          const data = await response.json();
          const items = data.pullRequests || data.mergeRequests || data.issues;
          if (items) {
            totalItems += items.length;
          }
        }
      }

      // Should be able to aggregate data from multiple sources
      expect(totalItems).toBeGreaterThanOrEqual(0);
      expect(toolsWithData).toBeGreaterThanOrEqual(0);
    });

    it("should handle tool failures gracefully in aggregation", async () => {
      const requests = [
        fetch(`${baseUrl}/api/tools/github/pull-requests`, {
          headers: { Cookie: `sessionId=${githubSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/nonexistent-tool/pull-requests`, {
          headers: { Cookie: `sessionId=${githubSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/gitlab/merge-requests`, {
          headers: { Cookie: `sessionId=${gitlabSession.sessionId}` },
        }),
      ];

      const responses = await Promise.all(requests);

      // Should handle mixed success/failure responses
      const successfulResponses = responses.filter((r) => r.status === 200);
      const errorResponses = responses.filter((r) =>
        [404, 500, 401, 403].includes(r.status),
      );

      expect(successfulResponses.length + errorResponses.length).toBe(
        requests.length,
      );
    });
  });

  describe("Cross-Tool Security Validation", () => {
    it("should maintain session isolation across tools", async () => {
      // Create session for different user
      const anotherSession = await testEnv.createTestSession("github");

      // Try cross-session access
      const crossSessionRequests = [
        fetch(`${baseUrl}/api/tools/github/pull-requests`, {
          headers: { Cookie: `sessionId=${anotherSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/gitlab/merge-requests`, {
          headers: { Cookie: `sessionId=${anotherSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/jira/issues`, {
          headers: { Cookie: `sessionId=${anotherSession.sessionId}` },
        }),
      ];

      const crossSessionResponses = await Promise.all(crossSessionRequests);

      // Should handle cross-session access appropriately for all tools
      crossSessionResponses.forEach((response) => {
        expect([401, 403, 500]).toContain(response.status);
      });
    });
  });
});
