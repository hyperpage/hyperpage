import { NextRequest, NextResponse } from "next/server";

import { getToolByName, getAllTools } from "@/tools";
import { Tool, ToolWidget, ToolApi } from "@/tools/tool-types";
import logger from "@/lib/logger";
import {
  createErrorResponse,
  validationErrorResponse,
} from "@/lib/api/responses";

const TOOL_SLUG_REGEX = /^[a-zA-Z0-9._-]+$/;

// Get details about a specific tool
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tool: string }> },
) {
  const { tool: toolName } = await context.params;

  if (!toolName || !TOOL_SLUG_REGEX.test(toolName)) {
    return validationErrorResponse("Invalid tool parameter", "INVALID_TOOL");
  }

  try {
    const tool = getToolByName(toolName);

    if (!tool) {
      // Check if it's a valid tool name (case-sensitive) or suggest alternatives
      const allTools = getAllTools();
      const suggestions = allTools
        .filter((t: Tool) =>
          t.name.toLowerCase().includes(toolName.toLowerCase()),
        )
        .map((t: Tool) => t.name);

      return createErrorResponse({
        status: 404,
        code: "TOOL_NOT_FOUND",
        message: `Tool '${toolName}' not found`,
        details: {
          suggestions,
          availableTools: allTools.map((t: Tool) => t.name),
        },
      });
    }

    // Transform tool to API format
    const toolData = {
      name: tool.name,
      enabled: tool.enabled,
      widgets: Array.isArray(tool.widgets)
        ? tool.widgets.map((widget: ToolWidget) => ({
            title: widget.title,
            type: widget.type,
            headers: widget.headers,
            dynamic: widget.dynamic,
          }))
        : [],
      apis: tool.apis
        ? Object.entries(tool.apis).map(
            ([endpoint, api]: [string, ToolApi]) => ({
              endpoint,
              method: api.method,
              description: api.description,
              parameters: api.parameters,
              url: `/api/tools/${tool.slug}/${endpoint}`,
            }),
          )
        : [],
      config: tool.config
        ? {
            hasApiUrl: !!tool.config.apiUrl,
            hasHeaders: !!tool.config.headers,
            headersCount: tool.config.headers
              ? Object.keys(tool.config.headers).length
              : 0,
          }
        : null,
    };

    return NextResponse.json({
      tool: toolData,
    });
  } catch (error) {
    logger.error("Error getting tool details", { error, tool: toolName });

    return createErrorResponse({
      status: 500,
      code: "TOOL_DETAIL_ERROR",
      message: "Failed to get tool details",
    });
  }
}
