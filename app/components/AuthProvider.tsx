"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

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

  const [configuredTools, setConfiguredTools] = useState<
    Record<string, boolean>
  >({});

  // Initialize configuration and authentication status on mount
  useEffect(() => {
    const initializeConfig = async () => {
      try {
        const response = await fetch("/api/auth/config");
        const result = await response.json();

        if (result.success) {
          setConfiguredTools(result.configured);
        }
      } catch (error) {
        
      }
    };

    // Load configuration
    initializeConfig();

    // Check authentication status for all tools
    initialTools.forEach((toolSlug) => {
      // Inline function to avoid dependency issues
      const checkStatus = async () => {
        try {
          const response = await fetch(`/api/auth/${toolSlug}/status`);
          const result = await response.json();
          const isAuthenticated = response.ok && result.authenticated;
          setTools((current) =>
            current.map((tool) =>
              tool.toolSlug === toolSlug
                ? {
                    ...tool,
                    isAuthenticated,
                    isLoading: false,
                    error: null,
                    lastConnectedAt: result.lastConnectedAt
                      ? new Date(result.lastConnectedAt)
                      : undefined,
                  }
                : tool,
            ),
          );
        } catch (error) {
          
          setTools((current) =>
            current.map((tool) =>
              tool.toolSlug === toolSlug
                ? {
                    ...tool,
                    isAuthenticated: false,
                    isLoading: false,
                    error: "Failed to check authentication status",
                  }
                : tool,
            ),
          );
        }
      };
      checkStatus();
    });

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
        setTimeout(() => {
          // Inline function to avoid dependency issues
          const checkStatus = async () => {
            try {
              const response = await fetch(`/api/auth/${toolMatch}/status`);
              const result = await response.json();
              const isAuthenticated = response.ok && result.authenticated;
              setTools((current) =>
                current.map((tool) =>
                  tool.toolSlug === toolMatch
                    ? {
                        ...tool,
                        isAuthenticated,
                        isLoading: false,
                        error: null,
                        lastConnectedAt: result.lastConnectedAt
                          ? new Date(result.lastConnectedAt)
                          : undefined,
                      }
                    : tool,
                ),
              );
            } catch (error) {
              console.error(
                `Failed to check auth status for ${toolMatch}:`,
                error,
              );
              setTools((current) =>
                current.map((tool) =>
                  tool.toolSlug === toolMatch
                    ? {
                        ...tool,
                        isAuthenticated: false,
                        isLoading: false,
                        error: "Failed to check authentication status",
                      }
                    : tool,
                ),
              );
            }
          };
          checkStatus();
        }, 100);

        // Clean up URL parameters
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("success");
        newUrl.searchParams.delete("timestamp");
        window.history.replaceState({}, "", newUrl.toString());
      }
    }

    // Cleanup (empty for now, reserved for future use)
    return () => {};
  }, [initialTools]);

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

      // Initiate OAuth flow with redirect
      const initiateUrl = `/api/auth/${toolSlug}/initiate`;

      // Redirect to OAuth flow
      window.location.href = initiateUrl;

      // Note: Code after this redirect will not execute
      // Authentication completion is handled by the callback route
    } catch (error) {
      
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
    } catch (error) {
      
      updateToolState(toolSlug, {
        isLoading: false,
        error: error instanceof Error ? error.message : "Disconnect failed",
      });
      throw error;
    }
  };

  const checkAuthStatus = async (toolSlug: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/auth/${toolSlug}/status`);
      const result = await response.json();

      const isAuthenticated = response.ok && result.authenticated;

      updateToolState(toolSlug, {
        isAuthenticated,
        isLoading: false,
        error: null,
        lastConnectedAt: result.lastConnectedAt
          ? new Date(result.lastConnectedAt)
          : undefined,
      });

      return isAuthenticated;
    } catch (error) {
      
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
    // Check if OAuth configuration exists for the tool
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
