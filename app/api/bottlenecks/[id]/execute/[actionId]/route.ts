import { NextRequest, NextResponse } from "next/server";

import { bottleneckDetector } from "@/lib/monitoring/bottleneck-detector";
import logger from "@/lib/logger";

/**
 * POST /api/bottlenecks/[id]/execute/[actionId] - Execute an automated action for a bottleneck
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; actionId: string }> },
): Promise<NextResponse> {
  const { id: bottleneckId, actionId } = await context.params;

  try {
    // Validate inputs
    if (!bottleneckId || !actionId) {
      return NextResponse.json(
        { error: "Bottleneck ID and action ID are required" },
        { status: 400 },
      );
    }

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

      return NextResponse.json(
        {
          success: false,
          message: result.message,
          executedAt: Date.now(),
        },
        { status: 400 },
      );
    }
  } catch (error) {
    logger.error("Failed to execute automated action for bottleneck", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      bottleneckId,
      actionId,
    });

    return NextResponse.json(
      {
        error: "Failed to execute automated action",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
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

  try {
    // Get bottleneck details
    const bottleneck = bottleneckDetector.getBottleneck(bottleneckId);

    if (!bottleneck) {
      return NextResponse.json(
        { error: "Bottleneck not found" },
        { status: 404 },
      );
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
      return NextResponse.json(
        { error: "Automated action not found" },
        { status: 404 },
      );
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

    return NextResponse.json(
      { error: "Failed to retrieve automated action details" },
      { status: 500 },
    );
  }
}
