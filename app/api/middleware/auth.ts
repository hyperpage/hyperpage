import { NextRequest, NextResponse } from "next/server";
import logger from "../../../lib/logger";
import {
  sessionManager,
  SessionData,
} from "../../../lib/sessions/session-manager";

export interface AuthenticatedTool {
  connected: boolean;
  connectedAt?: Date;
  lastUsed?: Date;
}

export interface AuthenticatedRequest extends NextRequest {
  session?: SessionData;
  user?: {
    id: string;
    provider: string;
    email?: string;
    username?: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

export interface AuthMiddlewareOptions {
  required?: boolean; // If true, require authentication. If false, allow anonymous but attach session if present
  tools?: string[]; // Specific tools that require authentication
  toolRequired?: boolean; // If true, require at least one tool to be authenticated
}

/**
 * Authentication middleware for protecting API routes
 * Validates user sessions and tool-specific authentication
 */
export async function withAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>,
  options: AuthMiddlewareOptions = {},
): Promise<(req: NextRequest) => Promise<NextResponse>> {
  return async (req: NextRequest): Promise<NextResponse> => {
    const { sessionId } = parseSessionCookies(req);

    try {
      if (!sessionId) {
        if (options.required || options.tools?.length || options.toolRequired) {
          return NextResponse.json(
            { error: "Authentication required" },
            { status: 401 },
          );
        }
        // Allow anonymous access for optional auth routes
        return handler(req as AuthenticatedRequest);
      }

      // Get session data
      const session = await sessionManager.getSession(sessionId);
      if (!session) {
        // Invalid or expired session
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
      }

      // For required authentication, validate user exists
      if (options.required && !session.userId) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }

      // Check tool-specific authentication requirements
      if (options.tools?.length && session.authenticatedTools) {
        const missingTools = options.tools.filter(
          (tool) => !session.authenticatedTools[tool]?.connected,
        );

        if (missingTools.length > 0) {
          return NextResponse.json(
            {
              error: "Tool authentication required",
              missingTools,
              message: `Please authenticate with: ${missingTools.join(", ")}`,
            },
            { status: 403 },
          );
        }
      }

      // Check if any tool authentication is required
      if (options.toolRequired) {
        const hasAnyAuthenticatedTool =
          session.authenticatedTools &&
          Object.values(session.authenticatedTools).some(
            (tool: AuthenticatedTool) => tool.connected,
          );

        if (!hasAnyAuthenticatedTool) {
          return NextResponse.json(
            {
              error: "Tool authentication required",
              message:
                "At least one tool must be authenticated to access this resource",
            },
            { status: 403 },
          );
        }
      }

      // Extend session TTL on activity (renew every request)
      await sessionManager.extendSession(sessionId, undefined); // Use default TTL

      // Attach session and user info to request
      const authenticatedReq = req as AuthenticatedRequest;
      authenticatedReq.session = session;
      authenticatedReq.user = session.user;

      return handler(authenticatedReq);
    } catch (error) {
      logger.error("Authentication middleware error", {
        error: error instanceof Error ? error.message : String(error),
        operation: "withAuth",
        hasSessionId: !!sessionId,
      });
      return NextResponse.json(
        { error: "Authentication service temporarily unavailable" },
        { status: 503 },
      );
    }
  };
}

/**
 * Parse session cookies from request
 */
function parseSessionCookies(req: NextRequest): { sessionId?: string } {
  const cookies = req.cookies;

  // Try different possible cookie names
  const sessionId =
    cookies.get("hyperpage-session")?.value ||
    cookies.get("sessionId")?.value ||
    cookies.get("session-id")?.value;

  return { sessionId };
}

/**
 * Create authenticated API response with session extension
 */
export async function createAuthenticatedResponse(
  data: unknown,
  sessionId?: string,
  options: { status?: number; headers?: Record<string, string> } = {},
): Promise<NextResponse> {
  // Extend session if provided
  if (sessionId) {
    try {
      await sessionManager.extendSession(sessionId);
    } catch (error) {
      logger.error("Failed to extend session", {
        error: error instanceof Error ? error.message : String(error),
        sessionId: sessionId ? "present" : "missing",
        operation: "extendSession",
      });
    }
  }

  return NextResponse.json(data, {
    status: options.status || 200,
    headers: options.headers,
  });
}

/**
 * Check if user is authenticated for a specific tool
 */
export async function checkToolAuthentication(
  sessionId: string,
  toolName: string,
): Promise<{ authenticated: boolean; userId?: string; error?: string }> {
  try {
    const session = await sessionManager.getSession(sessionId);
    if (!session || !session.userId) {
      return { authenticated: false, error: "User not authenticated" };
    }

    const authenticatedTools = session.authenticatedTools;
    if (!authenticatedTools || !authenticatedTools[toolName]) {
      return { authenticated: false, error: "Tool not authenticated" };
    }

    const toolAuth = authenticatedTools[toolName];
    if (!toolAuth.connected) {
      return { authenticated: false, error: "Tool authentication expired" };
    }

    return { authenticated: true, userId: session.userId };
  } catch (error) {
    logger.error("Authentication check failed", {
      error: error instanceof Error ? error.message : String(error),
      sessionId: sessionId ? "present" : "missing",
      toolName,
      operation: "checkToolAuthentication",
    });
    return { authenticated: false, error: "Authentication check failed" };
  }
}

/**
 * Get authenticated user from request
 */
export function getAuthenticatedUser(req: AuthenticatedRequest): {
  id: string;
  provider: string;
  email?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
} | null {
  return req.user || null;
}

/**
 * Validate request has required authentication level
 */
export function validateAuthLevel(
  req: AuthenticatedRequest,
  level: "user" | "tool" | "session",
): boolean {
  switch (level) {
    case "session":
      return !!req.session;
    case "user":
      return !!(req.user && req.session?.userId);
    case "tool":
      // Check if user has any authenticated tools
      return !!(
        req.session?.authenticatedTools &&
        Object.values(req.session.authenticatedTools).some(
          (tool: AuthenticatedTool) => tool.connected,
        )
      );
    default:
      return false;
  }
}
