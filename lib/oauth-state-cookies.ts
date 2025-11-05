import { cookies } from "next/headers";

/**
 * OAuth State Cookie Management
 * Provides secure cookie-based OAuth state storage for CSRF protection
 */

const OAUTH_STATE_COOKIE_PREFIX = "_oauth_state_";
const OAUTH_STATE_MAX_AGE = 600; // 10 minutes

/**
 * Get cookie options for OAuth state storage
 */
export function getOAuthStateCookieOptions(provider: string) {
  const secure = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: `/api/auth/${provider}/callback`,
    maxAge: OAUTH_STATE_MAX_AGE,
  };
}

/**
 * Set OAuth state in httpOnly cookie
 * Returns cookie options that need to be used with NextResponse.cookies.set()
 */
export function createOAuthStateCookie(provider: string, state: string) {
  const cookieName = `${OAUTH_STATE_COOKIE_PREFIX}${provider}`;
  const cookieValue = JSON.stringify({
    state,
    created: Date.now(),
  });

  return {
    name: cookieName,
    value: cookieValue,
    options: getOAuthStateCookieOptions(provider),
  };
}

/**
 * Get OAuth state from cookie and validate it
 */
export async function getOAuthStateCookie(
  provider: string,
): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const cookieName = `${OAUTH_STATE_COOKIE_PREFIX}${provider}`;

    const cookieValue = cookieStore.get(cookieName)?.value;
    if (!cookieValue) {
      return null;
    }

    const { state, created } = JSON.parse(cookieValue);

    // Check if cookie is expired (expired cookies normally auto-clean)
    const age = Date.now() - created;
    if (age > OAUTH_STATE_MAX_AGE * 1000) {
      return null; // Cookie expired
    }

    return state;
  } catch {
    return null;
  }
}

/**
 * Clear OAuth state cookie after use
 * Returns cookie options for clearing the cookie
 */
export function getOAuthStateClearCookieOptions(provider: string) {
  const cookieName = `${OAUTH_STATE_COOKIE_PREFIX}${provider}`;

  // Set cookie to expire immediately
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: `/api/auth/${provider}/callback`,
    maxAge: 0,
  };

  return {
    name: cookieName,
    value: "",
    options: cookieOptions,
  };
}

/**
 * Validate OAuth state parameter against cookie
 */
export async function validateOAuthState(
  provider: string,
  callbackState: string | null,
): Promise<boolean> {
  if (!callbackState) {
    return false; // State parameter required
  }

  try {
    const storedState = await getOAuthStateCookie(provider);

    if (!storedState || storedState !== callbackState) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
