import React from "react";
import { Kanban } from "lucide-react";
import { Tool, ToolConfig } from "../tool-types";
import { JiraApiIssue } from "./types";
import { registerTool } from "../registry";
import { detectJiraInstanceSize } from "../../lib/rate-limit-utils";
import { MemoryCache } from "../../lib/cache/memory-cache";
import { createIPv4Fetch } from "../../lib/ipv4-fetch";
import logger from "../../lib/logger";

// Advisory locking for concurrent requests to prevent API storms
class RequestDeduper<T = unknown> {
  private pendingRequests = new Map<string, Promise<T>>();

  /**
   * Execute a request with deduplication - if identical request is already in flight, return that promise instead
   * @param key Unique key identifying this request (cache-like key strategy)
   * @param executor Function that performs the actual request
   * @returns Promise that resolves to the result
   */
  async dedupe(key: string, executor: () => Promise<T>): Promise<T> {
    const existingRequest = this.pendingRequests.get(key);
    if (existingRequest) {
      // Return existing request promise instead of making new call
      return existingRequest;
    }

    const requestPromise = executor().finally(() => {
      // Clean up the pending request, but don't await cleanup
      setTimeout(() => this.pendingRequests.delete(key), 0);
    });

    this.pendingRequests.set(key, requestPromise);
    return requestPromise;
  }

  /**
   * Get current number of pending requests (for monitoring)
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Cancel all pending requests (for cleanup)
   */
  cancelAll(): void {
    this.pendingRequests.clear();
  }
}

// Instance-wide deduper for Jira requests
const jiraRequestDeduper = new RequestDeduper();

/**
 * Jira-specific fetch wrapper that uses IPv4 forcing with proper timeouts
 */
function createJiraFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  return createIPv4Fetch(url, options, 30000); // 30 second timeout for Jira API
}

