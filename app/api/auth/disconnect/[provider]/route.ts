import { NextRequest, NextResponse } from "next/server";

import { sessionManager } from "@/lib/sessions/session-manager";
import { SecureTokenStorage } from "@/lib/oauth-token-store";
import logger from "@/lib/logger";

/**
 * Unified OAuth Disconnect Handler
 * Disconnects authentication for any provider (GitHub, GitLab, Jira)
 */

// POST /api/auth/disconnect/{provider} - Disconnect OAuth authentication
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

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

    // Check if user is authenticated with the specified provider
    if (session.user?.provider !== provider) {
      return NextResponse.json(
        { success: false, error: `Not authenticated with ${provider}` },
        { status: 400 },
      );
    }

    try {
      // Remove tokens from secure storage
      const tokenStorage = new SecureTokenStorage();
      await tokenStorage.removeTokens(userId, provider);

      // Update session to remove user authentication
      await sessionManager.updateSession(sessionId, {
        userId: undefined,
        user: undefined,
      });

      return NextResponse.json({
        success: true,
        message: `${provider} authentication disconnected successfully`,
      });
    } catch (storageError) {
      logger.error(
        `Failed to remove ${provider} authentication tokens during disconnect`,
        {
          provider,
          userId,
          error:
            storageError instanceof Error
              ? storageError.message
              : String(storageError),
        },
      );

      return NextResponse.json(
        { success: false, error: "Failed to remove authentication data" },
        { status: 500 },
      );
    }
  } catch (error) {
    logger.error(`Failed to disconnect ${provider} authentication`, {
      error: error instanceof Error ? error.message : String(error),
      provider,
    });

    return NextResponse.json(
      { success: false, error: "Failed to disconnect authentication" },
      { status: 500 },
    );
  }
}
