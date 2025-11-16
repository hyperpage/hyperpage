"use client";

import { AlertTriangle } from "lucide-react";

import type { PortalAggregatedError } from "@/app/components/hooks/usePortalOverviewData";

export function ToolStatusSkeleton() {
  return (
    <div className="flex justify-center items-center py-6 border-t border-border mt-8">
      <div className="flex items-center space-x-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`tool-row-loading-${index}`}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-muted animate-pulse"
          >
            <div className="w-6 h-6 bg-gray-300 rounded-full" />
            <div className="w-12 h-3 bg-gray-300 rounded mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ToolStatusError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex justify-center items-center py-6 border-t border-border mt-8">
      <div className="flex flex-col items-center space-y-4">
        <div className="text-sm text-muted-foreground">
          Failed to load tool status
        </div>
        <button
          onClick={onRetry}
          className="text-xs text-blue-500 hover:text-blue-700 underline"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export function DataIssueSummary({
  errorSummaries,
}: {
  errorSummaries: PortalAggregatedError[];
}) {
  if (errorSummaries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-center text-amber-600 text-xs">
      <div className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="w-4 h-4" />
        <span>Data issues detected</span>
      </div>
      <ul className="mt-1 space-y-1 text-center">
        {errorSummaries.map(({ toolName, endpoints, message, timestamp }) => (
          <li key={`${toolName}-${message}`}>
            {toolName} ({endpoints.join(", ")}): {message} ·{" "}
            {new Date(timestamp).toLocaleTimeString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
