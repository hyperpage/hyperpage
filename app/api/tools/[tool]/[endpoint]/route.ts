import { NextRequest, NextResponse } from "next/server";
import { getToolByName } from "../../../../../tools";

// Input validation helper
function validateInput(
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

// Centralized API handler that routes through the tool registry
// Centralized API handler that routes through the tool registry
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tool: string; endpoint: string }> },
) {
  const { tool: toolName, endpoint } = await context.params;

  // Validate input to prevent injection attacks
  const validationError = validateInput(toolName, endpoint);
  if (validationError) {
    return validationError;
  }

  try {
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

    const apiConfig = tool.apis[endpoint];

    // Validate method
    if (apiConfig.method !== "GET") {
      return NextResponse.json(
        { error: `Method not allowed for this endpoint` },
        { status: 405 },
      );
    }

    // Route to tool-specific handler from registry
    const handler = tool.handlers[endpoint];
    if (!handler) {
      return NextResponse.json(
        {
          error: `Tool '${toolName}' does not implement endpoint '${endpoint}'`,
        },
        { status: 501 },
      );
    }

    try {
      const data = await handler(request, tool.config || {});
      return NextResponse.json(data);
    } catch (error) {
      console.error(`Handler error for ${toolName}/${endpoint}:`, error);
      return NextResponse.json(
        { error: "An error occurred while processing the request" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error(`Error in tool API ${toolName}/${endpoint}:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tool: string; endpoint: string }> },
) {
  const { tool: toolName, endpoint } = await context.params;

  // Validate input to prevent injection attacks
  const validationError = validateInput(toolName, endpoint);
  if (validationError) {
    return validationError;
  }

  try {
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

    const apiConfig = tool.apis[endpoint];

    // Validate method
    if (apiConfig.method !== "POST") {
      return NextResponse.json(
        { error: `Method not allowed for this endpoint` },
        { status: 405 },
      );
    }

    // Route to tool-specific handler from registry
    const handler = tool.handlers[endpoint];
    if (!handler) {
      return NextResponse.json(
        {
          error: `Tool '${toolName}' does not implement endpoint '${endpoint}'`,
        },
        { status: 501 },
      );
    }

    try {
      const data = await handler(request, tool.config || {});
      return NextResponse.json(data);
    } catch (error) {
      console.error(`Handler error for ${toolName}/${endpoint}:`, error);
      return NextResponse.json(
        { error: "An error occurred while processing the request" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error(`Error in tool API ${toolName}/${endpoint}:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
