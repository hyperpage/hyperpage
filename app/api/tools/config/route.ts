/**
 * Tool Configuration API
 *
 * Manages user-configurable tool settings that persist across application restarts.
 * Supports enabling/disabling tools, custom refresh intervals, and notifications.
 */

import { NextRequest, NextResponse } from "next/server";

import {
  saveToolConfiguration,
  getToolConfiguration,
  deleteToolConfiguration,
  getAllToolConfigurations,
  toggleToolState,
} from "@/lib/tool-config-manager";
import { toolRegistry } from "@/tools/registry";
import logger from "@/lib/logger";
import {
  createErrorResponse,
  methodNotAllowedResponse,
  validationErrorResponse,
} from "@/lib/api/responses";

/**
 * GET /api/tools/config - Get all tool configurations or specific tool config
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const toolName = url.searchParams.get("tool");

    if (toolName) {
      // Get configuration for a specific tool
      const config = await getToolConfiguration(toolName);
      if (!config) {
        return createErrorResponse({
          status: 404,
          code: "TOOL_CONFIG_NOT_FOUND",
          message: `No configuration found for tool '${toolName}'`,
        });
      }

      return NextResponse.json({ [toolName]: config });
    } else {
      // Get all tool configurations
      const allConfigs = await getAllToolConfigurations();
      return NextResponse.json(allConfigs);
    }
  } catch (error) {
    // Log the error with pino for debugging
    logger.error("Failed to retrieve tool configurations", { error });

    return NextResponse.json(
      { error: "Failed to retrieve tool configurations" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/tools/config - Update tool configuration
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { toolName, ...config } = body;

    if (!toolName || typeof toolName !== "string") {
      return validationErrorResponse(
        "toolName is required and must be a string",
        "INVALID_TOOL_NAME",
      );
    }

    // Validate that tool exists
    if (!toolRegistry[toolName]) {
      return createErrorResponse({
        status: 404,
        code: "TOOL_NOT_FOUND",
        message: `Tool '${toolName}' not found`,
      });
    }

    // Validate configuration options
    const validKeys = ["enabled", "config", "refreshInterval", "notifications"];
    const invalidKeys = Object.keys(config).filter(
      (key) => !validKeys.includes(key),
    );

    if (invalidKeys.length > 0) {
      return validationErrorResponse(
        `Invalid configuration keys: ${invalidKeys.join(", ")}. Valid keys: ${validKeys.join(", ")}`,
        "INVALID_CONFIGURATION_KEYS",
      );
    }

    // Validate refresh interval if provided
    if (config.refreshInterval !== undefined) {
      const interval = Number(config.refreshInterval);
      if (isNaN(interval) || interval < 1000 || interval > 3600000) {
        // 1 second to 1 hour
        return validationErrorResponse(
          "refreshInterval must be a number between 1000 (1 second) and 3600000 (1 hour)",
          "INVALID_REFRESH_INTERVAL",
        );
      }
      config.refreshInterval = interval;
    }

    // Save configuration
    await saveToolConfiguration(toolName, config);

    return NextResponse.json({
      success: true,
      message: `Configuration updated for tool '${toolName}'`,
    });
  } catch (error) {
    // Log the error with pino for debugging
    logger.error("Failed to update tool configuration", { error });

    return NextResponse.json(
      { error: "Failed to update tool configuration" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/tools/config?tool=toolName&action=toggle - Toggle tool state
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const toolName = url.searchParams.get("tool");
    const action = url.searchParams.get("action");

    if (!toolName || typeof toolName !== "string") {
      return validationErrorResponse("tool parameter is required", "INVALID_TOOL_PARAM");
    }

    // Validate that tool exists
    if (!toolRegistry[toolName]) {
      return createErrorResponse({
        status: 404,
        code: "TOOL_NOT_FOUND",
        message: `Tool '${toolName}' not found`,
      });
    }

    if (action === "toggle") {
      // Toggle enabled/disabled state
      const currentConfig = await getToolConfiguration(toolName);
      const newEnabled = !(currentConfig?.enabled ?? false);
      await toggleToolState(toolName, newEnabled);

      return NextResponse.json({
        success: true,
        message: `Tool '${toolName}' ${newEnabled ? "enabled" : "disabled"}`,
      });
    } else if (action === "enable") {
      await toggleToolState(toolName, true);
      return NextResponse.json({
        success: true,
        message: `Tool '${toolName}' enabled`,
      });
    } else if (action === "disable") {
      await toggleToolState(toolName, false);
      return NextResponse.json({
        success: true,
        message: `Tool '${toolName}' disabled`,
      });
    } else {
      return validationErrorResponse(
        "action parameter must be one of: toggle, enable, disable",
        "INVALID_ACTION",
      );
    }
  } catch (error) {
    // Log the error with pino for debugging
    logger.error("Failed to update tool state", { error });

    return NextResponse.json(
      { error: "Failed to update tool state" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/tools/config?tool=toolName - Delete tool configuration (reset to defaults)
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const toolName = url.searchParams.get("tool");

    if (!toolName || typeof toolName !== "string") {
      return validationErrorResponse("tool parameter is required", "INVALID_TOOL_PARAM");
    }

    // Validate that tool exists
    if (!toolRegistry[toolName]) {
      return createErrorResponse({
        status: 404,
        code: "TOOL_NOT_FOUND",
        message: `Tool '${toolName}' not found`,
      });
    }

    const deleted = await deleteToolConfiguration(toolName);

    return NextResponse.json({
      success: true,
      message: `Configuration reset to defaults for tool '${toolName}'`,
      deleted,
    });
  } catch (error) {
    // Log the error with pino for debugging
    logger.error("Failed to delete tool configuration", { error });

    return NextResponse.json(
      { error: "Failed to delete tool configuration" },
      { status: 500 },
    );
  }
}
