import React from "react";
import { Github } from "lucide-react";
import { Tool, ToolConfig, TransformedIssue } from "../tool-types";
import {
  GitHubSearchItem,
  GitHubRepository,
  GitHubWorkflowRun,
} from "./types";
import { registerTool } from "../registry";

export const githubTool: Tool = {
  name: "GitHub",
  slug: "github",
  enabled: process.env.ENABLE_GITHUB === "true",
  ui: {
    color: "bg-purple-500/10 border-purple-400/30 text-purple-400",
    icon: React.createElement(Github, { className: "w-5 h-5" }),
  },
  widgets: [],
  capabilities: ["pull-requests", "workflows", "issues", "rate-limit"], // Declares what this tool can provide
  validation: {
    required: ['GITHUB_TOKEN'],
    optional: ['GITHUB_USERNAME'],
    description: 'GitHub integration requires a personal access token with repo and user scopes'
  },
  apis: {
    "pull-requests": {
      method: "GET",
      description: "Get user pull requests",
      parameters: {
        state: {
          type: "string",
          required: false,
          description: "Pull request state (open, closed, all)",
        },
        sort: {
          type: "string",
          required: false,
          description:
            "Sort order (created, updated, popularity, long-running)",
        },
      },
      response: {
        dataKey: "pullRequests",
        description:
          "Array of pull request objects with title, repository, status, and created date",
      },
    },
    workflows: {
      method: "GET",
      description: "Get recent GitHub Actions workflow runs",
      parameters: {
        status: {
          type: "string",
          required: false,
          description: "Workflow run status (completed, in_progress, queued)",
        },
        conclusion: {
          type: "string",
          required: false,
          description:
            "Workflow run conclusion (success, failure, neutral, cancelled, skipped, timed_out, action_required)",
        },
        per_page: {
          type: "number",
          required: false,
          description: "Number of results per page",
        },
      },
      response: {
        dataKey: "workflows",
        description:
          "Array of workflow run objects with repository, branch, status, conclusion, and timing",
      },
    },
    issues: {
      method: "GET",
      description: "Get GitHub issues",
      parameters: {
        state: {
          type: "string",
          required: false,
          description: "Issue state (open, closed, all)",
        },
        assignee: {
          type: "string",
          required: false,
          description: "Assignee filter (@me for current user)",
        },
      },
      response: {
        dataKey: "issues",
        description:
          "Array of issue objects with ticket, title, status, assignee, and URL",
      },
    },

    "rate-limit": {
      method: "GET",
      description: "Get current GitHub API rate limit status",
      response: {
        dataKey: "rateLimit",
        description: "Current rate limit status including core, search, graphql limits and reset times",
      },
    },
  },
  handlers: {
    "pull-requests": async (request: Request, config: ToolConfig) => {
      const results: unknown[] = [];

      // Fetch GitHub PRs if enabled
      const apiUrl = config.formatApiUrl?.("https://github.com"); // GitHub's fixed API URL (ignores webUrl param)
      const token = process.env.GITHUB_TOKEN;

      if (token) {
        // Use GitHub Search API to find open pull requests authored by the user
        const searchUrl = `${apiUrl}/search/issues?q=is:pr+author:@me+is:open&sort=created&order=desc&per_page=10`;

        const response = await fetch(searchUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        });

        if (response.ok) {
          const data = await response.json();

          // Transform GitHub pull requests to unified format
          const transformedPRs = (data.items as GitHubSearchItem[]).map(
            (item: GitHubSearchItem) => ({
              id: `#${item.number}`, // PR number like #123
              title: item.title,
              repository: item.repository_url.split("/").slice(-2).join("/"), // Extract owner/repo from URL
              status: item.state,
              tool: "GitHub",
              created: item.created_at,
              created_display: new Date(item.created_at).toLocaleDateString(),
              type: "pull-request",
              url: item.html_url, // Add GitHub PR URL
            }),
          );

          results.push(...transformedPRs);
        }
      }

      return { pullRequests: results };
    },
    workflows: async (request: Request, config: ToolConfig) => {
      const apiUrl = config.formatApiUrl?.("https://github.com");
      const token = process.env.GITHUB_TOKEN;

      if (!token) {
        throw new Error("GitHub API token not configured");
      }

      // First get user's repositories to fetch workflow runs from
      const reposUrl = `${apiUrl}/user/repos?affiliation=owner,collaborator,organization_member&sort=pushed&per_page=10`;

      const reposResponse = await fetch(reposUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!reposResponse.ok) {
        throw new Error(
          `GitHub repositories API error: ${reposResponse.status}`,
        );
      }

      const repos: GitHubRepository[] = await reposResponse.json();

      // Get workflow runs from user's recent repositories
      const workflowPromises = repos
        .slice(0, 5)
        .map(async (repo: GitHubRepository) => {
          const runsUrl = `${apiUrl}/repos/${repo.owner.login}/${repo.name}/actions/runs?per_page=3`;

          const runsResponse = await fetch(runsUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github.v3+json",
            },
          });

          if (runsResponse.ok) {
            const runsData = await runsResponse.json();
            return (runsData.workflow_runs as GitHubWorkflowRun[]).map(
              (run: GitHubWorkflowRun) => ({
                id: run.id,
                repository: `${repo.owner.login}/${repo.name}`,
                name: run.name,
                head_branch: run.head_branch,
                status: run.status,
                conclusion: run.conclusion,
                created_at: run.created_at,
                updated_at: run.updated_at,
                run_duration:
                  run.updated_at && run.created_at
                    ? (new Date(run.updated_at).getTime() -
                        new Date(run.created_at).getTime()) /
                      1000
                    : null,
                html_url: run.html_url,
              }),
            );
          }
          return [];
        });

      const workflowArrays = await Promise.all(workflowPromises);
      const allWorkflows = workflowArrays.flat();

      // Sort by most recent and take top 15
      allWorkflows.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      return { workflows: allWorkflows.slice(0, 15) };
    },
    issues: async (request: Request, config: ToolConfig) => {
      const results: TransformedIssue[] = [];

      // Fetch GitHub issues if enabled
      const apiUrl = config.formatApiUrl?.("https://github.com"); // GitHub's fixed API URL (ignores webUrl param)
      const token = process.env.GITHUB_TOKEN;

      if (token) {
        // Use GitHub Search API to find issues assigned to or created by the user
        const searchUrl = `${apiUrl}/search/issues?q=is:issue+author:@me+is:open&sort=created&order=desc&per_page=20`;

        const response = await fetch(searchUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        });

        if (response.ok) {
          const data = await response.json();

          // Transform GitHub issues to unified ticketing format
          const transformedIssues: TransformedIssue[] = (
            data.items as GitHubSearchItem[]
          ).map((item: GitHubSearchItem) => ({
            ticket: `#${item.number}`, // Issue number like #123
            url: item.html_url,
            title: item.title,
            status: item.state,
            assignee: "Unassigned", // GitHub search API doesn't include assignee info
            created: item.created_at,
            created_display: new Date(item.created_at).toLocaleDateString(),
            type: "issue",
          }));

          results.push(...transformedIssues);
        }
      }

      return { issues: results };
    },
    "rate-limit": async (request: Request, config: ToolConfig) => {
      const apiUrl = config.formatApiUrl?.("https://github.com");
      const token = process.env.GITHUB_TOKEN;

      if (!token) {
        throw new Error("GitHub API token not configured");
      }

      const rateLimitUrl = `${apiUrl}/rate_limit`;

      const response = await fetch(rateLimitUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub rate limit API error: ${response.status}`);
      }

      const rateLimitData = await response.json();
      return { rateLimit: rateLimitData };
    },
  },
  config: {
    formatApiUrl: () => "https://api.github.com", // GitHub's special case - fixed API URL
    getWebUrl: () => "https://github.com", // Default GitHub web URL
    headers: {
      // Headers will be set dynamically in handlers
    },
    rateLimit: {
      detectHeaders: (response: Response) => ({
        remaining: response.headers.get('X-RateLimit-Remaining') ? parseInt(response.headers.get('X-RateLimit-Remaining')!, 10) : null,
        resetTime: response.headers.get('X-RateLimit-Reset') ? parseInt(response.headers.get('X-RateLimit-Reset')!, 10) : null,
        retryAfter: null
      }),
      shouldRetry: (response: Response, attemptNumber: number) => {
        // Handle 429 (Too Many Requests) responses
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const baseDelay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000;
          return baseDelay * Math.pow(2, attemptNumber); // Exponential backoff
        }

        // Proactive GitHub rate limit avoidance
        const remaining = response.headers.get('X-RateLimit-Remaining');
        if (remaining !== null) {
          const remainingCount = parseInt(remaining, 10);
          const resetTime = response.headers.get('X-RateLimit-Reset');

          if (remainingCount <= 1 && resetTime) {
            // Wait until reset time
            const resetTimestamp = parseInt(resetTime, 10) * 1000;
            return Math.max(resetTimestamp - Date.now(), 1000);
          }
        }

        return null; // No retry needed
      },
      maxRetries: 3,
      backoffStrategy: 'exponential'
    },
  },
};

registerTool("github", githubTool); // Self-register in registry on import
export default githubTool;
