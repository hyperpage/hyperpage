import { Tool, ToolData, ToolWidget } from "@/tools/tool-types";
import { sortDataByTime } from "@/lib/time-utils";

// Define ToolWidget extended type for components that need toolName
type ExtendedToolWidget = ToolWidget & { toolName: string };

// Search helper function
export function matchesSearch(item: ToolData, query: string): boolean {
  if (!query) return true;

  const searchTerms = query.toLowerCase().split(/\s+/);
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
}

// Data processing function for portal overview
export function processPortalData(
  enabledTools: Omit<Tool, "handlers">[],
  searchQuery: string,
  dynamicData: Record<string, Record<string, ToolData[]>>,
): {
  toolWidgets: ExtendedToolWidget[];
  totalSearchResults: number;
} {
  // Get enabled tools and their widgets with dynamic data and search filtering
  const toolWidgets: ExtendedToolWidget[] = enabledTools
    .filter((tool) => tool.apis && Object.keys(tool.apis).length > 0)
    .flatMap((tool) =>
      tool.widgets.map((widget) => {
        let widgetData = widget.data || [];

        // Use dynamic data if available and widget supports it
        if (widget.dynamic) {
          const toolDynamicData = dynamicData[tool.name];
          if (
            toolDynamicData &&
            widget.apiEndpoint &&
            toolDynamicData[widget.apiEndpoint]
          ) {
            widgetData = toolDynamicData[widget.apiEndpoint];
          }
        }

        // Filter data based on search query
        const filteredData = widgetData.filter((item: ToolData) =>
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

  return { toolWidgets, totalSearchResults };
}
