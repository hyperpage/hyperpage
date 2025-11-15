import { NextRequest, NextResponse } from "next/server";
import promClient from "prom-client";

import { defaultCache } from "@/lib/cache/memory-cache";
import { getActivePlatforms } from "@/lib/rate-limit-utils";
import { getServerRateLimitStatus } from "@/lib/rate-limit-service";
import { toolRegistry } from "@/tools/registry";
import { performanceDashboard } from "@/lib/monitoring/performance-dashboard";
import { defaultHttpClient } from "@/lib/connection-pool";
import { DashboardMetrics } from "@/lib/monitoring/performance-dashboard";
import { Tool } from "@/tools/tool-types";
import logger from "@/lib/logger";
import { createErrorResponse } from "@/lib/api/responses";
const register = new promClient.Registry();

// Add default metrics (process, heap, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics for rate limiting
const rateLimitUsageGauge = new promClient.Gauge({
  name: "rate_limit_usage_percent",
  help: "Current rate limit usage percentage per platform (0-100)",
  labelNames: ["platform"],
  registers: [register],
});

const rateLimitStatusGauge = new promClient.Gauge({
  name: "rate_limit_status",
  help: "Current rate limit status per platform (0=normal, 1=warning, 2=critical, 3=unknown)",
  labelNames: ["platform"],
  registers: [register],
});

const rateLimitRemainingGauge = new promClient.Gauge({
  name: "rate_limit_remaining",
  help: "Remaining API calls for rate limits",
  labelNames: ["platform", "endpoint"],
  registers: [register],
});

const rateLimitMaxGauge = new promClient.Gauge({
  name: "rate_limit_max",
  help: "Maximum API calls allowed per rate limit",
  labelNames: ["platform", "endpoint"],
  registers: [register],
});

// Cache metrics
const cacheSizeGauge = new promClient.Gauge({
  name: "cache_entries_total",
  help: "Total number of entries in the cache",
  registers: [register],
});

const cacheHitsTotal = new promClient.Counter({
  name: "cache_hits_total",
  help: "Total number of cache hits",
  registers: [register],
});

const cacheMissesTotal = new promClient.Counter({
  name: "cache_misses_total",
  help: "Total number of cache misses",
  registers: [register],
});

const cacheExpiriesTotal = new promClient.Counter({
  name: "cache_expiries_total",
  help: "Total number of cache entries that expired",
  registers: [register],
});

const cacheEvictionsTotal = new promClient.Counter({
  name: "cache_evictions_total",
  help: "Total number of cache entries evicted due to size limits",
  registers: [register],
});

// Monitoring system metrics
const performanceSnapshotsTotal = new promClient.Counter({
  name: "hyperpage_performance_snapshots_total",
  help: "Total number of performance snapshots recorded",
  registers: [register],
});

const alertsActiveTotal = new promClient.Gauge({
  name: "hyperpage_alerts_active_total",
  help: "Total number of currently active alerts",
  labelNames: ["severity"],
  registers: [register],
});

const monitoringSystemHealthGauge = new promClient.Gauge({
  name: "hyperpage_monitoring_health_status",
  help: "Overall monitoring system health (1=healthy, 0=unhealthy)",
  registers: [register],
});

// Connection pool metrics
const connectionPoolActiveConnectionsGauge = new promClient.Gauge({
  name: "http_connection_pool_active_connections",
  help: "Number of currently active connections in the HTTP pool",
  registers: [register],
});

const connectionPoolIdleConnectionsGauge = new promClient.Gauge({
  name: "http_connection_pool_idle_connections",
  help: "Number of idle connections in the HTTP pool",
  registers: [register],
});

const connectionPoolTotalConnectionsGauge = new promClient.Gauge({
  name: "http_connection_pool_total_connections",
  help: "Total number of connections ever created by the HTTP pool",
  registers: [register],
});

const connectionPoolPendingRequestsGauge = new promClient.Gauge({
  name: "http_connection_pool_pending_requests",
  help: "Number of requests currently pending in the HTTP pool",
  registers: [register],
});

const connectionPoolAverageResponseTimeGauge = new promClient.Gauge({
  name: "http_connection_pool_average_response_time_ms",
  help: "Average response time for HTTP pool requests in milliseconds",
  registers: [register],
});

