import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { sessionManager } from '@/lib/sessions/session-manager';
import { SecureTokenStorage } from '@/lib/oauth-token-store';

/**
 * GitHub OAuth Status Handler
 * Returns authentication status for GitHub
 */

const PROVIDER_NAME = 'github';

// GET /api/auth/github/status - Get OAuth authentication status
export async function GET(request: NextRequest) {
  try {
    // Get session ID from cookies
    const cookies = request.cookies;
    const sessionCookie = cookies.get('hyperpage-session');

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
      const now = Date.now();
      const isExpired = tokenStorage.areExpired(tokens);
      const isRefreshExpired = tokens.refreshToken && tokenStorage.isRefreshExpired(tokens);

      // Consider authenticated if we have tokens and they're not completely expired
      // (having expired access token but valid refresh token is still partially authenticated)
      const authenticated = !isExpired || (!isRefreshExpired && tokens.refreshToken !== undefined);

      return NextResponse.json({
        authenticated,
        lastConnectedAt: new Date(tokens.metadata?.lastConnectedAt || 0).toISOString(),
        expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt).toISOString() : null,
        isExpired,
        hasRefreshToken: !!tokens.refreshToken && !isRefreshExpired,
      });

    } catch (storageError) {
      console.error(`${PROVIDER_NAME} status storage error:`, storageError);
      // If storage check fails, assume not authenticated
      return NextResponse.json({
        authenticated: false,
        lastConnectedAt: null,
        expiresAt: null,
        error: 'Failed to check authentication status',
      });
    }

  } catch (error) {
    console.error(`${PROVIDER_NAME} status error:`, error);
    // Always return valid JSON in case of error
    return NextResponse.json({
      authenticated: false,
      lastConnectedAt: null,
      expiresAt: null,
      error: 'Failed to get authentication status',
    }, { status: 500 });
  }
}
