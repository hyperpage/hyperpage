// Rate limit monitoring endpoint for all platforms

import { NextRequest, NextResponse } from "next/server";

import logger from "@/lib/logger";
import { toolRegistry } from "@/tools/registry";
import { getServerRateLimitStatus } from "@/lib/rate-limit-service";
import { Tool } from "@/tools/tool-types";
import {
  createErrorResponse,
  validationErrorResponse,
} from "@/lib/api/responses";

/**
 * GET /api/rate-limit/[platform] - Get rate limit status for a specific platform
 */
const PLATFORM_REGEX = /^[a-zA-Z0-9._-]+$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
): Promise<NextResponse> {
  const platform = (await params).platform;

  if (!PLATFORM_REGEX.test(platform)) {
    return validationErrorResponse("Invalid platform parameter", "INVALID_PLATFORM");
  }

  try {
    // Check if platform supports rate limit monitoring
    const tool = toolRegistry[platform];
    if (!tool || !tool.capabilities?.includes("rate-limit")) {
      return validationErrorResponse(
        "Rate limit monitoring not supported for this platform",
        "PLATFORM_NOT_SUPPORTED",
        {
          platform,
          supportedPlatforms: Object.values(toolRegistry)
            .filter((tool): tool is Tool => tool !== undefined)
            .filter((tool) => tool.capabilities?.includes("rate-limit"))
            .map((tool) => tool.slug),
        },
      );
    }

    // Get the base URL for API calls
    const baseUrl = request.headers.get("host")
      ? `${request.headers.get("x-forwarded-proto") || "http"}://${request.headers.get("host")}`
      : "http://localhost:3000";

    // Use the server-only rate limit service
    const rateLimitStatus = await getServerRateLimitStatus(platform, baseUrl);

    if (!rateLimitStatus) {
      return createErrorResponse({
        status: 502,
        code: "RATE_LIMIT_UNAVAILABLE",
        message: `Rate limit monitoring not supported or failed for platform: ${platform}`,
      });
    }

    return NextResponse.json(rateLimitStatus);
  } catch (error) {
    logger.error("Rate limit status fetch error", {
      error: error instanceof Error ? error.message : String(error),
      platform,
      operation: "getServerRateLimitStatus",
    });
    return createErrorResponse({
      status: 500,
      code: "RATE_LIMIT_FETCH_ERROR",
      message: "Failed to fetch rate limit status",
    });
  }
}
