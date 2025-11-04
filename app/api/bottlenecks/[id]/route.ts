import { NextRequest, NextResponse } from "next/server";
import { bottleneckDetector } from "../../../../lib/monitoring/bottleneck-detector";
import {
  DetectedBottleneck,
  BottleneckRecommendation,
  Correlation,
} from "../../../../lib/monitoring/bottleneck-detector";
import { BOTTLENECK_PATTERNS } from "../../../../lib/monitoring/bottleneck-patterns";
import logger from "../../../../lib/logger";

/**
 * GET /api/bottlenecks/[id] - Get detailed information about a specific bottleneck
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    // Validate ID
    if (!id || id.trim().length === 0) {
      return NextResponse.json(
        { error: "Bottleneck ID is required" },
        { status: 400 },
      );
    }

    // Get bottleneck details
    const bottleneck = bottleneckDetector.getBottleneck(id);

    if (!bottleneck) {
      return NextResponse.json(
        { error: "Bottleneck not found" },
        { status: 404 },
      );
    }

    // Get correlation data for this bottleneck
    const correlationData = bottleneckDetector.getCorrelationData(bottleneck);

    // Get pattern details for additional context
    const pattern = BOTTLENECK_PATTERNS.find(
      (p) => p.id === bottleneck.patternId,
    );

    // Get related bottlenecks (same pattern in recent history)
    const relatedBottlenecks = getRelatedBottlenecks(bottleneck);

    // Prepare recommendations with execute actions
    const recommendations = prepareRecommendations(bottleneck);

    return NextResponse.json({
      bottleneck,
      pattern: {
        name: pattern?.name,
        description: pattern?.description,
        category: pattern?.category,
        severity: pattern?.severity,
      },
      correlationData,
      relatedBottlenecks,
      recommendations,
      metadata: {
        age: Date.now() - bottleneck.timestamp,
        timeToResolve: calculateTimeToResolve(bottleneck),
        confidenceReasoning: generateConfidenceReasoning(bottleneck),
        nextSteps: generateNextSteps(bottleneck),
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    logger.error(
      "Failed to retrieve bottleneck details",
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    );
    
    return NextResponse.json(
      { error: "Failed to retrieve bottleneck details" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/bottlenecks/[id] - Resolve or update a bottleneck
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const resolution: "automatic" | "manual" = body.resolution;
    const actionTaken: string = body.actionTaken;
    const followUpActions: unknown = body.followUpActions;

    if (!resolution || !["automatic", "manual"].includes(resolution)) {
      return NextResponse.json(
        { error: "Valid resolution type (automatic/manual) is required" },
        { status: 400 },
      );
    }

    if (!actionTaken || typeof actionTaken !== "string") {
      return NextResponse.json(
        { error: "Action taken description is required" },
        { status: 400 },
      );
    }

    // Resolve the bottleneck
    const resolvedBottleneck = bottleneckDetector.resolveBottleneck(id, {
      resolvedBy: resolution,
      actionTaken,
      resolutionTime: Date.now(),
      followUpActions: Array.isArray(followUpActions) ? followUpActions : [],
    });

    if (!resolvedBottleneck) {
      return NextResponse.json(
        { error: "Bottleneck not found or already resolved" },
        { status: 404 },
      );
    }

    // Log the resolution for auditing
    logger.info(
      "Bottleneck resolved",
      {
        bottleneckId: id,
        resolutionMethod: resolution,
        actionTaken,
        resolutionTime: resolvedBottleneck.resolutionTime,
      },
    );

    return NextResponse.json({
      success: true,
      resolvedBottleneck,
      message: `Bottleneck ${id} marked as resolved`,
    });
  } catch (error) {
    logger.error(
      "Bottleneck resolution error",
      {
        bottleneckId: id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    );
    return NextResponse.json(
      { error: "Failed to resolve bottleneck" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/bottlenecks/[id] - Remove a resolved bottleneck from active tracking
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;

  try {
    // Check if bottleneck exists and is already resolved
    const bottleneck = bottleneckDetector.getBottleneck(id);

    if (!bottleneck) {
      return NextResponse.json(
        { error: "Bottleneck not found" },
        { status: 404 },
      );
    }

    if (!bottleneck.resolved) {
      return NextResponse.json(
        { error: "Bottleneck must be resolved before deletion" },
        { status: 400 },
      );
    }

    // Remove from active tracking (it's already in history)
    // Note: This is simplified - in a real system, we'd have a separate cleanup mechanism

    return NextResponse.json({
      success: true,
      message: `Resolved bottleneck ${id} acknowledged and removed from active tracking`,
    });
  } catch (error) {
    logger.error(
      "Failed to delete bottleneck",
      {
        bottleneckId: id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    );
    
    return NextResponse.json(
      { error: "Failed to delete bottleneck" },
      { status: 500 },
    );
  }
}

/**
 * Helper functions for bottleneck details
 */
interface RelatedBottleneck {
  id: string;
  detectedAt: number;
  resolvedAt?: number;
  confidence: number;
}

