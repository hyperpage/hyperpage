import React from "react";
import { Play } from "lucide-react";
import { Tool, ToolConfig } from "../tool-types";
import { registerTool } from "../registry";

// Import capability-based tool discovery
import { getEnabledToolsByCapability } from "../index";

export const ciCdTool: Tool = {
  name: "CI/CD",
  slug: "ci-cd",
  enabled: process.env.ENABLE_CICD === "true",
  ui: {
    color: "bg-emerald-500/10 border-emerald-400/30 text-emerald-400",
    icon: React.createElement(Play, { className: "w-5 h-5" }),
  },
  widgets: [
    {
      title: "CI/CD Pipelines",
      type: "table",
      headers: ["Project", "Branch", "Status", "Duration", "Finished", "Tool"],
      data: [], // Data will be loaded asynchronously
      dynamic: true, // Indicate this widget needs dynamic data loading
    },
  ],
  apis: {
    pipelines: {
      method: "GET",
      description: "Get pipelines and workflows from all enabled CI/CD tools",
      parameters: {
        status: {
          type: "string",
          required: false,
          description:
            "Filter by status (success, failed, running, pending, etc.)",
        },
        limit: {
          type: "number",
          required: false,
          description: "Maximum number of results to return",
        },
      },
      response: {
        dataKey: "pipelines",
        description:
          "Array of pipeline/workflow objects from all enabled CI/CD tools",
      },
    },
  },
  handlers: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    pipelines: async (request: Request, _config: ToolConfig) => {
      const results: unknown[] = [];
      const url = new URL(request.url);
      const statusFilter = url.searchParams.get("status");
      const limit = parseInt(url.searchParams.get("limit") || "20", 10);

      // Get all enabled tools that provide pipelines capability (GitLab-style)
      const pipelineTools = getEnabledToolsByCapability("pipelines");

      // Get all enabled tools that provide workflows capability (GitHub-style)
      const workflowTools = getEnabledToolsByCapability("workflows");

      // Combine all CI/CD tools
      const ciCdTools = [...pipelineTools, ...workflowTools];

      // Aggregate pipelines from all supported CI/CD tools
      for (const tool of ciCdTools) {
        if (tool.capabilities?.includes("pipelines")) {
          // This is a GitLab-style tool (provides pipelines)
          try {
            const result = await tool.handlers["pipelines"](
              request,
              tool.config || {},
            );
            if (result.pipelines && Array.isArray(result.pipelines)) {
              // Transform pipelines to unified format
              const pipelines = result.pipelines as unknown[];
              const transformedPipelines = pipelines.map((pipeline) => {
                const p = pipeline as Record<string, unknown>;
                return {
                  project: p.project,
                  branch: p.branch,
                  status: p.status,
                  duration: p.duration,
                  finished_at: p.finished_at,
                  tool: tool.name,
                  created_at: p.created_at || new Date().toISOString(),
                  url: p.url,
                };
              });
              results.push(...transformedPipelines);
            }
          } catch (error) {
            console.warn(`Failed to fetch pipelines from ${tool.name}:`, error);
          }
        } else if (tool.capabilities?.includes("workflows")) {
          // This is a GitHub-style tool (provides workflows)
          try {
            const result = await tool.handlers["workflows"](
              request,
              tool.config || {},
            );
            if (result.workflows && Array.isArray(result.workflows)) {
              // Transform workflows to unified pipeline format
              const workflows = result.workflows as unknown[];
              const transformedWorkflows = workflows.map((workflow) => {
                const w = workflow as Record<string, unknown>;
                const runDuration = w.run_duration as number;
                const updatedAt = w.updated_at as string;
                const createdAt = w.created_at as string;

                return {
                  project: w.repository,
                  branch: w.head_branch || w.branch || "main",
                  status: w.status || w.conclusion,
                  duration: runDuration ? `${Math.round(runDuration)}s` : "N/A",
                  finished_at: updatedAt
                    ? new Date(updatedAt).toLocaleDateString()
                    : "Running",
                  tool: tool.name,
                  created_at: createdAt || new Date().toISOString(),
                  url: w.html_url,
                };
              });
              results.push(...transformedWorkflows);
            }
          } catch (error) {
            console.warn(`Failed to fetch workflows from ${tool.name}:`, error);
          }
        }
      }

      // Sort combined results by creation time (most recent first)
      results.sort((a, b) => {
        const aData = a as Record<string, unknown>;
        const bData = b as Record<string, unknown>;
        return (
          new Date(String(bData.created_at)).getTime() -
          new Date(String(aData.created_at)).getTime()
        );
      });

      // Apply status filter if provided
      let filteredResults = results;
      if (statusFilter) {
        filteredResults = results.filter((pipeline) => {
          const pData = pipeline as Record<string, unknown>;
          const status = String(pData.status || "").toLowerCase();
          return status.includes(statusFilter.toLowerCase());
        });
      }

      // Apply limit
      filteredResults = filteredResults.slice(0, limit);

      return { pipelines: filteredResults };
    },
  },
  config: {
    // CI/CD tool aggregates from multiple sources, no single API URL
  },
};

registerTool("ci-cd", ciCdTool); // Self-register in registry on import
export default ciCdTool;
