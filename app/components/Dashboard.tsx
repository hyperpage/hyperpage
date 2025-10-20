"use client";

import { useState, useEffect, useCallback } from "react";
import TopBar from "./TopBar";
import TabNavigation from "./TabNavigation";
import DataTable from "./DataTable";
import Livefeed from "./Livefeed";

import { Tool, ToolData } from "../../tools/tool-types";
import { getToolDataKey } from "../../tools";
import { sortDataByTime } from "../../lib/time-utils";

interface DashboardProps {
  enabledTools: Omit<Tool, "handlers">[];
}

export default function Dashboard({ enabledTools }: DashboardProps) {
  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [dynamicData, setDynamicData] = useState<Record<string, ToolData[]>>(
    {},
  );
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>(
    {},
  );
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const darkMode = localStorage.getItem("darkMode");
    if (darkMode === "true") {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    } else if (darkMode === "false") {
      setIsDark(false);
      document.documentElement.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      setIsDark(prefersDark);
      if (prefersDark) document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleDarkMode = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    localStorage.setItem("darkMode", newIsDark.toString());
    if (newIsDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

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
      const availableApi = tool.apis && Object.keys(tool.apis)[0];
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
  const refreshAllData = useCallback(() => {
    enabledTools.forEach((tool) => {
      if (tool.enabled && tool.widgets.some((widget) => widget.dynamic)) {
        refreshToolData(tool);
      }
    });
    // Also refresh activity feed
    refreshActivityData();
  }, [enabledTools, refreshToolData, refreshActivityData]);

  // Initial data loading and polling setup
  useEffect(() => {
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

    return () => {
      // Cleanup intervals and listeners
      intervalIds.forEach((id) => clearInterval(id));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabledTools, refreshToolData, refreshActivityData]);

  // Search helper function
  const matchesSearch = (item: ToolData, query: string): boolean => {
    if (!query) return true;

    const searchTerms = query.toLowerCase().split(new RegExp("\\s+"));
    const searchableText = [
      item.title,
      item.repository,
      item.status,
      item.id,
      item.name,
      item.head_branch,
      item.author,
      item.description,
      item.tool,
      item.type,
      item.action,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchTerms.every((term) => searchableText.includes(term));
  };

  // Get enabled tools and their widgets with dynamic data and search filtering
  // Only show widgets for tools that have API endpoints defined
  const toolWidgets = enabledTools
    .filter((tool) => tool.apis && Object.keys(tool.apis).length > 0)
    .flatMap((tool) =>
      tool.widgets.map((widget) => {
        // Use dynamic data if available and widget supports it
        const widgetData =
          widget.dynamic && dynamicData[tool.name]
            ? dynamicData[tool.name]
            : widget.data;

        // Filter data based on search query
        const filteredData = widgetData.filter((item) =>
          matchesSearch(item, searchQuery),
        );

        // Sort data by time (most recent first)
        const sortedData = sortDataByTime(filteredData);

        return {
          ...widget,
          toolName: tool.name,
          data: sortedData,
        };
      }),
    );

  // Calculate total search results
  const totalSearchResults = toolWidgets.reduce(
    (total, widget) => total + widget.data.length,
    0,
  );

  const mainContent =
    activeTab === "livefeed" ? (
      <div className="p-6">
        <Livefeed
          onRefresh={refreshActivityData}
          isLoading={loadingStates["activity-refresh"] || false}
        />
      </div>
    ) : (
      <div className="p-6">
        {/* Search Results Summary */}
        {searchQuery && (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              Found {totalSearchResults} result
              {totalSearchResults !== 1 ? "s" : ""} for &ldquo;{searchQuery}
              &rdquo;
            </p>
          </div>
        )}

        {/* Tool Widgets Grid */}
        {toolWidgets.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dynamic Tool Widgets */}
            {toolWidgets.map((widget, index) => (
              <div key={`${widget.toolName}-${index}`}>
                {widget.type === "table" && (
                  <DataTable
                    title={widget.title}
                    headers={widget.headers || []}
                    data={widget.data}
                    tool={widget.toolName}
                    isLoading={
                      loadingStates[`${widget.toolName}-refresh`] || false
                    }
                    onRefresh={() => {
                      const tool = enabledTools.find(
                        (t) => t.name === widget.toolName,
                      );
                      if (tool) {
                        refreshToolData(tool);
                      }
                    }}
                  />
                )}
                {widget.type === "chart" && widget.component && (
                  <widget.component {...widget} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-muted-foreground mb-2">
                No Tools Enabled
              </h2>
              <p className="text-muted-foreground">
                Enable tools in your environment configuration to see dashboard
                widgets. Configure integrations using the settings dropdown in
                the top bar.
              </p>
            </div>
          </div>
        )}
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        toggleDarkMode={toggleDarkMode}
        isDark={isDark}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClearSearch={clearSearch}
        onGlobalRefresh={refreshAllData}
      />

      {/* Tab Navigation below TopBar */}
      <div className="fixed top-16 left-0 right-0 z-40">
        <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* Main content area - accounts for TopBar (64px) + TabNavigation (48px) */}
      <div className="fixed top-28 left-0 right-0 bottom-0 flex">
        {/* Full-width Content container */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Scrollable main content */}
          <div className="flex-1 overflow-y-auto">{mainContent}</div>
        </div>
      </div>
    </div>
  );
}
