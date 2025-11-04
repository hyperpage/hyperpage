"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useAuthStatus } from "./hooks/useAuthStatus";

interface AuthToolState {
  toolSlug: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastConnectedAt?: Date;
}

interface AuthContextType {
  tools: AuthToolState[];
  authenticate: (toolSlug: string) => Promise<void>;
  disconnect: (toolSlug: string) => Promise<void>;
  checkAuthStatus: (toolSlug: string) => Promise<boolean>;
  clearAuth: () => Promise<void>; // Logout from all tools
  isConfigured: (toolSlug: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
  initialTools?: string[]; // Tool slugs to manage auth for
}

export function AuthProvider({
  children,
  initialTools = ["github", "gitlab", "jira"],
}: AuthProviderProps) {
  const [tools, setTools] = useState<AuthToolState[]>(
    initialTools.map((slug) => ({
      toolSlug: slug,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })),
  );

  // Use the shared auth status hook with caching to prevent duplicate requests
  const { 
    toolStatuses, 
    configuredTools, 
    fetchToolAuthStatus, 
    fetchAuthConfig,
    clearCache 
  } = useAuthStatus();

  // Initialize configuration on mount using cached data
  useEffect(() => {
    const initializeConfig = async () => {
      try {
        // Use the cached configuration from the hook
        // If not available in cache, fetch it once
        if (Object.keys(configuredTools).length === 0) {
          await fetchAuthConfig();
        }
      } catch (error) {
        console.error("Failed to load auth configuration:", error);
      }
    };

    // Load configuration
    initializeConfig();

    // Check for OAuth success indicators on page load
    const urlParams = new URLSearchParams(window.location.search);
    const successParam = urlParams.get("success");
    const currentAuthTool = sessionStorage.getItem("currentAuthTool");

    if (successParam && currentAuthTool) {
      // Clear the stored tool since OAuth is complete
      sessionStorage.removeItem("currentAuthTool");

      // Check if this matches our tool
      const toolMatch = initialTools.find((tool) =>
        successParam.includes(tool),
      );
      if (toolMatch) {
        console.log(
          `OAuth success detected for ${toolMatch}, refreshing status...`,
        );
        // Refresh authentication status after OAuth success
        setTimeout(async () => {
          await fetchToolAuthStatus(toolMatch);
        }, 100);

        // Clean up URL parameters
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("success");
        newUrl.searchParams.delete("timestamp");
        window.history.replaceState({}, "", newUrl.toString());
      }
    }

    // Cleanup
    return () => {};
  }, [initialTools, fetchToolAuthStatus, fetchAuthConfig, configuredTools]);

  const updateToolState = (
    toolSlug: string,
    updates: Partial<AuthToolState>,
  ) => {
    setTools((current) =>
      current.map((tool) =>
        tool.toolSlug === toolSlug ? { ...tool, ...updates } : tool,
      ),
    );
  };

  const authenticate = async (toolSlug: string): Promise<void> => {
    updateToolState(toolSlug, { isLoading: true, error: null });

    try {
      // Check if OAuth is configured for this tool
      if (!isConfigured(toolSlug)) {
        throw new Error("OAuth not configured for this tool");
      }

      // Store current authentication attempt for post-OAuth refresh
      if (typeof window !== "undefined") {
        sessionStorage.setItem("currentAuthTool", toolSlug);
      }

      // Clear cache to ensure fresh auth status after OAuth
      clearCache();

      // Initiate OAuth flow with redirect
      const initiateUrl = `/api/auth/${toolSlug}/initiate`;

      // Redirect to OAuth flow
      window.location.href = initiateUrl;

      // Note: Code after this redirect will not execute
      // Authentication completion is handled by the callback route
    } catch (error) {
      console.error("Authentication error:", error);
      updateToolState(toolSlug, {
        isLoading: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      });
      throw error;
    }
  };

  const disconnect = async (toolSlug: string): Promise<void> => {
    updateToolState(toolSlug, { isLoading: true, error: null });

    try {
      // Call disconnect API endpoint
      const response = await fetch(`/api/auth/${toolSlug}/disconnect`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to disconnect");
      }

      // Update state to reflect disconnection
      updateToolState(toolSlug, {
        isAuthenticated: false,
        isLoading: false,
        error: null,
        lastConnectedAt: undefined,
      });

      // Clear cache to reflect the change
      clearCache();
    } catch (error) {
      console.error("Disconnect error:", error);
      updateToolState(toolSlug, {
        isLoading: false,
        error: error instanceof Error ? error.message : "Disconnect failed",
      });
      throw error;
    }
  };

  const checkAuthStatus = async (toolSlug: string): Promise<boolean> => {
    try {
      // Use the shared hook to prevent duplicate requests
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
      console.error("Auth status check error:", error);
      updateToolState(toolSlug, {
        isAuthenticated: false,
        isLoading: false,
        error: "Failed to check authentication status",
      });
      return false;
    }
  };

  const clearAuth = async (): Promise<void> => {
    try {
      // Disconnect from all authenticated tools
      const authenticatedTools = tools
        .filter((t) => t.isAuthenticated)
        .map((t) => t.toolSlug);

      await Promise.allSettled(
        authenticatedTools.map((toolSlug) =>
          fetch(`/api/auth/${toolSlug}/disconnect`, { method: "POST" }),
        ),
      );

      // Call general logout endpoint
      await fetch("/api/auth/logout", { method: "POST" });

      // Reset all tool states
      setTools((current) =>
        current.map((tool) => ({
          ...tool,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          lastConnectedAt: undefined,
        })),
      );

      // Clear cache to reflect the change
      clearCache();

      // Restore redirect URL for post-logout redirect if needed
      if (typeof window !== "undefined") {
        const redirectUrl = sessionStorage.getItem("postLogoutUrl");
        if (redirectUrl) {
          window.location.href = redirectUrl;
        } else {
          // Default redirect to home or login page
          window.location.href = "/";
        }
      }
    } catch (error) {
      console.error("Clear auth error:", error);
      // Still clear local state even if API calls fail
      setTools((current) =>
        current.map((tool) => ({
          ...tool,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          lastConnectedAt: undefined,
        })),
      );
    }
  };

  const isConfigured = (toolSlug: string): boolean => {
    // Check if OAuth configuration exists for the tool using cached data
    return configuredTools[toolSlug] || false;
  };

  const contextValue: AuthContextType = {
    tools,
    authenticate,
    disconnect,
    checkAuthStatus,
    clearAuth,
    isConfigured,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

// Custom hook for easier access to specific tool auth
export function useToolAuth(toolSlug: string) {
  const auth = useAuth();
  const toolState = auth.tools.find((t) => t.toolSlug === toolSlug);

  return {
    isAuthenticated: toolState?.isAuthenticated ?? false,
    isLoading: toolState?.isLoading ?? false,
    error: toolState?.error ?? null,
    lastConnectedAt: toolState?.lastConnectedAt,
    authenticate: () => auth.authenticate(toolSlug),
    disconnect: () => auth.disconnect(toolSlug),
    checkStatus: () => auth.checkAuthStatus(toolSlug),
    isConfigured: auth.isConfigured(toolSlug),
  };
}
