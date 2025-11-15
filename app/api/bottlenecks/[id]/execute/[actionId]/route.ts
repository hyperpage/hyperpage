import { NextRequest, NextResponse } from "next/server";

import { bottleneckDetector } from "@/lib/monitoring/bottleneck-detector";
import logger from "@/lib/logger";
import {
  createErrorResponse,
  validationErrorResponse,
} from "@/lib/api/responses";

const ID_REGEX = /^[a-zA-Z0-9._-]+$/;

/**
 * POST /api/bottlenecks/[id]/execute/[actionId] - Execute an automated action for a bottleneck
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; actionId: string }> },
): Promise<NextResponse> {
  const { id: bottleneckId, actionId } = await context.params;

  if (!ID_REGEX.test(bottleneckId) || !ID_REGEX.test(actionId)) {
    return validationErrorResponse(
      "Bottleneck ID and action ID are required",
      "INVALID_BOTTLENECK_ACTION",
    );
  }

  try {
    // Execute the automated action
    const result = await bottleneckDetector.executeAutomatedAction(
      bottleneckId,
      actionId,
    );

    if (result.success) {
      // Log successful execution for auditing
      logger.info("Automated action executed", {
        bottleneckId,
        actionId,
        result: result.result,
        timestamp: Date.now(),
      });

      return NextResponse.json({
        success: true,
        message: result.message,
        result: result.result,
        executedAt: Date.now(),
      });
    } else {
      // Log failed execution
      logger.warn("Automated action failed", {
        bottleneckId,
        actionId,
        message: result.message,
        timestamp: Date.now(),
      });

      return validationErrorResponse(
        result.message || "Automated action failed",
        "BOTTLENECK_ACTION_FAILED",
      );
    }
  } catch (error) {
    logger.error("Failed to execute automated action for bottleneck", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      bottleneckId,
      actionId,
    });

    return createErrorResponse({
      status: 500,
      code: "BOTTLENECK_ACTION_ERROR",
      message: "Failed to execute automated action",
    });
  }
}

/**
 * GET /api/bottlenecks/[id]/execute/[actionId] - Get details about an automated action
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; actionId: string }> },
): Promise<NextResponse> {
  const { id: bottleneckId, actionId } = await context.params;

  if (!ID_REGEX.test(bottleneckId) || !ID_REGEX.test(actionId)) {
    return validationErrorResponse(
      "Bottleneck ID and action ID are required",
      "INVALID_BOTTLENECK_ACTION",
    );
  }

  try {
    // Get bottleneck details
    const bottleneck = bottleneckDetector.getBottleneck(bottleneckId);

    if (!bottleneck) {
      return createErrorResponse({
        status: 404,
        code: "BOTTLENECK_NOT_FOUND",
        message: "Bottleneck not found",
      });
    }

    // Find the specific action
    const action = bottleneck.recommendations
      .flatMap((rec) =>
        rec.automated
          ? [{ actionId: `auto-${rec.priority}`, recommendation: rec }]
          : [],
      )
      .find((item) => item.actionId === actionId);

    if (!action) {
      return createErrorResponse({
        status: 404,
        code: "BOTTLENECK_ACTION_NOT_FOUND",
        message: "Automated action not found",
      });
    }

    // Return action details
    return NextResponse.json({
      actionId,
      recommendation: action.recommendation,
      canExecute: true, // If we have the endpoint, it's executable
      status: "ready_for_execution",
      bottleneckId,
      patternId: bottleneck.patternId,
    });
  } catch (error) {
    logger.error("Failed to retrieve automated action details", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      bottleneckId,
      actionId,
    });

    return createErrorResponse({
      status: 500,
      code: "BOTTLENECK_ACTION_DETAIL_ERROR",
      message: "Failed to retrieve automated action details",
    });
  }
}
