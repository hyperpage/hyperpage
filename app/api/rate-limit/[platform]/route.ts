// Rate limit monitoring endpoint for all platforms

import { NextRequest, NextResponse } from "next/server";
import { toolRegistry } from "../../../../tools/registry";
import { transformGitHubLimits, transformGitLabLimits, transformJiraLimits, calculateOverallStatus } from "../../../../lib/rate-limit-monitor";
import { Tool } from "../../../../tools/tool-types";
import { PlatformRateLimits } from "../../../../lib/types/rate-limit";

/**
 * GET /api/rate-limit/[platform] - Get rate limit status for a specific platform
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }): Promise<NextResponse> {
  const platform = (await params).platform;

  try {
    // Check if platform supports rate limit monitoring
    const tool = toolRegistry[platform];
    if (!tool || !tool.capabilities?.includes('rate-limit')) {
      return NextResponse.json({
        error: `Rate limit monitoring not supported for platform: ${platform}`,
        supportedPlatforms: Object.values(toolRegistry)
          .filter((tool): tool is Tool => tool !== undefined)
          .filter(tool => tool.capabilities?.includes('rate-limit'))
          .map(tool => tool.slug)
      }, { status: 400 });
    }

    // Tool must implement the rate-limit handler (tool is already validated above)
    const rateLimitHandler = (tool as Tool).handlers['rate-limit'];
    if (!rateLimitHandler) {
      return NextResponse.json({
        error: `Platform ${platform} supports rate limit monitoring but has no handler`
      }, { status: 500 });
    }

    // Call the tool's rate-limit handler
    const result = await rateLimitHandler(request, (tool as Tool).config!);

    if (!result.rateLimit) {
      return NextResponse.json({
        error: `Tool handler returned no rate limit data for ${platform}`
      }, { status: 500 });
    }

    // Transform platform-specific data to universal format
    let limits: PlatformRateLimits;
    try {
      switch (platform) {
        case 'github':
          limits = transformGitHubLimits(result.rateLimit);
          break;
        case 'gitlab':
          limits = transformGitLabLimits(result.rateLimit, null); // GitLab handler manages retry-after
          break;
        case 'jira':
          limits = transformJiraLimits(result.rateLimit);
          break;
        default:
          return NextResponse.json({
            error: `Rate limit transformation not implemented for platform: ${platform}`
          }, { status: 501 });
      }
    } catch (transformError) {
      console.error(`Error transforming rate limit data for ${platform}:`, transformError);
      return NextResponse.json({
        error: `Failed to transform rate limit data for ${platform}`
      }, { status: 500 });
    }

    // Calculate overall status and include complete status fields
    const status: 'normal' | 'warning' | 'critical' | 'unknown' = calculateOverallStatus(limits);
    const lastUpdated = Date.now();
    const dataFresh = true;

    // Return the complete RateLimitStatus format
    return NextResponse.json({
      platform,
      lastUpdated,
      dataFresh,
      status,
      limits
    });

  } catch (error) {
    console.error(`Rate limit API error for platform ${platform}:`, error);
    return NextResponse.json({
      error: `Internal error fetching rate limit status for ${platform}`
    }, { status: 500 });
  }
}
