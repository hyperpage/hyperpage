import React from "react";
import { Github } from "lucide-react";
import { Tool, ToolConfig, TransformedIssue } from "../tool-types";
import { CommitContentItem } from "../tool-types";
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
    activity: async (request: Request, config: ToolConfig) => {
      const activityEvents: unknown[] = [];
      const apiUrl = config.formatApiUrl?.("https://github.com");
      const token = process.env.GITHUB_TOKEN;

      if (!token) {
        throw new Error("GitHub API token not configured");
      }

      // FIRST: Fetch recent PRs and issues and convert them to activity events
      // This provides the navigation links that the repository events API may not have
      try {
        // Get recent PRs
        const prHandler = githubTool.handlers["pull-requests"];
        const prResult = await prHandler!(request, config);
        const prs = prResult.pullRequests as any[];

        for (const pr of prs.slice(0, 3)) { // Limit to 3 recent PRs
          const prCreatedTime = new Date(pr.created);
          const prTimeAgo = getTimeAgo(prCreatedTime);

          activityEvents.push({
            id: `pr_${pr.id}`,
            tool: "GitHub",
            toolIcon: "github",
            action: "Pull request opened",
            description: pr.title,
            author: "Current User",
            time: prTimeAgo,
            color: "purple",
            timestamp: pr.created,
            repository: pr.repository,
            url: pr.url,
            displayId: pr.id,
            status: pr.status,
            type: "pull-request"
          });
        }

        // Get recent issues
        const issuesHandler = githubTool.handlers["issues"];
        const issuesResult = await issuesHandler!(request, config);
        const issues = issuesResult.issues as any[];

        for (const issue of issues.slice(0, 3)) { // Limit to 3 recent issues
          const issueCreatedTime = new Date(issue.created);
          const issueTimeAgo = getTimeAgo(issueCreatedTime);

          activityEvents.push({
            id: `issue_${issue.ticket}`,
            tool: "GitHub",
            toolIcon: "github",
            action: "Issue opened",
            description: issue.title,
            author: "Current User",
            time: issueTimeAgo,
            color: "purple",
            timestamp: issue.created,
            repository: "N/A", // Issues search API doesn't provide repository
            url: issue.url,
            displayId: issue.ticket,
            status: issue.status,
            type: "issue"
          });
        }
      } catch (error) {
        console.warn("Failed to fetch PRs/issues for activity feed:", error);
      }

      // SECOND: Get recently active repositories and query their events
      // This provides much faster updates than user public events
      try {
        const username = process.env.GITHUB_USERNAME;
        if (!username) {
          throw new Error("GitHub username not configured (GITHUB_USERNAME)");
        }

        // First, get user's repositories sorted by most recently pushed
        // This gives us repositories they've recently worked on
        const reposUrl = `${apiUrl}/user/repos?affiliation=owner,collaborator,organization_member&sort=pushed&direction=desc&per_page=10`;

        const reposResponse = await fetch(reposUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        });

        if (!reposResponse.ok) {
          throw new Error(`Failed to fetch repositories: ${reposResponse.status}`);
        }

        const repositories: GitHubRepository[] = await reposResponse.json();

        // Query events for each repository (limit to top 5 most recently active)
        const recentRepos = repositories.slice(0, 5);
        const repoEventsPromises = recentRepos.map(async (repo: GitHubRepository) => {
          try {
            const eventsUrl = `${apiUrl}/repos/${repo.owner.login}/${repo.name}/events?per_page=20`;

            const eventsResponse = await fetch(eventsUrl, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
              },
            });

            if (eventsResponse.ok) {
              const events: GitHubEvent[] = await eventsResponse.json();
              return events;
            } else {
              console.warn(`Failed to fetch events for ${repo.owner.login}/${repo.name}: ${eventsResponse.status}`);
              return [];
            }
          } catch (error) {
            console.warn(`Error fetching events for ${repo.owner.login}/${repo.name}:`, error);
            return [];
          }
        });

        const repoEventsArrays = await Promise.all(repoEventsPromises);
        const allRepoEvents = repoEventsArrays.flat();

        // Deduplicate events by ID (since same event might appear in multiple repos)
        const seenEventIds = new Set<string>();
        const deduplicatedEvents = allRepoEvents.filter(event => {
          if (seenEventIds.has(event.id)) {
            return false;
          }
          seenEventIds.add(event.id);
          return true;
        });

        // Transform repository events to activity feed format
        let pushEventCount = 0;
        const maxPushEvents = 8; // Allow more push events since we're getting from specific repos

        for (const event of deduplicatedEvents) {
          const eventTime = new Date(event.created_at);
          const timeAgo = getTimeAgo(eventTime);
          const repository = `${event.repo.name}`;

          switch (event.type) {
            case "PushEvent":
              if (pushEventCount >= maxPushEvents) continue;

              const pushPayload = event.payload as {
                ref?: string;
                commits?: unknown[];
                before?: string;
                head?: string;
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
                  const fullSha = pushCommit.sha;
                  const shortSha = fullSha?.substring(0, 7) || 'unknown';
                  const message = pushCommit.message || `Commit ${shortSha}`;
                  const truncatedMessage = message.length > 150 ? message.substring(0, 150) + '...' : message;

                  commitMessages.push({
                    type: 'commit',
                    text: truncatedMessage,
                    url: fullSha ? `https://github.com/${repository}/commit/${fullSha}` : undefined,
                    displayId: shortSha !== 'unknown' ? shortSha : undefined,
                    author: pushCommit.author?.name || event.actor.login,
                    timestamp: eventTime.toISOString()
                  } as CommitContentItem);
                });
              } else if (pushPayload.before && pushPayload.head) {
                try {
                  const [owner, repo] = repository.split('/');
                  const compareUrl = `${apiUrl}/repos/${owner}/${repo}/compare/${pushPayload.before}...${pushPayload.head}`;

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
                      const fullSha = commit.sha;
                      const shortSha = fullSha?.substring(0, 7) || 'unknown';
                      const message = commit.commit?.message || `Commit ${shortSha}`;
                      const truncatedMessage = message.length > 150 ? message.substring(0, 150) + '...' : message;

                      commitMessages.push({
                        type: 'commit',
                        text: truncatedMessage,
                        url: fullSha ? `https://github.com/${repository}/commit/${fullSha}` : undefined,
                        displayId: shortSha !== 'unknown' ? shortSha : undefined,
                        author: commit.commit?.author?.name || commit.commit?.committer?.name || commit.author?.login || event.actor.login,
                        timestamp: commit.commit?.committer?.date || eventTime.toISOString()
                      } as CommitContentItem);
                    });
                  }
                } catch (error) {
                  console.warn(`Failed to fetch push comparison for ${repository}:`, error);
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
                url: "",
                displayId: "",
                content: commitMessages.length > 0 ? commitMessages : undefined,
              });
              pushEventCount++;
              break;

            case "PullRequestEvent":
              // Handle PR events with proper links
              const prPayload = event.payload as { action?: string; pull_request?: any };
              if (prPayload.pull_request) {
                const pr = prPayload.pull_request;
                activityEvents.push({
                  id: event.id,
                  tool: "GitHub",
                  toolIcon: "github",
                  action: `Pull request ${prPayload.action}`,
                  description: pr.title || "Pull request activity",
                  author: event.actor.login,
                  time: timeAgo,
                  color: "purple",
                  timestamp: eventTime.toISOString(),
                  repository,
                  url: pr.html_url,
                  displayId: `#${pr.number}`,
                  status: pr.state,
                  type: "pull-request"
                });
              }
              break;

            case "IssuesEvent":
              // Handle issue events
              const issuePayload = event.payload as { action?: string; issue?: any };
              if (issuePayload.issue) {
                const issue = issuePayload.issue;
                activityEvents.push({
                  id: event.id,
                  tool: "GitHub",
                  toolIcon: "github",
                  action: `Issue ${issuePayload.action}`,
                  description: issue.title || "Issue activity",
                  author: event.actor.login,
                  time: timeAgo,
                  color: "purple",
                  timestamp: eventTime.toISOString(),
                  repository,
                  url: issue.html_url,
                  displayId: `#${issue.number}`,
                  status: issue.state,
                  type: "issue"
                });
              }
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
              break;
          }
        }

      } catch (error) {
        console.warn("Failed to fetch repository events:", error);
        // Fall back to user public events if repository events fail
        try {
          const username = process.env.GITHUB_USERNAME;
          if (username) {
            const fallbackUrl = `${apiUrl}/users/${username}/events/public?per_page=15`;
            const fallbackResponse = await fetch(fallbackUrl, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
              },
            });

            if (fallbackResponse.ok) {
              const events: GitHubEvent[] = await fallbackResponse.json();

              for (const event of events.slice(0, 3)) { // Limited fallback
                const eventTime = new Date(event.created_at);
                const timeAgo = getTimeAgo(eventTime);
                const repository = `${event.repo.name}`;

                if (event.type === "PushEvent") {
                  activityEvents.push({
                    id: event.id,
                    tool: "GitHub",
                    toolIcon: "github",
                    action: "Code pushed",
                    description: "GitHub activity (fallback)",
                    author: event.actor.login,
                    time: timeAgo,
                    color: "purple",
                    timestamp: eventTime.toISOString(),
                    repository,
                  });
                }
              }
            }
          }
        } catch (fallbackError) {
          console.warn("Fallback to user events also failed:", fallbackError);
        }
      }

      // Sort all activities by timestamp (most recent first)
      activityEvents.sort((a: any, b: any) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      // Limit to 15 total activities to keep feed manageable
      return { activity: activityEvents.slice(0, 15) };
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
