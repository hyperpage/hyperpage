import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '../../../lib/sessions/session-manager';
import { headers } from 'next/headers';

/**
 * Session Management API
 * Handles CRUD operations for user sessions in distributed deployments
 */

// GET /api/sessions - Get current session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      // Create new session with client info
      const headersList = await headers();
      const ua = headersList.get('user-agent') || '';
      const forwarded = headersList.get('x-forwarded-for');
      const ip = (forwarded as string)?.split(',')[0]?.trim() ||
        headersList.get('x-real-ip') ||
        'unknown';

      const newSessionId = sessionManager.generateSessionId();
      const session = sessionManager.createSession(newSessionId);
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
        message: 'New session created',
      });
    }

    // Get existing session
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId,
      session,
    });

  } catch (error) {
    console.error('Session GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get session' },
      { status: 500 }
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
        { success: false, error: 'sessionId is required' },
        { status: 400 }
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
        { success: false, error: 'sessionData or updates required' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Session saved successfully',
    });

  } catch (error) {
    console.error('Session POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save session' },
      { status: 500 }
    );
  }
}

// PATCH /api/sessions - Update session preferences/UI state
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const body = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId required as query param' },
        { status: 400 }
      );
    }

    // Update session with provided data
    await sessionManager.updateSession(sessionId, body);

    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Session updated successfully',
    });

  } catch (error) {
    console.error('Session PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

// DELETE /api/sessions - Delete session
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId required' },
        { status: 400 }
      );
    }

    await sessionManager.deleteSession(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Session deleted successfully',
    });

  } catch (error) {
    console.error('Session DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
