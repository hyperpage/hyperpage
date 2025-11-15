import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import { sessionManager } from "@/lib/sessions/session-manager";
import logger from "@/lib/logger";
import {
  createErrorResponse,
  validationErrorResponse,
} from "@/lib/api/responses";

const SESSION_ID_REGEX = /^[a-zA-Z0-9._-]+$/;

function validateSessionIdParam(
  sessionId: string | null,
  options: { optional?: boolean; requiredMessage?: string } = {},
) {
  const { optional = false, requiredMessage = "sessionId is required" } =
    options;

  if (!sessionId) {
    if (optional) {
      return { value: undefined };
    }
    return {
      error: validationErrorResponse(requiredMessage, "INVALID_SESSION_ID"),
    };
  }

  const trimmed = sessionId.trim();
  if (!SESSION_ID_REGEX.test(trimmed)) {
    return {
      error: validationErrorResponse("Invalid sessionId", "INVALID_SESSION_ID"),
    };
  }

  return { value: trimmed };
}

/**
 * Session Management API
 * Handles CRUD operations for user sessions in distributed deployments
 */

// GET /api/sessions - Get current session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const {
      value: sessionId,
      error: sessionIdError,
    } = validateSessionIdParam(searchParams.get("sessionId"), {
      optional: true,
    });
    if (sessionIdError) {
      return sessionIdError;
    }

    if (!sessionId) {
      // Create new session with client info
      const headersList = await headers();
      const ua = headersList.get("user-agent") || "";
      const forwarded = headersList.get("x-forwarded-for");
      const ip =
        (forwarded as string)?.split(",")[0]?.trim() ||
        headersList.get("x-real-ip") ||
        "unknown";

      const newSessionId = sessionManager.generateSessionId();
      const session = sessionManager.createSession();
      session.metadata = {
        ...session.metadata,
        ipAddress: ip,
        userAgent: ua,
      };

      // Save new session
      await sessionManager.setSession(newSessionId, session);

      return NextResponse.json({
        success: true,
        sessionId: newSessionId,
        session: session,
        message: "New session created",
      });
    }

    // Get existing session
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return createErrorResponse({
        status: 401,
        code: "SESSION_NOT_FOUND",
        message: "Session not found or expired",
      });
    }

    return NextResponse.json({
      success: true,
      sessionId,
      session,
    });
  } catch (error) {
    logger.error("Failed to get session", {
      error: error instanceof Error ? error.message : String(error),
    });

    return createErrorResponse({
      status: 500,
      code: "SESSION_FETCH_ERROR",
      message: "Failed to get session",
    });
  }
}

// POST /api/sessions - Create or update session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, sessionData, updates } = body;
    const { value: validatedSessionId, error: sessionIdError } =
      validateSessionIdParam(sessionId, {
        requiredMessage: "sessionId is required",
      });
    if (sessionIdError || !validatedSessionId) {
      return sessionIdError!;
    }

    // Validate session exists before updating
    const existingSession = await sessionManager.getSession(
      validatedSessionId,
    );
    if (!existingSession && !sessionData) {
      return createErrorResponse({
        status: 401,
        code: "SESSION_NOT_FOUND",
        message: "Session not found or expired",
      });
    }

    if (updates) {
      // Update specific fields
      await sessionManager.updateSession(validatedSessionId, updates);
    } else if (sessionData) {
      // Save complete session
      await sessionManager.setSession(validatedSessionId, sessionData);
    } else {
      return validationErrorResponse(
        "sessionData or updates required",
        "INVALID_SESSION_REQUEST",
      );
    }

    return NextResponse.json({
      success: true,
      sessionId: validatedSessionId,
      message: "Session saved successfully",
    });
  } catch (error) {
    logger.error("Failed to save session", {
      error: error instanceof Error ? error.message : String(error),
    });

    return createErrorResponse({
      status: 500,
      code: "SESSION_SAVE_ERROR",
      message: "Failed to save session",
    });
  }
}

// PATCH /api/sessions - Update session preferences/UI state
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const {
      value: sessionId,
      error: sessionIdError,
    } = validateSessionIdParam(searchParams.get("sessionId"));
    if (sessionIdError || !sessionId) {
      return sessionIdError!;
    }
    const body = await request.json();

    // Validate session exists before updating
    const existingSession = await sessionManager.getSession(sessionId);
    if (!existingSession) {
      return createErrorResponse({
        status: 401,
        code: "SESSION_NOT_FOUND",
        message: "Session not found or expired",
      });
    }

    // Update session with provided data
    await sessionManager.updateSession(sessionId, body);

    return NextResponse.json({
      success: true,
      sessionId,
      message: "Session updated successfully",
    });
  } catch (error) {
    logger.error("Failed to update session", {
      error: error instanceof Error ? error.message : String(error),
    });

    return createErrorResponse({
      status: 500,
      code: "SESSION_UPDATE_ERROR",
      message: "Failed to update session",
    });
  }
}

// DELETE /api/sessions - Delete session
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const {
      value: sessionId,
      error: sessionIdError,
    } = validateSessionIdParam(searchParams.get("sessionId"));
    if (sessionIdError || !sessionId) {
      return sessionIdError!;
    }

    // Check if session exists before deletion
    const existingSession = await sessionManager.getSession(sessionId);
    if (!existingSession) {
      return createErrorResponse({
        status: 401,
        code: "SESSION_NOT_FOUND",
        message: "Session not found or expired",
      });
    }

    await sessionManager.deleteSession(sessionId);

    return NextResponse.json({
      success: true,
      message: "Session deleted successfully",
    });
  } catch (error) {
    logger.error("Failed to delete session", {
      error: error instanceof Error ? error.message : String(error),
    });

    return createErrorResponse({
      status: 500,
      code: "SESSION_DELETE_ERROR",
      message: "Failed to delete session",
    });
  }
}
