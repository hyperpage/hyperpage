import { NextRequest, NextResponse } from "next/server";
import { sessionManager } from "../../../lib/sessions/session-manager";
import { headers } from "next/headers";
import logger from "../../../lib/logger";

/**
 * Session Management API
 * Handles CRUD operations for user sessions in distributed deployments
 */

// GET /api/sessions - Get current session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

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
      // Return 401 for invalid/missing sessions (not authenticated)
      return NextResponse.json(
        { success: false, error: "Session not found or expired" },
        { status: 401 },
      );
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

    return NextResponse.json(
      { success: false, error: "Failed to get session" },
      { status: 500 },
    );
  }
}

// POST /api/sessions - Create or update session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, sessionData, updates } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "sessionId is required" },
        { status: 400 },
      );
    }

    // Validate session exists before updating
    const existingSession = await sessionManager.getSession(sessionId);
    if (!existingSession && !sessionData) {
      // Cannot update non-existent session unless providing complete session data
      return NextResponse.json(
        { success: false, error: "Session not found or expired" },
        { status: 401 },
      );
    }

    if (updates) {
      // Update specific fields
      await sessionManager.updateSession(sessionId, updates);
    } else if (sessionData) {
      // Save complete session
      await sessionManager.setSession(sessionId, sessionData);
    } else {
      return NextResponse.json(
        { success: false, error: "sessionData or updates required" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      sessionId,
      message: "Session saved successfully",
    });
  } catch (error) {
    logger.error("Failed to save session", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { success: false, error: "Failed to save session" },
      { status: 500 },
    );
  }
}

// PATCH /api/sessions - Update session preferences/UI state
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const body = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "sessionId required as query param" },
        { status: 400 },
      );
    }

    // Validate session exists before updating
    const existingSession = await sessionManager.getSession(sessionId);
    if (!existingSession) {
      return NextResponse.json(
        { success: false, error: "Session not found or expired" },
        { status: 401 },
      );
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

    return NextResponse.json(
      { success: false, error: "Failed to update session" },
      { status: 500 },
    );
  }
}

// DELETE /api/sessions - Delete session
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "sessionId required" },
        { status: 400 },
      );
    }

    // Check if session exists before deletion
    const existingSession = await sessionManager.getSession(sessionId);
    if (!existingSession) {
      return NextResponse.json(
        { success: false, error: "Session not found or expired" },
        { status: 401 },
      );
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

    return NextResponse.json(
      { success: false, error: "Failed to delete session" },
      { status: 500 },
    );
  }
}
