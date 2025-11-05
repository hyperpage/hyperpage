"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { SessionData } from "../../../lib/sessions/session-manager";

interface SessionHookReturn {
  session: SessionData | null;
  sessionId: string | null;
  isLoading: boolean;
  error: string | null;
  updateSession: (updates: Partial<SessionData>) => Promise<void>;
  refreshSession: () => Promise<void>;
  clearSession: () => Promise<void>;
}

export const useSession = (): SessionHookReturn => {
  const [session, setSession] = useState<SessionData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  // Initialize session on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    initializeSession();
  }, []);

  const initializeSession = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Try to get existing session from localStorage
      const storedSessionId = localStorage.getItem("hyperpage_session_id");

      if (storedSessionId) {
        // Try to get existing session
        const getResponse = await fetch(
          `/api/sessions?sessionId=${storedSessionId}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          },
        );

        if (getResponse.ok) {
          const data = await getResponse.json();
          if (data.success) {
            setSession(data.session);
            setSessionId(data.sessionId);
            return;
          }
        }
      }

      // Create new session if no existing session or failed to get
      const createResponse = await fetch("/api/sessions", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (createResponse.ok) {
        const data = await createResponse.json();
        if (data.success) {
          setSession(data.session);
          setSessionId(data.sessionId);
          localStorage.setItem("hyperpage_session_id", data.sessionId);
        }
      } else {
        throw new Error("Failed to create session");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSession = useCallback(
    async (updates: Partial<SessionData>) => {
      if (!sessionId) return;

      try {
        setError(null);

        const response = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            updates,
          }),
        });

        if (response.ok) {
          // Update local state with optimistic update
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  ...updates,
                  lastActivity: new Date(),
                  metadata: {
                    ...prev.metadata,
                    ...updates.metadata,
                    updated: new Date(),
                  },
                }
              : null,
          );
        } else {
          throw new Error("Failed to update session");
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
      }
    },
    [sessionId],
  );

  const refreshSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/sessions?sessionId=${sessionId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSession(data.session);
        } else {
          throw new Error("Failed to refresh session");
        }
      } else {
        throw new Error("Failed to refresh session");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const clearSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      setError(null);

      const response = await fetch(`/api/sessions?sessionId=${sessionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        setSession(null);
        setSessionId(null);
        localStorage.removeItem("hyperpage_session_id");
      } else {
        throw new Error("Failed to clear session");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
    }
  }, [sessionId]);

  // Auto-refresh session every 5 minutes
  useEffect(() => {
    if (!sessionId || !session) return;

    const interval = setInterval(
      () => {
        refreshSession();
      },
      5 * 60 * 1000,
    ); // 5 minutes

    return () => clearInterval(interval);
  }, [sessionId, refreshSession, session]);

  // Update session activity on user interactions
  useEffect(() => {
    const handleActivity = () => {
      if (session && sessionId) {
        updateSession({ lastActivity: new Date() });
      }
    };

    const events = ["click", "keydown", "scroll", "mousemove"];
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [session, sessionId, updateSession]);

  return {
    session,
    sessionId,
    isLoading,
    error,
    updateSession,
    refreshSession,
    clearSession,
  };
};
