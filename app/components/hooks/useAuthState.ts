"use client";

import { useState } from "react";

interface AuthToolState {
  toolSlug: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastConnectedAt?: Date;
}

export function useAuthState(initialTools: string[]) {
  const [tools, setTools] = useState<AuthToolState[]>(
    initialTools.map((slug) => ({
      toolSlug: slug,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })),
  );

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

  return {
    tools,
    updateToolState,
  };
}
