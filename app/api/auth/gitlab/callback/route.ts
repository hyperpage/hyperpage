import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getOAuthConfig, exchangeCodeForTokens } from "@/lib/oauth-config";
import { sessionManager } from "@/lib/sessions/session-manager";
import {
  validateOAuthState,
  getOAuthStateClearCookieOptions,
} from "@/lib/oauth-state-cookies";
import { getAppDatabase } from "@/lib/database/connection";
import { SecureTokenStorage } from "@/lib/oauth-token-store";
import { users } from "@/lib/database/schema";
import { eq } from "drizzle-orm";

/**
 * GitLab OAuth Callback Handler
 * Handles authorization code exchange for access tokens
 */

const PROVIDER_NAME = "gitlab";

// GET /api/auth/gitlab/callback - Handle OAuth callback
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

    // Validate state parameter for CSRF protection using cookie
    const isValidState = await validateOAuthState(PROVIDER_NAME, state);

    if (!isValidState) {
      console.error(`${PROVIDER_NAME} OAuth: Invalid state parameter`);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${PROVIDER_NAME}_oauth_invalid_state`,
      );
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
      // Get user info from GitLab API
      const userResponse = await fetch("https://gitlab.com/api/v4/user", {
        headers: {
          Authorization: `Bearer ${tokenResponse.access_token}`,
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
      const userId = `${PROVIDER_NAME}:${userProfile.id}`;

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
          providerUserId: userProfile.id.toString(),
          email: userProfile.email || null,
          username: userProfile.username || null,
          displayName: userProfile.name || null,
          avatarUrl: userProfile.avatar_url || null,
          createdAt:
            existingUser.length > 0 ? existingUser[0].createdAt : Date.now(),
          updatedAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email: userProfile.email || null,
            username: userProfile.username || null,
            displayName: userProfile.name || null,
            avatarUrl: userProfile.avatar_url || null,
            updatedAt: Date.now(),
          },
        });

      // Store tokens securely
      const tokenStorage = new SecureTokenStorage();
      const now = Date.now();

      await tokenStorage.storeTokens(userId, PROVIDER_NAME, {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || undefined,
        tokenType: "Bearer",
        expiresAt: tokenResponse.expires_in
          ? now + tokenResponse.expires_in * 1000
          : undefined,
        refreshExpiresAt: undefined, // GitLab may return refresh_expires_in in newer responses
        scopes: tokenResponse.scope
          ? tokenResponse.scope.split(" ")
          : undefined,
        metadata: {
          tokenResponse: tokenResponse,
          userProfile: userProfile,
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
          email: userProfile.email || undefined,
          username: userProfile.username || undefined,
          displayName: userProfile.name || undefined,
          avatarUrl: userProfile.avatar_url || undefined,
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

    // Redirect back to main application with success indicator
    const successUrl = new URL(
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
    );
    successUrl.searchParams.set("success", `${PROVIDER_NAME}_oauth_connected`);
    successUrl.searchParams.set("timestamp", Date.now().toString());

    const successResponse = NextResponse.redirect(successUrl.toString());

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
