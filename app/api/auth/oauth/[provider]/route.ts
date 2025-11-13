import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getOAuthConfig, buildAuthorizationUrl } from "@/lib/oauth-config";
import {
  validateOAuthState,
  createOAuthStateCookie,
  getOAuthStateClearCookieOptions,
} from "@/lib/oauth-state-cookies";
import { sessionManager } from "@/lib/sessions/session-manager";
import { getReadWriteDb } from "@/lib/database/connection";
import { SecureTokenStorage } from "@/lib/oauth-token-store";
import { users } from "@/lib/database/pg-schema";
import { exchangeCodeForTokens } from "@/lib/oauth-config";
import { eq } from "drizzle-orm";
import { getToolByName } from "@/tools";
import logger from "@/lib/logger";

/**
 * Unified OAuth Handler - Registry-Driven
 * Handles OAuth initiation and callback for all providers using tool registry
 */

// GET /api/auth/oauth/{provider}/initiate - Initiate OAuth flow
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const { searchParams } = new URL(request.url);
  const webUrl = searchParams.get("web_url"); // For Jira instances

  try {
    // Get OAuth configuration
    const oauthConfig = getOAuthConfig(provider, webUrl || undefined);
    if (!oauthConfig) {
      return NextResponse.json(
        { error: `${provider} OAuth not configured` },
        { status: 500 },
      );
    }

    // Generate state parameter for CSRF protection
    const state = crypto.randomUUID();

    // Build authorization URL
    const authUrl = buildAuthorizationUrl(oauthConfig, state);

    // Create response with OAuth state cookie
    const response = NextResponse.redirect(authUrl);

    // Set OAuth state cookie for CSRF protection
    // For Jira, include web_url in state JSON
    const cookieStateValue =
      provider === "jira"
        ? JSON.stringify({
            state,
            webUrl: webUrl || undefined,
            created: Date.now(),
          })
        : state;

    const cookieOptions =
      provider === "jira"
        ? {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax" as const,
            path: `/api/auth/${provider}/callback`,
            maxAge: 600,
          }
        : createOAuthStateCookie(provider, state).options;

    if (provider === "jira") {
      response.cookies.set(
        `_oauth_state_${provider}`,
        cookieStateValue,
        cookieOptions,
      );
    } else {
      const { name, value, options } = createOAuthStateCookie(provider, state);
      response.cookies.set(name, value, options);
    }

    return response;
  } catch (error) {
    logger.error(`Failed to initiate ${provider} OAuth flow`, {
      error: error instanceof Error ? error.message : String(error),
      webUrl,
      provider,
    });

    return NextResponse.json(
      { error: "Failed to initiate OAuth flow" },
      { status: 500 },
    );
  }
}

