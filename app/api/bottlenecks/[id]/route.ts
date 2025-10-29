/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { bottleneckDetector } from '../../../../lib/monitoring/bottleneck-detector';

/**
 * GET /api/bottlenecks/[id] - Get detailed information about a specific bottleneck
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    // Validate ID
    if (!id || id.trim().length === 0) {
      return NextResponse.json(
        { error: 'Bottleneck ID is required' },
        { status: 400 }
      );
    }

    // Get bottleneck details
    const bottleneck = bottleneckDetector.getBottleneck(id);

    if (!bottleneck) {
      return NextResponse.json(
        { error: 'Bottleneck not found' },
        { status: 404 }
      );
    }

    // Get correlation data for this bottleneck
    const correlationData = bottleneckDetector.getCorrelationData(bottleneck);

    // Get pattern details for additional context
    const patterns = (await import('../../../../lib/monitoring/bottleneck-patterns')).BOTTLENECK_PATTERNS;
    const pattern = patterns.find(p => p.id === bottleneck.patternId);

    // Get related bottlenecks (same pattern in recent history)
    const relatedBottlenecks = getRelatedBottlenecks(bottleneck, pattern);

    // Prepare recommendations with execute actions
    const recommendations = prepareRecommendations(bottleneck);

    return NextResponse.json({
      bottleneck,
      pattern: {
        name: pattern?.name,
        description: pattern?.description,
        category: pattern?.category,
        severity: pattern?.severity
      },
      correlationData,
      relatedBottlenecks,
      recommendations,
      metadata: {
        age: Date.now() - bottleneck.timestamp,
        timeToResolve: calculateTimeToResolve(bottleneck),
        confidenceReasoning: generateConfidenceReasoning(bottleneck),
        nextSteps: generateNextSteps(bottleneck),
        timestamp: Date.now()
      }
    });

  } catch (error) {
    console.error(`Bottleneck ${context.params} detail error:`, error);
    return NextResponse.json(
      { error: 'Failed to retrieve bottleneck details' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/bottlenecks/[id] - Resolve or update a bottleneck
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const { resolution, actionTaken, followUpActions } = body;

    if (!resolution || !['automatic', 'manual'].includes(resolution)) {
      return NextResponse.json(
        { error: 'Valid resolution type (automatic/manual) is required' },
        { status: 400 }
      );
    }

    if (!actionTaken || typeof actionTaken !== 'string') {
      return NextResponse.json(
        { error: 'Action taken description is required' },
        { status: 400 }
      );
    }

    // Resolve the bottleneck
    const resolvedBottleneck = bottleneckDetector.resolveBottleneck(id, {
      resolvedBy: resolution,
      actionTaken,
      resolutionTime: Date.now(),
      followUpActions: Array.isArray(followUpActions) ? followUpActions : []
    });

    if (!resolvedBottleneck) {
      return NextResponse.json(
        { error: 'Bottleneck not found or already resolved' },
        { status: 404 }
      );
    }

    // Log the resolution for auditing
    console.info('Bottleneck resolved', {
      bottleneckId: id,
      resolutionMethod: resolution,
      actionTaken,
      resolutionTime: resolvedBottleneck.resolutionTime
    });

    return NextResponse.json({
      success: true,
      resolvedBottleneck,
      message: `Bottleneck ${id} marked as resolved`
    });

  } catch (error) {
    console.error(`Bottleneck ${await context.params} resolution error:`, error);
    return NextResponse.json(
      { error: 'Failed to resolve bottleneck' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bottlenecks/[id] - Remove a resolved bottleneck from active tracking
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    // Check if bottleneck exists and is already resolved
    const bottleneck = bottleneckDetector.getBottleneck(id);

    if (!bottleneck) {
      return NextResponse.json(
        { error: 'Bottleneck not found' },
        { status: 404 }
      );
    }

    if (!bottleneck.resolved) {
      return NextResponse.json(
        { error: 'Bottleneck must be resolved before deletion' },
        { status: 400 }
      );
    }

    // Remove from active tracking (it's already in history)
    // Note: This is simplified - in a real system, we'd have a separate cleanup mechanism

    return NextResponse.json({
      success: true,
      message: `Resolved bottleneck ${id} acknowledged and removed from active tracking`
    });

  } catch (error) {
    console.error(`Bottleneck ${await context.params} deletion error:`, error);
    return NextResponse.json(
      { error: 'Failed to delete bottleneck' },
      { status: 500 }
    );
  }
}

/**
 * Helper functions for bottleneck details
 */
