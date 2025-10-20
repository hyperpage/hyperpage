import { NextResponse } from "next/server.js";
import { getToolByName, Tool } from "../../../../../tools";
import { ToolApi } from "../../../../../tools/tool-types";

// Input validation helper
export function validateInput(
  toolName: string,
  endpoint: string,
): NextResponse | null {
  // Allow alphanumeric, underscores, hyphens, spaces, and URL-encoded characters (%)
  const validInputRegex = /^[a-zA-Z0-9_%\-\s]+$/;

  if (!validInputRegex.test(toolName)) {
    return NextResponse.json({ error: "Invalid tool name" }, { status: 400 });
  }

  if (!validInputRegex.test(endpoint)) {
    return NextResponse.json(
      { error: "Invalid endpoint name" },
      { status: 400 },
    );
  }

  return null; // Valid input
}

// Tool validation helper
export function validateTool(
  toolName: string,
  endpoint: string,
): NextResponse | { tool: Tool; apiConfig: ToolApi } | null {
  // Get tool from registry
  const tool = getToolByName(toolName);

  if (!tool) {
    return NextResponse.json(
      { error: `Tool '${toolName}' not found` },
      { status: 404 },
    );
  }

  if (!tool.enabled) {
    return NextResponse.json(
      { error: `Tool '${toolName}' is not enabled` },
      { status: 403 },
    );
  }

  // Check if tool supports this endpoint
  if (!tool.apis || !tool.apis[endpoint]) {
    return NextResponse.json(
      { error: `Tool '${toolName}' does not support endpoint '${endpoint}'` },
      { status: 404 },
    );
  }

  return { tool, apiConfig: tool.apis[endpoint] };
}

// Handler execution helper
export async function executeHandler(
  request: Request,
  tool: Tool,
  endpoint: string,
): Promise<NextResponse> {
  // Route to tool-specific handler from registry
  const handler = tool.handlers[endpoint];
  if (!handler) {
    return NextResponse.json(
      {
        error: `Tool '${tool.name}' does not implement endpoint '${endpoint}'`,
      },
      { status: 501 },
    );
  }

  try {
    const data = await handler(request, tool.config || {});
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Handler error for ${tool.name}/${endpoint}:`, error);
    return NextResponse.json(
      { error: "An error occurred while processing the request" },
      { status: 500 },
    );
  }
}
