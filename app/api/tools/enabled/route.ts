import { NextResponse } from "next/server";
import { getEnabledTools } from "../../../../tools";
import { Tool, ToolWidget, ToolApi } from "../../../../tools/tool-types";

// Enabled tools API endpoint
// Returns only enabled tools and their capabilities
export async function GET() {
  try {
    const enabledTools = getEnabledTools();

    // Transform enabled tools to API format
    const enabledToolsData = enabledTools.map((tool: Tool) => ({
      name: tool.name,
      slug: tool.slug,
      capabilities: tool.capabilities || [],
      enabled: true, // All tools here are enabled
      widgets: Array.isArray(tool.widgets)
        ? tool.widgets.map((widget: ToolWidget) => ({
            title: widget.title,
            type: widget.type,
            headers: widget.headers,
            dynamic: widget.dynamic,
            apiEndpoint: widget.apiEndpoint,
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
    }));

    return NextResponse.json({
      enabledTools: enabledToolsData,
      count: enabledTools.length,
      apis: enabledToolsData.flatMap((tool) =>
        tool.apis.map((api) => ({
          tool: tool.name,
          ...api,
        })),
      ),
    });
  } catch (error) {
    
    return NextResponse.json(
      { error: "Failed to get enabled tools" },
      { status: 500 },
    );
  }
}
