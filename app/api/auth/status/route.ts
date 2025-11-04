import { NextRequest, NextResponse } from "next/server";
import { sessionManager } from "../../../../lib/sessions/session-manager";

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
    // Get session ID from cookies
    const { sessionId } = parseSessionCookies(request);

    if (!sessionId) {
      // No session means no authentication
      return NextResponse.json({
        success: true,
        authenticated: false,
        user: null,
        authenticatedTools: {},
      });
    }

    // Get session data
    const session = await sessionManager.getSession(sessionId);

    if (!session) {
      // Session not found means no authentication
      return NextResponse.json({
        success: true,
        authenticated: false,
        user: null,
        authenticatedTools: {},
      });
    }

    // Return authentication status
    return NextResponse.json({
      success: true,
      authenticated: !!session.userId,
      user: session.user || null,
      authenticatedTools: session.authenticatedTools || {},
    });
  } catch (error) {
    
    return NextResponse.json(
      { success: false, error: "Failed to get authentication status" },
      { status: 500 },
    );
  }
}
