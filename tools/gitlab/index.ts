import React from "react";
import { Gitlab } from "lucide-react";
import { Tool, ToolConfig, TransformedIssue } from "../tool-types";
import {
  GitLabMergeRequest,
  GitLabProject,
  GitLabPipeline,
  GitLabIssue,
  GitLabEvent,
  GitLabComparisonCommit,
} from "./types";
import { registerTool } from "../registry";
import { getTimeAgo } from "../../lib/time-utils";

export const gitlabTool: Tool = {
  name: "GitLab",
  slug: "gitlab",
  enabled: process.env.ENABLE_GITLAB === "true",
  ui: {
    color: "bg-orange-500/10 border-orange-400/30 text-orange-400",
    icon: React.createElement(Gitlab, { className: "w-5 h-5" }),
  },
  widgets: [],
  capabilities: ["merge-requests", "pipelines", "issues", "rate-limit"], // Declares what this tool can provide
  validation: {
    required: ['GITLAB_WEB_URL', 'GITLAB_TOKEN'],
    optional: [],
    description: 'GitLab integration requires instance URL and personal access token'
  },
  apis: {
    "merge-requests": {
      method: "GET",
      description: "Get user merge requests",
      parameters: {
        state: {
          type: "string",
          required: false,
          description: "Merge request state (opened, closed, merged, all)",
        },
        scope: {
          type: "string",
          required: false,
          description: "Scope (created_by_me, assigned_to_me, all)",
        },
      },
      response: {
        dataKey: "mergeRequests",
        description:
          "Array of merge request objects with title, project, status, author, and created date",
      },
    },
    pipelines: {
      method: "GET",
      description: "Get recent pipelines from user projects",
      parameters: {
        status: {
          type: "string",
          required: false,
          description:
            "Pipeline status (running, pending, success, failed, canceled, skipped)",
        },
        ref: {
          type: "string",
          required: false,
          description: "Pipeline ref (branch name)",
        },
      },
      response: {
        dataKey: "pipelines",
        description:
          "Array of pipeline objects with project, branch, status, duration, and finished date",
      },
    },

    "rate-limit": {
      method: "GET",
      description: "Get current GitLab API rate limit status",
      response: {
        dataKey: "rateLimit",
        description: "Current rate limit status for GitLab instance (based on Retry-After headers)",
      },
    },
  },
  handlers: {
    "merge-requests": async (request: Request, config: ToolConfig) => {
      // Use tool-owned logic to format URLs
      const webUrl = config.getWebUrl?.() || "https://gitlab.com";
      const apiUrl =
        config.formatApiUrl?.(webUrl) || "https://gitlab.com/api/v4";
      const token = process.env.GITLAB_TOKEN;

      if (!token) {
        throw new Error("GitLab API token not configured");
      }

      const url = new URL(`${apiUrl}/merge_requests`);
      url.searchParams.set("scope", "created_by_me");
      url.searchParams.set("state", "opened");
      url.searchParams.set("per_page", "10");

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitLab API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Transform GitLab merge requests to dashboard format
      const transformedMRs = (data as GitLabMergeRequest[]).map((mr) => ({
        id: `!${mr.iid}`, // MR number like !456
        title: mr.title,
        project: `${mr.project_id}`, // In real impl, we'd fetch project name
        status: mr.state,
        author: mr.author?.name || "Unknown",
        created: new Date(mr.created_at).toLocaleDateString(),
        url: mr.web_url, // GitLab provides web_url directly
      }));

      return { mergeRequests: transformedMRs };
    },
    pipelines: async (request: Request, config: ToolConfig) => {
      // Use tool-owned logic to format URLs
      const webUrl = config.getWebUrl?.() || "https://gitlab.com";
      const apiUrl =
        config.formatApiUrl?.(webUrl) || "https://gitlab.com/api/v4";
      const token = process.env.GITLAB_TOKEN;

      if (!token) {
        throw new Error("GitLab API token not configured");
      }

      // First get user's projects
      const projectsUrl = `${apiUrl}/projects?membership=true&per_page=10`;
      const projectsResponse = await fetch(projectsUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const projects: GitLabProject[] = await projectsResponse.json();

      // Get pipelines from user's recent projects
      const pipelinesPromises = projects
        .slice(0, 5)
        .map(async (project: GitLabProject) => {
          const pipelinesUrl = `${apiUrl}/projects/${project.id}/pipelines?per_page=3`;
          const pipelinesResponse = await fetch(pipelinesUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          if (pipelinesResponse.ok) {
            const pipelines: GitLabPipeline[] = await pipelinesResponse.json();
            return pipelines.map((pipeline: GitLabPipeline) => ({
              project: project.name,
              branch: pipeline.ref,
              status: pipeline.status,
              duration: pipeline.duration
                ? `${Math.round(pipeline.duration)}s`
                : "N/A",
              finished_at: pipeline.finished_at
                ? new Date(pipeline.finished_at).toLocaleDateString()
                : "Running",
            }));
          }
          return [];
        });

      const pipelinesArrays = await Promise.all(pipelinesPromises);
      const allPipelines = pipelinesArrays.flat();

      return { pipelines: allPipelines.slice(0, 10) }; // Limit to 10 most recent
    },
    issues: async (request: Request, config: ToolConfig) => {
      const results: TransformedIssue[] = [];

      // Fetch GitLab issues if enabled
      const webUrl = config.getWebUrl?.() || "https://gitlab.com";
      const apiUrl =
        config.formatApiUrl?.(webUrl) || "https://gitlab.com/api/v4";
      const token = process.env.GITLAB_TOKEN;

      if (!token) {
        throw new Error("GitLab API token not configured");
      }

      try {
        // Try alternative approaches since membership API fails

        // Approach 1: Try user-created issues endpoint

        // Get user info first to get user ID
        const userUrl = `${apiUrl}/user`;
        const userResponse = await fetch(userUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!userResponse.ok) {
          console.warn(
            "Could not fetch GitLab user info, falling back to empty issues array",
          );
          return { issues: results };
        }

        const userData = await userResponse.json();

        // Approach 2: Get issues created by the authenticated user
        const issuesUrl = `${apiUrl}/issues?author_id=${userData.id}&state=opened&order_by=created_at&sort=desc&per_page=20`;

        const issuesResponse = await fetch(issuesUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!issuesResponse.ok) {
          const errorText = await issuesResponse.text();
          console.warn(
            `GitLab user issues API error: ${issuesResponse.status} - ${errorText}`,
          );
          console.warn("Failed to get user issues, returning empty array");
          return { issues: results }; // Return empty array instead of throwing
        }

        const issues: GitLabIssue[] = await issuesResponse.json();

        // Transform GitLab issues to unified ticketing format
        const transformedIssues: TransformedIssue[] = issues.map(
          (issue: GitLabIssue) => ({
            ticket: `#${issue.iid}`, // Issue number like #789
            url: issue.web_url,
            title: issue.title,
            status: issue.state,
            assignee: issue.assignee?.name || "Unassigned",
            created: issue.created_at,
            created_display: new Date(issue.created_at).toLocaleDateString(),
            type: "issue",
          }),
        );

        // Sort by most recent
        transformedIssues.sort(
          (a: TransformedIssue, b: TransformedIssue) =>
            new Date(b.created).getTime() - new Date(a.created).getTime(),
        );

        results.push(...transformedIssues.slice(0, 15)); // Limit to prevent overwhelming
      } catch (error) {
        console.warn("Error fetching GitLab issues:", error);
        // Return empty array instead of throwing to avoid breaking the dashboard
      }

      return { issues: results };
    },

    "rate-limit": async (request: Request, config: ToolConfig) => {
      // GitLab doesn't have a dedicated rate limit API like GitHub
      // We'll make a test request to the user endpoint to check connectivity and basic rate limiting
      const webUrl = config.getWebUrl?.() || "https://gitlab.com";
      const apiUrl =
        config.formatApiUrl?.(webUrl) || "https://gitlab.com/api/v4";
      const token = process.env.GITLAB_TOKEN;

      if (!token) {
        throw new Error("GitLab API token not configured");
      }

      const userUrl = `${apiUrl}/user`; // Simple endpoint to test API connectivity

      const response = await fetch(userUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      // Return basic rate limit information for GitLab
      // Since GitLab doesn't expose actual rate limits via API, we report status based on response codes
      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited response - report as high usage
          return {
            rateLimit: {
              message: "GitLab API rate limit exceeded",
              statusCode: response.status,
              retryAfter: response.headers.get('Retry-After')
            }
          };
        }

        // Other error - might be authentication or server issue
        throw new Error(`GITLAB user API error: ${response.status}`);
      }

      // Success - return basic status information
      return {
        rateLimit: {
          message: "GitLab API accessible - rate limiting status unknown (not exposed by API)",
          statusCode: response.status,
          serverInfo: "GitLab API connection confirmed"
        }
      };
    },
  },
  config: {
    formatApiUrl: (webUrl: string) => `${webUrl}/api/v4`, // GitLab's URL formatting logic
    getWebUrl: () => process.env.GITLAB_WEB_URL || "https://gitlab.com", // Default web URL
    headers: {
      // Headers will be set dynamically in handlers
    },
    rateLimit: {
      detectHeaders: (response: Response) => ({
        remaining: null, // GitLab doesn't provide remaining count headers
        resetTime: null, // GitLab doesn't provide reset time headers
        retryAfter: response.headers.get('Retry-After') ? parseInt(response.headers.get('Retry-After')!, 10) : null
      }),
      shouldRetry: (response: Response, attemptNumber: number) => {
        // Handle 429 (Too Many Requests) responses with Retry-After header
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          if (retryAfter) {
            // Honor GitLab's requested wait time from Retry-After header
            const retryAfterSeconds = parseInt(retryAfter, 10);
            return retryAfterSeconds * 1000; // Convert to milliseconds
          }
          // Fallback to exponential backoff if no Retry-After header
          const baseDelay = 1000; // 1 second base
          return baseDelay * Math.pow(2, attemptNumber);
        }

        return null; // No retry needed
      },
      maxRetries: 5, // GitLab can have more retries due to tier variability
      backoffStrategy: 'exponential'
    },
  },
};

registerTool("gitlab", gitlabTool); // Self-register in registry on import
export default gitlabTool;
