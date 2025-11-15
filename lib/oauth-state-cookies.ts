import { cookies } from "next/headers";

/**
 * OAuth State Cookie Management
 * Provides secure cookie-based OAuth state storage for CSRF protection
 */

const OAUTH_STATE_COOKIE_PREFIX = "_oauth_state_";
const OAUTH_STATE_MAX_AGE = 600; // 10 minutes

function getCookieName(provider: string): string {
  return `${OAUTH_STATE_COOKIE_PREFIX}${provider}`;
}

function getCookiePath(provider: string): string {
  return `/api/auth/oauth/${provider}`;
}

/**
 * Get cookie options for OAuth state storage
 */
export function getOAuthStateCookieOptions(provider: string) {
  const secure = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: getCookiePath(provider),
    maxAge: OAUTH_STATE_MAX_AGE,
  };
}

/**
 * Set OAuth state in httpOnly cookie
 * Returns cookie options that need to be used with NextResponse.cookies.set()
 */
export function createOAuthStateCookie(provider: string, state: string) {
  const cookieName = getCookieName(provider);
  const payload = {
    state,
    created: Date.now(),
  };

  return {
    name: cookieName,
    value: JSON.stringify(payload),
    options: getOAuthStateCookieOptions(provider),
  };
}

/**
 * Get OAuth state from cookie and validate it
 */
export interface OAuthStatePayload {
  state: string;
  created: number;
  [key: string]: unknown;
}

export async function getOAuthStatePayload(
  provider: string,
): Promise<OAuthStatePayload | null> {
  try {
    const cookieStore = await cookies();
    const cookieName = getCookieName(provider);

    const cookieValue = cookieStore.get(cookieName)?.value;
    if (!cookieValue) {
      return null;
    }

    const payload = JSON.parse(cookieValue) as OAuthStatePayload;
    const { state, created } = payload;
    if (typeof state !== "string" || typeof created !== "number") {
      return null;
    }

    // Check if cookie is expired (expired cookies normally auto-clean)
    const age = Date.now() - created;
    if (age > OAUTH_STATE_MAX_AGE * 1000) {
      return null; // Cookie expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Clear OAuth state cookie after use
 * Returns cookie options for clearing the cookie
 */
export function getOAuthStateClearCookieOptions(provider: string) {
  const cookieName = getCookieName(provider);

  // Set cookie to expire immediately
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: getCookiePath(provider),
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
    const payload = await getOAuthStatePayload(provider);
    if (!payload || payload.state !== callbackState) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
