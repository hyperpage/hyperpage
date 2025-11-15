import { NextRequest, NextResponse } from "next/server";

import { sessionManager } from "@/lib/sessions/session-manager";
import { SecureTokenStorage } from "@/lib/oauth-token-store";
import logger from "@/lib/logger";
import {
  createErrorResponse,
  validationErrorResponse,
} from "@/lib/api/responses";

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
  const normalizedProvider = provider?.toLowerCase();
  const allowedProviders = new Set(["github", "gitlab", "jira"]);

  if (!normalizedProvider || !allowedProviders.has(normalizedProvider)) {
    return validationErrorResponse("Unsupported provider", "INVALID_PROVIDER", {
      provider,
    });
  }

  try {
    // Get session ID from cookies
    const cookies = request.cookies;
    const sessionCookie = cookies.get("hyperpage-session");

    if (!sessionCookie) {
      return createErrorResponse({
        status: 401,
        code: "SESSION_REQUIRED",
        message: "No session found",
      });
    }

    const sessionId = sessionCookie.value;
    const session = await sessionManager.getSession(sessionId);

    if (!session?.userId) {
      return createErrorResponse({
        status: 401,
        code: "NOT_AUTHENTICATED",
        message: "Not authenticated",
      });
    }

    const userId = session.userId;

    // Check if user is authenticated with the specified provider
    if (session.user?.provider !== normalizedProvider) {
      return validationErrorResponse(
        `Not authenticated with ${normalizedProvider}`,
        "PROVIDER_NOT_AUTHENTICATED",
      );
    }

    try {
      // Remove tokens from secure storage
      const tokenStorage = new SecureTokenStorage();
      await tokenStorage.removeTokens(userId, normalizedProvider);

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

      return createErrorResponse({
        status: 500,
        code: "DISCONNECT_STORAGE_ERROR",
        message: "Failed to remove authentication data",
      });
    }
  } catch (error) {
    logger.error(`Failed to disconnect ${provider} authentication`, {
      error: error instanceof Error ? error.message : String(error),
      provider,
    });

    return createErrorResponse({
      status: 500,
      code: "DISCONNECT_ERROR",
      message: "Failed to disconnect authentication",
    });
  }
}
