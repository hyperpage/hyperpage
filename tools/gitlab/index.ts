import React from "react";
import { Gitlab } from "lucide-react";
import { Tool, ToolConfig, TransformedIssue } from "../tool-types";
import {
  GitLabMergeRequest,
  GitLabProject,
  GitLabPipeline,
  GitLabIssue,
  GitLabEvent,
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
  capabilities: ["merge-requests", "pipelines", "activity", "issues"], // Declares what this tool can provide
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
    activity: {
      method: "GET",
      description: "Get recent GitLab activity events",
      response: {
        dataKey: "activity",
        description: "Array of recent GitLab activity events",
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
    activity: async (request: Request, config: ToolConfig) => {
      // Use tool-owned logic to format URLs
      const webUrl = config.getWebUrl?.() || "https://gitlab.com";
      const apiUrl =
        config.formatApiUrl?.(webUrl) || "https://gitlab.com/api/v4";
      const token = process.env.GITLAB_TOKEN;

      if (!token) {
        throw new Error("GitLab API token not configured");
      }

      // Get user events from GitLab API (all events, not just pushes)
      const eventsUrl = `${apiUrl}/events?per_page=20`;

      const response = await fetch(eventsUrl, {
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

      const events: GitLabEvent[] = await response.json();

      // GitLab /events API doesn't include project_path, so we need to fetch project details
      // Create a map of project_id -> project details to avoid multiple API calls
      const projectCache = new Map<number, string>();

      const fetchProjectPath = async (projectId: number): Promise<string> => {
        if (projectCache.has(projectId)) {
          return projectCache.get(projectId)!;
        }

        try {
          const projectUrl = `${apiUrl}/projects/${projectId}`;
          const projectResponse = await fetch(projectUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          if (projectResponse.ok) {
            const project = await projectResponse.json();
            const path = project.path_with_namespace || `Project ${projectId}`;
            projectCache.set(projectId, path);
            return path;
          }
        } catch (error) {
          console.warn(`Failed to fetch project ${projectId}:`, error);
        }

        const fallback = `Project ${projectId}`;
        projectCache.set(projectId, fallback);
        return fallback;
      };

      // Helper function to create GitLab push events (no hyperlinks due to URL limitations)
      const createPushEvent = async (
        event: GitLabEvent,
        index: number,
        eventTime: Date,
        timeAgo: string,
      ) => {
        const branchName = event.push_data?.ref?.split("/").pop() || "unknown";
        const commitCount = event.push_data?.commit_count || 0;

        // Get project name from the event data
        let project = event.project_path;
        if (!project && event.project_id) {
          project = await fetchProjectPath(event.project_id);
        }
        project = project || "unknown";

        return {
          id: `${event.id}_${index}`,
          tool: "GitLab",
          toolIcon: "🦊",
          action: "Code pushed",
          description: `Pushed to ${branchName} (${commitCount} commits)`,
          author: event.author?.name || event.author_username || "Unknown",
          time: timeAgo,
          color: "orange",
          timestamp: eventTime.toISOString(),
          repository: project,
          branch: branchName,
          commitCount,
        };
      };

      // Helper function to create MR/Issue events
      const createTargetEvent = async (
        event: GitLabEvent,
        index: number,
        eventTime: Date,
        timeAgo: string,
        action: string,
        targetType: string,
      ) => {
        const isMR = event.target_type === "MergeRequest";
        const isIssue =
          event.target_type === "Issue" || event.target_type === "WorkItem"; // WorkItem might be GitLab's term for issues

        let displayId: string;
        if (isMR) {
          displayId = `!${event.target_iid}`;
        } else if (isIssue) {
          displayId = `#${event.target_iid}`;
        } else {
          displayId = "";
        }

        // Get project info for context
        let project = event.project_path || "unknown";
        if (!isNaN(Number(project)) && event.project_id) {
          project = `Project ${event.project_id}`;
        }

        // Construct URL if target_url is missing (common issue with GitLab events API)
        let url = event.target_url;
        if (!url && event.project_path && event.target_iid) {
          const webUrl = config.getWebUrl?.() || "https://gitlab.com";
          if (isMR) {
            url = `${webUrl}/${event.project_path}/-/merge_requests/${event.target_iid}`;
          } else if (isIssue) {
            url = `${webUrl}/${event.project_path}/-/issues/${event.target_iid}`;
          }
        }

        // For MRs and Issues, we'll need to fetch assignee and label info separately
        // For now, include basic info - can be enhanced later with individual API calls
        return {
          id: `${event.id}_${index}`,
          tool: "GitLab",
          toolIcon: "🦊",
          action: `${targetType} ${action}`,
          description:
            event.target_title || `Unnamed ${targetType.toLowerCase()}`,
          author: event.author?.name || event.author_username || "Unknown",
          time: timeAgo,
          color: "orange",
          timestamp: eventTime.toISOString(),
          repository: project,
          url: url || undefined,
          displayId: displayId || undefined,
          status:
            action === "closed"
              ? "closed"
              : action === "opened"
                ? "opened"
                : action === "merged"
                  ? "merged"
                  : "unknown",
        };
      };

      // Transform GitLab events to activity feed format
      // Since we need to make async calls to fetch project paths, we'll use Promise.all
      const activityPromises = events
        .slice(0, 10)
        .map(async (event: GitLabEvent, index: number) => {
          const eventTime = new Date(event.created_at);
          const timeAgo = getTimeAgo(eventTime);

          // Fetch project path if it's missing
          let projectPath = event.project_path;
          if (!projectPath && event.project_id) {
            projectPath = await fetchProjectPath(event.project_id);
          }

          // Update the event object with the fetched project path
          const enrichedEvent = { ...event, project_path: projectPath };

          switch (event.action_name) {
            case "pushed":
              return createPushEvent(enrichedEvent, index, eventTime, timeAgo);

            case "opened":
            case "closed":
            case "reopened":
            case "updated":
              if (event.target_type === "MergeRequest") {
                return await createTargetEvent(
                  enrichedEvent,
                  index,
                  eventTime,
                  timeAgo,
                  event.action_name,
                  "Merge request",
                );
              } else if (
                event.target_type === "Issue" ||
                event.target_type === "WorkItem"
              ) {
                // WorkItem is GitLab's internal issue type
                return await createTargetEvent(
                  enrichedEvent,
                  index,
                  eventTime,
                  timeAgo,
                  event.action_name,
                  "Issue",
                );
              }
              break;

            case "approved":
              if (event.target_type === "MergeRequest") {
                return await createTargetEvent(
                  enrichedEvent,
                  index,
                  eventTime,
                  timeAgo,
                  "approved",
                  "Merge request",
                );
              }
              break;

            case "merged":
              if (event.target_type === "MergeRequest") {
                return await createTargetEvent(
                  enrichedEvent,
                  index,
                  eventTime,
                  timeAgo,
                  "merged",
                  "Merge request",
                );
              }
              break;

            default:
              // Generic event with no special handling
              let project = enrichedEvent.project_path || "unknown";
              if (!isNaN(Number(project)) && event.project_id) {
                project = `Project ${event.project_id}`;
              }

              return {
                id: `${event.id}_${index}`,
                tool: "GitLab",
                toolIcon: "🦊",
                action: event.action_name || "Activity",
                description: event.target_title || "General activity",
                author:
                  event.author?.name || event.author_username || "Unknown",
                time: timeAgo,
                color: "orange",
                timestamp: eventTime.toISOString(),
                repository: project,
              };
          }
          return null;
        });

      const activityEvents = (await Promise.all(activityPromises)).filter(
        Boolean,
      );

      // If no events, return empty array
      if (activityEvents.length === 0) {
        return { activity: [] };
      }

      return { activity: activityEvents };
    },
  },
  config: {
    formatApiUrl: (webUrl: string) => `${webUrl}/api/v4`, // GitLab's URL formatting logic
    getWebUrl: () => process.env.GITLAB_WEB_URL || "https://gitlab.com", // Default web URL
    headers: {
      // Headers will be set dynamically in handlers
    },
  },
};

registerTool("gitlab", gitlabTool); // Self-register in registry on import
export default gitlabTool;
