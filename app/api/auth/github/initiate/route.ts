import { NextResponse } from "next/server";
import { getOAuthConfig, buildAuthorizationUrl } from "@/lib/oauth-config";
import { createOAuthStateCookie } from "@/lib/oauth-state-cookies";

/**
 * GitHub OAuth Initiate Handler
 * Starts OAuth flow by redirecting to GitHub authorization
 */

const PROVIDER_NAME = "github";

// GET /api/auth/github/initiate - Initiate OAuth flow
export async function GET() {
  try {
    // Get OAuth configuration
    const oauthConfig = getOAuthConfig(PROVIDER_NAME);
    if (!oauthConfig) {
      console.error(`${PROVIDER_NAME} OAuth not configured`);
      return NextResponse.json(
        { error: `${PROVIDER_NAME} OAuth not configured` },
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
    const { name, value, options } = createOAuthStateCookie(
      PROVIDER_NAME,
      state,
    );
    response.cookies.set(name, value, options);

    // Redirect to GitHub authorization
    return response;
  } catch (error) {
    console.error(`${PROVIDER_NAME} OAuth initiate error:`, error);
    return NextResponse.json(
      { error: "Failed to initiate OAuth flow" },
      { status: 500 },
    );
  }
}
