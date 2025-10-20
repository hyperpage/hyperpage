import { NextResponse } from "next/server.js";
import { getAvailableApis, getAllTools } from "../../../../tools";
import { Tool, ToolWidget, ToolApi } from "../../../../tools/tool-types";

// Tool discovery API endpoint
// Returns all available tools and their API capabilities
export async function GET() {
  try {
    const allTools = getAllTools();
    const availableApis = getAvailableApis();

    // Transform tools to discovery format
    const discoveryData = allTools.map((tool: Tool) => ({
      name: tool.name,
      enabled: tool.enabled,
      widgets: tool.widgets.map((widget: ToolWidget) => ({
        title: widget.title,
        type: widget.type,
        headers: widget.headers,
        dynamic: widget.dynamic,
      })),
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
    }));

    return NextResponse.json({
      tools: discoveryData,
      apis: availableApis,
      totalTools: allTools.length,
      enabledTools: allTools.filter((t: Tool) => t.enabled).length,
    });
  } catch (error) {
    console.error("Error in tool discovery:", error);
    return NextResponse.json(
      { error: "Failed to discover tools" },
      { status: 500 },
    );
  }
}
