import { NextResponse } from "next/server";
import { getAvailableApis, getAllTools } from "@/tools";
import { Tool, ToolWidget, ToolApi } from "@/tools/tool-types";
import logger from "@/lib/logger";

// Tool discovery API endpoint
// Returns all available tools and their API capabilities
export async function GET() {
  try {
    const allTools = getAllTools();
    const availableApis = getAvailableApis();

    // Transform tools to discovery format
    const discoveryData = allTools
      .map((tool: Tool) => ({
        name: tool.name || "Unknown Tool",
        enabled: tool.enabled || false,
        widgets: tool.widgets
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
              }),
            )
          : [],
      }))
      .filter((item) => item.name !== "Unknown Tool" || allTools.length === 0);

    return NextResponse.json({
      tools: discoveryData,
      apis: availableApis,
      totalTools: allTools.length,
      enabledTools: allTools.filter((t: Tool) => t.enabled).length,
    });
  } catch (error) {
    // Log the error with pino for debugging
    logger.error("Failed to discover tools", { error });

    return NextResponse.json(
      { error: "Failed to discover tools" },
      { status: 500 },
    );
  }
}
