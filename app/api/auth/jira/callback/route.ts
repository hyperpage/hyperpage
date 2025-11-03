import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getOAuthConfig, exchangeCodeForTokens } from "@/lib/oauth-config";
import { sessionManager } from "@/lib/sessions/session-manager";
import {
  getOAuthStateClearCookieOptions,
  getOAuthStateCookie,
} from "@/lib/oauth-state-cookies";
import { getAppDatabase } from "@/lib/database/connection";
import { SecureTokenStorage } from "@/lib/oauth-token-store";
import { users } from "@/lib/database/schema";
import { eq } from "drizzle-orm";

/**
 * Jira OAuth 2.0 Callback Handler
 * Handles authorization code exchange for access tokens
 */

const PROVIDER_NAME = "jira";

// GET /api/auth/jira/callback - Handle OAuth callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Check for OAuth errors
    if (error) {
      console.error(`${PROVIDER_NAME} OAuth error:`, error);
      const errorDescription =
        searchParams.get("error_description") || "Unknown error";
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${PROVIDER_NAME}_oauth_${error}&description=${encodeURIComponent(errorDescription)}`,
      );
    }

    // Validate required parameters
    if (!code) {
      console.error(
        `${PROVIDER_NAME} OAuth callback: Missing authorization code`,
      );
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${PROVIDER_NAME}_oauth_missing_code`,
      );
    }

    // Get OAuth configuration
    const oauthConfig = getOAuthConfig(PROVIDER_NAME);
    if (!oauthConfig) {
      console.error(`${PROVIDER_NAME} OAuth not configured`);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${PROVIDER_NAME}_oauth_not_configured`,
      );
    }

    // Validate state parameter for CSRF protection and extract stored webUrl
    let webUrl: string | null = null;

    if (state) {
      try {
        // Get OAuth state cookie for Jira (contains state and webUrl)
        const storedCookieValue = await getOAuthStateCookie(PROVIDER_NAME);

        if (!storedCookieValue) {
          console.error(
            `${PROVIDER_NAME} OAuth: Invalid state parameter - no cookie found`,
          );
          return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${PROVIDER_NAME}_oauth_invalid_state`,
          );
        }

        // Validate state matches cookie
        if (storedCookieValue !== state) {
          console.error(
            `${PROVIDER_NAME} OAuth: Invalid state parameter - state mismatch`,
          );
          return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${PROVIDER_NAME}_oauth_invalid_state`,
          );
        }

        // Since Jira stores additional data in cookie, get the full cookie data
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        const cookieName = `_oauth_state_${PROVIDER_NAME}`;

        const cookieValue = cookieStore.get(cookieName)?.value;
        if (cookieValue) {
          const cookieData = JSON.parse(cookieValue);
          webUrl = cookieData.webUrl || null;
        }
      } catch (cookieError) {
        console.error(
          `${PROVIDER_NAME} OAuth: Cookie validation failed:`,
          cookieError,
        );
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${PROVIDER_NAME}_oauth_invalid_state`,
        );
      }
    }

    // Get session ID for storing user authentication state
    const headersList = await headers();
    const sessionId = headersList.get("session-id") || crypto.randomUUID();

    // Exchange authorization code for tokens
    const tokenResponse = await exchangeCodeForTokens(oauthConfig, code);

    if (!tokenResponse.access_token) {
      console.error(`${PROVIDER_NAME} OAuth: Failed to obtain access token`);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${PROVIDER_NAME}_oauth_token_exchange_failed`,
      );
    }

    try {
      // Get user info from Jira API
      // Use webUrl retrieved from cookie, fallback to environment
      const finalWebUrl = webUrl || process.env.JIRA_WEB_URL;

      if (!finalWebUrl) {
        console.error(`${PROVIDER_NAME} OAuth: Web URL not configured`);
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${PROVIDER_NAME}_oauth_web_url_missing`,
        );
      }

      const userResponse = await fetch(`${finalWebUrl}/rest/api/3/myself`, {
        headers: {
          Authorization: `Bearer ${tokenResponse.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!userResponse.ok) {
        console.error(`${PROVIDER_NAME} OAuth: Failed to fetch user profile`);
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${PROVIDER_NAME}_oauth_user_fetch_failed`,
        );
      }

      const userProfile = await userResponse.json();

      // Generate unique user ID (format: provider:provider_id)
      const userId = `${PROVIDER_NAME}:${userProfile.accountId}`;

      // Connect to database
      const { drizzle: db } = getAppDatabase();

      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      // Create or update user profile
      await db
        .insert(users)
        .values({
          id: userId,
          provider: PROVIDER_NAME,
          providerUserId: userProfile.accountId,
          email: userProfile.emailAddress || null,
          username: userProfile.displayName || null,
          displayName: userProfile.displayName || null,
          avatarUrl: userProfile.avatarUrls?.["48x48"] || null,
          createdAt:
            existingUser.length > 0 ? existingUser[0].createdAt : Date.now(),
          updatedAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email: userProfile.emailAddress || null,
            username: userProfile.displayName || null,
            displayName: userProfile.displayName || null,
            avatarUrl: userProfile.avatarUrls?.["48x48"] || null,
            updatedAt: Date.now(),
          },
        });

      // Store tokens securely
      const tokenStorage = new SecureTokenStorage();
      const now = Date.now();

      await tokenStorage.storeTokens(userId, PROVIDER_NAME, {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || undefined,
        tokenType: tokenResponse.token_type || "Bearer",
        expiresAt: tokenResponse.expires_in
          ? now + tokenResponse.expires_in * 1000
          : undefined,
        refreshExpiresAt: undefined, // Jira typically doesn't specify refresh token expiry in OAuth 2.0
        scopes:
          typeof tokenResponse.scope === "string"
            ? tokenResponse.scope.split(" ")
            : undefined,
        metadata: {
          tokenResponse: tokenResponse,
          userProfile: userProfile,
          webUrl: finalWebUrl,
        },
      });

      // Get current session and merge authenticated tools
      const currentSession = await sessionManager.getSession(sessionId);

      // Update session with authentication status
      await sessionManager.updateSession(sessionId, {
        userId: userId,
        user: {
          id: userId,
          provider: PROVIDER_NAME,
          email: userProfile.emailAddress || undefined,
          username: userProfile.displayName || undefined,
          displayName: userProfile.displayName || undefined,
          avatarUrl: userProfile.avatarUrls?.["48x48"] || undefined,
        },
        authenticatedTools: {
          ...currentSession?.authenticatedTools,
          [PROVIDER_NAME]: {
            connected: true,
            connectedAt: new Date(),
            lastUsed: new Date(),
          },
        },
      });

      console.log(`${PROVIDER_NAME} OAuth successful for user: ${userId}`);
    } catch (storageError) {
      console.error(`${PROVIDER_NAME} OAuth storage error:`, storageError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${PROVIDER_NAME}_oauth_storage_error`,
      );
    }

    // Create response with cleared OAuth state cookie
    const successResponse = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?success=${PROVIDER_NAME}_oauth_connected`,
    );

    // Set client session cookie so UI can identify its session
    successResponse.cookies.set("hyperpage-session", sessionId, {
      httpOnly: false, // False so client can read it
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60, // 24 hours
    });

    // Clear OAuth state cookie after successful validation
    const { name, value, options } =
      getOAuthStateClearCookieOptions(PROVIDER_NAME);
    successResponse.cookies.set(name, value, options);

    return successResponse;
  } catch (error) {
    console.error(`${PROVIDER_NAME} OAuth callback error:`, error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${PROVIDER_NAME}_oauth_internal_error`,
    );
  }
}
