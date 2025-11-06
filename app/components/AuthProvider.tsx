"use client";

import { createContext, useContext, ReactNode } from "react";
import { useAuthOperations, type AuthToolState } from "./hooks/useAuthOperations";

interface AuthContextType {
  tools: AuthToolState[];
  authenticate: (toolSlug: string) => Promise<void>;
  disconnect: (toolSlug: string) => Promise<void>;
  checkAuthStatus: (toolSlug: string) => Promise<boolean>;
  clearAuth: () => Promise<void>;
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
  initialTools?: string[];
}

export function AuthProvider({
  children,
  initialTools = ["github", "gitlab", "jira"],
}: AuthProviderProps) {
  const authOperations = useAuthOperations(initialTools);

  const contextValue: AuthContextType = {
    tools: authOperations.tools,
    authenticate: authOperations.authenticate,
    disconnect: authOperations.disconnect,
    checkAuthStatus: authOperations.checkAuthStatus,
    clearAuth: authOperations.clearAuth,
    isConfigured: authOperations.isConfigured,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

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
