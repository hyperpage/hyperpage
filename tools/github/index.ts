import React from "react";
import { Github } from "lucide-react";
import { Tool, ToolConfig, TransformedIssue } from "../tool-types";
import {
  GitHubSearchItem,
  GitHubRepository,
  GitHubWorkflowRun,
  GitHubEvent,
} from "./types";
import { registerTool } from "../registry";
import { getTimeAgo } from "../../lib/time-utils";

export const githubTool: Tool = {
  name: "GitHub",
  slug: "github",
  enabled: process.env.ENABLE_GITHUB === "true",
  ui: {
    color: "bg-purple-500/10 border-purple-400/30 text-purple-400",
    icon: React.createElement(Github, { className: "w-5 h-5" }),
  },
  widgets: [],
  capabilities: ["pull-requests", "workflows", "activity", "issues"], // Declares what this tool can provide
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
    activity: {
      method: "GET",
      description: "Get recent GitHub activity events",
      response: {
        dataKey: "activity",
        description: "Array of recent GitHub activity events",
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
      const reposUrl = `${apiUrl}/user/repos?type=owner&sort=pushed&per_page=10`;

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
    activity: async (request: Request, config: ToolConfig) => {
      const apiUrl = config.formatApiUrl?.("https://github.com");
      const token = process.env.GITHUB_TOKEN;

      if (!token) {
        throw new Error("GitHub API token not configured");
      }

      // Get user public events from GitHub API
      const username = process.env.GITHUB_USERNAME;
      if (!username) {
        throw new Error("GitHub username not configured (GITHUB_USERNAME)");
      }
      const eventsUrl = `${apiUrl}/users/${username}/events/public?per_page=50`;

      const response = await fetch(eventsUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }

      const events: GitHubEvent[] = await response.json();

      // Transform GitHub events to activity feed format with safe property access
      const activityEvents: unknown[] = [];
      let count = 0;

      for (const event of events) {
        if (count >= 10) break; // Limit to 10 events

        const eventTime = new Date(event.created_at);
        const timeAgo = getTimeAgo(eventTime);
        const repository = `${event.repo.name}`;

        switch (event.type) {
          case "PushEvent":
            const pushPayload = event.payload as {
              ref?: string;
              commits?: unknown[];
              size?: number;
            };
            const branch =
              typeof pushPayload.ref === "string"
                ? pushPayload.ref.split("/").pop()
                : "unknown";

            const pushCommits = Array.isArray(pushPayload.commits) ? pushPayload.commits : [];
            const commitMessages: Array<{ type: 'commit'; text: string; author?: string; timestamp?: string }> = [];

            if (pushCommits.length > 0) {
              // Use the actual commits from the push event (limit to first 3)
              pushCommits.slice(0, 3).forEach((pushCommit: any) => {
                const shortSha = pushCommit.sha?.substring(0, 7) || 'unknown';
                const message = pushCommit.message || `Commit ${shortSha}`;
                const truncatedMessage = message.length > 150 ? message.substring(0, 150) + '...' : message;

                commitMessages.push({
                  type: 'commit',
                  text: truncatedMessage,
                  author: pushCommit.author?.name || event.actor.login,
                  timestamp: eventTime.toISOString()
                });
              });
            } else {
              try {
                const repoName = event.repo.name;
                const [owner, repo] = repoName.split('/');
                const before = (pushPayload as any).before;
                const head = (pushPayload as any).head;

                if (before && head) {
                  const compareUrl = `${apiUrl}/repos/${owner}/${repo}/compare/${before}...${head}`;

                  const compareResponse = await fetch(compareUrl, {
                    method: "GET",
                    headers: {
                      Authorization: `Bearer ${token}`,
                      Accept: "application/vnd.github.v3+json",
                    },
                  });

                  if (compareResponse.ok) {
                    const compareData = await compareResponse.json();
                    const commits = compareData.commits || [];

                    commits.slice(0, 3).forEach((commit: any) => {
                      const shortSha = commit.sha?.substring(0, 7) || 'unknown';
                      const message = commit.commit?.message || `Commit ${shortSha}`;
                      const truncatedMessage = message.length > 150 ? message.substring(0, 150) + '...' : message;

                      commitMessages.push({
                        type: 'commit',
                        text: truncatedMessage,
                        author: commit.commit?.author?.name || commit.commit?.committer?.name || commit.author?.login || event.actor.login,
                        timestamp: commit.commit?.committer?.date || eventTime.toISOString()
                      });
                    });
                  }
                }

                if (commitMessages.length === 0) {
                  commitMessages.push({
                    type: 'commit',
                    text: `Code push to ${repository}/${branch}`,
                    author: event.actor.login,
                    timestamp: eventTime.toISOString()
                  });
                }
              } catch (error) {
                console.warn(`Failed to fetch push comparison for ${repository}:`, error);
                commitMessages.push({
                  type: 'commit',
                  text: `GitHub push to ${branch}`,
                  author: event.actor.login,
                  timestamp: eventTime.toISOString()
                });
              }
            }

            // Use actual fetched commit count instead of unreliable pushPayload.size
            const commitCount = commitMessages.length;

            activityEvents.push({
              id: event.id,
              tool: "GitHub",
              toolIcon: "github",
              action: "Code pushed",
              description: `Pushed to ${branch}`,
              author: event.actor.login,
              time: timeAgo,
              color: "purple",
              timestamp: eventTime.toISOString(),
              repository,
              branch,
              commitCount,
              content: commitMessages.length > 0 ? commitMessages : undefined,
            });
            count++;
            break;

          default:
            // Generic event handling for other cases
            activityEvents.push({
              id: event.id,
              tool: "GitHub",
              toolIcon: "github",
              action: event.type.replace("Event", ""),
              description: `Activity in ${repository}`,
              author: event.actor.login,
              time: timeAgo,
              color: "purple",
              timestamp: eventTime.toISOString(),
              repository,
            });
            count++;
            break;
        }
      }

      return { activity: activityEvents };
    },
  },
  config: {
    formatApiUrl: () => "https://api.github.com", // GitHub's special case - fixed API URL
    getWebUrl: () => "https://github.com", // Default GitHub web URL
    headers: {
      // Headers will be set dynamically in handlers
    },
  },
};

registerTool("github", githubTool); // Self-register in registry on import
export default githubTool;
