"use client";

import { useCallback } from "react";
import { useAuthStatus } from "./useAuthStatus";
import { useAuthState } from "./useAuthState";
import { useOAuthFlow } from "./useOAuthFlow";
import logger from "@/lib/logger";

export interface AuthToolState {
  toolSlug: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastConnectedAt?: Date;
}

export function useAuthOperations(
  initialTools: string[] = ["github", "gitlab", "jira"],
) {
  const { tools, updateToolState } = useAuthState(initialTools);
  const { configuredTools, fetchToolAuthStatus, clearCache } = useAuthStatus();

  // OAuth success callback handler
  const handleAuthSuccess = useCallback(
    async (tool: string) => {
      setTimeout(async () => {
        await fetchToolAuthStatus(tool);
      }, 100);
    },
    [fetchToolAuthStatus],
  );

  // Initialize OAuth flow
  useOAuthFlow(initialTools, handleAuthSuccess);

  const isConfigured = useCallback(
    (toolSlug: string): boolean => {
      return configuredTools[toolSlug] || false;
    },
    [configuredTools],
  );

  const authenticate = useCallback(
    async (toolSlug: string): Promise<void> => {
      updateToolState(toolSlug, { isLoading: true, error: null });

      try {
        if (!isConfigured(toolSlug)) {
          throw new Error("OAuth not configured for this tool");
        }

        if (typeof window !== "undefined") {
          sessionStorage.setItem("currentAuthTool", toolSlug);
        }

        clearCache();
        window.location.href = `/api/auth/${toolSlug}/initiate`;
      } catch (error) {
        logger.error("Authentication error:", error);
        updateToolState(toolSlug, {
          isLoading: false,
          error:
            error instanceof Error ? error.message : "Authentication failed",
        });
        throw error;
      }
    },
    [isConfigured, clearCache, updateToolState],
  );

  const disconnect = useCallback(
    async (toolSlug: string): Promise<void> => {
      updateToolState(toolSlug, { isLoading: true, error: null });

      try {
        const response = await fetch(`/api/auth/${toolSlug}/disconnect`, {
          method: "POST",
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to disconnect");
        }

        updateToolState(toolSlug, {
          isAuthenticated: false,
          isLoading: false,
          error: null,
          lastConnectedAt: undefined,
        });

        clearCache();
      } catch (error) {
        logger.error("Disconnect error:", error);
        updateToolState(toolSlug, {
          isLoading: false,
          error: error instanceof Error ? error.message : "Disconnect failed",
        });
        throw error;
      }
    },
    [clearCache, updateToolState],
  );

  const checkAuthStatus = useCallback(
    async (toolSlug: string): Promise<boolean> => {
      try {
        const result = await fetchToolAuthStatus(toolSlug);

        if (result) {
          const isAuthenticated = result.authenticated;
          updateToolState(toolSlug, {
            isAuthenticated,
            isLoading: false,
            error: null,
            lastConnectedAt: result.lastConnectedAt
              ? new Date(result.lastConnectedAt)
              : undefined,
          });
          return isAuthenticated;
        }

        return false;
      } catch (error) {
        logger.error("Auth status check error:", error);
        updateToolState(toolSlug, {
          isAuthenticated: false,
          isLoading: false,
          error: "Failed to check authentication status",
        });
        return false;
      }
    },
    [fetchToolAuthStatus, updateToolState],
  );

  const clearAuth = useCallback(async (): Promise<void> => {
    try {
      const authenticatedTools = tools
        .filter((t) => t.isAuthenticated)
        .map((t) => t.toolSlug);

      await Promise.allSettled(
        authenticatedTools.map((toolSlug) =>
          fetch(`/api/auth/${toolSlug}/disconnect`, { method: "POST" }),
        ),
      );

      await fetch("/api/auth/logout", { method: "POST" });

      tools.forEach((tool) => {
        updateToolState(tool.toolSlug, {
          isAuthenticated: false,
          isLoading: false,
          error: null,
          lastConnectedAt: undefined,
        });
      });

      clearCache();

      if (typeof window !== "undefined") {
        const redirectUrl = sessionStorage.getItem("postLogoutUrl");
        window.location.href = redirectUrl || "/";
      }
    } catch (error) {
      logger.error("Clear auth error:", error);
      tools.forEach((tool) => {
        updateToolState(tool.toolSlug, {
          isAuthenticated: false,
          isLoading: false,
          error: null,
          lastConnectedAt: undefined,
        });
      });
    }
  }, [tools, clearCache, updateToolState]);

  return {
    tools,
    authenticate,
    disconnect,
    checkAuthStatus,
    clearAuth,
    isConfigured,
  };
}
