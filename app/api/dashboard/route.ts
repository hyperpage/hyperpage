import { NextRequest, NextResponse } from "next/server";
import {
  performanceDashboard,
  PerformanceThresholds,
} from "../../../lib/monitoring/performance-dashboard";
import logger from "../../../lib/logger";

/**
 * GET /api/dashboard - Get real-time performance dashboard metrics
 *
 * Returns comprehensive performance metrics including response times,
 * caching efficiency, compression stats, batch processing, and active alerts.
 *
 * Query Parameters:
 * - timeWindow: Time window in milliseconds (default: 300000 = 5 minutes)
 * - format: Response format - 'json' or 'prometheus' (default: 'json')
 *
 * Response Formats:
 * - JSON: Full dashboard metrics object
 * - Prometheus: Exposable metrics in Prometheus text format
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const timeWindowMs = parseInt(
      url.searchParams.get("timeWindow") || "300000",
    );
    const format = url.searchParams.get("format") || "json";

    if (format === "prometheus") {
      const prometheusMetrics = performanceDashboard.exportMetrics(
        "prometheus",
        timeWindowMs,
      ) as string;
      return new NextResponse(prometheusMetrics, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    // JSON format - full dashboard metrics
    const metrics = performanceDashboard.getDashboardMetrics(timeWindowMs);

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        timeWindowMs,
        metrics,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=5", // Short cache for real-time monitoring
        },
      },
    );
  } catch (error) {
    logger.error("Failed to generate dashboard metrics", {
      error: error instanceof Error ? error.message : String(error),
      endpoint: "/api/dashboard",
      method: "GET",
    });

    return NextResponse.json(
      {
        error: "Failed to generate dashboard metrics",
        code: "DASHBOARD_ERROR",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * POST /api/dashboard/thresholds - Update performance thresholds
 *
 * Updates the performance thresholds used for alerting.
 * All thresholds are optional - only provided values are updated.
 *
 * Request Body:
 * {
 *   "maxResponseTimeMs": {
 *     "p95": 500,
 *     "p99": 2000
 *   },
 *   "maxErrorRate": 5.0,
 *   "minCacheHitRate": 70.0,
 *   "maxMemoryUsage": 85.0,
 *   "minCompressionRatio": 40.0,
 *   "maxBatchDurationMs": 10000,
 *   "circuitBreakerThreshold": 10
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "thresholds") {
      const updates = await request.json();

      // Validate threshold updates
      const validatedUpdates: Partial<PerformanceThresholds> = {};

      if (updates.maxResponseTimeMs?.p95) {
        validatedUpdates.maxResponseTimeMs = {
          ...performanceDashboard.getPerformanceThresholds().maxResponseTimeMs,
          ...updates.maxResponseTimeMs,
        };
      }

      if (typeof updates.maxErrorRate === "number") {
        validatedUpdates.maxErrorRate = updates.maxErrorRate;
      }

      if (typeof updates.minCacheHitRate === "number") {
        validatedUpdates.minCacheHitRate = updates.minCacheHitRate;
      }

      if (typeof updates.maxMemoryUsage === "number") {
        validatedUpdates.maxMemoryUsage = updates.maxMemoryUsage;
      }

      if (typeof updates.minCompressionRatio === "number") {
        validatedUpdates.minCompressionRatio = updates.minCompressionRatio;
      }

      if (typeof updates.maxBatchDurationMs === "number") {
        validatedUpdates.maxBatchDurationMs = updates.maxBatchDurationMs;
      }

      if (typeof updates.circuitBreakerThreshold === "number") {
        validatedUpdates.circuitBreakerThreshold =
          updates.circuitBreakerThreshold;
      }

      // Update thresholds
      performanceDashboard.updatePerformanceThresholds(validatedUpdates);

      return NextResponse.json({
        success: true,
        message: "Performance thresholds updated successfully",
        updatedThresholds: performanceDashboard.getPerformanceThresholds(),
      });
    } else if (action === "resolve-alert") {
      const { alertId } = await request.json();

      if (!alertId) {
        return NextResponse.json(
          {
            error: "alertId is required",
            code: "MISSING_ALERT_ID",
          },
          { status: 400 },
        );
      }

      const resolved = performanceDashboard.resolveAlert(alertId);

      return NextResponse.json({
        success: resolved,
        message: resolved
          ? "Alert resolved"
          : "Alert not found or already resolved",
      });
    }

    return NextResponse.json(
      {
        error: "Invalid action. Supported actions: thresholds, resolve-alert",
        code: "INVALID_ACTION",
      },
      { status: 400 },
    );
  } catch (error) {
    logger.error("Failed to update dashboard settings", {
      error: error instanceof Error ? error.message : String(error),
      endpoint: "/api/dashboard",
      method: "POST",
      action: "thresholds",
    });

    return NextResponse.json(
      {
        error: "Failed to update dashboard settings",
        code: "DASHBOARD_UPDATE_ERROR",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/dashboard/reset - Reset dashboard metrics
 *
 * Clears all performance snapshots and alert history.
 * Use with caution in production environments.
 */
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action !== "reset") {
      return NextResponse.json(
        {
          error: "Invalid action. Use action=reset to reset dashboard metrics",
          code: "INVALID_RESET_ACTION",
        },
        { status: 400 },
      );
    }

    // Reset dashboard metrics
    performanceDashboard.reset();

    return NextResponse.json({
      success: true,
      message: "Dashboard metrics and alert history have been reset",
    });
  } catch (error) {
    logger.error("Failed to reset dashboard metrics", {
      error: error instanceof Error ? error.message : String(error),
      endpoint: "/api/dashboard",
      method: "DELETE",
      action: "reset",
    });

    return NextResponse.json(
      {
        error: "Failed to reset dashboard metrics",
        code: "DASHBOARD_RESET_ERROR",
      },
      { status: 500 },
    );
  }
}
