import React from "react";
import { Ticket } from "lucide-react";
import { Tool, ToolConfig, TransformedIssue } from "../tool-types";
import { registerTool } from "../registry";

// Import capability-based tool discovery
import { getEnabledToolsByCapability } from "../index";

export const ticketingTool: Tool = {
  name: "Ticketing",
  slug: "ticketing",
  enabled: process.env.ENABLE_TICKETING === "true",
  ui: {
    color: "bg-blue-500/10 border-blue-400/30 text-blue-400",
    icon: React.createElement(Ticket, { className: "w-5 h-5" }),
  },
  widgets: [
    {
      title: "Tickets",
      type: "table",
      headers: ["ID", "Title", "Status", "Assignee", "Tool"],
      data: [], // Data will be loaded asynchronously
      dynamic: true, // Indicate this widget needs dynamic data loading
      refreshInterval: 300000, // 5 minutes refresh interval (matches Jira's previous setting)
      displayName: "Combined", // Show "Combined" instead of individual tool names
    },
  ],
  apis: {
    issues: {
      method: "GET",
      description: "Get issues and tickets from all enabled ticketing tools",
      response: {
        dataKey: "issues",
        description:
          "Array of issue/ticket objects from all enabled ticketing tools",
      },
    },
  },
  handlers: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    issues: async (request: Request, _config: ToolConfig) => {
      const results: TransformedIssue[] = [];

      // Get all enabled tools that provide issues capability (Jira-style)
      const issueTools = getEnabledToolsByCapability("issues");

      // Aggregate issues from all supported ticketing tools
      for (const tool of issueTools) {
        if (tool.capabilities?.includes("issues")) {
          // This is a tool that provides issues capability
          try {
            const result = await tool.handlers["issues"](
              request,
              tool.config || {},
            );
            if (result.issues && Array.isArray(result.issues)) {
              // Transform issues from this tool into unified format
              const issues = result.issues as unknown[];
              const transformedIssues: TransformedIssue[] = issues.map(
                (issue) => {
                  const issueData = issue as Record<string, unknown>;
                  const ticketId = String(
                    issueData.ticket || issueData.key || issueData.id || "",
                  );
                  return {
                    id: ticketId, // Map ticket ID to 'id' field for DataTable
                    ticket: ticketId, // Keep ticket field for internal consistency
                    title: String(issueData.title || issueData.summary || ""),
                    status: String(issueData.status || ""),
                    assignee: String(issueData.assignee || "Unassigned"),
                    tool: tool.name, // Add tool name for the Tool column
                    url: String(issueData.url || ""),
                    created: String(issueData.created || ""),
                    created_display: issueData.created
                      ? new Date(String(issueData.created)).toLocaleDateString()
                      : "",
                    type: "issue",
                  };
                },
              );
              results.push(...transformedIssues);
            }
          } catch (error) {
            console.warn(`Failed to fetch issues from ${tool.name}:`, error);
          }
        }
      }

      // Sort combined results by creation date (most recent first)
      results.sort((a, b) => {
        if (!a.created || !b.created) return 0;
        return new Date(b.created).getTime() - new Date(a.created).getTime();
      });

      return { issues: results };
    },
  },
  config: {
    // Ticketing tool aggregates from multiple sources, no single API URL
  },
};

registerTool("ticketing", ticketingTool); // Self-register in registry on import
export default ticketingTool;
