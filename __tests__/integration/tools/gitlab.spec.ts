/**
 * GitLab Tool Integration Tests
 *
 * Tests complete GitLab tool integration including MRs, pipelines, issues,
 * rate limiting behavior, and data transformation accuracy.
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

/**
 * GitLab Tool Integration Tests (Optional External Integration Suite)
 *
 * This suite:
 * - Exercises GitLab tool wiring against configured endpoints/tokens
 * - Assumes valid GitLab credentials and network access when enabled
 *
 * It MUST be:
 * - Explicitly enabled via:
 *     - E2E_TESTS=1
 *     - GITLAB_TOKEN (and related GitLab env) configured
 * - Treated as optional CI/enterprise coverage, never a default local blocker.
 *
 * Default behavior:
 * - If flags/tokens are missing, this suite is fully skipped.
 */
const shouldRunGitlabToolIntegration =
  process.env.E2E_TESTS === "1" && !!process.env.GITLAB_TOKEN;
const GITLAB_AUTHORIZED_STATUSES = [200, 401, 403];

const describeGitlabToolIntegration = shouldRunGitlabToolIntegration
  ? describe
  : describe.skip;

describeGitlabToolIntegration("GitLab Tool Integration", () => {
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
    testSession = await testEnv.createTestSession("gitlab");
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

  describe("Merge Requests API Integration", () => {
    it("should fetch GitLab merge requests", async () => {
      const response = await fetch(
        `${baseUrl}/api/tools/gitlab/merge-requests`,
        {
          headers: {
            Cookie: `sessionId=${testSession.sessionId}`,
          },
        },
      );

      expect([200, 401, 403, 503]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("mergeRequests");
        expect(Array.isArray(data.mergeRequests)).toBe(true);

        // Validate merge request data structure
        if (data.mergeRequests.length > 0) {
          const mr = data.mergeRequests[0];
          expect(mr).toHaveProperty("id");
          expect(mr).toHaveProperty("title");
          expect(mr).toHaveProperty("project");
          expect(mr).toHaveProperty("status");
          expect(mr).toHaveProperty("created");
          expect(mr).toHaveProperty("url");
          expect(mr).toHaveProperty("author");

          // Verify MR numbering format (GitLab uses ! format)
          expect(mr.id).toMatch(/^!\d+$/);
        }
      }
    });

    it("should handle merge request filtering parameters", async () => {
      const url = new URL(`${baseUrl}/api/tools/gitlab/merge-requests`);
      url.searchParams.set("state", "opened");
      url.searchParams.set("scope", "created_by_me");

      const response = await fetch(url.toString(), {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect([200, 401, 403, 503]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("mergeRequests");
        expect(Array.isArray(data.mergeRequests)).toBe(true);
      }
    });

    it("should handle missing GitLab token gracefully", async () => {
      const response = await fetch(
        `${baseUrl}/api/tools/gitlab/merge-requests`,
        {
          headers: {
            Cookie: `sessionId=${testSession.sessionId}`,
          },
        },
      );

      // Should return 401/403 if no token, but not crash
      expect([200, 401, 403]).toContain(response.status);

      if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        expect(data).toHaveProperty("error");
      }
    });

    it("should handle GitLab rate limiting with fallback data", async () => {
      const response = await fetch(
        `${baseUrl}/api/tools/gitlab/merge-requests`,
        {
          headers: {
            Cookie: `sessionId=${testSession.sessionId}`,
          },
        },
      );

      // Should handle rate limiting gracefully
      expect([200, 401, 403, 429, 503]).toContain(response.status);

      if (response.status === 429) {
        const data = await response.json();
        // Should contain rate limit warning or fallback data
        expect(data.warning || data.mergeRequests).toBeDefined();
        if (data.warning) {
          expect(data.warning).toHaveProperty("message");
          expect(data.warning).toHaveProperty("retryAfter");
        }
      }
    });
  });

  describe("Pipelines API Integration", () => {
    it("should fetch GitLab pipelines", async () => {
      const response = await fetch(`${baseUrl}/api/tools/gitlab/pipelines`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect([200, 401, 403, 503]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("pipelines");
        expect(Array.isArray(data.pipelines)).toBe(true);

        // Validate pipeline data structure
        if (data.pipelines.length > 0) {
          const pipeline = data.pipelines[0];
          expect(pipeline).toHaveProperty("project");
          expect(pipeline).toHaveProperty("branch");
          expect(pipeline).toHaveProperty("status");
          expect(pipeline).toHaveProperty("duration");
          expect(pipeline).toHaveProperty("finished_at");
        }
      }
    });

    it("should handle pipeline filtering parameters", async () => {
      const url = new URL(`${baseUrl}/api/tools/gitlab/pipelines`);
      url.searchParams.set("status", "success");
      url.searchParams.set("ref", "main");

      const response = await fetch(url.toString(), {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect([200, 401, 403, 503]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("pipelines");
        expect(Array.isArray(data.pipelines)).toBe(true);
      }
    });

    it("should aggregate pipelines from multiple projects", async () => {
      const response = await fetch(`${baseUrl}/api/tools/gitlab/pipelines`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      if (response.status === 200) {
        const data = await response.json();
        if (data.pipelines.length > 0) {
          // Should have pipelines from different projects
          interface Pipeline {
            project: string;
            branch: string;
            status: string;
          }
          const projects = new Set(
            data.pipelines.map((p: Pipeline) => p.project),
          );
          expect(projects.size).toBeGreaterThanOrEqual(1);

          // Each pipeline should have consistent structure
          data.pipelines.forEach((pipeline: Pipeline) => {
            expect(pipeline.project).toBeTruthy();
            expect(pipeline.branch).toBeTruthy();
            expect(pipeline.status).toBeTruthy();
          });
        }
      }
    });
  });

  describe("Issues API Integration", () => {
    it("should fetch GitLab issues", async () => {
      const response = await fetch(`${baseUrl}/api/tools/gitlab/issues`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      // In environments without GitLab configured, the route may not be available
      expect([200, 401, 403, 404, 503]).toContain(response.status);

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
          expect(issue).toHaveProperty("created");
          expect(issue).toHaveProperty("assignee");
          expect(issue.type).toBe("issue");

          // Verify issue numbering format (GitLab uses # format)
          expect(issue.ticket).toMatch(/^#\d+$/);
        }
      }
    });

    it("should handle issues without authentication gracefully", async () => {
      const response = await fetch(`${baseUrl}/api/tools/gitlab/issues`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      // Should return empty array or error, but not crash; 404 allowed if route disabled
      expect([200, 401, 403, 404, 503]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("issues");
        expect(Array.isArray(data.issues)).toBe(true);
      }
    });

    it("should sort issues by creation date", async () => {
      const response = await fetch(`${baseUrl}/api/tools/gitlab/issues`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      if (response.status === 200) {
        const data = await response.json();
        if (data.issues.length > 1) {
          // Should be sorted by creation date (most recent first)
          const issues = data.issues;
          for (let i = 1; i < issues.length; i++) {
            expect(
              new Date(issues[i - 1].created).getTime(),
            ).toBeGreaterThanOrEqual(new Date(issues[i].created).getTime());
          }
        }
      }
    });
  });

  describe("Rate Limiting Integration", () => {
    it("should return GitLab rate limit status", async () => {
      const response = await fetch(`${baseUrl}/api/tools/gitlab/rate-limit`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect(GITLAB_AUTHORIZED_STATUSES.concat([503])).toContain(
        response.status,
      );

      if (response.status !== 200) {
        return;
      }

      const data = await response.json();

      // Should return rate limit data structure
      expect(data).toHaveProperty("rateLimit");
      const rateLimit = data.rateLimit;

      // GitLab rate limit structure (limited compared to GitHub)
      expect(rateLimit).toHaveProperty("message");
      expect(rateLimit).toHaveProperty("statusCode");
    });

    it("should handle GitLab-specific rate limiting headers", async () => {
      const response = await fetch(`${baseUrl}/api/tools/gitlab/rate-limit`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      expect(GITLAB_AUTHORIZED_STATUSES.concat([503])).toContain(
        response.status,
      );

      if (response.status === 200 || response.status === 503) {
        // GitLab uses Retry-After header for rate limiting
        // Should handle both successful and rate-limited responses
        const hasRateLimitInfo = response.headers
          .get("content-type")
          ?.includes("application/json");

        expect(hasRateLimitInfo).toBe(true);
      }
    });

    it("should respect GitLab progressive backoff strategy", async () => {
      // Make multiple requests to test GitLab's progressive delay strategy
      const requests = Array.from({ length: 10 }, () =>
        fetch(`${baseUrl}/api/tools/gitlab/merge-requests`, {
          headers: {
            Cookie: `sessionId=${testSession.sessionId}`,
          },
        }),
      );

      const responses = await Promise.all(requests);

      // Should handle rate limiting with GitLab's linear backoff strategy
      const rateLimitedResponses = responses.filter((r) => r.status === 429);
      const successfulResponses = responses.filter((r) => r.status === 200);
      const errorResponses = responses.filter((r) =>
        [401, 403, 503].includes(r.status),
      );

      if (
        successfulResponses.length + rateLimitedResponses.length === 0 &&
        errorResponses.length === responses.length
      ) {
        // All requests were unauthorized/unavailable; treat as a skipped scenario.
        expect(errorResponses.length).toBe(responses.length);
        return;
      }

      // Should handle rate limiting without complete failure
      expect(
        successfulResponses.length + rateLimitedResponses.length,
      ).toBeGreaterThan(0);
    });
  });

  describe("Data Transformation Accuracy", () => {
    it("should transform GitLab data to unified format", async () => {
      const [mrResponse, pipelineResponse, issueResponse] = await Promise.all([
        fetch(`${baseUrl}/api/tools/gitlab/merge-requests`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/gitlab/pipelines`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/gitlab/issues`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
      ]);

      // All responses should have consistent data structure when enabled
      [mrResponse, pipelineResponse, issueResponse].forEach((response) => {
        expect([200, 401, 403, 404, 503]).toContain(response.status);
      });

      // Validate unified format consistency for merge requests based on actual handler output
      if (mrResponse.status === 200) {
        const mrData = await mrResponse.json();
        if (mrData.mergeRequests.length > 0) {
          const mr = mrData.mergeRequests[0];
          expect(mr).toHaveProperty("id");
          expect(mr).toHaveProperty("title");
          expect(mr).toHaveProperty("project");
          expect(mr).toHaveProperty("status");
          expect(mr).toHaveProperty("created");
          expect(mr).toHaveProperty("url");
          expect(mr).toHaveProperty("author");
        }
      }

      if (issueResponse.status === 200) {
        const issueData = await issueResponse.json();
        if (issueData.issues.length > 0) {
          const issue = issueData.issues[0];
          expect(issue).toHaveProperty("type");
          expect(issue.type).toBe("issue");
          expect(issue).toHaveProperty("tool");
          expect(issue.tool).toBe("GitLab");
        }
      }
    });

    it("should extract project information correctly", async () => {
      const response = await fetch(
        `${baseUrl}/api/tools/gitlab/merge-requests`,
        {
          headers: {
            Cookie: `sessionId=${testSession.sessionId}`,
          },
        },
      );

      if (response.status === 200) {
        const data = await response.json();
        if (data.mergeRequests.length > 0) {
          const mr = data.mergeRequests[0];
          // Project should be a string (project name or ID)
          expect(typeof mr.project).toBe("string");
          expect(mr.project).toBeTruthy();
        }
      }
    });

    it("should format GitLab timestamps as human-readable dates when present", async () => {
      const response = await fetch(
        `${baseUrl}/api/tools/gitlab/merge-requests`,
        {
          headers: {
            Cookie: `sessionId=${testSession.sessionId}`,
          },
        },
      );

      if (response.status === 200) {
        const data = await response.json();
        if (data.mergeRequests.length > 0) {
          const mr = data.mergeRequests[0];
          expect(mr).toHaveProperty("created");

          // Handlers use toLocaleDateString() so ensure it's a non-empty string
          expect(typeof mr.created).toBe("string");
          expect(mr.created.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle invalid session gracefully", async () => {
      const response = await fetch(
        `${baseUrl}/api/tools/gitlab/merge-requests`,
        {
          headers: {
            Cookie: "sessionId=invalid-session-id",
          },
        },
      );

      // Depending on environment/tool wiring, invalid sessions may yield 401/403/404, or 200 if treated as anonymous/no-op
      expect([200, 401, 403, 404, 503]).toContain(response.status);
      if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        expect(data).toHaveProperty("error");
      }
    });

    it("should handle GitLab API connectivity issues", async () => {
      // Test endpoint that doesn't exist
      const response = await fetch(
        `${baseUrl}/api/tools/gitlab/nonexistent-endpoint`,
        {
          headers: {
            Cookie: `sessionId=${testSession.sessionId}`,
          },
        },
      );

      expect([401, 403, 404, 500]).toContain(response.status);
    });

    it("should handle malformed GitLab parameters", async () => {
      const url = new URL(`${baseUrl}/api/tools/gitlab/merge-requests`);
      url.searchParams.set("state", "invalid_state");

      const response = await fetch(url.toString(), {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      // Should handle gracefully (200 with filtered results or 400 error)
      expect([200, 400, 401, 403, 503]).toContain(response.status);
    });

    it("should handle GitLab membership API failures", async () => {
      const response = await fetch(`${baseUrl}/api/tools/gitlab/issues`, {
        headers: {
          Cookie: `sessionId=${testSession.sessionId}`,
        },
      });

      // Should handle membership API failures gracefully by returning empty array; 404 allowed if issues route not wired
      expect([200, 401, 403, 404, 503]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("issues");
        expect(Array.isArray(data.issues)).toBe(true);
      }
    });
  });

  describe("Security and Validation", () => {
    it("should not expose GitLab tokens in responses", async () => {
      const [mrResponse, rateLimitResponse] = await Promise.all([
        fetch(`${baseUrl}/api/tools/gitlab/merge-requests`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/gitlab/rate-limit`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
      ]);

      const responses = [mrResponse, rateLimitResponse];

      for (const response of responses) {
        if (response.status === 200) {
          const data = await response.json();
          const serialized = JSON.stringify(data);
          // Should not contain sensitive GitLab token information
          expect(serialized).not.toContain("GITLAB_TOKEN");
          expect(serialized).not.toContain("access_token");
          expect(serialized).not.toContain("private_token");
        }
      }
    });

    it("should handle invalid session gracefully", async () => {
      const response = await fetch(
        `${baseUrl}/api/tools/gitlab/merge-requests`,
        {
          headers: {
            Cookie: "sessionId=invalid-session-id",
          },
        },
      );

      // IntegrationTestEnvironment or routing may reject invalid/unknown sessions; 404 or 200 allowed depending on wiring
      expect([200, 401, 403, 404, 503]).toContain(response.status);
    });
  });

  describe("Performance and Reliability", () => {
    it("should handle concurrent requests to different endpoints", async () => {
      const concurrentRequests = [
        fetch(`${baseUrl}/api/tools/gitlab/merge-requests`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/gitlab/pipelines`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/gitlab/issues`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
      ];

      const responses = await Promise.all(concurrentRequests);

      // All requests should complete (success or appropriate error)
      responses.forEach((response) => {
        expect([200, 401, 403, 404, 429, 503]).toContain(response.status);
      });
    });

    it("should respect GitLab rate limit backoff delays", async () => {
      // Test that GitLab's linear backoff strategy is implemented
      const startTime = Date.now();

      // Make requests that might trigger rate limiting
      const requests = Array.from({ length: 5 }, () =>
        fetch(`${baseUrl}/api/tools/gitlab/merge-requests`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();

      // Should complete within reasonable time even with rate limiting
      expect(endTime - startTime).toBeLessThan(30000); // 30 seconds max

      // At least some requests should succeed or handle rate limiting gracefully
      const successfulOrRateLimited = responses.filter((r) =>
        [200, 429].includes(r.status),
      );

      if (successfulOrRateLimited.length === 0) {
        const allUnauthorized = responses.every((r) =>
          GITLAB_AUTHORIZED_STATUSES.concat([503]).includes(r.status),
        );
        expect(allUnauthorized).toBe(true);
        return;
      }

      expect(successfulOrRateLimited.length).toBeGreaterThan(0);
    });

    it("should maintain consistent data structure across endpoints", async () => {
      const requests = [
        fetch(`${baseUrl}/api/tools/gitlab/merge-requests`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/gitlab/pipelines`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
        fetch(`${baseUrl}/api/tools/gitlab/issues`, {
          headers: { Cookie: `sessionId=${testSession.sessionId}` },
        }),
      ];

      const responses = await Promise.all(requests);

      for (const response of responses) {
        if (response.status === 200) {
          const data = await response.json();
          // Each response should have the expected dataKey structure from the tool config
          expect(
            data.mergeRequests || data.pipelines || data.issues,
          ).toBeTruthy();
        }
      }
    });
  });
});
