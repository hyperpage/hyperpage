"use client";

import ToolStatusIndicator from "@/app/components/ToolStatusIndicator";
import type { PortalAggregatedError } from "@/app/components/hooks/usePortalOverviewData";
import type {
  ToolStatusAuthData,
  ToolStatusRowItem,
} from "@/app/components/hooks/useToolStatusRow";
import {
  ToolStatusSkeleton,
  ToolStatusError,
  DataIssueSummary,
} from "@/app/components/ToolStatusRowStates";

interface ToolStatusRowViewProps {
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  toolStatusItems: ToolStatusRowItem[];
  authStatus: ToolStatusAuthData;
  errorSummaries: PortalAggregatedError[];
}

export default function ToolStatusRowView({
  isLoading,
  errorMessage,
  onRetry,
  toolStatusItems,
  authStatus,
  errorSummaries,
}: ToolStatusRowViewProps) {
  if (isLoading) {
    return <ToolStatusSkeleton />;
  }

  if (errorMessage) {
    return <ToolStatusError onRetry={onRetry} />;
  }

  if (toolStatusItems.length === 0) {
    return null;
  }

  return (
    <div className="flex justify-center items-center py-6 border-t border-border mt-8">
      <div className="flex flex-col items-center space-y-4">
        <div className="flex items-center space-x-6">
          {toolStatusItems.map(
            ({ tool, rateLimitStatus, dataIssue }, index) => (
              <ToolStatusIndicator
                key={`${tool.slug}-${index}`}
                tool={tool}
                authStatus={authStatus}
                rateLimitStatus={rateLimitStatus}
                dataIssue={dataIssue}
              />
            ),
          )}
        </div>
        <DataIssueSummary errorSummaries={errorSummaries} />
      </div>
    </div>
  );
}
