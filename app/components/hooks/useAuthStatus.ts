"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Cache configuration
const CACHE_TTL = 30 * 1000; // 30 seconds
const CACHE_KEY = "auth-status-cache";

// Request deduplication map
const pendingRequests = new Map<string, Promise<unknown>>();

interface ToolConnectionStatus {
  connected: boolean;
  connectedAt: Date;
  lastUsed: Date;
}

interface ToolAuthStatus {
  connected: boolean;
  connectedAt?: string;
  lastUsed?: string;
  [key: string]: unknown;
}

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

interface AuthStatusCache {
  [key: string]: CacheEntry;
}

/**
 * Shared hook for managing auth status with caching and request deduplication
 * Prevents multiple components from making simultaneous identical requests
 */
export function useAuthStatus() {
  const [authStatus, setAuthStatus] = useState<{
    authenticated: boolean;
    authenticatedTools: Record<string, ToolConnectionStatus>;
    user: unknown;
  }>({ authenticated: false, authenticatedTools: {}, user: null });

  const [toolStatuses, setToolStatuses] = useState<
    Record<string, ToolAuthStatus>
  >({});
  const [configuredTools, setConfiguredTools] = useState<
    Record<string, boolean>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheRef = useRef<AuthStatusCache | null>(null);

  // Load cache from localStorage
  const loadCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        cacheRef.current = JSON.parse(cached);
      }
    } catch {
      // Clear invalid cache
      localStorage.removeItem(CACHE_KEY);
    }
  }, []);

  // Save cache to localStorage
  const saveCache = useCallback((cache: AuthStatusCache) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      cacheRef.current = cache;
    } catch {
      // Handle storage errors gracefully
    }
  }, []);

  // Get cached data if still valid
  const getCachedData = useCallback((key: string) => {
    const cache = cacheRef.current;
    if (!cache || !cache[key]) return null;

    const now = Date.now();
    const cacheEntry = cache[key];

    // Check if cache is still valid
    if (now - cacheEntry.timestamp < CACHE_TTL) {
      return cacheEntry.data;
    }

    return null;
  }, []);

  // Check if endpoint should be called (not cached or cache expired)
  const shouldCallEndpoint = useCallback((endpoint: string) => {
    const cache = cacheRef.current;
    if (!cache || !cache[endpoint]) return true;

    const now = Date.now();
    const cacheEntry = cache[endpoint];

    return now - cacheEntry.timestamp >= CACHE_TTL;
  }, []);

  // Make authenticated request with deduplication
  const makeRequest = useCallback(
    async (endpoint: string, url: string) => {
      // Check if request is already pending
      if (pendingRequests.has(endpoint)) {
        return pendingRequests.get(endpoint);
      }

      // Check cache first
      const cachedData = getCachedData(endpoint);
      if (cachedData) {
        return cachedData;
      }

      // Check if we should make the request (not spam)
      if (!shouldCallEndpoint(endpoint)) {
        return getCachedData(endpoint);
      }

      // Create new request
      const requestPromise = fetch(url)
        .then(async (response) => {
          const data = await response.json();

          // Update cache
          const currentCache = cacheRef.current || {};
          currentCache[endpoint] = {
            data,
            timestamp: Date.now(),
          };
          saveCache(currentCache);

          // Remove from pending requests
          pendingRequests.delete(endpoint);

          return data;
        })
        .catch((error) => {
          // Remove from pending requests on error
          pendingRequests.delete(endpoint);
          throw error;
        });

      // Store pending request
      pendingRequests.set(endpoint, requestPromise);

      return requestPromise;
    },
    [getCachedData, shouldCallEndpoint, saveCache],
  );

  // Fetch general auth status
  const fetchGeneralAuthStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await makeRequest("general", "/api/auth/status");

      setAuthStatus({
        authenticated: data.authenticated,
        authenticatedTools: data.authenticatedTools || {},
        user: data.user || null,
      });

      return data;
    } catch (err) {
      const errorMessage = "Failed to fetch authentication status";
      setError(errorMessage);
      console.error("Auth status error:", err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [makeRequest]);

  // Fetch specific tool auth status
  const fetchToolAuthStatus = useCallback(
    async (toolSlug: string) => {
      try {
        const data = await makeRequest(
          toolSlug,
          `/api/auth/${toolSlug}/status`,
        );

        setToolStatuses((prev) => ({
          ...prev,
          [toolSlug]: data,
        }));

        return data;
      } catch (err) {
        console.error(`Failed to fetch ${toolSlug} auth status:`, err);
        return null;
      }
    },
    [makeRequest],
  );

  // Fetch OAuth configuration status for tools
  const fetchAuthConfig = useCallback(async () => {
    try {
      const data = await makeRequest("config", "/api/auth/config");

      if (data && data.success) {
        setConfiguredTools(data.configured);
      }

      return data;
    } catch (err) {
      console.error("Failed to fetch auth configuration:", err);
      return null;
    }
  }, [makeRequest]);

  // Refresh all auth data
  const refreshAuthStatus = useCallback(
    async (tools: string[] = ["github", "gitlab", "jira"]) => {
      try {
        setIsLoading(true);
        setError(null);

        // Clear cache to force fresh requests
        localStorage.removeItem(CACHE_KEY);
        cacheRef.current = null;
        pendingRequests.clear();

        // Fetch general auth status, all tools, and configuration in parallel
        const results = await Promise.allSettled([
          fetchGeneralAuthStatus(),
          ...tools.map((toolSlug) => fetchToolAuthStatus(toolSlug)),
          fetchAuthConfig(),
        ]);

        // Check if any requests failed
        const failedRequests = results.filter(
          (result) => result.status === "rejected",
        );
        if (failedRequests.length > 0) {
          setError("Some authentication requests failed");
        }

        return results;
      } catch (err) {
        setError("Failed to refresh authentication status");
        console.error("Auth refresh error:", err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchGeneralAuthStatus, fetchToolAuthStatus, fetchAuthConfig],
  );

  // Clear cache manually
  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    cacheRef.current = null;
    pendingRequests.clear();
  }, []);

  // Initialize cache on mount
  useEffect(() => {
    loadCache();
  }, [loadCache]);

  // Auto-refresh auth status on mount if cache is stale
  useEffect(() => {
    const needsRefresh =
      !cacheRef.current || Object.keys(cacheRef.current).length === 0;

    if (needsRefresh) {
      refreshAuthStatus();
    }
  }, [refreshAuthStatus]);

  // Cleanup pending requests on unmount
  useEffect(() => {
    return () => {
      // Note: We don't clear pending requests on unmount as they might be shared across components
      // pendingRequests.clear();
    };
  }, []);

  return {
    // General auth status (from /api/auth/status)
    authStatus,

    // Individual tool statuses (from /api/auth/{tool}/status)
    toolStatuses,

    // OAuth configuration status (from /api/auth/config)
    configuredTools,

    // Loading and error states
    isLoading,
    error,

    // Actions
    fetchGeneralAuthStatus,
    fetchToolAuthStatus,
    fetchAuthConfig,
    refreshAuthStatus,
    clearCache,

    // Cache utilities
    getCachedData,
    shouldCallEndpoint: shouldCallEndpoint,
  };
}
