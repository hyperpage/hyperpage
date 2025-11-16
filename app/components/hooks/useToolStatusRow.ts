"use client";

import { useMemo } from "react";

import { RateLimitStatus } from "@/lib/types/rate-limit";
import {
  useToolStatus,
  ToolHealthInfo,
  UseToolStatusReturn,
} from "@/app/components/hooks/useToolStatus";
import { PortalAggregatedError } from "@/app/components/hooks/usePortalOverviewData";

interface UseToolStatusRowArgs {
  errorSummaries: PortalAggregatedError[];
}

export interface ToolStatusRowItem {
  tool: ToolHealthInfo;
  rateLimitStatus?: RateLimitStatus;
  dataIssue: { message: string; timestamp: number } | null;
}

export type ToolStatusAuthData = UseToolStatusReturn["authData"];

const normalizeSlug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function useToolStatusRow({
  errorSummaries,
}: UseToolStatusRowArgs) {
  const {
    toolIntegrations,
    rateLimitStatuses,
    authData,
    isLoading,
    error,
    refetch,
  } = useToolStatus();

  const toolIssueMap = useMemo(() => {
    const map = new Map<string, { message: string; timestamp: number }>();

    errorSummaries.forEach(({ toolName, message, timestamp }) => {
      const slug = normalizeSlug(toolName);
      const existing = map.get(slug);
      if (!existing || timestamp > existing.timestamp) {
        map.set(slug, { message, timestamp });
      }
    });

    return map;
  }, [errorSummaries]);

  const toolStatusItems = useMemo<ToolStatusRowItem[]>(() => {
    if (toolIntegrations.length === 0) {
      return [];
    }

    return toolIntegrations.map((tool) => ({
      tool,
      rateLimitStatus: rateLimitStatuses.get(tool.slug) as
        | RateLimitStatus
        | undefined,
      dataIssue: toolIssueMap.get(tool.slug) ?? null,
    }));
  }, [toolIntegrations, rateLimitStatuses, toolIssueMap]);

  return {
    authStatus: authData,
    isLoading,
    errorMessage: error?.message ?? null,
    onRetry: refetch,
    hasTools: toolIntegrations.length > 0,
    toolStatusItems,
  };
}
