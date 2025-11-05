import { NextResponse } from "next/server";
import { getAllTools } from "../../../../tools";
import {
  testToolConnectivity,
  getAllToolsHealth,
  getCircuitBreakerStatus,
} from "../../../../tools/validation";
import logger from "../../../../lib/logger";

/**
 * Tool Health API Endpoint
 * Returns configuration validation and connectivity status for all tools
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const detailed = searchParams.get("detailed") === "true";
  const connectivity = searchParams.get("connectivity") === "true";

  try {
    const tools = getAllTools();

    // Get basic health status for all tools
    const healthResults = getAllToolsHealth();

    // If detailed mode is requested, include circuit breaker status
    if (detailed) {
      Object.keys(healthResults).forEach((toolSlug) => {
        const circuitBreaker = getCircuitBreakerStatus(toolSlug);
        healthResults[toolSlug] = {
          ...healthResults[toolSlug],
          circuitBreaker,
        };
      });
    }

    // If connectivity test is requested, test actual API connectivity
    if (connectivity) {
      const connectivityPromises = tools.map(async (tool) => {
        try {
          const result = await testToolConnectivity(tool, 3000); // 3 second timeout
          return { slug: tool.slug, connectivity: result };
        } catch {
          return {
            slug: tool.slug,
            connectivity: {
              isValid: false,
              errors: ["Connectivity test failed"],
              warnings: [],
              status: "error" as const,
            },
          };
        }
      });

      const connectivityResults = await Promise.all(connectivityPromises);

      connectivityResults.forEach(({ slug, connectivity }) => {
        if (healthResults[slug]) {
          healthResults[slug] = {
            ...healthResults[slug],
            connectivity,
          };
        }
      });
    }

    return NextResponse.json({
      tools: healthResults,
      timestamp: new Date().toISOString(),
      meta: {
        toolCount: tools.length,
        detailed,
        connectivity: connectivity ? "tested" : "not_tested",
      },
    });
  } catch (error) {
    logger.error("Failed to get tool health status", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      detailed,
      connectivity,
    });

    return NextResponse.json(
      { error: "Failed to get tool health status" },
      { status: 500 },
    );
  }
}