export const jiraTool: Tool = {
  name: "Jira",
  slug: "jira",
  enabled: process.env.ENABLE_JIRA === "true",
  ui: {
    color: "bg-green-500/10 border-green-400/30 text-green-400",
    icon: React.createElement(Kanban, { className: "w-5 h-5" }),
  },
  capabilities: ["issues", "rate-limit"], // Declares what this tool can provide for unified views
  widgets: [], // Removed individual widget - now unified in ticketing tool
  validation: {
    required: ["JIRA_WEB_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"],
    optional: [],
    description: "Jira integration requires instance URL, email, and API token",
  },
  apis: {
    issues: {
      method: "GET",
      description: "Get recent issues",
      parameters: {
        project: {
          type: "string",
          required: false,
          description: "Project key to filter issues",
        },
        status: {
          type: "string",
          required: false,
          description: "Issue status filter",
        },
      },
      response: {
        dataKey: "issues",
        description:
          "Array of issue objects with ticket, title, status, and assignee",
      },
    },

    changelogs: {
      method: "POST",
      description:
        "Batch fetch changelogs for multiple Jira issues (rate limit optimized)",
      parameters: {
        issueIds: {
          type: "array",
          required: true,
          description: "Array of issue IDs/keys to fetch changelogs for",
        },
        since: {
          type: "string",
          required: false,
          description: "Only return changes since this timestamp (ISO 8601)",
        },
        maxResults: {
          type: "number",
          required: false,
          description: "Maximum results per issue changelog (default: 10)",
        },
      },
      response: {
        dataKey: "changelogs",
        description: "Batched changelog entries for requested issues",
      },
    },

    projects: {
      method: "GET",
      description:
        "Get Jira project metadata with 24-hour caching (rate limit optimized)",
      parameters: {
        projectKey: {
          type: "string",
          required: false,
          description:
            "Specific project key to fetch (returns all projects if omitted)",
        },
        includeDetails: {
          type: "boolean",
          required: false,
          description: "Include detailed project information (default: false)",
        },
      },
      response: {
        dataKey: "projects",
        description:
          "Cached project metadata (24-hour TTL to reduce API calls)",
      },
    },

    "rate-limit": {
      method: "GET",
      description: "Get current Jira API rate limit status",
      response: {
        dataKey: "rateLimit",
        description:
          "Current rate limit status for Jira instance (limited support - mainly status based)",
      },
    },
  },
  handlers: {
    issues: async (request: Request, config: ToolConfig) => {
      // Use tool-owned logic to format URLs
      const webUrl = process.env.JIRA_WEB_URL;
      const apiUrl =
        config.formatApiUrl?.(webUrl || "") || process.env.JIRA_API_URL;
      const apiToken = process.env.JIRA_API_TOKEN;
      const email = process.env.JIRA_EMAIL;

      if (!apiUrl || !apiToken) {
        throw new Error("JIRA API credentials not configured");
      }

      const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");
      const issuesUrl = `${apiUrl}/search/jql`;

      const response = await createJiraFetch(issuesUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jql: "updated > -30d ORDER BY updated DESC",
          maxResults: 50,
          fields: ["key", "summary", "status", "assignee"],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JIRA API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Transform JIRA issues to our portal format
      const transformedIssues = (data.issues as JiraApiIssue[]).map(
        (issue: JiraApiIssue) => ({
          ticket: issue.key,
          url: webUrl && issue.key ? `${webUrl}/browse/${issue.key}` : "#",
          title: issue.fields.summary,
          status: issue.fields.status.name,
          assignee: issue.fields.assignee?.displayName || "Unassigned",
        }),
      );

      return { issues: transformedIssues };
    },
    changelogs: async (request: Request, config: ToolConfig) => {
      const webUrl = process.env.JIRA_WEB_URL;
      const apiUrl =
        config.formatApiUrl?.(webUrl || "") || process.env.JIRA_API_URL;
      const apiToken = process.env.JIRA_API_TOKEN;
      const email = process.env.JIRA_EMAIL;

      if (!apiUrl || !apiToken) {
        throw new Error("JIRA API credentials not configured");
      }

      const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");

      // Parse request body for parameters
      let body: { issueIds?: string[]; since?: string; maxResults?: number };
      try {
        body = await request.json();
      } catch {
        throw new Error("Invalid JSON in request body");
      }

      const { issueIds, maxResults = 10 } = body;

      if (!issueIds || !Array.isArray(issueIds) || issueIds.length === 0) {
        throw new Error("issueIds must be a non-empty array");
      }

      if (issueIds.length > 50) {
        throw new Error("Maximum 50 issue IDs allowed per batch request");
      }

      // Filter out invalid issue IDs
      const validIssueIds = issueIds.filter(
        (id: string) => typeof id === "string" && id.trim().length > 0,
      );

      if (validIssueIds.length === 0) {
        return { changelogs: [] };
      }

      // Batch processing with rate limit awareness
      const instanceSize = detectJiraInstanceSize(
        new Response(null, { status: 200 }),
      );

      const chunkSize = Math.min(
        validIssueIds.length,
        instanceSize === "small"
          ? 5
          : instanceSize === "cloud"
            ? 10
            : instanceSize === "large"
              ? 15
              : 8,
      );

      const changelogPromises: Promise<{
        issueId: string;
        changelog: Record<string, unknown>[];
        error?: string;
      }>[] = [];
      const allChangelogs: {
        issueId: string;
        changelog: Record<string, unknown>[];
        error?: string;
      }[] = [];

      // Process issues in chunks to avoid overwhelming the API
      for (let i = 0; i < validIssueIds.length; i += chunkSize) {
        const chunk = validIssueIds.slice(i, i + chunkSize);

        // Create promises for this chunk
        for (const issueId of chunk) {
          const changelogPromise = (async () => {
            try {
              const changelogUrl = `${apiUrl}/issue/${issueId}/changelog?maxResults=${maxResults}`;
              const response = await createJiraFetch(changelogUrl, {
                method: "GET",
                headers: {
                  Authorization: `Basic ${auth}`,
                  "Content-Type": "application/json",
                },
              });

              if (!response.ok) {
                if (response.status === 404) {
                  return { issueId, changelog: [], error: "Issue not found" };
                }
                if (response.status === 403) {
                  return {
                    issueId,
                    changelog: [],
                    error: "Access denied to issue",
                  };
                }
                if (response.status === 429) {
                  // Rate limited - return partial data indicating retry needed
                  return {
                    issueId,
                    changelog: [],
                    error: "Rate limited - try again later",
                  };
                }
                return {
                  issueId,
                  changelog: [],
                  error: `API error: ${response.status}`,
                };
              }

              const data = await response.json();
              const changelog = (data.values || []).map(
                (entry: Record<string, unknown>) => ({
                  id: entry.id,
                  author:
                    (entry.author as { displayName?: string; name?: string })
                      ?.displayName ||
                    (entry.author as { displayName?: string; name?: string })
                      ?.name ||
                    "Unknown",
                  created: entry.created,
                  items:
                    (entry.items as Record<string, unknown>[])?.map(
                      (item: Record<string, unknown>) => ({
                        field: item.field,
                        fieldtype: item.fieldtype,
                        from:
                          (item as { fromString?: string; from?: string })
                            .fromString ||
                          (item as { fromString?: string; from?: string }).from,
                        to:
                          (item as { toString?: string; to?: string })
                            .toString ||
                          (item as { toString?: string; to?: string }).to,
                      }),
                    ) || [],
                }),
              );

              return { issueId, changelog };
            } catch (error) {
              return {
                issueId,
                changelog: [],
                error: `Network error: ${error}`,
              };
            }
          })();

          changelogPromises.push(changelogPromise);
        }

        // Process this chunk with adaptive delays for rate limit protection
        if (instanceSize === "small" || instanceSize === "medium") {
          // Add delays between chunks for conservative instances
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      // Wait for all changelog requests to complete
      const results = await Promise.allSettled(changelogPromises);

      // Process results and handle failures gracefully
      for (const result of results) {
        if (result.status === "fulfilled") {
          allChangelogs.push(result.value);
        } else {
          // Handle rejected promises (network failures, etc.)
          allChangelogs.push({
            issueId: "unknown",
            changelog: [],
            error: `Promise rejected: ${result.reason}`,
          });
        }
      }

      return { changelogs: allChangelogs };
    },
    projects: async (
      request: Request,
      config: ToolConfig,
    ): Promise<Record<string, unknown>> => {
      const webUrl = process.env.JIRA_WEB_URL;
      const apiUrl =
        config.formatApiUrl?.(webUrl || "") || process.env.JIRA_API_URL;
      const apiToken = process.env.JIRA_API_TOKEN;
      const email = process.env.JIRA_EMAIL;

      if (!apiUrl || !apiToken) {
        throw new Error("JIRA API credentials not configured");
      }

      const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");
      const url = new URL(request.url);
      const projectKey = url.searchParams.get("projectKey");
      const includeDetails = url.searchParams.get("includeDetails") === "true";

      // Cache key strategy for project metadata (24-hour TTL)
      const cacheKey = projectKey
        ? `jira:project:${projectKey}:${includeDetails}`
        : `jira:projects:list:${includeDetails}`;

      const cache = new MemoryCache(); // Use instance-based cache

      // Try to get from cache first
      try {
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
          return {
            projects: cachedData as unknown as Record<string, unknown>[],
          };
        }
      } catch (cacheError) {
        logger.warn("Cache read error", { error: cacheError });
        // Continue with API call if cache fails
      }

      // Use advisory locking to prevent concurrent requests for same data
      return (await jiraRequestDeduper.dedupe(
        `projects:${cacheKey}`,
        async () => {
          let apiEndpoint: string;
          if (projectKey) {
            // Single project request
            apiEndpoint = includeDetails
              ? `/project/${projectKey}`
              : `/project/${projectKey}?expand=`;
          } else {
            // All projects request
            apiEndpoint = "/project";
          }

          const projectsUrl = `${apiUrl}${apiEndpoint}`;

          const response = await createJiraFetch(projectsUrl, {
            method: "GET",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            if (response.status === 404 && projectKey) {
              throw new Error(`Project ${projectKey} not found`);
            }
            if (response.status === 403) {
              throw new Error("Access denied to project information");
            }
            if (response.status === 429) {
              throw new Error(
                "Rate limited - project metadata temporarily unavailable",
              );
            }
            throw new Error(`JIRA API error: ${response.status}`);
          }

          const data = await response.json();

          // Transform project data - handle both single project and project list responses
          let projects: Record<string, unknown>[];
          if (projectKey && !Array.isArray(data)) {
            // Single project response
            projects = [
              {
                key: data.key,
                name: data.name,
                description: data.description,
                projectTypeKey: data.projectTypeKey,
                lead:
                  (data.lead as { displayName?: string; name?: string })
                    ?.displayName ||
                  (data.lead as { displayName?: string; name?: string })
                    ?.name ||
                  "Unknown",
                url: webUrl ? `${webUrl}/projects/${data.key}` : undefined,
                category:
                  (data.projectCategory as { name?: string })?.name || null,
                // Include additional details if requested
                ...(includeDetails && {
                  components: data.components || [],
                  versions: data.versions || [],
                  roles: data.roles || {},
                  issueTypes: data.issueTypes || [],
                }),
              },
            ];
          } else {
            // Multiple projects response
            projects = (Array.isArray(data) ? data : data.values || []).map(
              (project: Record<string, unknown>) => ({
                key: project.key,
                name: project.name,
                description: project.description,
                projectTypeKey: project.projectTypeKey,
                lead:
                  (project.lead as { displayName?: string; name?: string })
                    ?.displayName ||
                  (project.lead as { displayName?: string; name?: string })
                    ?.name ||
                  "Unknown",
                url: webUrl ? `${webUrl}/projects/${project.key}` : undefined,
                category:
                  (project.projectCategory as { name?: string })?.name || null,
                // Include additional details if requested (limited for list view)
                ...(includeDetails && {
                  roles: project.roles || {},
                }),
              }),
            );
          }

          // Cache the results for 24 hours to reduce API calls
          try {
            cache.set(cacheKey, projects, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
          } catch (cacheError) {
            logger.warn("Cache write error", { error: cacheError });
            // Continue even if caching fails
          }

          return { projects } as Record<string, unknown>;
        },
      )) as Record<string, unknown>;
    },
    "rate-limit": async (request: Request, config: ToolConfig) => {
      // Jira doesn't have a dedicated rate limit API like GitHub
      // We'll make a test request to the server info endpoint to check connectivity and basic rate limiting
      const webUrl = process.env.JIRA_WEB_URL;
      const apiUrl =
        config.formatApiUrl?.(webUrl || "") || process.env.JIRA_API_URL;
      const apiToken = process.env.JIRA_API_TOKEN;
      const email = process.env.JIRA_EMAIL;

      if (!apiUrl || !apiToken) {
        throw new Error("JIRA API credentials not configured");
      }

      const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");
      const serverInfoUrl = `${apiUrl}/serverInfo`; // Simple endpoint to test API connectivity

      try {
        const response = await createIPv4Fetch(
          serverInfoUrl,
          {
            method: "GET",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/json",
            },
          },
          20000,
        ); // 20 second timeout

        // Return basic rate limit information for Jira
        // Since Jira doesn't expose actual rate limits via API, we report status based on response codes
        if (!response.ok) {
          if (response.status === 429) {
            // Rate limited response - report as high usage
            return {
              rateLimit: {
                message: "Jira API rate limit exceeded",
                statusCode: response.status,
                retryAfter: response.headers.get("Retry-After"),
              },
            };
          }

          // Other error - might be authentication or server issue
          throw new Error(`JIRA server info API error: ${response.status}`);
        }

        // Success - return basic status information
        return {
          rateLimit: {
            message:
              "Jira API accessible - rate limiting status unknown (not exposed by API)",
            statusCode: response.status,
            serverInfo: "Jira API connection confirmed",
          },
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes("timeout")) {
          throw new Error(
            "Jira API request timed out after 20 seconds - possible connectivity issue",
          );
        }
        throw error; // Re-throw other errors
      }
    },
  },
  config: {
    formatApiUrl: (webUrl: string) => `${webUrl}/rest/api/3`, // Jira's URL formatting logic
    headers: {
      // Headers will be set dynamically in handlers
    },
    rateLimit: {
      // Instance-aware rate limiting for Jira
      instanceAware: true,
      detectHeaders: () => ({
        remaining: null, // Jira doesn't provide remaining count headers
        resetTime: null, // Jira doesn't provide reset time headers
        retryAfter: null, // Jira uses 429 status, not Retry-After header typically
      }),
      shouldRetry: (response: Response, attemptNumber: number) => {
        // Instance-specific retry logic
        const instanceSize = detectJiraInstanceSize(response);

        // Adjust retry behavior based on instance size
        let baseDelay: number;

        switch (instanceSize) {
          case "small":
            baseDelay = 3000; // 3s - more conservative for small instances
            break;
          case "cloud":
            baseDelay = 1500; // 1.5s - Atlassian Cloud is responsive
            break;
          case "large":
            baseDelay = 1000; // 1s - large instances can handle more
            break;
          case "medium":
          default:
            baseDelay = 2000; // 2s - default for medium instances
            break;
        }

        // Handle 429 (Too Many Requests) responses
        if (response.status === 429) {
          // Use exponential backoff with instance-specific base delay
          return baseDelay * Math.pow(2, attemptNumber);
        }

        return null; // No retry needed
      },
      getMaxRetries: (response: Response) => {
        // Dynamic max retries based on instance size
        const instanceSize = detectJiraInstanceSize(response);

        switch (instanceSize) {
          case "small":
            return 3; // Conservative approach for small instances
          case "cloud":
            return 6; // Cloud can handle more retries
          case "large":
            return 8; // Large instances are more robust
          case "medium":
          default:
            return 5; // Default for medium instances
        }
      },
      backoffStrategy: "adaptive-exponential", // More adaptive than simple exponential
      adaptiveThresholds: {
        // Instance size determines when to trigger backoff
        small: { warningThreshold: 25, criticalThreshold: 50 }, // Very conservative
        medium: { warningThreshold: 50, criticalThreshold: 75 }, // Default thresholds
        large: { warningThreshold: 70, criticalThreshold: 85 }, // Less conservative
        cloud: { warningThreshold: 60, criticalThreshold: 80 }, // Optimized for Atlassian Cloud
      },
    },
    // OAuth configuration for registry-driven authentication
    oauthConfig: {
      userApiUrl: "/rest/api/3/myself", // Jira's current user endpoint
      authorizationHeader: "Bearer",
      authorizationUrl: "/rest/oauth2/latest/authorize", // Will be formatted with base URL
      tokenUrl: "/rest/oauth2/latest/token", // Will be formatted with base URL
      scopes: [
        "read:jira-work", // Read jira work items
        "read:jira-user", // Read user information
        "write:jira-work", // Create and edit jira work items
      ],
      clientIdEnvVar: "JIRA_OAUTH_CLIENT_ID",
      clientSecretEnvVar: "JIRA_OAUTH_CLIENT_SECRET",
      userMapping: {
        id: "accountId",
        email: "emailAddress",
        username: "name",
        name: "displayName",
        avatar: "avatarUrls.48x48",
      },
    },
  },
};

registerTool("jira", jiraTool); // Self-register in registry on import
export default jiraTool;
