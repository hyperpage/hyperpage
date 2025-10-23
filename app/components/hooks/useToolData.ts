import { useState, useCallback } from "react";
import { Tool, ToolData } from "../../../tools/tool-types";
import { getToolDataKey } from "../../../tools";

interface UseToolDataProps {
  enabledTools: Omit<Tool, "handlers">[];
}

interface UseToolDataReturn {
  dynamicData: Record<string, ToolData[]>;
  loadingStates: Record<string, boolean>;
  refreshToolData: (tool: Omit<Tool, "handlers">) => Promise<void>;
  refreshActivityData: () => Promise<void>;
  refreshAllData: () => void;
  initializePolling: () => () => void;
}

export function useToolData({
  enabledTools,
}: UseToolDataProps): UseToolDataReturn {
  const [dynamicData, setDynamicData] = useState<Record<string, ToolData[]>>(
    {},
  );
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>(
    {},
  );

  // Manual refresh function for a specific tool
  const refreshToolData = useCallback(async (tool: Omit<Tool, "handlers">) => {
    if (!tool.enabled) return;

    // Check if any widgets need dynamic data
    const hasDynamicWidgets = tool.widgets.some((widget) => widget.dynamic);
    if (!hasDynamicWidgets) return;

    const toolKey = `${tool.name}-refresh`;
    setLoadingStates((prev) => ({ ...prev, [toolKey]: true }));

    try {
      // Get the first available API endpoint for this tool
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const availableApi = (tool.apis as any)?.length > 0 ? (tool.apis as any)[0].endpoint : null;
      if (!availableApi) return;

      const response = await fetch(`/api/tools/${tool.slug}/${availableApi}`);
      if (response.ok) {
        const data = await response.json();
        // Use registry-driven data key access
        const dataKey = getToolDataKey(tool.name, availableApi) || availableApi;
        setDynamicData((prev) => ({
          ...prev,
          [tool.name]: data[dataKey] || [],
        }));
      } else {
        console.error(`Failed to refresh ${tool.name}: ${response.status}`);
      }
    } catch (error) {
      console.error(`Error refreshing ${tool.name}:`, error);
    } finally {
      setLoadingStates((prev) => ({ ...prev, [toolKey]: false }));
    }
  }, []);

  // Activity feed refresh function
  const refreshActivityData = useCallback(async () => {
    const activityKey = "activity-refresh";
    setLoadingStates((prev) => ({ ...prev, [activityKey]: true }));

    try {
      const response = await fetch("/api/tools/activity");
      if (response.ok) {
        // The Livefeed component will handle the update via its fetchActivities function
        // This just ensures we're in loading state during the operation
      } else {
        console.error(`Failed to refresh activity data: ${response.status}`);
      }
    } catch (error) {
      console.error("Error refreshing activity data:", error);
    } finally {
      setLoadingStates((prev) => ({ ...prev, [activityKey]: false }));
    }
  }, []);

  // Global refresh function
  const refreshAllData = useCallback(
    () => {
      enabledTools.forEach((tool) => {
        if (tool.enabled && tool.widgets.some((widget) => widget.dynamic)) {
          refreshToolData(tool);
        }
      });
      // Also refresh activity feed
      refreshActivityData();
    },
    [enabledTools, refreshToolData, refreshActivityData],
  );

  // Initialize polling and setup function
  const initializePolling = useCallback(() => {
    const intervalIds: NodeJS.Timeout[] = [];

    const setupPolling = async () => {
      // Initial data load for all enabled tools
      for (const tool of enabledTools) {
        if (tool.enabled) {
          const dynamicWidgets = tool.widgets.filter(
            (widget) => widget.dynamic,
          );
          if (dynamicWidgets.length > 0) {
            await refreshToolData(tool);

            // Set up polling for each dynamic widget if refresh interval is configured
            dynamicWidgets.forEach((widget) => {
              if (widget.refreshInterval && widget.refreshInterval > 0) {
                const intervalId = setInterval(() => {
                  refreshToolData(tool);
                }, widget.refreshInterval);
                intervalIds.push(intervalId);
              }
            });
          }
        }
      }

      // Set up activity feed polling (15 seconds = 15,000 ms for balanced updates)
      const activityIntervalId = setInterval(() => {
        refreshActivityData();
      }, 15000);
      intervalIds.push(activityIntervalId);
    };

    setupPolling();

    // Handle visibility change - refresh data when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        enabledTools.forEach((tool) => {
          if (tool.enabled && tool.widgets.some((widget) => widget.dynamic)) {
            refreshToolData(tool);
          }
        });
        // Also refresh activity feed when tab becomes visible
        refreshActivityData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Return cleanup function
    return () => {
      intervalIds.forEach((id) => clearInterval(id));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabledTools, refreshToolData, refreshActivityData]);

  return {
    dynamicData,
    loadingStates,
    refreshToolData,
    refreshActivityData,
    refreshAllData,
    initializePolling,
  };
}
