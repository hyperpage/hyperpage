import { NextResponse } from "next/server";
import { defaultCache } from "@/lib/cache/cache-factory";
import { getActivePlatforms } from "@/lib/rate-limit-utils";
import { getServerRateLimitStatus } from "@/lib/rate-limit-service";
import { toolRegistry } from "@/tools/registry";
import { Tool } from "@/tools/tool-types";
import { checkPostgresConnectivity } from "@/lib/database/connection";

export async function GET() {
  const cacheStats = await defaultCache.getStats();

  // Get rate limit status for all enabled platforms
  const enabledTools: Tool[] = Object.values(toolRegistry).filter(
    (tool): tool is Tool =>
      Boolean(
        tool &&
          tool.enabled === true &&
          Array.isArray(tool.capabilities) &&
          tool.capabilities.includes("rate-limit"),
      ),
  );

  const activePlatforms = getActivePlatforms(
    enabledTools.map((tool) => ({
      slug: tool.slug,
      capabilities: tool.capabilities ?? [],
    })),
  );
  const rateLimitStatuses = await Promise.allSettled(
    activePlatforms.map((platform) => getServerRateLimitStatus(platform)),
  );

  // Aggregate rate limit metrics
  const platformMetrics = rateLimitStatuses.reduce(
    (
      acc: Record<
        string,
        {
          usagePercent: number | null;
          status: string;
          dataFresh: boolean;
          lastUpdated: number | null;
          resetTime: number | null;
        }
      >,
      result,
      index,
    ) => {
      const platform = activePlatforms[index];
      if (result.status === "fulfilled" && result.value) {
        const status = result.value;
        const maxUsage = Math.max(
          ...Object.values(status.limits).flatMap((platformLimits) =>
            Object.values(platformLimits || {}).map((usage) =>
              typeof (usage as { usagePercent?: number }).usagePercent ===
              "number"
                ? (usage as { usagePercent?: number }).usagePercent!
                : 0,
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
              Object.values(platformLimits || {}).map((usage) =>
                typeof (usage as { resetTime?: number }).resetTime === "number"
                  ? (usage as { resetTime?: number }).resetTime!
                  : 0,
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
    {} as Record<
      string,
      {
        usagePercent: number | null;
        status: string;
        dataFresh: boolean;
        lastUpdated: number | null;
        resetTime: number | null;
      }
    >,
  );

  // Calculate overall system rate limit health
  const overallHealth = Object.values(platformMetrics).reduce<
    "normal" | "warning" | "critical"
  >((acc, platform) => {
    if (acc === "critical" || platform.status === "critical") {
      return "critical";
    }
    if (acc === "warning" || platform.status === "warning") {
      return "warning";
    }
    return "normal";
  }, "normal");

  // Calculate aggregate metrics
  const validRates = Object.values(platformMetrics)
    .filter((platform) => platform.usagePercent !== null)
    .map((platform) => platform.usagePercent as number);

  const avgRateUsage =
    validRates.length > 0
      ? Math.round(
          validRates.reduce((sum, val) => sum + val, 0) / validRates.length,
        )
      : null;

  const dbHealth = await checkPostgresConnectivity();
  const isDbHealthy = dbHealth.status === "healthy";

  const status = isDbHealthy ? "healthy" : "unhealthy";
  const httpStatus = isDbHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: dbHealth,
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
    },
    { status: httpStatus },
  );
}
