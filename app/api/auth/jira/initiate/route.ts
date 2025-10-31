import { NextRequest, NextResponse } from 'next/server';
import { getOAuthConfig, buildAuthorizationUrl } from '@/lib/oauth-config';
import { createOAuthStateCookie } from '@/lib/oauth-state-cookies';

/**
 * Jira OAuth 2.0 Initiate Handler
 * Starts OAuth flow by redirecting to Atlassian authorization
 */

const PROVIDER_NAME = 'jira';

// GET /api/auth/jira/initiate - Initiate OAuth flow
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const webUrl = searchParams.get('web_url');

    // Get OAuth configuration
    const oauthConfig = getOAuthConfig(PROVIDER_NAME, webUrl || undefined);
    if (!oauthConfig) {
      console.error(`${PROVIDER_NAME} OAuth not configured`);
      return NextResponse.json(
        { error: `${PROVIDER_NAME} OAuth not configured` },
        { status: 500 }
      );
    }

    // Generate state parameter for CSRF protection
    const state = crypto.randomUUID();

    // Build authorization URL
    const authUrl = buildAuthorizationUrl(oauthConfig, state);

    // Create response with OAuth state cookie
    const response = NextResponse.redirect(authUrl);

    // Set OAuth state cookie for CSRF protection (include web_url in state JSON)
    const cookieStateValue = JSON.stringify({
      state,
      webUrl: webUrl || undefined,
      created: Date.now()
    });

    const cookieOptions = {
      name: `_oauth_state_${PROVIDER_NAME}`,
      value: cookieStateValue,
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: `/api/auth/${PROVIDER_NAME}/callback`,
        maxAge: 600,
      },
    };

    response.cookies.set(cookieOptions.name, cookieOptions.value, cookieOptions.options);

    // Redirect to Atlassian authorization
    return response;

  } catch (error) {
    console.error(`${PROVIDER_NAME} OAuth initiate error:`, error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
