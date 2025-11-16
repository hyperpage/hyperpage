"use client";

import { useMemo } from "react";

import { ClientSafeTool, ToolData } from "@/tools/tool-types";
import { processPortalData } from "@/lib/portal-utils";

export interface PortalAggregatedError {
  toolName: string;
  endpoints: string[];
  message: string;
  timestamp: number;
}

interface UsePortalOverviewDataArgs {
  enabledTools: ClientSafeTool[];
  searchQuery: string;
  dynamicData: Record<string, Record<string, ToolData[]>>;
  errorStates: Record<string, { message: string; timestamp: number } | null>;
}

export function usePortalOverviewData({
  enabledTools,
  searchQuery,
  dynamicData,
  errorStates,
}: UsePortalOverviewDataArgs) {
  const { toolWidgets, totalSearchResults } = useMemo(
    () => processPortalData(enabledTools, searchQuery, dynamicData),
    [enabledTools, searchQuery, dynamicData],
  );

  const aggregatedErrors = useMemo<PortalAggregatedError[]>(() => {
    const entries = Object.entries(errorStates).filter(
      ([, info]) => info !== null,
    );

    if (entries.length === 0) {
      return [];
    }

    const aggregatedMap = entries.reduce<Record<string, PortalAggregatedError>>(
      (acc, [key, info]) => {
        const [toolName, ...endpointParts] = key.split("-");
        const endpoint = endpointParts.join("-");
        const normalizedMessage = info?.message || "Unknown error";
        const aggregateKey = `${toolName}-${normalizedMessage}`;

        const existing = acc[aggregateKey];
        if (!existing) {
          acc[aggregateKey] = {
            toolName,
            endpoints: [endpoint],
            message: normalizedMessage,
            timestamp: info?.timestamp ?? Date.now(),
          };
          return acc;
        }

        if (!existing.endpoints.includes(endpoint)) {
          existing.endpoints.push(endpoint);
        }

        if ((info?.timestamp ?? 0) > existing.timestamp) {
          existing.timestamp = info?.timestamp ?? existing.timestamp;
        }

        return acc;
      },
      {},
    );

    return Object.values(aggregatedMap);
  }, [errorStates]);

  const telemetryRefreshKey = useMemo(
    () =>
      aggregatedErrors.reduce(
        (acc, item) => acc + item.timestamp,
        aggregatedErrors.length,
      ),
    [aggregatedErrors],
  );

  return {
    toolWidgets,
    totalSearchResults,
    aggregatedErrors,
    telemetryRefreshKey,
  };
}
