import React from "react";
import { Kanban } from "lucide-react";
import { Tool, ToolConfig } from "../tool-types";
import { JiraApiIssue, AtlassianNode, JiraChangelogItem, JiraChangelogResponse } from "./types";
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
  capabilities: ["issues", "activity", "rate-limit"], // Declares what this tool can provide for unified views
  widgets: [], // Removed individual widget - now unified in ticketing tool
  validation: {
    required: ['JIRA_WEB_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'],
    optional: [],
    description: 'Jira integration requires instance URL, email, and API token'
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
    activity: {
      method: "GET",
      description: "Get recent Jira activity with status change tracking",
      response: {
        dataKey: "activity",
        description: "Array of recent Jira activity events with status transitions",
      },
    },
    "rate-limit": {
      method: "GET",
      description: "Get current Jira API rate limit status",
      response: {
        dataKey: "rateLimit",
        description: "Current rate limit status for Jira instance (limited support - mainly status based)",
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
      const activityPromises = (data.issues as JiraApiIssue[])
        .slice(0, 10)
        .map(async (issue: JiraApiIssue, index: number) => {
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
                  const extractText = (nodes: AtlassianNode[]): string => {
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

          // Fetch the most recent status change for this issue
          let statusTransition = null;
          try {
            const changelogUrl = `${apiUrl}/issue/${issue.key}/changelog?maxResults=10`;
            const changelogResponse = await fetch(changelogUrl, {
              method: "GET",
              headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/json",
              },
            });

            if (changelogResponse.ok) {
              const changelogData: JiraChangelogResponse = await changelogResponse.json();

              // Find the most recent status change
              const statusChanges = changelogData.values
                .filter((change: JiraChangelogItem) =>
                  change.items.some(item => item.field === 'status')
                );

              if (statusChanges.length > 0) {
                const recentChange = statusChanges[0];
                const statusItem = recentChange.items.find(item => item.field === 'status')!;
                if (statusItem.fromString && statusItem.toString && statusItem.fromString !== statusItem.toString) {
                  statusTransition = `${statusItem.fromString} → ${statusItem.toString}`;
                }
              }
            } else {
              console.warn(`Failed to fetch changelog for ${issue.key}: ${changelogResponse.status}`);
            }
          } catch (changelogError) {
            console.warn(`Changelog error for ${issue.key}:`, changelogError instanceof Error ? changelogError.message : String(changelogError));
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
            statusTransition, // Add status transition info
            assignee,
            labels,
            content: content.length > 0 ? content : undefined,
          };

          return result;
        });

      // Wait for all async operations to complete
      const activityEvents = await Promise.all(activityPromises);

      return { activity: activityEvents };
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

      const response = await fetch(serverInfoUrl, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      });

      // Return basic rate limit information for Jira
      // Since Jira doesn't expose actual rate limits via API, we report status based on response codes
      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited response - report as high usage
          return {
            rateLimit: {
              message: "Jira API rate limit exceeded",
              statusCode: response.status,
              retryAfter: response.headers.get('Retry-After')
            }
          };
        }

        // Other error - might be authentication or server issue
        throw new Error(`JIRA server info API error: ${response.status}`);
      }

      // Success - return basic status information
      return {
        rateLimit: {
          message: "Jira API accessible - rate limiting status unknown (not exposed by API)",
          statusCode: response.status,
          serverInfo: "Jira API connection confirmed"
        }
      };
    },
  },
  config: {
    formatApiUrl: (webUrl: string) => `${webUrl}/rest/api/3`, // Jira's URL formatting logic
    headers: {
      // Headers will be set dynamically in handlers
    },
    rateLimit: {
      detectHeaders: (response: Response) => ({
        remaining: null, // Jira doesn't provide remaining count headers
        resetTime: null, // Jira doesn't provide reset time headers
        retryAfter: null  // Jira uses 429 status, not Retry-After header typically
      }),
      shouldRetry: (response: Response, attemptNumber: number) => {
        // Handle 429 (Too Many Requests) responses
        if (response.status === 429) {
          // Use exponential backoff starting at 2 seconds (more conservative than GitHub)
          const baseDelay = 2000; // 2 seconds
          return baseDelay * Math.pow(2, attemptNumber);
        }

        return null; // No retry needed
      },
      maxRetries: 5, // Jira can have more retries due to instance variability
      backoffStrategy: 'exponential'
    },
  },
};

registerTool("jira", jiraTool); // Self-register in registry on import
export default jiraTool;
