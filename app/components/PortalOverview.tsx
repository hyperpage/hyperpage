import SearchResultsHeader from "@/app/components/SearchResultsHeader";
import ToolWidgetGrid from "@/app/components/ToolWidgetGrid";
import NoToolsState from "@/app/components/NoToolsState";
import ToolStatusRow from "@/app/components/ToolStatusRow";
import { Tool, ToolData } from "@/tools/tool-types";
import { processPortalData } from "@/lib/portal-utils";

interface PortalOverviewProps {
  enabledTools: Omit<Tool, "handlers">[];
  searchQuery: string;
  dynamicData: Record<string, Record<string, ToolData[]>>;
  loadingStates: Record<string, boolean>;
  refreshToolData: (tool: Omit<Tool, "handlers">) => Promise<void>;
}

export default function PortalOverview({
  enabledTools,
  searchQuery,
  dynamicData,
  loadingStates,
  refreshToolData,
}: PortalOverviewProps) {
  // Process data using utility function
  const { toolWidgets, totalSearchResults } = processPortalData(
    enabledTools,
    searchQuery,
    dynamicData,
  );

  return (
    <div className="p-8">
      {/* Search Results Summary */}
      {searchQuery && (
        <SearchResultsHeader
          searchQuery={searchQuery}
          totalSearchResults={totalSearchResults}
        />
      )}

      {/* Tool Widgets Grid */}
      {toolWidgets.length > 0 ? (
        <ToolWidgetGrid
          toolWidgets={toolWidgets}
          enabledTools={enabledTools}
          loadingStates={loadingStates}
          refreshToolData={refreshToolData}
        />
      ) : (
        <NoToolsState />
      )}

      {/* Tool Status Row */}
      <ToolStatusRow />
    </div>
  );
}
