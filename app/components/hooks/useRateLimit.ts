// Custom hook for accessing rate limit status in components

import { useState, useEffect, useCallback } from "react";
import {
  RateLimitStatus,
  UseRateLimitResult,
} from "../../../lib/types/rate-limit";
import { getRateLimitStatus } from "../../../lib/rate-limit-monitor";

/**
 * Hook for accessing rate limit status for a specific platform
 * @param platform - The platform slug (e.g., 'github', 'gitlab', 'jira')
 * @param enabled - Whether to enable the hook (default: true)
 * @returns Rate limit status and controls
 */
export function useRateLimit(
  platform: string,
  enabled: boolean = true,
): UseRateLimitResult {
  const [status, setStatus] = useState<RateLimitStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate if data is stale (>5 minutes old)
  const isStale = status
    ? Date.now() - status.lastUpdated > 5 * 60 * 1000
    : false;

  const refresh = useCallback(async () => {
    if (!enabled || !platform) return;

    setLoading(true);
    setError(null);

    try {
      const rateLimitStatus = await getRateLimitStatus(
        platform,
        window.location.origin,
      );
      setStatus(rateLimitStatus);

      // If no status returned, it could be because the platform doesn't support rate limiting
      if (!rateLimitStatus) {
        setError(
          `Rate limit monitoring not supported for platform: ${platform}`,
        );
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(`Failed to fetch rate limit status: ${errorMessage}`);
      
    } finally {
      setLoading(false);
    }
  }, [platform, enabled]);

  // Auto-refresh on mount and when platform changes
  useEffect(() => {
    if (enabled && platform) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, enabled]); // refresh is deliberately omitted as it's memoized

  // Clear any existing data when disabled
  useEffect(() => {
    if (!enabled) {
      setStatus(null);
      setError(null);
      setLoading(false);
    }
  }, [enabled]);

  return {
    status,
    loading,
    error,
    refresh,
    isStale,
  };
}

/**
 * Hook for monitoring rate limits across multiple platforms
 * @param platforms - Array of platform slugs to monitor
 * @param enabled - Whether to enable the hook (default: true)
 * @returns Map of platform slugs to their rate limit status
 */
export function useMultipleRateLimits(
  platforms: string[],
  enabled: boolean = true,
): {
  statuses: Map<string, RateLimitStatus>;
  loading: Map<string, boolean>;
  errors: Map<string, string>;
  refreshAll: () => Promise<void>;
  refresh: (platform: string) => Promise<void>;
  hasStaleData: boolean;
} {
  const [statuses] = useState(() => new Map<string, RateLimitStatus>());
  const [loading] = useState(() => new Map<string, boolean>());
  const [errors] = useState(() => new Map<string, string>());

  const refresh = useCallback(
    async (platform: string) => {
      if (!enabled) return;

      loading.set(platform, true);
      errors.delete(platform);

      try {
        const rateLimitStatus = await getRateLimitStatus(
          platform,
          window.location.origin,
        );
        if (rateLimitStatus) {
          statuses.set(platform, rateLimitStatus);
        } else {
          errors.set(
            platform,
            `Rate limit monitoring not supported for platform: ${platform}`,
          );
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Rate limit monitoring not supported for platform";
        errors.set(
          platform,
          `Failed to fetch rate limit status: ${errorMessage}`,
        );
      } finally {
        loading.set(platform, false);
      }
    },
    [enabled, statuses, loading, errors],
  );

  const refreshAll = useCallback(async () => {
    if (!enabled) return;
    await Promise.all(platforms.map((platform) => refresh(platform)));
  }, [platforms, refresh, enabled]);

  // Auto-refresh on mount and when platforms change
  const platformsKey = platforms.join(",");
  useEffect(() => {
    if (enabled && platforms.length > 0) {
      refreshAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformsKey, enabled, refreshAll]); // refreshAll is included

  // Clear data when disabled
  useEffect(() => {
    if (!enabled) {
      statuses.clear();
      loading.clear();
      errors.clear();
    }
  }, [enabled, statuses, loading, errors]);

  const hasStaleData = Array.from(statuses.values()).some(
    (status) => Date.now() - status.lastUpdated > 5 * 60 * 1000,
  );

  return {
    statuses,
    loading,
    errors,
    refreshAll,
    refresh,
    hasStaleData,
  };
}

/**
 * Get the color class for rate limit status indicators
 */
export function getRateLimitStatusColor(
  status: "normal" | "warning" | "critical" | "unknown",
): string {
  switch (status) {
    case "critical":
      return "text-red-600 dark:text-red-400";
    case "warning":
      return "text-yellow-600 dark:text-yellow-400";
    case "normal":
      return "text-green-600 dark:text-green-400";
    default:
      return "text-gray-500 dark:text-gray-400";
  }
}

/**
 * Get the background color class for rate limit status badges
 */
export function getRateLimitStatusBgColor(
  status: "normal" | "warning" | "critical" | "unknown",
): string {
  switch (status) {
    case "critical":
      return "bg-red-100 dark:bg-red-900/20";
    case "warning":
      return "bg-yellow-100 dark:bg-yellow-900/20";
    case "normal":
      return "bg-green-100 dark:bg-green-900/20";
    default:
      return "bg-gray-100 dark:bg-gray-800/20";
  }
}

/**
 * Get the border color class for rate limit status indicators
 */
export function getRateLimitStatusBorderColor(
  status: "normal" | "warning" | "critical" | "unknown",
): string {
  switch (status) {
    case "critical":
      return "border-red-300 dark:border-red-700";
    case "warning":
      return "border-yellow-300 dark:border-yellow-700";
    case "normal":
      return "border-green-300 dark:border-green-700";
    default:
      return "border-gray-300 dark:border-gray-700";
  }
}

/**
 * Format usage percentage for display
 */
export function formatUsagePercent(percent: number | null): string {
  if (percent === null) return "N/A";
  return `${Math.round(percent)}%`;
}

/**
 * Format time until reset
 */
export function formatTimeUntilReset(resetTime: number | null): string {
  if (!resetTime) return "Unknown";

  const timeUntilReset = resetTime - Date.now();
  if (timeUntilReset <= 0) return "Reset pending";

  const minutes = Math.ceil(timeUntilReset / (60 * 1000));
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// Export utility functions and types for convenience
export type {
  RateLimitStatus,
  PlatformRateLimits,
} from "../../../lib/types/rate-limit";