const connectionPoolSuccessRateGauge = new promClient.Gauge({
  name: "http_connection_pool_success_rate_percent",
  help: "Percentage of successful HTTP pool requests (0-100)",
  registers: [register],
});

const connectionPoolReuseRatioGauge = new promClient.Gauge({
  name: "http_connection_pool_reuse_ratio_percent",
  help: "Percentage of connections that were reused (0-100)",
  registers: [register],
});

const connectionPoolUtilizationGauge = new promClient.Gauge({
  name: "http_connection_pool_utilization_percent",
  help: "Current HTTP pool utilization percentage (0-100)",
  registers: [register],
});

const connectionPoolRequestsTotal = new promClient.Counter({
  name: "http_connection_pool_requests_total",
  help: "Total number of requests processed by the HTTP pool",
  registers: [register],
});

const connectionPoolHealthStatusGauge = new promClient.Gauge({
  name: "http_connection_pool_health_status",
  help: "Current health status of the HTTP connection pool (0=unhealthy, 1=degraded, 2=healthy)",
  registers: [register],
});

// Update metrics from current state
async function updateMetrics() {
  try {
    // Update cache metrics
    const cacheStats = await defaultCache.getStats();
    cacheSizeGauge.set(cacheStats.size);
    cacheHitsTotal.reset(); // Reset counter and set to current value
    cacheHitsTotal.inc(cacheStats.hits);
    cacheMissesTotal.reset();
    cacheMissesTotal.inc(cacheStats.misses);
    cacheExpiriesTotal.reset();
    cacheExpiriesTotal.inc(cacheStats.expiries);
    cacheEvictionsTotal.reset();
    cacheEvictionsTotal.inc(cacheStats.evictions);

    // Update monitoring system metrics
    const dashboardMetrics = performanceDashboard.exportMetrics("json");

    // Update performance snapshots count (approximation based on metrics data)
    if (dashboardMetrics && typeof dashboardMetrics === "object") {
      const overall = (dashboardMetrics as DashboardMetrics).overall;
      if (overall) {
        performanceSnapshotsTotal.reset();
        performanceSnapshotsTotal.inc(overall.totalRequests || 0);
      }

      // Update alert metrics
      const alerting = (dashboardMetrics as DashboardMetrics).alerting;
      if (alerting && alerting.activeAlerts) {
        alertsActiveTotal.set(
          { severity: "critical" },
          alerting.activeAlerts.highResponseTime ? 1 : 0,
        );
        alertsActiveTotal.set(
          { severity: "warning" },
          alerting.activeAlerts.highErrorRate ||
            alerting.activeAlerts.cacheLowHitRate ||
            alerting.activeAlerts.compressionLowRatio ||
            alerting.activeAlerts.batchHighLatency
            ? 1
            : 0,
        );
        alertsActiveTotal.set(
          { severity: "info" },
          alerting.activeAlerts.compressionLowRatio ? 1 : 0,
        );
      }
    }

    // Update monitoring system health
    try {
      // Get base URL from environment or construct from request in SSR context
      const baseUrl = process.env.BASE_URL || "http://localhost:3000";
      const dashboardHealth = await fetch(`${baseUrl}/api/dashboard`, {
        signal: AbortSignal.timeout(1000), // 1 second timeout
      });
      monitoringSystemHealthGauge.set(dashboardHealth.ok ? 1 : 0);
    } catch {
      monitoringSystemHealthGauge.set(0); // System unhealthy if dashboard unreachable
    }

    // Update rate limit metrics
    const enabledTools = (Object.values(toolRegistry) as Tool[]).filter(
      (tool): tool is Tool =>
        tool !== undefined &&
        tool.enabled === true &&
        Boolean(tool.capabilities?.includes("rate-limit")),
    );

    const activePlatforms = getActivePlatforms(enabledTools);

    for (const platform of activePlatforms) {
      try {
        const status = await getServerRateLimitStatus(platform);
        if (!status) continue;

        // Update platform-level metrics
        const maxUsage = Math.max(
          ...Object.values(status.limits).flatMap((platformLimits) =>
            Object.values(platformLimits || {}).map((usage) =>
              usage &&
              typeof usage === "object" &&
              "usagePercent" in usage &&
              typeof usage.usagePercent === "number"
                ? usage.usagePercent
                : 0,
            ),
          ),
        );

        const statusValue =
          status.status === "normal"
            ? 0
            : status.status === "warning"
              ? 1
              : status.status === "critical"
                ? 2
                : 3;

        rateLimitUsageGauge.set({ platform }, maxUsage);
        rateLimitStatusGauge.set({ platform }, statusValue);

        // Update per-endpoint metrics
        const platformLimits =
          status.limits[platform as keyof typeof status.limits];
        if (platformLimits) {
          Object.entries(platformLimits).forEach(([endpoint, usage]) => {
            if (
              usage &&
              typeof usage === "object" &&
              "limit" in usage &&
              "remaining" in usage
            ) {
              const limit = usage.limit as number | null;
              const remaining = usage.remaining as number | null;
              if (limit !== null && remaining !== null) {
                rateLimitMaxGauge.set({ platform, endpoint }, limit);
                rateLimitRemainingGauge.set({ platform, endpoint }, remaining);
              }
            }
          });
        }
      } catch (error) {
        logger.error(`Failed to fetch rate limit status for ${platform}`, {
          error: error instanceof Error ? error.message : String(error),
          platform,
          endpoint: "/api/metrics",
        });
        // Set status to unknown for failed platforms
        rateLimitStatusGauge.set({ platform }, 3);
      }
    }

    // Update connection pool metrics
    try {
      const poolMetrics = defaultHttpClient.getMetrics();
      const poolHealth = defaultHttpClient.getHealth();

      connectionPoolActiveConnectionsGauge.set(poolMetrics.activeConnections);
      connectionPoolIdleConnectionsGauge.set(poolMetrics.idleConnections);
      connectionPoolTotalConnectionsGauge.set(poolMetrics.totalConnections);
      connectionPoolPendingRequestsGauge.set(poolMetrics.pendingRequests);
      connectionPoolAverageResponseTimeGauge.set(
        poolMetrics.averageConnectionLifetime,
      );
      connectionPoolSuccessRateGauge.set(
        poolMetrics.connectionSuccessRate * 100,
      ); // Convert to percentage
      connectionPoolReuseRatioGauge.set(poolMetrics.reuseRatio * 100); // Convert to percentage

      // Calculate utilization (simplified version)
      const totalConnections =
        poolMetrics.activeConnections + poolMetrics.idleConnections;
      const utilization =
        totalConnections > 0
          ? (poolMetrics.activeConnections / totalConnections) * 100
          : 0;
      connectionPoolUtilizationGauge.set(utilization);

      // Set health status as numeric value
      const healthValue =
        poolHealth.status === "healthy"
          ? 2
          : poolHealth.status === "degraded"
            ? 1
            : 0;
      connectionPoolHealthStatusGauge.set(healthValue);

      // Update total requests counter (this is cumulative)
      connectionPoolRequestsTotal.reset();
      // We don't have a direct count, so we'll use active connections as approximation
      // In a real implementation, this would increment per request
      connectionPoolRequestsTotal.inc(poolMetrics.totalConnections);
    } catch (error) {
      logger.error("Failed to update connection pool metrics", {
        error: error instanceof Error ? error.message : String(error),
        endpoint: "/api/metrics",
        component: "connection_pool",
      });
      // Set error states
      connectionPoolHealthStatusGauge.set(0); // Unhealthy
    }
  } catch (error) {
    logger.error("Failed to update metrics", {
      error: error instanceof Error ? error.message : String(error),
      endpoint: "/api/metrics",
      function: "updateMetrics",
    });
  }
}

/**
 * GET /api/metrics - Expose Prometheus metrics
 */
export async function GET(_request: NextRequest) {
  try {
    // Update metrics before serving them
    await updateMetrics();

    // Generate Prometheus format response
    const metrics = await register.metrics();
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    logger.error("Failed to generate metrics", {
      error: error instanceof Error ? error.message : String(error),
      endpoint: "/api/metrics",
      method: "GET",
    });

    return createErrorResponse({
      code: "METRICS_GENERATION_FAILED",
      message: "Failed to generate metrics",
      status: 500,
    });
  }
}

// Note: Removed named export 'metrics' to fix Next.js route validation
// Metrics are now available through the /api/metrics endpoint only
// Individual metrics can be accessed via register.getMetricsAsJSON()
