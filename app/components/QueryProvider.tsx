"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

// Create QueryClient with sensible defaults for dashboard data
const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // Keep data fresh for 5 minutes (similar to your widget refresh intervals)
        staleTime: 5 * 60 * 1000, // 5 minutes
        // Refetch when window regains focus (matches your visibility change logic)
        refetchOnWindowFocus: true,
        // Allow 3 retries before failing (better than manual error handling)
        retry: 3,
        // Don't refetch on reconnect immediately
        refetchOnReconnect: false,
        // Cache for 30 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
      },
      mutations: {
        // Retries for mutations (useful for optimistic updates)
        retry: 1,
      },
    },
  });

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Create QueryClient per session (stable across re-renders)
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Devtools for development debugging - only in development mode */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
