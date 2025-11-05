import { NextRequest, NextResponse } from "next/server";
import { sessionManager } from "@/lib/sessions/session-manager";
import { SecureTokenStorage } from "@/lib/oauth-token-store";
import logger from "@/lib/logger";

/**
 * GitLab OAuth Status Handler
 * Returns authentication status for GitLab
 */

const PROVIDER_NAME = "gitlab";

// GET /api/auth/gitlab/status - Get OAuth authentication status
export async function GET(request: NextRequest) {
  let sessionCookie: { value: string } | undefined;

  try {
    // Get session ID from cookies
    const cookies = request.cookies;
    sessionCookie = cookies.get("hyperpage-session");

    if (!sessionCookie) {
      return NextResponse.json({
        authenticated: false,
        lastConnectedAt: null,
        expiresAt: null,
      });
    }

    const sessionId = sessionCookie.value;
    const session = await sessionManager.getSession(sessionId);

    if (!session?.userId) {
      return NextResponse.json({
        authenticated: false,
        lastConnectedAt: null,
        expiresAt: null,
      });
    }

    const userId = session.userId;

    try {
      // Check if tokens exist for this user and tool
      const tokenStorage = new SecureTokenStorage();
      const tokens = await tokenStorage.getTokens(userId, PROVIDER_NAME);

      if (!tokens) {
        return NextResponse.json({
          authenticated: false,
          lastConnectedAt: null,
          expiresAt: null,
        });
      }

      // Check if tokens are expired
      const isExpired = tokenStorage.areExpired(tokens);
      const isRefreshExpired =
        tokens.refreshToken && tokenStorage.isRefreshExpired(tokens);

      // Consider authenticated if we have tokens and they're not completely expired
      // (having expired access token but valid refresh token is still partially authenticated)
      const authenticated =
        !isExpired || (!isRefreshExpired && tokens.refreshToken !== undefined);

      // Handle lastConnectedAt safely for Date constructor - ensure it's always a valid timestamp
      const lastConnectedAt =
        tokens.metadata?.lastConnectedAt &&
        typeof tokens.metadata.lastConnectedAt === "number"
          ? tokens.metadata.lastConnectedAt
          : Date.now();

      return NextResponse.json({
        authenticated,
        lastConnectedAt: new Date(lastConnectedAt).toISOString(),
        expiresAt: tokens.expiresAt
          ? new Date(tokens.expiresAt).toISOString()
          : null,
        isExpired,
        hasRefreshToken: !!tokens.refreshToken && !isRefreshExpired,
      });
    } catch (storageError) {
      logger.error("Failed to check GitLab authentication status in storage", { 
        storageError, 
        userId, 
        provider: PROVIDER_NAME 
      });
      // If storage check fails, assume not authenticated
      return NextResponse.json({
        authenticated: false,
        lastConnectedAt: null,
        expiresAt: null,
        error: "Failed to check authentication status",
      });
    }
  } catch (error) {
    logger.error("Failed to get GitLab authentication status", { 
      error, 
      sessionId: sessionCookie?.value, 
      provider: PROVIDER_NAME 
    });
    // Always return valid JSON in case of error
    return NextResponse.json(
      {
        authenticated: false,
        lastConnectedAt: null,
        expiresAt: null,
        error: "Failed to get authentication status",
      },
      { status: 500 },
    );
  }
}
