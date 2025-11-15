import { NextRequest, NextResponse } from "next/server";

import { bottleneckDetector } from "@/lib/monitoring/bottleneck-detector";
import {
  DetectedBottleneck,
  BottleneckHistory,
} from "@/lib/monitoring/bottleneck-detector";
import logger from "@/lib/logger";
import {
  createErrorResponse,
  validationErrorResponse,
} from "@/lib/api/responses";

/**
 * GET /api/bottlenecks - Get all active and recent bottleneck detections
 */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_TIME_RANGE = 3600000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const includeHistory = searchParams.get("history") === "true";
  const limitParam = searchParams.get("limit") || `${DEFAULT_LIMIT}`;
  const timeRangeParam =
    searchParams.get("timeRange") || `${DEFAULT_TIME_RANGE}`;

  const limit = Number(limitParam);
  if (Number.isNaN(limit) || limit <= 0 || limit > MAX_LIMIT) {
    return validationErrorResponse(
      `limit must be between 1 and ${MAX_LIMIT}`,
      "INVALID_LIMIT",
    );
  }

  const timeRange = Number(timeRangeParam);
  if (
    Number.isNaN(timeRange) ||
    timeRange <= 0 ||
    timeRange > 24 * 60 * 60 * 1000
  ) {
    return validationErrorResponse(
      "timeRange must be a positive number up to 24h in milliseconds",
      "INVALID_TIME_RANGE",
    );
  }

  try {
    // Get active bottlenecks
    const activeBottlenecks = bottleneckDetector.getActiveBottlenecks();

    // Get analysis statistics
    const analysis = bottleneckDetector.getBottleneckAnalysis();

    // Get recent history if requested
    const historicalBottlenecks = includeHistory
      ? bottleneckDetector.getHistoricalBottlenecks(limit)
      : [];

    // Calculate trend analysis (simplified - expanding recent data)
    const trends = calculateBottleneckTrends(
      activeBottlenecks,
      historicalBottlenecks,
      timeRange,
    );

    // Get correlation data for active bottlenecks
    const correlationData = activeBottlenecks.map(
      (bottleneck: DetectedBottleneck) =>
        bottleneckDetector.getCorrelationData(bottleneck),
    );

    return NextResponse.json({
      activeBottlenecks,
      analysis,
      historicalBottlenecks,
      trends,
      correlationData,
      timestamp: Date.now(),
      summary: {
        criticalCount: activeBottlenecks.filter(
          (b: DetectedBottleneck) => b.impact === "critical",
        ).length,
        warningCount: activeBottlenecks.filter(
          (b: DetectedBottleneck) =>
            b.impact === "severe" || b.impact === "moderate",
        ).length,
        lastDetection:
          activeBottlenecks.length > 0
            ? Math.max(
                ...activeBottlenecks.map(
                  (b: DetectedBottleneck) => b.timestamp,
                ),
              )
            : null,
      },
    });
  } catch (error) {
    logger.error("Failed to retrieve bottleneck data", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      includeHistory,
      limit,
      timeRange,
    });

    return createErrorResponse({
      status: 500,
      code: "BOTTLENECK_LIST_ERROR",
      message: "Failed to retrieve bottleneck data",
    });
  }
}

/**
 * POST /api/bottlenecks - Trigger manual bottleneck analysis
 */
export async function POST(request: NextRequest) {
  let timeRange: number | undefined;
  let categories: unknown;
  let severities: unknown;

  try {
    const body = await request.json();
    timeRange = body.timeRange;
    categories = body.categories;
    severities = body.severities;

    if (timeRange !== undefined) {
      const parsedTimeRange = Number(timeRange);
      if (
        Number.isNaN(parsedTimeRange) ||
        parsedTimeRange <= 0 ||
        parsedTimeRange > 24 * 60 * 60 * 1000
      ) {
        return validationErrorResponse(
          "timeRange must be a positive number up to 24h in milliseconds",
          "INVALID_TIME_RANGE",
        );
      }
      timeRange = parsedTimeRange;
    }

    // Force a detection cycle with custom parameters
    const analysisTimeRange = timeRange || 300000; // 5 minutes default

    // Optional: Trigger detection cycle
    // In a real implementation, you'd force a detection cycle here

    return NextResponse.json({
      message: "Bottleneck analysis triggered",
      parameters: { timeRange: analysisTimeRange, categories, severities },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to trigger bottleneck analysis", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timeRange,
      categories,
      severities,
    });

    return createErrorResponse({
      status: 500,
      code: "BOTTLENECK_TRIGGER_ERROR",
      message: "Failed to trigger bottleneck analysis",
    });
  }
}

/**
 * Helper function to calculate bottleneck trends
 */
function calculateBottleneckTrends(
  active: DetectedBottleneck[],
  historical: BottleneckHistory[],
  timeRange: number,
) {
  const windowStart = Date.now() - timeRange;
  const recentHistorical = historical.filter(
    (h) => h.detectedAt >= windowStart,
  );

  const patternCounts = new Map<
    string,
    { count: number; totalConfidence: number }
  >();

  [...active, ...recentHistorical].forEach(
    (bottleneck: DetectedBottleneck | BottleneckHistory) => {
      const patternId = bottleneck.patternId;
      const existing = patternCounts.get(patternId) || {
        count: 0,
        totalConfidence: 0,
      };
      patternCounts.set(patternId, {
        count: existing.count + 1,
        totalConfidence: existing.totalConfidence + bottleneck.confidence,
      });
    },
  );

  const trends = Array.from(patternCounts.entries()).map(
    ([patternId, data]) => ({
      patternId,
      frequency: data.count / (timeRange / (1000 * 60 * 60)), // per hour
      averageConfidence: data.totalConfidence / data.count,
    }),
  );

  return trends.sort((a, b) => b.frequency - a.frequency);
}
