import React from "react";
import { Kanban } from "lucide-react";
import { Tool, ToolConfig } from "../tool-types";
import { JiraApiIssue } from "./types";
import { registerTool } from "../registry";

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
