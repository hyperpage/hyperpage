"use client";

import SearchResultsHeader from "@/app/components/SearchResultsHeader";
import ToolWidgetGrid from "@/app/components/ToolWidgetGrid";
import NoToolsState from "@/app/components/NoToolsState";
import ToolStatusRow from "@/app/components/ToolStatusRow";
import { ClientSafeTool, ToolData } from "@/tools/tool-types";
import { processPortalData } from "@/lib/portal-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import WidgetTelemetryPanel from "@/app/components/WidgetTelemetryPanel";

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
  // Process data using utility function
  const { toolWidgets, totalSearchResults } = processPortalData(
    enabledTools,
    searchQuery,
    dynamicData,
  );

  const aggregatedErrors = Object.entries(errorStates)
    .filter(([, info]) => info)
    .map(([key, info]) => {
      const [toolName, ...endpointParts] = key.split("-");
      const endpoint = endpointParts.join("-");
      return {
        toolName,
        endpoint,
        message: info!.message,
        timestamp: info!.timestamp,
      };
    })
    .reduce<
      Record<
        string,
        {
          toolName: string;
          endpoints: string[];
          message: string;
          timestamp: number;
        }
      >
    >((acc, { toolName, endpoint, message, timestamp }) => {
      const normalizedMessage = message || "Unknown error";
      const aggregateKey = `${toolName}-${normalizedMessage}`;
      const current = acc[aggregateKey];
      if (!current) {
        acc[aggregateKey] = {
          toolName,
          endpoints: [endpoint],
          message: normalizedMessage,
          timestamp,
        };
      } else {
        if (!current.endpoints.includes(endpoint)) {
          current.endpoints.push(endpoint);
        }
        if (timestamp > current.timestamp) {
          current.timestamp = timestamp;
        }
      }
      return acc;
    }, {});
  const aggregatedErrorList = Object.values(aggregatedErrors);
  const telemetryRefreshKey = aggregatedErrorList.reduce(
    (acc, item) => acc + item.timestamp,
    aggregatedErrorList.length,
  );

  return (
    <div className="p-8">
      {aggregatedErrorList.length > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Some tool data failed to load</AlertTitle>
          <AlertDescription>
            {aggregatedErrorList.map(
              ({ toolName, endpoints, message, timestamp }) => (
                <p key={`${toolName}-${message}`}>
                  <span className="font-semibold">{toolName}</span> (
                  {endpoints.join(", ")}): {message} –{" "}
                  <span className="italic text-xs">
                    {new Date(timestamp).toLocaleTimeString()}
                  </span>
                </p>
              ),
            )}
          </AlertDescription>
        </Alert>
      )}

      {aggregatedErrorList.length > 0 && (
        <WidgetTelemetryPanel refreshKey={telemetryRefreshKey} limit={5} />
      )}

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
      <ToolStatusRow errorSummaries={aggregatedErrorList} />
    </div>
  );
}
