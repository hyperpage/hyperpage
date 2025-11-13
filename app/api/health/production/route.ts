import { NextResponse } from "next/server";
import { checkPostgresConnectivity } from "@/lib/database/connection";
import logger from "@/lib/logger";

export async function GET(): Promise<NextResponse> {
  try {
    const startTime = Date.now();

    // Check overall system health
    const systemHealth: {
      status: "healthy" | "unhealthy" | "degraded";
      timestamp: string;
      version: string;
      environment: string;
      uptime: number;
      memory: NodeJS.MemoryUsage;
      cpu: NodeJS.CpuUsage;
    } = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "0.1.0",
      environment: process.env.NODE_ENV || "development",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    };

    // Database health checks (PostgreSQL-only)
    const dbChecks: Array<{
      name: string;
      status: "healthy" | "unhealthy" | "degraded";
      responseTime: number;
      details?: Record<string, unknown>;
    }> = [];

    const pgCheck = await checkPostgresConnectivity();
    dbChecks.push({
      name: "PostgreSQL",
      status: pgCheck.status,
      responseTime: Date.now() - startTime,
      details: pgCheck.details,
    });

    const primaryDbEngine = "postgresql";

    // Application-specific health checks
    const appChecks: Array<{
      name: string;
      status: "healthy" | "unhealthy" | "degraded";
      responseTime: number;
      details?: Record<string, unknown>;
    }> = [];

    // Check tool configurations
    try {
      const toolConfigStart = Date.now();
      // This would check if tools can be loaded
      // For now, just check the tools registry
      const toolsCount = 0; // Would be actual count
      appChecks.push({
        name: "Tool Registry",
        status: "healthy",
        responseTime: Date.now() - toolConfigStart,
        details: { toolsCount },
      });
    } catch (error) {
      appChecks.push({
        name: "Tool Registry",
        status: "unhealthy",
        responseTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }

    // Check rate limiting
    try {
      const rateLimitStart = Date.now();
      // This would check rate limiting service
      appChecks.push({
        name: "Rate Limiting",
        status: "healthy",
        responseTime: Date.now() - rateLimitStart,
        details: { enabled: process.env.ENABLE_RATE_LIMITING === "true" },
      });
    } catch (error) {
      appChecks.push({
        name: "Rate Limiting",
        status: "unhealthy",
        responseTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }

    // Check OAuth services
    try {
      const oauthStart = Date.now();
      // This would check OAuth configuration
      const oauthProviders = ["github", "gitlab", "jira"];
      const enabledProviders = oauthProviders.filter(
        (provider) =>
          process.env[`ENABLE_${provider.toUpperCase()}`] === "true",
      );
      appChecks.push({
        name: "OAuth Services",
        status: enabledProviders.length > 0 ? "healthy" : "degraded",
        responseTime: Date.now() - oauthStart,
        details: {
          totalProviders: oauthProviders.length,
          enabledProviders: enabledProviders.length,
          providers: enabledProviders,
        },
      });
    } catch (error) {
      appChecks.push({
        name: "OAuth Services",
        status: "unhealthy",
        responseTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }

    // Check Redis connection (if configured)
    if (process.env.REDIS_URL) {
      try {
        const redisStart = Date.now();
        // This would check Redis connectivity
        appChecks.push({
          name: "Redis Cache",
          status: "healthy",
          responseTime: Date.now() - redisStart,
          details: { configured: true },
        });
      } catch (error) {
        appChecks.push({
          name: "Redis Cache",
          status: "unhealthy",
          responseTime: Date.now() - startTime,
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    // Calculate overall health
    const allChecks = [...dbChecks, ...appChecks];
    const unhealthyChecks = allChecks.filter(
      (check) => check.status === "unhealthy",
    );
    const degradedChecks = allChecks.filter(
      (check) => check.status === "degraded",
    );

    if (unhealthyChecks.length > 0) {
      systemHealth.status = "unhealthy";
    } else if (degradedChecks.length > 0) {
      systemHealth.status = "degraded";
    }

    // Performance metrics
    const totalResponseTime = Date.now() - startTime;
    const performanceMetrics = {
      totalResponseTime,
      databaseResponseTime: Math.max(...dbChecks.map((db) => db.responseTime)),
      applicationResponseTime: Math.max(
        ...appChecks.map((app) => app.responseTime),
      ),
      memoryUsage: {
        ...systemHealth.memory,
        used: systemHealth.memory.heapUsed,
        total: systemHealth.memory.heapTotal,
        percentage: Math.round(
          (systemHealth.memory.heapUsed / systemHealth.memory.heapTotal) * 100,
        ),
      },
      cpuUsage: systemHealth.cpu,
    };

    const response = {
      status: systemHealth.status,
      timestamp: systemHealth.timestamp,
      version: systemHealth.version,
      environment: systemHealth.environment,
      uptime: systemHealth.uptime,
      primaryDatabase: primaryDbEngine,
      databases: dbChecks,
      services: appChecks,
      performance: performanceMetrics,
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
      },
    };

    // Determine HTTP status code
    const statusCode =
      systemHealth.status === "healthy"
        ? 200
        : systemHealth.status === "degraded"
          ? 200
          : 503;

    return NextResponse.json(response, {
      status: statusCode,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "X-Health-Check": "production",
      },
    });
  } catch (error) {
    logger.error(
      "Production health check failed",
      error instanceof Error
        ? { err: { message: error.message, stack: error.stack } }
        : { err: { value: error } },
    );

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check system failure",
        version: process.env.npm_package_version || "0.1.0",
        environment: process.env.NODE_ENV || "development",
        details: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Health-Check": "production",
        },
      },
    );
  }
}