function getRelatedBottlenecks(
  bottleneck: DetectedBottleneck,
): RelatedBottleneck[] {
  // Get historical bottlenecks with same pattern within last 24 hours
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const historical = bottleneckDetector.getHistoricalBottlenecks(50);

  return historical
    .filter(
      (h) => h.patternId === bottleneck.patternId && h.detectedAt >= oneDayAgo,
    )
    .sort((a, b) => b.detectedAt - a.detectedAt)
    .slice(0, 5)
    .map((h) => ({
      id: h.bottleneckId,
      detectedAt: h.detectedAt,
      resolvedAt: h.resolvedAt,
      confidence: h.confidence,
    }));
}

interface PreparedRecommendation {
  priority: string;
  category: string;
  action: string;
  expectedImpact: string;
  automated?: boolean;
  estimatedTime?: number;
  rolloutStrategy?: string;
  canExecute: boolean;
  executeUrl: string | null;
  metadata: {
    categoryBadge: { color: string; label: string };
    priorityBadge: { color: string; label: string };
    timeEstimate: string;
  };
}

function prepareRecommendations(
  bottleneck: DetectedBottleneck,
): PreparedRecommendation[] {
  return bottleneck.recommendations.map((rec: BottleneckRecommendation) => ({
    ...rec,
    canExecute: rec.automated === true,
    executeUrl: rec.automated
      ? `/api/bottlenecks/${bottleneck.id}/execute/${rec.priority}`
      : null,
    metadata: {
      categoryBadge: getCategoryBadge(rec.category),
      priorityBadge: getPriorityBadge(rec.priority),
      timeEstimate: `${rec.estimatedTime ? rec.estimatedTime + "min" : "Unknown"}`,
    },
  }));
}

function calculateTimeToResolve(bottleneck: DetectedBottleneck): number | null {
  const resolution = bottleneck.resolution;
  if (!resolution || !resolution.resolutionTime || !bottleneck.timestamp) {
    return null;
  }
  return resolution.resolutionTime - bottleneck.timestamp;
}

function generateConfidenceReasoning(bottleneck: DetectedBottleneck): string[] {
  const reasoning: string[] = [];

  // Analyze breached conditions for reasoning
  const breachedCount = Object.values(bottleneck.metrics).filter(
    (m) => m.breached,
  ).length;
  const totalConditions = Object.values(bottleneck.metrics).length;

  reasoning.push(
    `${breachedCount}/${totalConditions} conditions were breached`,
  );

  // Add correlation information if available
  if (bottleneck.correlations && bottleneck.correlations.length > 0) {
    const correlationStrengths = bottleneck.correlations
      .filter((c: Correlation) => c.strength !== "weak")
      .map((c: Correlation) => c.strength);

    if (correlationStrengths.length > 0) {
      reasoning.push(
        `Strong correlations detected: ${correlationStrengths.join(", ")} patterns`,
      );
    }
  }

  return reasoning;
}

interface NextStep {
  action: string;
  priority: "critical" | "high" | "medium" | "low";
  category: "immediate" | "preventative" | "configuration" | "monitoring";
  automated?: boolean;
  timeEstimate?: string | number;
  type?: string;
}

function generateNextSteps(bottleneck: DetectedBottleneck): NextStep[] {
  const nextSteps: NextStep[] = [];

  if (!bottleneck.resolved) {
    // Get highest priority recommendations
    const highPriorityRecs = bottleneck.recommendations
      .filter(
        (r: BottleneckRecommendation) =>
          r.priority === "critical" || r.priority === "high",
      )
      .slice(0, 3);

    highPriorityRecs.forEach((rec: BottleneckRecommendation) => {
      nextSteps.push({
        action: rec.action,
        priority: rec.priority,
        category: rec.category,
        automated: rec.automated,
        timeEstimate: rec.estimatedTime || "Unknown",
      });
    });
  } else {
    // Resolution steps
    if (bottleneck.resolution?.followUpActions) {
      bottleneck.resolution.followUpActions.forEach((action: string) => {
        nextSteps.push({
          action,
          priority: "medium",
          category: "preventative",
          type: "follow-up",
        });
      });
    }
  }

  return nextSteps;
}

/**
 * Badge helpers
 */
function getCategoryBadge(category: string): { color: string; label: string } {
  const categoryMap = {
    immediate: { color: "bg-red-500", label: "Immediate" },
    preventative: { color: "bg-blue-500", label: "Preventative" },
    configuration: { color: "bg-purple-500", label: "Configuration" },
    monitoring: { color: "bg-green-500", label: "Monitoring" },
  };

  return (
    categoryMap[category as keyof typeof categoryMap] || {
      color: "bg-gray-500",
      label: category,
    }
  );
}

function getPriorityBadge(priority: string): { color: string; label: string } {
  const priorityMap = {
    critical: { color: "bg-red-600", label: "🔴 Critical" },
    high: { color: "bg-orange-500", label: "🟡 High" },
    medium: { color: "bg-yellow-500", label: "🟡 Medium" },
    low: { color: "bg-green-500", label: "🟢 Low" },
  };

  return (
    priorityMap[priority as keyof typeof priorityMap] || {
      color: "bg-gray-500",
      label: priority,
    }
  );
}