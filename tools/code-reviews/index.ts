import React from "react";
import { GitBranch } from "lucide-react";
import { Tool, ToolConfig } from "../tool-types";
import { registerTool } from "../registry";

// Import capability-based tool discovery
import { getEnabledToolsByCapability } from "../index";

export const codeReviewsTool: Tool = {
  name: "Code Reviews",
  slug: "code-reviews",
  enabled: process.env.ENABLE_CODE_REVIEWS === "true",
  ui: {
    color: "bg-indigo-500/10 border-indigo-400/30 text-indigo-400",
    icon: React.createElement(GitBranch, { className: "w-5 h-5" }),
  },
  widgets: [
    {
      title: "Code Reviews",
      type: "table",
      headers: ["ID", "Title", "Repository", "Status", "Tool"],
      data: [], // Data will be loaded asynchronously
      dynamic: true, // Indicate this widget needs dynamic data loading
      refreshInterval: 600000, // 10 minutes refresh interval (longer since it's aggregated data)
      displayName: "Combined", // Show "Combined" instead of individual tool names
    },
  ],
  apis: {
    "pull-requests": {
      method: "GET",
      description:
        "Get pull requests and merge requests from all enabled git tools",
      response: {
        dataKey: "pullRequests",
        description:
          "Array of pull request/merge request objects from all enabled git tools",
      },
    },
  },
  handlers: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    "pull-requests": async (request: Request, _config: ToolConfig) => {
      const results: unknown[] = [];

      // Get all enabled tools that provide pull-requests capability (GitHub)
      const pullRequestTools = getEnabledToolsByCapability("pull-requests");

      // Get all enabled tools that provide merge-requests capability (GitLab)
      const mergeRequestTools = getEnabledToolsByCapability("merge-requests");

      // Combine all Git tools
      const gitTools = [...pullRequestTools, ...mergeRequestTools];

      // Aggregate pull requests from all supported git tools
      for (const tool of gitTools) {
        if (tool.capabilities?.includes("pull-requests")) {
          // This is a GitHub-style tool (provides pull-requests)
          try {
            const result = await tool.handlers["pull-requests"](
              request,
              tool.config || {},
            );
            if (result.pullRequests && Array.isArray(result.pullRequests)) {
              results.push(...result.pullRequests);
            }
          } catch (error) {
            console.warn(
              `Failed to fetch pull requests from ${tool.name}:`,
              error,
            );
          }
        } else if (tool.capabilities?.includes("merge-requests")) {
          // This is a GitLab-style tool (provides merge-requests)
          try {
            const result = await tool.handlers["merge-requests"](
              request,
              tool.config || {},
            );
            if (result.mergeRequests && Array.isArray(result.mergeRequests)) {
              // Transform merge requests to unified pull request format
              const mergeRequests = result.mergeRequests as unknown[];
              const transformedMRs = mergeRequests.map((mr) => ({
                id: (mr as Record<string, unknown>).id, // Include PR/MR identifier
                title: (mr as Record<string, unknown>).title,
                repository:
                  (mr as Record<string, unknown>).project ||
                  (mr as Record<string, unknown>).repository ||
                  "Unknown",
                status: (mr as Record<string, unknown>).status,
                tool: tool.name,
                created: (mr as Record<string, unknown>).created,
                created_display: (mr as Record<string, unknown>).created
                  ? new Date(
                      String((mr as Record<string, unknown>).created),
                    ).toLocaleDateString()
                  : String((mr as Record<string, unknown>).created),
                url: (mr as Record<string, unknown>).url, // Preserve URL from GitLab merge requests
                type: "merge-request",
              }));
              results.push(...transformedMRs);
            }
          } catch (error) {
            console.warn(
              `Failed to fetch merge requests from ${tool.name}:`,
              error,
            );
          }
        }
      }

      // Sort combined results by timestamp (most recent first)
      results.sort(
        (a, b) =>
          new Date((b as Record<string, unknown>).created as string).getTime() -
          new Date((a as Record<string, unknown>).created as string).getTime(),
      );

      return { pullRequests: results };
    },
  },
  config: {
    // Code Reviews tool aggregates from multiple sources, no single API URL
  },
};

registerTool("code-reviews", codeReviewsTool); // Self-register in registry on import
export default codeReviewsTool;
