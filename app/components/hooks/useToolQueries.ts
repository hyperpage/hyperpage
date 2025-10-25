"use client";

import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import { Tool, ToolData } from "../../../tools/tool-types";
import { getToolDataKey } from "../../../tools";

interface UseToolQueriesProps {
  enabledTools: Omit<Tool, "handlers">[];
}

interface UseToolQueriesReturn {
  dynamicData: Record<string, Record<string, ToolData[]>>;
  loadingStates: Record<string, boolean>;
  refreshToolData: (tool: Omit<Tool, "handlers">) => Promise<void>;
  refreshActivityData: () => Promise<void>;
  refreshAllData: () => void;
  initializePolling: () => () => void;
}

// Fetch function for a specific tool endpoint
const fetchToolData = async (tool: Omit<Tool, "handlers">, endpoint: string): Promise<ToolData[]> => {
  const response = await fetch(`/api/tools/${tool.slug}/${endpoint}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${tool.name}/${endpoint}: ${response.status}`);
  }
  const data = await response.json();
  // Use registry-driven data key access
  const dataKey = getToolDataKey(tool.name, endpoint) || endpoint;
  return data[dataKey] || [];
};

// Create query configurations for all enabled tool endpoints
const createQueryConfigs = (enabledTools: Omit<Tool, "handlers">[]) => {
  const queries = [];

  for (const tool of enabledTools) {
    if (!tool.enabled) continue;

    // Check if any widgets need dynamic data
    const dynamicWidgets = tool.widgets.filter((widget) => widget.dynamic);
    if (dynamicWidgets.length === 0) continue;

    // Find unique API endpoints that widgets require
    const requiredApiEndpoints = Array.from(new Set(
      tool.widgets
        .filter(widget => widget.dynamic && widget.apiEndpoint)
        .map(widget => widget.apiEndpoint!)
    ));



    // Create a query for each endpoint this tool needs
    for (const endpoint of requiredApiEndpoints) {
      const queryKey = ['tool-data', tool.name, endpoint];

      // Find the maximum refresh interval for this endpoint (widgets can specify different intervals)
      const endpointWidget = dynamicWidgets.find(w => w.apiEndpoint === endpoint);
      const refreshInterval = endpointWidget?.refreshInterval;

      queries.push({
        queryKey,
        queryFn: () => fetchToolData(tool, endpoint),
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: true,
        retry: 3,
        // Only enable background polling if refresh interval is configured
        refetchInterval: refreshInterval && refreshInterval > 0 ? refreshInterval : (false as const),
        refetchIntervalInBackground: true,
        meta: { toolName: tool.name, endpoint },
      });
    }
  }

  return queries;
};

export function useToolQueries({
  enabledTools,
}: UseToolQueriesProps): UseToolQueriesReturn {
  const queryClient = useQueryClient();

  // Create dynamic query configurations based on enabled tools
  const queryConfigs = useMemo(
    () => createQueryConfigs(enabledTools),
    [enabledTools]
  );

  // Execute all queries
  const queryResults = useQueries({ queries: queryConfigs });

  // Transform query results into the expected data structure
  const dynamicData = useMemo(() => {
    const result: Record<string, Record<string, ToolData[]>> = {};

    queryResults.forEach((queryResult, index) => {
      if (!queryResult.isSuccess || !queryResult.data) return;

      const config = queryConfigs[index];
      const { toolName, endpoint } = config.meta as { toolName: string; endpoint: string };

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
      const toolQueries = queryConfigs.filter(config =>
        (config.meta as { toolName: string; endpoint: string })?.toolName === tool.name
      );
      const isToolLoading = toolQueries.some((_, index) =>
        queryResults[index]?.isLoading || queryResults[index]?.isFetching
      );
      states[toolKey] = isToolLoading;
    });

    return states;
  }, [queryResults, queryConfigs, enabledTools]);

  // Manual refresh function for a specific tool
  const refreshToolData = useCallback(async (tool: Omit<Tool, "handlers">) => {
    if (!tool.enabled) return;

    // Find all queries related to this tool
    const toolQueries = queryConfigs.filter(config =>
      (config.meta as { toolName: string; endpoint: string })?.toolName === tool.name
    );

    // Refresh all queries for this tool
    await Promise.all(
      toolQueries.map((config) => queryClient.refetchQueries({ queryKey: config.queryKey }))
    );
  }, [queryConfigs, queryClient]);

  // Activity feed refresh function
  const refreshActivityData = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey: ["activities"] });
  }, [queryClient]);

  // Global refresh function
  const refreshAllData = useCallback(async () => {
    // Refresh all tool queries
    await Promise.all(
      queryConfigs.map((config) => queryClient.refetchQueries({ queryKey: config.queryKey }))
    );
    // Refresh activity data
    await queryClient.refetchQueries({ queryKey: ["activities"] });
  }, [queryConfigs, queryClient]);

  // Initialize polling - cleanup function since React Query handles polling automatically
  const initializePolling = useCallback(() => {
    // All polling is handled automatically by React Query's refetchInterval configuration
    return () => {};
  }, []);

  return {
    dynamicData,
    loadingStates,
    refreshToolData,
    refreshActivityData,
    refreshAllData,
    initializePolling,
  };
}
