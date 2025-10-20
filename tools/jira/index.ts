import React from "react";
import { Kanban } from "lucide-react";
import { Tool, ToolConfig } from "../tool-types";
import { JiraApiIssue } from "./types";
import { registerTool } from "../registry";
import { getTimeAgo } from "../../lib/time-utils";

export const jiraTool: Tool = {
  name: "Jira",
  slug: "jira",
  enabled: process.env.ENABLE_JIRA === "true",
  ui: {
    color: "bg-green-500/10 border-green-400/30 text-green-400",
    icon: React.createElement(Kanban, { className: "w-5 h-5" }),
  },
  capabilities: ["issues", "activity"], // Declares what this tool can provide for unified views
  widgets: [], // Removed individual widget - now unified in ticketing tool
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
    activity: {
      method: "GET",
      description: "Get recent Jira activity",
      response: {
        dataKey: "activity",
        description: "Array of recent Jira activity events",
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

      const response = await fetch(issuesUrl, {
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

      // Transform JIRA issues to our dashboard format
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
    activity: async (request: Request, config: ToolConfig) => {
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

      // Get recent issues for activity (simpler approach)
      const worklogUrl = `${apiUrl}/search/jql`;
      const response = await fetch(worklogUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jql: "updated >= -30d ORDER BY updated DESC",
          maxResults: 20,
          fields: [
            "key",
            "summary",
            "status",
            "assignee",
            "updated",
            "issuetype",
            "labels",
            "project",
            "description",
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JIRA API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Create activity events from recent issues updates
      const activityEvents = (data.issues as JiraApiIssue[])
        .slice(0, 10)
        .map((issue: JiraApiIssue, index: number) => {
          const eventTime = new Date(issue.fields.updated);
          const timeAgo = getTimeAgo(eventTime);
          const jiraWebUrl = process.env.JIRA_WEB_URL;

          // Extract project info from the key (everything before the dash)
          const projectKey = issue.key.split("-")[0];
          const projectName = issue.fields.project?.name || projectKey;

          // Get assignee information
          const assignee = issue.fields.assignee?.displayName;

          // Get labels if available
          const labels = issue.fields.labels || [];

          // Add issue description preview
          const content: Array<{ type: 'description'; text: string }> = [];

          // Handle Jira's Atlassian Document Format (ADF) or plain text descriptions
          if (issue.fields.description) {
            let descriptionText = '';

            if (typeof issue.fields.description === 'string') {
              // Plain text description
              if (issue.fields.description.trim()) {
                descriptionText = issue.fields.description.length > 150
                  ? issue.fields.description.substring(0, 150) + "..."
                  : issue.fields.description;
              }
            } else if (typeof issue.fields.description === 'object' && issue.fields.description?.content) {
              // Atlassian Document Format - extract basic text content
              try {
                const adfContent = issue.fields.description.content;
                if (Array.isArray(adfContent) && adfContent.length > 0) {
                  // Simple ADF text extraction - just get the first few text nodes
                  const extractText = (nodes: any[]): string => {
                    let text = '';
                    for (const node of nodes) {
                      if (node.type === 'paragraph' && node.content) {
                        for (const contentNode of node.content) {
                          if (contentNode.type === 'text' && contentNode.text) {
                            text += contentNode.text + ' ';
                          }
                        }
                      }
                      if (text.length > 150) break; // Stop at reasonable length
                    }
                    return text.trim();
                  };

                  const extractedText = extractText(adfContent);
                  if (extractedText) {
                    descriptionText = extractedText.length > 150
                      ? extractedText.substring(0, 150) + "..."
                      : extractedText;
                  }
                }
              } catch (error) {
                console.warn(`Failed to parse Jira ADF for ${issue.key}:`, error);
                descriptionText = '[Description available in Jira]'; // Fallback for complex ADF
              }
            }

            if (descriptionText) {
              content.push({
                type: 'description',
                text: descriptionText
              });
            }
          }



          const result = {
            id: `jira_${issue.id}_${index}`,
            tool: "Jira",
            toolIcon: "jira",
            action: "Issue updated",
            description: issue.fields.summary,
            author: assignee || "Unassigned",
            time: timeAgo,
            color: "green",
            timestamp: eventTime.toISOString(),
            url:
              jiraWebUrl && issue.key
                ? `${jiraWebUrl}/browse/${issue.key}`
                : "",
            displayId: issue.key,
            repository: projectName, // Use project name as repository context
            status: issue.fields.status?.name || "Unknown",
            assignee,
            labels,
            content: content.length > 0 ? content : undefined,
          };



          return result;
        });

      return { activity: activityEvents };
    },
  },
  config: {
    formatApiUrl: (webUrl: string) => `${webUrl}/rest/api/3`, // Jira's URL formatting logic
    headers: {
      // Headers will be set dynamically in handlers
    },
  },
};

registerTool("jira", jiraTool); // Self-register in registry on import
export default jiraTool;
