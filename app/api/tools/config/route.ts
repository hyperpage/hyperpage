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
} from "../../../../lib/tool-config-manager";
import { toolRegistry } from "../../../../tools/registry";

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
        return NextResponse.json(
          { error: `No configuration found for tool '${toolName}'` },
          { status: 404 },
        );
      }

      return NextResponse.json({ [toolName]: config });
    } else {
      // Get all tool configurations
      const allConfigs = await getAllToolConfigurations();
      return NextResponse.json(allConfigs);
    }
  } catch (error) {
    console.error("Error retrieving tool configurations:", error);
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
      return NextResponse.json(
        { error: "toolName is required and must be a string" },
        { status: 400 },
      );
    }

    // Validate that tool exists
    if (!toolRegistry[toolName]) {
      return NextResponse.json(
        { error: `Tool '${toolName}' not found` },
        { status: 404 },
      );
    }

    // Validate configuration options
    const validKeys = ["enabled", "config", "refreshInterval", "notifications"];
    const invalidKeys = Object.keys(config).filter(
      (key) => !validKeys.includes(key),
    );

    if (invalidKeys.length > 0) {
      return NextResponse.json(
        {
          error: `Invalid configuration keys: ${invalidKeys.join(", ")}. Valid keys: ${validKeys.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Validate refresh interval if provided
    if (config.refreshInterval !== undefined) {
      const interval = Number(config.refreshInterval);
      if (isNaN(interval) || interval < 1000 || interval > 3600000) {
        // 1 second to 1 hour
        return NextResponse.json(
          {
            error:
              "refreshInterval must be a number between 1000 (1 second) and 3600000 (1 hour)",
          },
          { status: 400 },
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
    console.error("Error updating tool configuration:", error);
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
      return NextResponse.json(
        { error: "tool parameter is required" },
        { status: 400 },
      );
    }

    // Validate that tool exists
    if (!toolRegistry[toolName]) {
      return NextResponse.json(
        { error: `Tool '${toolName}' not found` },
        { status: 404 },
      );
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
      return NextResponse.json(
        {
          error: "action parameter must be one of: toggle, enable, disable",
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Error updating tool state:", error);
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
      return NextResponse.json(
        { error: "tool parameter is required" },
        { status: 400 },
      );
    }

    // Validate that tool exists
    if (!toolRegistry[toolName]) {
      return NextResponse.json(
        { error: `Tool '${toolName}' not found` },
        { status: 404 },
      );
    }

    const deleted = await deleteToolConfiguration(toolName);

    return NextResponse.json({
      success: true,
      message: `Configuration reset to defaults for tool '${toolName}'`,
      deleted,
    });
  } catch (error) {
    console.error("Error deleting tool configuration:", error);
    return NextResponse.json(
      { error: "Failed to delete tool configuration" },
      { status: 500 },
    );
  }
}
