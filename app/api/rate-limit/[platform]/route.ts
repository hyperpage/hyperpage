// Rate limit monitoring endpoint for all platforms

import { NextRequest, NextResponse } from "next/server";
import logger from "../../../../lib/logger";
import { toolRegistry } from "../../../../tools/registry";
import { getServerRateLimitStatus } from "../../../../lib/rate-limit-service";
import { Tool } from "../../../../tools/tool-types";

/**
 * GET /api/rate-limit/[platform] - Get rate limit status for a specific platform
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
): Promise<NextResponse> {
  const platform = (await params).platform;

  try {
    // Check if platform supports rate limit monitoring
    const tool = toolRegistry[platform];
    if (!tool || !tool.capabilities?.includes("rate-limit")) {
      return NextResponse.json(
        {
          error: `Rate limit monitoring not supported for platform: ${platform}`,
          supportedPlatforms: Object.values(toolRegistry)
            .filter((tool): tool is Tool => tool !== undefined)
            .filter((tool) => tool.capabilities?.includes("rate-limit"))
            .map((tool) => tool.slug),
        },
        { status: 400 },
      );
    }

    // Get the base URL for API calls
    const baseUrl = request.headers.get("host")
      ? `${request.headers.get("x-forwarded-proto") || "http"}://${request.headers.get("host")}`
      : "http://localhost:3000";

    // Use the server-only rate limit service
    const rateLimitStatus = await getServerRateLimitStatus(platform, baseUrl);

    if (!rateLimitStatus) {
      return NextResponse.json(
        {
          error: `Rate limit monitoring not supported or failed for platform: ${platform}`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(rateLimitStatus);
  } catch (error) {
    logger.error("Rate limit status fetch error", {
      error: error instanceof Error ? error.message : String(error),
      platform,
      operation: "getServerRateLimitStatus",
    });
    return NextResponse.json(
      {
        error: `Internal error fetching rate limit status for ${platform}`,
      },
      { status: 500 },
    );
  }
}
