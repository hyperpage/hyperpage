import { NextRequest, NextResponse } from "next/server";

import { sessionManager } from "@/lib/sessions/session-manager";
import logger from "@/lib/logger";
import { checkAuthRateLimit } from "@/lib/rate-limit-auth";

/**
 * Parse session cookies to extract session ID
 */
function parseSessionCookies(request: NextRequest): { sessionId?: string } {
  const cookies = request.cookies;
  const sessionCookie = cookies.get("hyperpage-session");

  if (sessionCookie) {
    return { sessionId: sessionCookie.value };
  }

  return {};
}

/**
 * Get OAuth authentication status for current user
 * Returns authentication status for all enabled tools
 */
export async function GET(request: NextRequest) {
  try {
    // Check rate limiting first to prevent spam
    const rateLimitResponse = checkAuthRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Get session ID from cookies
    const { sessionId } = parseSessionCookies(request);

    let result;

    if (!sessionId) {
      // No session means no authentication
      result = {
        success: true,
        authenticated: false,
        user: null,
        authenticatedTools: {},
      };
    } else {
      // Get session data
      const session = await sessionManager.getSession(sessionId);

      if (!session) {
        // Session not found means no authentication
        result = {
          success: true,
          authenticated: false,
          user: null,
          authenticatedTools: {},
        };
      } else {
        // Return authentication status
        result = {
          success: true,
          authenticated: !!session.userId,
          user: session.user || null,
          authenticatedTools: session.authenticatedTools || {},
        };
      }
    }

    // Add response caching headers to reduce spam
    const response = NextResponse.json(result);

    // Cache for 30 seconds to reduce server load
    response.headers.set(
      "Cache-Control",
      "public, max-age=30, stale-while-revalidate=60",
    );

    // Add ETag for conditional requests
    const etag = `"auth-status-${sessionId || "anonymous"}-${Date.now()}"`;
    response.headers.set("ETag", etag);

    // Handle If-None-Match for conditional requests
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: response.headers,
      });
    }

    return response;
  } catch (error) {
    logger.error("Failed to get authentication status", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { success: false, error: "Failed to get authentication status" },
      { status: 500 },
    );
  }
}
