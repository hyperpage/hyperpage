"use client";

import SearchResultsHeader from "@/app/components/SearchResultsHeader";
import ToolWidgetGrid from "@/app/components/ToolWidgetGrid";
import NoToolsState from "@/app/components/NoToolsState";
import ToolStatusRow from "@/app/components/ToolStatusRow";
import { ClientSafeTool, ToolData } from "@/tools/tool-types";
import PortalErrorSummary from "@/app/components/PortalErrorSummary";
import { usePortalOverviewData } from "@/app/components/hooks/usePortalOverviewData";

interface PortalOverviewProps {
  enabledTools: ClientSafeTool[];
  searchQuery: string;
  dynamicData: Record<string, Record<string, ToolData[]>>;
  loadingStates: Record<string, boolean>;
  errorStates: Record<string, { message: string; timestamp: number } | null>;
  refreshToolData: (tool: ClientSafeTool) => Promise<void>;
}

export default function PortalOverview({
  enabledTools,
  searchQuery,
  dynamicData,
  loadingStates,
  errorStates,
  refreshToolData,
}: PortalOverviewProps) {
  const {
    toolWidgets,
    totalSearchResults,
    aggregatedErrors,
    telemetryRefreshKey,
  } = usePortalOverviewData({
    enabledTools,
    searchQuery,
    dynamicData,
    errorStates,
  });

  return (
    <div className="p-8 space-y-6">
      <PortalErrorSummary
        aggregatedErrors={aggregatedErrors}
        telemetryRefreshKey={telemetryRefreshKey}
      />

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
          errorStates={errorStates}
          refreshToolData={refreshToolData}
        />
      ) : (
        <NoToolsState />
      )}

      {/* Tool Status Row */}
      <ToolStatusRow errorSummaries={aggregatedErrors} />
    </div>
  );
}
