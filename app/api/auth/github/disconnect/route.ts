import { NextRequest, NextResponse } from "next/server";
import { sessionManager } from "@/lib/sessions/session-manager";
import { SecureTokenStorage } from "@/lib/oauth-token-store";

/**
 * GitHub OAuth Disconnect Handler
 * Disconnects GitHub authentication for the current user
 */

const PROVIDER_NAME = "github";

// POST /api/auth/github/disconnect - Disconnect OAuth authentication
export async function POST(request: NextRequest) {
  try {
    // Get session ID from cookies
    const cookies = request.cookies;
    const sessionCookie = cookies.get("hyperpage-session");

    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, error: "No session found" },
        { status: 401 },
      );
    }

    const sessionId = sessionCookie.value;
    const session = await sessionManager.getSession(sessionId);

    if (!session?.userId) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const userId = session.userId;

    // Check if user is authenticated with GitHub
    if (session.user?.provider !== PROVIDER_NAME) {
      return NextResponse.json(
        { success: false, error: `Not authenticated with ${PROVIDER_NAME}` },
        { status: 400 },
      );
    }

    try {
      // Remove tokens from secure storage
      const tokenStorage = new SecureTokenStorage();
      await tokenStorage.removeTokens(userId, PROVIDER_NAME);

      // Update session to remove user authentication
      await sessionManager.updateSession(sessionId, {
        userId: undefined,
        user: undefined,
      });

      return NextResponse.json({
        success: true,
        message: `${PROVIDER_NAME} authentication disconnected successfully`,
      });
    } catch (storageError) {
      console.error(`${PROVIDER_NAME} disconnect storage error:`, storageError);
      return NextResponse.json(
        { success: false, error: "Failed to remove authentication data" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error(`${PROVIDER_NAME} disconnect error:`, error);
    return NextResponse.json(
      { success: false, error: "Failed to disconnect authentication" },
      { status: 500 },
    );
  }
}