// POST /api/auth/oauth/{provider}/callback - Handle OAuth callback
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Check for OAuth errors
    if (error) {
      const errorDescription =
        searchParams.get("error_description") || "Unknown error";
      logger.warn(`${provider} OAuth callback error from provider`, {
        provider,
        error,
        errorDescription,
        state,
      });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${provider}_oauth_${error}&description=${encodeURIComponent(errorDescription)}`,
      );
    }

    // Validate required parameters
    if (!code) {
      logger.error(`${provider} OAuth callback: Missing authorization code`, {
        provider,
        state,
        hasCode: !!code,
      });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${provider}_oauth_missing_code`,
      );
    }

    // Get OAuth configuration
    const oauthConfig = getOAuthConfig(provider);
    if (!oauthConfig) {
      logger.error(`${provider} OAuth not configured`, {
        provider,
        hasConfig: !!oauthConfig,
      });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${provider}_oauth_not_configured`,
      );
    }

    // Validate state parameter for CSRF protection using cookie
    const isValidState = await validateOAuthState(provider, state);
    if (!isValidState) {
      logger.warn(`${provider} OAuth state validation failed`, {
        provider,
        hasState: !!state,
        isValidState,
      });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${provider}_oauth_invalid_state`,
      );
    }

    // Get session ID for storing user authentication state
    const headersList = await headers();
    const sessionId = headersList.get("session-id") || crypto.randomUUID();

    // Exchange authorization code for tokens
    const tokenResponse = await exchangeCodeForTokens(oauthConfig, code);
    if (!tokenResponse.access_token) {
      logger.error(`${provider} OAuth token exchange failed`, {
        provider,
        hasAccessToken: !!tokenResponse.access_token,
        tokenType: tokenResponse.token_type,
      });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${provider}_oauth_token_exchange_failed`,
      );
    }

    try {
      // Get user info from provider API using registry-driven approach
      const tool = getToolByName(provider);
      if (!tool?.config?.oauthConfig) {
        throw new Error(`OAuth not configured for ${provider}`);
      }

      const { oauthConfig: toolOAuthConfig } = tool.config;

      // Build the full user API URL (handle relative paths for GitLab)
      const userApiUrl = toolOAuthConfig.userApiUrl.startsWith("/")
        ? `${getOAuthConfig(provider)?.authorizationUrl?.replace(/\/authorize.*/, "") || ""}${toolOAuthConfig.userApiUrl}`
        : toolOAuthConfig.userApiUrl;

      const userResponse = await fetch(userApiUrl, {
        headers: {
          Authorization: `${toolOAuthConfig.authorizationHeader} ${tokenResponse.access_token}`,
          "User-Agent": "Hyperpage-OAuth-App",
        },
      });

      if (!userResponse.ok) {
        logger.error(`Failed to fetch user profile from ${provider}`, {
          provider,
          status: userResponse.status,
          statusText: userResponse.statusText,
        });
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${provider}_oauth_user_fetch_failed`,
        );
      }

      const userProfile = await userResponse.json();

      // Generate unique user ID (format: provider:provider_id)
      const userId = `${provider}:${userProfile.id}`;

      // Connect to PostgreSQL database
      const db = getReadWriteDb();

      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      // Map provider-specific user profile fields using registry configuration
      const userMapping = toolOAuthConfig.userMapping || {
        id: "id",
        email: "email",
        username: "username",
        name: "name",
        avatar: "avatar_url",
      };

      // Type-safe helper function to extract nested values
      const getNestedValue = (obj: unknown, path: string): unknown => {
        return path.split(".").reduce((current, key) => {
          if (current && typeof current === "object" && current !== null) {
            return (current as Record<string, unknown>)[key];
          }
          return undefined;
        }, obj);
      };

      // Helper function to safely extract string values
      const getStringValue = (obj: unknown, path: string): string | null => {
        const value = getNestedValue(obj, path);
        return value == null ? null : String(value);
      };

      const now = new Date();

      const userData = {
        id: userId,
        provider,
        providerUserId: getStringValue(userProfile, userMapping.id) || "",
        email: getStringValue(userProfile, userMapping.email) || "",
        username: getStringValue(userProfile, userMapping.username),
        displayName: getStringValue(userProfile, userMapping.name),
        avatarUrl: getStringValue(userProfile, userMapping.avatar),
        createdAt: existingUser[0]?.createdAt ?? now,
        updatedAt: now,
      };

      // Create or update user profile
      await db
        .insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email: userData.email,
            // Map into existing schema fields; adjust when pgSchema.users changes.
            name: userData.displayName ?? userData.username ?? users.name,
            updatedAt: new Date(),
          },
        });

      // Store tokens securely
      const tokenStorage = new SecureTokenStorage();
      const nowMs = Date.now();

      await tokenStorage.storeTokens(userId, provider, {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || undefined,
        tokenType: tokenResponse.token_type || "Bearer",
        expiresAt: tokenResponse.expires_in
          ? nowMs + tokenResponse.expires_in * 1000
          : undefined,
        refreshExpiresAt: undefined,
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
          provider: provider,
          email: userData.email || undefined,
          username: userData.username || undefined,
          displayName: userData.displayName || undefined,
          avatarUrl: userData.avatarUrl || undefined,
        },
        authenticatedTools: {
          ...currentSession?.authenticatedTools,
          [provider]: {
            connected: true,
            connectedAt: new Date(),
            lastUsed: new Date(),
          },
        },
      });

      logger.info(`${provider} OAuth successfully connected`, {
        provider,
        userId,
        username: userData.username,
        sessionId,
        isNewUser: existingUser.length === 0,
      });
    } catch (storageError) {
      logger.error(`Failed to store ${provider} OAuth tokens and user data`, {
        provider,
        sessionId,
        error:
          storageError instanceof Error
            ? storageError.message
            : String(storageError),
        stack: storageError instanceof Error ? storageError.stack : undefined,
      });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${provider}_oauth_storage_error`,
      );
    }

    // Create response with cleared OAuth state cookie
    const successResponse = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?success=${provider}_oauth_connected`,
    );

    // Set client session cookie so UI can identify its session
    successResponse.cookies.set("hyperpage-session", sessionId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60, // 24 hours
    });

    // Clear OAuth state cookie after successful validation
    const { name, value, options } = getOAuthStateClearCookieOptions(provider);
    successResponse.cookies.set(name, value, options);

    return successResponse;
  } catch (error) {
    logger.error(`${provider} OAuth callback internal error`, {
      provider,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}?error=${provider}_oauth_internal_error`,
    );
  }
}
