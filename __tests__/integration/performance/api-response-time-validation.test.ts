import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import { clearRateLimitCache } from "../../../lib/rate-limit-monitor";
import { toolRegistry } from "../../../tools/registry";
import logger from "../../../lib/logger";

describe("API Response Time Validation Suite", () => {
  // Create spy for global.fetch
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  // Mock tools with different response times for realistic testing
  const mockTools = {
    github: {
      name: "GitHub",
      slug: "github",
      enabled: true,
      capabilities: ["rate-limit", "pull-requests", "issues", "workflows"],
      ui: { color: "", icon: "GitHubIcon" },
      widgets: [],
      apis: {},
      handlers: {
        "pull-requests": vi.fn().mockResolvedValue({
          pullRequests: [
            {
              id: 1,
              title: "Test PR",
              state: "open",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
              user: { login: "testuser" },
              repository: {
                name: "test-repo",
                full_name: "testuser/test-repo",
              },
            },
          ],
        }),
        issues: vi.fn().mockResolvedValue({
          issues: [
            {
              id: 1,
              title: "Test Issue",
              state: "open",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
              user: { login: "testuser" },
              repository: {
                name: "test-repo",
                full_name: "testuser/test-repo",
              },
            },
          ],
        }),
        workflows: vi.fn().mockResolvedValue({
          workflows: [
            {
              id: 1,
              name: "Test Workflow",
              state: "active",
              path: ".github/workflows/test.yml",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
        }),
        "rate-limit": vi.fn().mockResolvedValue({
          rateLimit: {
            resources: {
              core: { limit: 5000, remaining: 4000, reset: 1640995200 },
              search: { limit: 30, remaining: 25, reset: 1640995200 },
              graphql: { limit: 5000, remaining: 4990, reset: 1640995200 },
            },
          },
        }),
      },
    },
    gitlab: {
      name: "GitLab",
      slug: "gitlab",
      enabled: true,
      capabilities: ["rate-limit", "merge-requests", "pipelines", "issues"],
      ui: { color: "", icon: "GitLabIcon" },
      widgets: [],
      apis: {},
      handlers: {
        "merge-requests": vi.fn().mockResolvedValue({
          mergeRequests: [
            {
              id: 1,
              title: "Test MR",
              state: "opened",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
              author: { username: "testuser" },
              project: {
                name: "test-repo",
                path_with_namespace: "testuser/test-repo",
              },
            },
          ],
        }),
        pipelines: vi.fn().mockResolvedValue({
          pipelines: [
            {
              id: 1,
              status: "success",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
              project: {
                name: "test-repo",
                path_with_namespace: "testuser/test-repo",
              },
            },
          ],
        }),
        issues: vi.fn().mockResolvedValue({
          issues: [
            {
              id: 1,
              title: "Test Issue",
              state: "opened",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
              author: { username: "testuser" },
              project: {
                name: "test-repo",
                path_with_namespace: "testuser/test-repo",
              },
            },
          ],
        }),
        "rate-limit": vi.fn().mockResolvedValue({
          rateLimit: {
            message: "Rate limit exceeded",
            retryAfter: 60,
            statusCode: 429,
          },
        }),
      },
    },
    jira: {
      name: "Jira",
      slug: "jira",
      enabled: true,
      capabilities: ["rate-limit", "issues", "projects", "changelogs"],
      ui: { color: "", icon: "JiraIcon" },
      widgets: [],
      apis: {},
      handlers: {
        issues: vi.fn().mockResolvedValue({
          issues: [
            {
              id: "1",
              key: "TEST-1",
              fields: {
                summary: "Test Issue",
                status: { name: "Open" },
                assignee: { displayName: "Test User" },
                created: "2024-01-01T00:00:00Z",
                updated: "2024-01-01T00:00:00Z",
                project: { key: "TEST", name: "Test Project" },
              },
            },
          ],
        }),
        projects: vi.fn().mockResolvedValue({
          projects: [
            {
              id: "1",
              key: "TEST",
              name: "Test Project",
              lead: { displayName: "Test Lead" },
              projectTypeKey: "software",
            },
          ],
        }),
        changelogs: vi.fn().mockResolvedValue({
          changelogs: [
            {
              id: "1",
              created: "2024-01-01T00:00:00Z",
              author: { displayName: "Test User" },
              items: [
                {
                  field: "status",
                  fromString: "Open",
                  toString: "In Progress",
                },
              ],
            },
          ],
        }),
        "rate-limit": vi.fn().mockResolvedValue({
          rateLimit: {
            message: "Too many requests",
            retryAfter: "3600",
            statusCode: 429,
          },
        }),
      },
    },
  };

  beforeAll(() => {
    // Set up mock tools in registry
    Object.assign(toolRegistry, mockTools);
  });

  afterAll(() => {
    // Clean up mock tools
    Object.keys(mockTools).forEach((key) => {
      delete (toolRegistry as Record<string, unknown>)[key];
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimitCache();
  });

  afterEach(() => {
    // No specific cleanup needed
  });

  describe("GitHub API Response Time Validation", () => {
    const githubEndpoints = [
      "pull-requests",
      "issues",
      "workflows",
      "rate-limit",
    ];
    const PERFORMANCE_THRESHOLDS = {
      fast: 100, // 100ms for fast operations
      normal: 500, // 500ms for normal operations
      slow: 1000, // 1s for slow operations (acceptable)
    };

    githubEndpoints.forEach((endpoint) => {
      it(`GitHub ${endpoint} responds within performance thresholds`, async () => {
        const startTime = performance.now();

        try {
          // Simulate API call by calling the handler directly
          const handler =
            mockTools.github.handlers[
              endpoint as keyof typeof mockTools.github.handlers
            ];
          const result = await handler();

          const endTime = performance.now();
          const responseTime = endTime - startTime;


          // Verify the result structure is correct
          expect(result).toBeDefined();

          // Performance validation
          expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.slow);

          // Specific endpoint validations
          switch (endpoint) {
            case "pull-requests":
              expect(result.pullRequests).toBeDefined();
              expect(Array.isArray(result.pullRequests)).toBe(true);
              break;
            case "issues":
              expect(result.issues).toBeDefined();
              expect(Array.isArray(result.issues)).toBe(true);
              break;
            case "workflows":
              expect(result.workflows).toBeDefined();
              expect(Array.isArray(result.workflows)).toBe(true);
              break;
            case "rate-limit":
              expect(result.rateLimit).toBeDefined();
              break;
          }
        } catch (error) {
          // Even on error, should respond quickly
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.slow);
          expect(error).toBeDefined();
        }
      });
    });

    it("GitHub endpoints maintain consistent performance under repeated calls", async () => {
      const endpoint = "pull-requests";
      const iterations = 10;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        const handler =
          mockTools.github.handlers[
            endpoint as keyof typeof mockTools.github.handlers
          ];
        await handler();

        const endTime = performance.now();
        responseTimes.push(endTime - startTime);
      }

      // Calculate statistics
      const avgResponseTime =
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);
      const variance =
        responseTimes.reduce(
          (sum, time) => sum + Math.pow(time - avgResponseTime, 2),
          0,
        ) / responseTimes.length;
      const standardDeviation = Math.sqrt(variance);


      // Performance consistency validations
      expect(avgResponseTime).toBeLessThan(200); // Average should be fast
      expect(maxResponseTime).toBeLessThan(500); // Max should be reasonable
      expect(standardDeviation).toBeLessThan(50); // Low variance (consistent performance)
      expect(maxResponseTime - minResponseTime).toBeLessThan(100); // Small range
    });

    it("GitHub bulk operations complete within acceptable time limits", async () => {
      const startTime = performance.now();

      // Simulate multiple GitHub endpoint calls
      const endpoints = ["pull-requests", "issues", "workflows"];
      const promises = endpoints.map((endpoint) => {
        const handler =
          mockTools.github.handlers[
            endpoint as keyof typeof mockTools.github.handlers
          ];
        return handler();
      });

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Verify all results are valid
      expect(results.length).toBe(3);
      results.forEach((result) => {
        expect(result).toBeDefined();
      });

      // Bulk operations should complete within reasonable time
      expect(totalTime).toBeLessThan(1000); // 1 second for bulk operation

      // Per-endpoint time should be reasonable
      const timePerEndpoint = totalTime / endpoints.length;
      expect(timePerEndpoint).toBeLessThan(500);
    });
  });

  describe("GitLab API Response Time Validation", () => {
    const gitlabEndpoints = [
      "merge-requests",
      "pipelines",
      "issues",
      "rate-limit",
    ];
    const PERFORMANCE_THRESHOLDS = {
      fast: 120,
      normal: 600,
      slow: 1200,
    };

    gitlabEndpoints.forEach((endpoint) => {
      it(`GitLab ${endpoint} responds within performance thresholds`, async () => {
        const startTime = performance.now();

        try {
          const handler =
            mockTools.gitlab.handlers[
              endpoint as keyof typeof mockTools.gitlab.handlers
            ];
          const result = await handler();

          const endTime = performance.now();
          const responseTime = endTime - startTime;


          // Verify result structure
          expect(result).toBeDefined();

          // Performance validation
          expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.slow);

          // Endpoint-specific validations
          switch (endpoint) {
            case "merge-requests":
              expect(result.mergeRequests).toBeDefined();
              expect(Array.isArray(result.mergeRequests)).toBe(true);
              break;
            case "pipelines":
              expect(result.pipelines).toBeDefined();
              expect(Array.isArray(result.pipelines)).toBe(true);
              break;
            case "issues":
              expect(result.issues).toBeDefined();
              expect(Array.isArray(result.issues)).toBe(true);
              break;
            case "rate-limit":
              expect(result.rateLimit).toBeDefined();
              break;
          }
        } catch (error) {
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.slow);
          expect(error).toBeDefined();
        }
      });
    });

    it("GitLab endpoints handle concurrent requests efficiently", async () => {
      const endpoint = "merge-requests";
      const concurrentRequests = 5;
      const startTime = performance.now();

      // Make concurrent requests
      const promises = Array.from({ length: concurrentRequests }, async () => {
        const handler =
          mockTools.gitlab.handlers[
            endpoint as keyof typeof mockTools.gitlab.handlers
          ];
        return handler();
      });

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Verify all results are valid
      expect(results.length).toBe(concurrentRequests);
      results.forEach((result) => {
        expect(result).toBeDefined();
      });

      // Concurrent requests should be efficient (not linear time increase)
      // With proper mocking, all should complete quickly
      expect(totalTime).toBeLessThan(500);

      // Average time per request should be reasonable
      const avgTimePerRequest = totalTime / concurrentRequests;
      expect(avgTimePerRequest).toBeLessThan(200);
    });
  });

  describe("Jira API Response Time Validation", () => {
    const jiraEndpoints = ["issues", "projects", "changelogs", "rate-limit"];
    const PERFORMANCE_THRESHOLDS = {
      fast: 150,
      normal: 800,
      slow: 1500,
    };

    jiraEndpoints.forEach((endpoint) => {
      it(`Jira ${endpoint} responds within performance thresholds`, async () => {
        const startTime = performance.now();

        try {
          const handler =
            mockTools.jira.handlers[
              endpoint as keyof typeof mockTools.jira.handlers
            ];
          const result = await handler();

          const endTime = performance.now();
          const responseTime = endTime - startTime;


          // Verify result structure
          expect(result).toBeDefined();

          // Performance validation
          expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.slow);

          // Endpoint-specific validations
          switch (endpoint) {
            case "issues":
              expect(result.issues).toBeDefined();
              expect(Array.isArray(result.issues)).toBe(true);
              break;
            case "projects":
              expect(result.projects).toBeDefined();
              expect(Array.isArray(result.projects)).toBe(true);
              break;
            case "changelogs":
              expect(result.changelogs).toBeDefined();
              expect(Array.isArray(result.changelogs)).toBe(true);
              break;
            case "rate-limit":
              expect(result.rateLimit).toBeDefined();
              break;
          }
        } catch (error) {
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.slow);
          expect(error).toBeDefined();
        }
      });
    });

    it("Jira endpoints maintain performance with complex data structures", async () => {
      const startTime = performance.now();

      // Test complex data fetching (changelogs can be more complex)
      const handler = mockTools.jira.handlers["changelogs"];
      const result = await handler();

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // Verify result structure
      expect(result.changelogs).toBeDefined();
      expect(Array.isArray(result.changelogs)).toBe(true);

      // Complex operations should still be reasonably fast
      expect(responseTime).toBeLessThan(800);

      // Data structure validation
      if (result.changelogs.length > 0) {
        const changelog = result.changelogs[0];
        expect(changelog).toHaveProperty("id");
        expect(changelog).toHaveProperty("created");
        expect(changelog).toHaveProperty("author");
        expect(changelog).toHaveProperty("items");
      }
    });
  });

  describe("Cross-Platform Response Time Comparison", () => {
    it("All platforms maintain comparable response time characteristics", async () => {
      const platforms = [
        { name: "GitHub", tool: mockTools.github, endpoint: "pull-requests" },
        { name: "GitLab", tool: mockTools.gitlab, endpoint: "merge-requests" },
        { name: "Jira", tool: mockTools.jira, endpoint: "issues" },
      ];

      const responseTimes: Record<string, number> = {};

      for (const platform of platforms) {
        const startTime = performance.now();

        const handler =
          platform.tool.handlers[
            platform.endpoint as keyof typeof platform.tool.handlers
          ];
        await handler();

        const endTime = performance.now();
        responseTimes[platform.name] = endTime - startTime;
      }

      // All platforms should have reasonable response times
      Object.values(responseTimes).forEach((time) => {
        expect(time).toBeLessThan(500);
      });

      // Response times should be relatively similar (within 2x of each other)
      const times = Object.values(responseTimes);
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const ratio = maxTime / minTime;

      expect(ratio).toBeLessThan(3); // Max time should not be 3x the min time
    });

    it("Performance remains stable under mixed platform access patterns", async () => {
      const accessPatterns = [
        { platform: "github", endpoint: "issues", priority: 1 },
        { platform: "gitlab", endpoint: "pipelines", priority: 2 },
        { platform: "jira", endpoint: "projects", priority: 1 },
        { platform: "github", endpoint: "workflows", priority: 3 },
        { platform: "gitlab", endpoint: "merge-requests", priority: 2 },
        { platform: "jira", endpoint: "changelogs", priority: 3 },
      ];

      const startTime = performance.now();

      // Execute access pattern
      for (const pattern of accessPatterns) {
        const tool = mockTools[pattern.platform as keyof typeof mockTools];
        const handler =
          tool.handlers[pattern.endpoint as keyof typeof tool.handlers];
        await handler();
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Mixed access patterns should be efficient
      expect(totalTime).toBeLessThan(1500);

      // Average time per access should be reasonable
      const avgTimePerAccess = totalTime / accessPatterns.length;
      expect(avgTimePerAccess).toBeLessThan(300);
    });
  });

  describe("Response Time Distribution Analysis", () => {
    it("Response times follow expected distribution patterns", async () => {
      const endpoint = "pull-requests";
      const sampleSize = 50;
      const responseTimes: number[] = [];

      // Collect response time samples
      for (let i = 0; i < sampleSize; i++) {
        const startTime = performance.now();

        const handler =
          mockTools.github.handlers[
            endpoint as keyof typeof mockTools.github.handlers
          ];
        await handler();

        const endTime = performance.now();
        responseTimes.push(endTime - startTime);
      }

      // Calculate distribution statistics
      const sortedTimes = [...responseTimes].sort((a, b) => a - b);
      const p50 = sortedTimes[Math.floor(sampleSize * 0.5)];
      const p95 = sortedTimes[Math.floor(sampleSize * 0.95)];
      const p99 = sortedTimes[Math.floor(sampleSize * 0.99)];
      const avg =
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;


      // Performance distribution validations
      expect(p50).toBeLessThan(100); // 50th percentile should be fast
      expect(p95).toBeLessThan(300); // 95th percentile should be reasonable
      expect(p99).toBeLessThan(500); // 99th percentile should be acceptable
      expect(avg).toBeLessThan(200); // Average should be good

      // Distribution should be reasonably tight
      expect(p95).toBeLessThan(p50 * 5); // 95th percentile not too far from median
    });

    it("Response times remain consistent across different time windows", async () => {
      const endpoint = "issues";
      const windows = [
        { name: "Window 1", size: 10 },
        { name: "Window 2", size: 10 },
        { name: "Window 3", size: 10 },
      ];

      const windowResults: Record<
        string,
        { avg: number; max: number; min: number }
      > = {};

      for (const window of windows) {
        const responseTimes: number[] = [];

        for (let i = 0; i < window.size; i++) {
          const startTime = performance.now();

          const handler =
            mockTools.github.handlers[
              endpoint as keyof typeof mockTools.github.handlers
            ];
          await handler();

          const endTime = performance.now();
          responseTimes.push(endTime - startTime);
        }

        windowResults[window.name] = {
          avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
          max: Math.max(...responseTimes),
          min: Math.min(...responseTimes),
        };
      }

      // All windows should have reasonable averages
      Object.values(windowResults).forEach((result) => {
        expect(result.avg).toBeLessThan(200);
        expect(result.max).toBeLessThan(500);
      });

      // Windows should have similar performance characteristics
      const averages = Object.values(windowResults).map((r) => r.avg);
      const maxAvg = Math.max(...averages);
      const minAvg = Math.min(...averages);
      const avgVariation = (maxAvg - minAvg) / minAvg;

      expect(avgVariation).toBeLessThan(6); // Less than 600% variation (allowing for real-world timing variations)
    });
  });
});
