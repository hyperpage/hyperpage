"use client";

import type { PortalAggregatedError } from "@/app/components/hooks/usePortalOverviewData";
import ToolStatusRowView from "@/app/components/ToolStatusRowView";
import { useToolStatusRow } from "@/app/components/hooks/useToolStatusRow";

interface ToolStatusRowProps {
  errorSummaries?: PortalAggregatedError[];
}

export default function ToolStatusRow({
  errorSummaries = [],
}: ToolStatusRowProps) {
  const {
    authStatus,
    isLoading,
    errorMessage,
    onRetry,
    hasTools,
    toolStatusItems,
  } = useToolStatusRow({ errorSummaries });

  if (!hasTools && !isLoading) {
    return null;
  }

  return (
    <ToolStatusRowView
      authStatus={authStatus}
      errorSummaries={errorSummaries}
      isLoading={isLoading}
      errorMessage={errorMessage}
      onRetry={onRetry}
      toolStatusItems={toolStatusItems}
    />
  );
}
