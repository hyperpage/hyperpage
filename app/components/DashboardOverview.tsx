import { useMemo } from "react";
import { Tool, ToolData } from "../../tools/tool-types";
import { sortDataByTime } from "../../lib/time-utils";
import { DashboardSearchResults } from "./DashboardSearchResults";
import { DashboardWidgetGrid } from "./DashboardWidgetGrid";

interface DashboardOverviewProps {
  enabledTools: Omit<Tool, "handlers">[];
  searchQuery: string;
  dynamicData: Record<string, ToolData[]>;
  loadingStates: Record<string, boolean>;
  refreshToolData: (tool: Omit<Tool, "handlers">) => void;
}

export function DashboardOverview({
  enabledTools,
  searchQuery,
  dynamicData,
  loadingStates,
  refreshToolData,
}: DashboardOverviewProps) {
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

  // Process tool widgets with dynamic data and search filtering
  const toolWidgets = useMemo(() => {
    return enabledTools
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
  }, [enabledTools, dynamicData, searchQuery]);

  // Calculate total search results
  const totalSearchResults = toolWidgets.reduce(
    (total, widget) => total + widget.data.length,
    0,
  );

  return (
    <div className="p-6">
      <DashboardSearchResults
        searchQuery={searchQuery}
        totalSearchResults={totalSearchResults}
      />

      <DashboardWidgetGrid
        toolWidgets={toolWidgets}
        loadingStates={loadingStates}
        enabledTools={enabledTools}
        refreshToolData={refreshToolData}
      />
    </div>
  );
}
