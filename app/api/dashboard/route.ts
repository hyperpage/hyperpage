import { NextRequest, NextResponse } from "next/server";

import {
  performanceDashboard,
  PerformanceThresholds,
} from "@/lib/monitoring/performance-dashboard";
import logger from "@/lib/logger";
import {
  createErrorResponse,
  validationErrorResponse,
} from "@/lib/api/responses";

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
const DEFAULT_TIME_WINDOW = 300000;
const MAX_TIME_WINDOW = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const timeWindow = url.searchParams.get("timeWindow");
    const format = (url.searchParams.get("format") || "json").toLowerCase();
    const timeWindowMs = timeWindow
      ? Number(timeWindow)
      : DEFAULT_TIME_WINDOW;

    if (
      Number.isNaN(timeWindowMs) ||
      timeWindowMs <= 0 ||
      timeWindowMs > MAX_TIME_WINDOW
    ) {
      return validationErrorResponse(
        "timeWindow must be a positive number up to 24h in milliseconds",
        "INVALID_TIME_WINDOW",
      );
    }

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

    return createErrorResponse({
      status: 500,
      code: "DASHBOARD_ERROR",
      message: "Failed to generate dashboard metrics",
    });
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

      if (!alertId || typeof alertId !== "string") {
        return validationErrorResponse(
          "alertId is required",
          "MISSING_ALERT_ID",
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

    return validationErrorResponse(
      "Invalid action. Supported actions: thresholds, resolve-alert",
      "INVALID_ACTION",
    );
  } catch (error) {
    logger.error("Failed to update dashboard settings", {
      error: error instanceof Error ? error.message : String(error),
      endpoint: "/api/dashboard",
      method: "POST",
      action: "thresholds",
    });

    return createErrorResponse({
      status: 500,
      code: "DASHBOARD_UPDATE_ERROR",
      message: "Failed to update dashboard settings",
    });
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
      return validationErrorResponse(
        "Invalid action. Use action=reset to reset dashboard metrics",
        "INVALID_RESET_ACTION",
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

    return createErrorResponse({
      status: 500,
      code: "DASHBOARD_RESET_ERROR",
      message: "Failed to reset dashboard metrics",
    });
  }
}
