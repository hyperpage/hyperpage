"use client";

import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useMemo, useCallback, useState, useEffect } from "react";
import { Tool, ToolData } from "../../../tools/tool-types";
import { getToolDataKey } from "../../../tools";
import {
  getDynamicInterval,
  getActivePlatforms,
  TOOL_PLATFORM_MAP,
  getMaxUsageForPlatform,
  getGitHubWeightedUsage,
  getActivityAccelerationFactor,
  clampInterval,
} from "../../../lib/rate-limit-utils";
import { useMultipleRateLimits, RateLimitStatus } from "./useRateLimit";

interface UseToolQueriesProps {
  enabledTools: Omit<Tool, "handlers">[];
}

interface UseToolQueriesReturn {
  dynamicData: Record<string, Record<string, ToolData[]>>;
  loadingStates: Record<string, boolean>;
  refreshToolData: (tool: Omit<Tool, "handlers">) => Promise<void>;
  refreshAllData: () => void;
  initializePolling: () => () => void;
}

// Fetch function for a specific tool endpoint
const fetchToolData = async (
  tool: Omit<Tool, "handlers">,
  endpoint: string,
): Promise<ToolData[]> => {
  const response = await fetch(`/api/tools/${tool.slug}/${endpoint}`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${tool.name}/${endpoint}: ${response.status}`,
    );
  }
  const data = await response.json();
  // Use registry-driven data key access
  const dataKey = getToolDataKey(tool.name, endpoint) || endpoint;
  return data[dataKey] || [];
};

// Create query configurations for all enabled tool endpoints with adaptive polling
const createQueryConfigs = (
  enabledTools: Omit<Tool, "handlers">[],
  rateLimitStatuses: Map<string, RateLimitStatus>,
  isTabVisible: boolean,
  isUserActive: boolean,
) => {
  const queries = [];

  for (const tool of enabledTools) {
    if (!tool.enabled) continue;

    // Check if any widgets need dynamic data
    const dynamicWidgets = tool.widgets.filter((widget) => widget.dynamic);
    if (dynamicWidgets.length === 0) continue;

    // Find unique API endpoints that widgets require
    const requiredApiEndpoints = Array.from(
      new Set(
        tool.widgets
          .filter((widget) => widget.dynamic && widget.apiEndpoint)
          .map((widget) => widget.apiEndpoint!),
      ),
    );

    // Get platform-specific rate limit usage for this tool
    const platform = TOOL_PLATFORM_MAP[tool.slug];
    const platformStatus = platform ? rateLimitStatuses.get(platform) : null;

    // Use GitHub-specific weighted usage for better search API awareness
    let usagePercent = 0;
    if (platformStatus) {
      if (platform === "github") {
        usagePercent = getGitHubWeightedUsage(platformStatus);
      } else {
        usagePercent = getMaxUsageForPlatform(platformStatus);
      }
    }

    // Apply activity-based acceleration factor
    const activityFactor = getActivityAccelerationFactor(
      isTabVisible,
      isUserActive,
    );

    // Create a query for each endpoint this tool needs
    for (const endpoint of requiredApiEndpoints) {
      const queryKey = ["tool-data", tool.name, endpoint];

      // Find the base refresh interval for this endpoint
      const endpointWidget = dynamicWidgets.find(
        (w) => w.apiEndpoint === endpoint,
      );
      const baseInterval = endpointWidget?.refreshInterval;

      // Calculate final adaptive interval
      let finalInterval: number | false = false;
      let originalInterval = 0;

      if (baseInterval && baseInterval > 0) {
        originalInterval = baseInterval;

        // Apply adaptive polling: rate-aware dynamic interval + activity factor
        const rateAwareInterval = getDynamicInterval(
          usagePercent,
          baseInterval,
        );
        const finalDynamicInterval = Math.round(
          rateAwareInterval * activityFactor,
        );

        // Clamp to reasonable bounds and ensure at least 30 seconds
        finalInterval = clampInterval(finalDynamicInterval) || false;
      }

      queries.push({
        queryKey,
        queryFn: () => fetchToolData(tool, endpoint),
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: true,
        retry: 3,
        // Use dynamic adaptive interval
        refetchInterval: finalInterval,
        refetchIntervalInBackground: true,
        meta: {
          toolName: tool.name,
          endpoint,
          originalInterval,
          finalInterval,
          usagePercent,
          activityFactor,
        },
      });
    }
  }

  return queries;
};

export function useToolQueries({
  enabledTools,
}: UseToolQueriesProps): UseToolQueriesReturn {
  const queryClient = useQueryClient();

  // Rate limit monitoring for all active platforms
  const activePlatforms = useMemo(
    () => getActivePlatforms(enabledTools),
    [enabledTools],
  );
  const { statuses: rateLimitStatuses } = useMultipleRateLimits(
    activePlatforms,
    activePlatforms.length > 0,
  );

  // User activity and tab visibility detection for adaptive polling
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [isUserActive, setIsUserActive] = useState(true);

  // Tab visibility detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // User activity detection (keyboard/mouse events)
  useEffect(() => {
    let inactivityTimeout: NodeJS.Timeout;

    const resetActivity = () => {
      setIsUserActive(true);
      clearTimeout(inactivityTimeout);
      // Set user as inactive after 5 minutes of no activity
      inactivityTimeout = setTimeout(
        () => setIsUserActive(false),
        5 * 60 * 1000,
      );
    };

    // Activity events to monitor
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, resetActivity, { passive: true });
    });

    // Initial activity
    resetActivity();

    // Cleanup
    return () => {
      clearTimeout(inactivityTimeout);
      events.forEach((event) => {
        document.removeEventListener(event, resetActivity);
      });
    };
  }, []);

  // Create dynamic query configurations based on enabled tools and rate limits
  const queryConfigs = useMemo(
    () =>
      createQueryConfigs(
        enabledTools,
        rateLimitStatuses,
        isTabVisible,
        isUserActive,
      ),
    [enabledTools, rateLimitStatuses, isTabVisible, isUserActive],
  );

  // Execute all queries
  const queryResults = useQueries({ queries: queryConfigs });

  // Transform query results into the expected data structure
  const dynamicData = useMemo(() => {
    const result: Record<string, Record<string, ToolData[]>> = {};

    queryResults.forEach((queryResult, index) => {
      if (!queryResult.isSuccess || !queryResult.data) return;

      const config = queryConfigs[index];
      const { toolName, endpoint } = config.meta as {
        toolName: string;
        endpoint: string;
      };

      if (!result[toolName]) {
        result[toolName] = {};
      }

      result[toolName][endpoint] = queryResult.data;
    });

    return result;
  }, [queryResults, queryConfigs]);

  // Derive loading states from query states
  const loadingStates = useMemo(() => {
    const states: Record<string, boolean> = {};

    enabledTools.forEach((tool) => {
      const toolKey = `${tool.name}-refresh`;
      // A tool is loading if any of its queries are loading or fetching
      const toolQueries = queryConfigs.filter(
        (config) =>
          (config.meta as { toolName: string; endpoint: string })?.toolName ===
          tool.name,
      );
      const isToolLoading = toolQueries.some(
        (_, index) =>
          queryResults[index]?.isLoading || queryResults[index]?.isFetching,
      );
      states[toolKey] = isToolLoading;
    });

    return states;
  }, [queryResults, queryConfigs, enabledTools]);

  // Manual refresh function for a specific tool
  const refreshToolData = useCallback(
    async (tool: Omit<Tool, "handlers">) => {
      if (!tool.enabled) return;

      // Find all endpoints this tool provides
      const toolQueries = queryConfigs.filter(
        (config) =>
          (config.meta as { toolName: string; endpoint: string })?.toolName ===
          tool.name,
      );

      // Trigger immediate refetch for all tool queries
      await Promise.all(
        toolQueries.map((config) =>
          queryClient.refetchQueries({ queryKey: config.queryKey }),
        ),
      );
    },
    [queryConfigs, queryClient],
  );

  // Global refresh function for all enabled tools
  const refreshAllData = useCallback(async () => {
    // Trigger immediate refetch for all tool queries
    await queryClient.refetchQueries({ queryKey: ["tool-data"] });
  }, [queryClient]);

  // Initialize polling - cleanup function since React Query handles polling automatically
  const initializePolling = useCallback(() => {
    // All polling is handled automatically by React Query's refetchInterval configuration
    return () => {};
  }, []);

  return {
    dynamicData,
    loadingStates,
    refreshToolData,
    refreshAllData,
    initializePolling,
  };
}
