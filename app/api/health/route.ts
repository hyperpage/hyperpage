/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { defaultCache } from "@/lib/cache/memory-cache";
import { getActivePlatforms } from "@/lib/rate-limit-utils";
import { getServerRateLimitStatus } from "@/lib/rate-limit-service";
import { toolRegistry } from "@/tools/registry";

export async function GET() {
  const cacheStats = await defaultCache.getStats();

  // Get rate limit status for all enabled platforms
  const enabledTools = (Object.values(toolRegistry) as any[]).filter(
    (tool) =>
      tool &&
      tool.enabled === true &&
      tool.capabilities?.includes("rate-limit"),
  );

  const activePlatforms = getActivePlatforms(enabledTools);
  const rateLimitStatuses = await Promise.allSettled(
    activePlatforms.map((platform) => getServerRateLimitStatus(platform)),
  );

  // Aggregate rate limit metrics
  const platformMetrics = rateLimitStatuses.reduce(
    (acc, result, index) => {
      const platform = activePlatforms[index];
      if (result.status === "fulfilled" && result.value) {
        const status = result.value;
        const maxUsage = Math.max(
          ...Object.values(status.limits).flatMap((platformLimits) =>
            Object.values(platformLimits || {}).map(
              (usage: any) => usage.usagePercent || 0,
            ),
          ),
        );

        acc[platform] = {
          usagePercent: Math.round(maxUsage),
          status: status.status,
          dataFresh: status.dataFresh,
          lastUpdated: status.lastUpdated,
          resetTime: Math.max(
            ...Object.values(status.limits).flatMap((platformLimits) =>
              Object.values(platformLimits || {}).map(
                (usage: any) => usage.resetTime || 0,
              ),
            ),
          ),
        };
      } else {
        acc[platform] = {
          usagePercent: null,
          status: "unknown",
          dataFresh: false,
          lastUpdated: null,
          resetTime: null,
        };
      }
      return acc;
    },
    {} as Record<string, any>,
  );

  // Calculate overall system rate limit health
  const overallHealth = Object.values(platformMetrics).reduce(
    (acc: string, platform: any) => {
      if (acc === "critical" || platform.status === "critical")
        return "critical";
      if (acc === "warning" || platform.status === "warning") return "warning";
      return "normal";
    },
    "normal",
  );

  // Calculate aggregate metrics
  const validRates = Object.values(platformMetrics)
    .filter((platform: any) => platform.usagePercent !== null)
    .map((platform: any) => platform.usagePercent);

  const avgRateUsage =
    validRates.length > 0
      ? Math.round(
          validRates.reduce((sum, val) => sum + val, 0) / validRates.length,
        )
      : null;

  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    cache: {
      ...cacheStats,
      hitRate:
        cacheStats.hits + cacheStats.misses > 0
          ? Math.round(
              (cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100,
            )
          : 0,
    },
    rateLimits: {
      overallHealth,
      enabledPlatforms: activePlatforms.length,
      averageUsagePercent: avgRateUsage,
      platforms: platformMetrics,
    },
  });
}
