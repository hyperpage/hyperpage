/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { bottleneckDetector } from '../../../../../../../lib/monitoring/bottleneck-detector';

/**
 * POST /api/bottlenecks/[id]/execute/[actionId] - Execute an automated action for a bottleneck
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; actionId: string }> }
): Promise<NextResponse> {
  try {
    const { id, actionId } = await context.params;

    // Validate inputs
    if (!id || !actionId) {
      return NextResponse.json(
        { error: 'Bottleneck ID and action ID are required' },
        { status: 400 }
      );
    }

    // Execute the automated action
    const result = await bottleneckDetector.executeAutomatedAction(id, actionId);

    if (result.success) {
      // Log successful execution for auditing
      console.info('Automated action executed', {
        bottleneckId: id,
        actionId,
        result: result.result,
        timestamp: Date.now()
      });

      return NextResponse.json({
        success: true,
        message: result.message,
        result: result.result,
        executedAt: Date.now()
      });
    } else {
      // Log failed execution
      console.warn('Automated action failed', {
        bottleneckId: id,
        actionId,
        message: result.message,
        timestamp: Date.now()
      });

      return NextResponse.json(
        {
          success: false,
          message: result.message,
          executedAt: Date.now()
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Automated action execution error:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute automated action',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bottlenecks/[id]/execute/[actionId] - Get details about an automated action
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; actionId: string }> }
): Promise<NextResponse> {
  try {
    const { id, actionId } = await context.params;

    // Get bottleneck details
    const bottleneck = bottleneckDetector.getBottleneck(id);

    if (!bottleneck) {
      return NextResponse.json(
        { error: 'Bottleneck not found' },
        { status: 404 }
      );
    }

    // Find the specific action
    const action = bottleneck.recommendations
      .flatMap(rec => rec.automated ? [{ actionId: `auto-${rec.priority}`, recommendation: rec }] : [])
      .find(item => item.actionId === actionId);

    if (!action) {
      return NextResponse.json(
        { error: 'Automated action not found' },
        { status: 404 }
      );
    }

    // Return action details
    return NextResponse.json({
      actionId,
      recommendation: action.recommendation,
      canExecute: true, // If we have the endpoint, it's executable
      status: 'ready_for_execution',
      bottleneckId: id,
      patternId: bottleneck.patternId
    });

  } catch (error) {
    console.error('Automated action details error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve automated action details' },
      { status: 500 }
    );
  }
}
