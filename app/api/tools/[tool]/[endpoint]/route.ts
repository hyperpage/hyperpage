import { NextRequest, NextResponse } from "next/server";
import { validateInput, validateTool, executeHandler } from "./shared";
import { performanceMiddleware } from "../../../../../lib/monitoring/performance-middleware";

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
    // Validate tool and get configuration
    const toolValidation = validateTool(toolName, endpoint);
    if (toolValidation instanceof NextResponse) {
      return toolValidation;
    }
    if (!toolValidation) {
      return NextResponse.json(
        { error: "Tool validation failed" },
        { status: 500 },
      );
    }

    const { tool, apiConfig } = toolValidation;

    // Validate method
    if (apiConfig.method !== "GET") {
      return NextResponse.json(
        { error: `Method not allowed for this endpoint` },
        { status: 405 },
      );
    }

    const response = await executeHandler(request, tool, endpoint);
    return await performanceMiddleware.recordPerformance(request, response);
  } catch (error) {
    
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
    // Validate tool and get configuration
    const toolValidation = validateTool(toolName, endpoint);
    if (toolValidation instanceof NextResponse) {
      return toolValidation;
    }
    if (!toolValidation) {
      return NextResponse.json(
        { error: "Tool validation failed" },
        { status: 500 },
      );
    }

    const { tool, apiConfig } = toolValidation;

    // Validate method
    if (apiConfig.method !== "POST") {
      return NextResponse.json(
        { error: `Method not allowed for this endpoint` },
        { status: 405 },
      );
    }

    const response = await executeHandler(request, tool, endpoint);
    return await performanceMiddleware.recordPerformance(request, response);
  } catch (error) {
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