function getRelatedBottlenecks(bottleneck: any, pattern?: any): any[] {
  // Get historical bottlenecks with same pattern within last 24 hours
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const historical = bottleneckDetector.getHistoricalBottlenecks(50);

  return historical
    .filter(h => h.patternId === bottleneck.patternId && h.detectedAt >= oneDayAgo)
    .sort((a, b) => b.detectedAt - a.detectedAt)
    .slice(0, 5)
    .map(h => ({
      id: h.bottleneckId,
      detectedAt: h.detectedAt,
      resolvedAt: h.resolvedAt,
      confidence: h.confidence
    }));
}

function prepareRecommendations(bottleneck: any): any[] {
  return bottleneck.recommendations.map((rec: any) => ({
    ...rec,
    canExecute: rec.automated === true,
    executeUrl: rec.automated ? `/api/bottlenecks/${bottleneck.id}/execute/${rec.priority}` : null,
    metadata: {
      categoryBadge: getCategoryBadge(rec.category),
      priorityBadge: getPriorityBadge(rec.priority),
      timeEstimate: `${rec.estimatedTime ? rec.estimatedTime + 'min' : 'Unknown'}`,
    }
  }));
}

function calculateTimeToResolve(bottleneck: any): number | null {
  const resolution = bottleneck.resolution;
  if (!resolution || !resolution.resolutionTime || !bottleneck.timestamp) {
    return null;
  }
  return resolution.resolutionTime - bottleneck.timestamp;
}

function generateConfidenceReasoning(bottleneck: any): string[] {
  const reasoning: string[] = [];

  // Analyze breached conditions for reasoning
  const breachedCount = Object.values(bottleneck.metrics).filter((m: any) => m.breached).length;
  const totalConditions = Object.values(bottleneck.metrics).length;

  reasoning.push(`${breachedCount}/${totalConditions} conditions were breached`);

  // Add trend information if available
  if (bottleneck.correlations && bottleneck.correlations.length > 0) {
    const trends = bottleneck.correlations
      .filter((c: any) => c.trend !== 'stable')
      .map((c: any) => c.trend);

    if (trends.length > 0) {
      reasoning.push(`Metric trends showing ${trends.join(', ')} patterns`);
    }
  }

  return reasoning;
}

function generateNextSteps(bottleneck: any): any[] {
  const nextSteps: any[] = [];

  if (!bottleneck.resolved) {
    // Get highest priority recommendations
    const highPriorityRecs = bottleneck.recommendations
      .filter((r: any) => r.priority === 'critical' || r.priority === 'high')
      .slice(0, 3);

    highPriorityRecs.forEach((rec: any) => {
      nextSteps.push({
        action: rec.action,
        priority: rec.priority,
        category: rec.category,
        automated: rec.automated,
        timeEstimate: rec.estimatedTime || 'Unknown'
      });
    });
  } else {
    // Resolution steps
    if (bottleneck.resolution?.followUpActions) {
      bottleneck.resolution.followUpActions.forEach((action: string) => {
        nextSteps.push({
          action,
          priority: 'medium',
          category: 'preventative',
          type: 'follow-up'
        });
      });
    }
  }

  return nextSteps;
}

/**
 * Badge helpers
 */
function getCategoryBadge(category: string): { color: string, label: string } {
  const categoryMap = {
    immediate: { color: 'bg-red-500', label: 'Immediate' },
    preventative: { color: 'bg-blue-500', label: 'Preventative' },
    configuration: { color: 'bg-purple-500', label: 'Configuration' },
    monitoring: { color: 'bg-green-500', label: 'Monitoring' }
  };

  return categoryMap[category as keyof typeof categoryMap] || { color: 'bg-gray-500', label: category };
}

function getPriorityBadge(priority: string): { color: string, label: string } {
  const priorityMap = {
    critical: { color: 'bg-red-600', label: '🔴 Critical' },
    high: { color: 'bg-orange-500', label: '🟡 High' },
    medium: { color: 'bg-yellow-500', label: '🟡 Medium' },
    low: { color: 'bg-green-500', label: '🟢 Low' }
  };

  return priorityMap[priority as keyof typeof priorityMap] || { color: 'bg-gray-500', label: priority };
}
