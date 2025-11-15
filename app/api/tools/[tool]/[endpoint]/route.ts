import { NextRequest, NextResponse } from "next/server";

import {
  validateInput,
  validateTool,
  executeHandler,
} from "@/app/api/tools/[tool]/[endpoint]/shared";
import { performanceMiddleware } from "@/lib/monitoring/performance-middleware";
import logger from "@/lib/logger";
import {
  createErrorResponse,
  methodNotAllowedResponse,
} from "@/lib/api/responses";

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
      return createErrorResponse({
        status: 500,
        code: "TOOL_VALIDATION_FAILED",
        message: "Tool validation failed",
      });
    }

    const { tool, apiConfig } = toolValidation;

    // Validate method
    if (apiConfig.method !== "GET") {
      return methodNotAllowedResponse([apiConfig.method]);
    }

    const response = await executeHandler(request, tool, endpoint);
    return await performanceMiddleware.recordPerformance(request, response);
  } catch (error) {
    logger.error("Error in GET handler", { error, tool: toolName, endpoint });

    return createErrorResponse({
      status: 500,
      code: "TOOLS_ENDPOINT_ERROR",
      message: "Internal server error",
    });
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
      return createErrorResponse({
        status: 500,
        code: "TOOL_VALIDATION_FAILED",
        message: "Tool validation failed",
      });
    }

    const { tool, apiConfig } = toolValidation;

    // Validate method
    if (apiConfig.method !== "POST") {
      return methodNotAllowedResponse([apiConfig.method]);
    }

    const response = await executeHandler(request, tool, endpoint);
    return await performanceMiddleware.recordPerformance(request, response);
  } catch (error) {
    logger.error("Error in POST handler", { error, tool: toolName, endpoint });

    return createErrorResponse({
      status: 500,
      code: "TOOLS_ENDPOINT_ERROR",
      message: "Internal server error",
    });
  }
}
