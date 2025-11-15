"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

import ToolStatusIndicator from "@/app/components/ToolStatusIndicator";
import { useToolStatus } from "@/app/components/hooks/useToolStatus";
import { RateLimitStatus } from "@/lib/types/rate-limit";

interface ToolStatusRowProps {
  errorSummaries?: {
    toolName: string;
    endpoints: string[];
    message: string;
    timestamp: number;
  }[];
}

export default function ToolStatusRow({
  errorSummaries = [],
}: ToolStatusRowProps) {
  const {
    toolIntegrations,
    rateLimitStatuses,
    authData,
    isLoading,
    error,
    refetch,
  } = useToolStatus();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-6 border-t border-border mt-8">
        <div className="flex items-center space-x-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col items-center justify-center p-3 rounded-lg bg-muted animate-pulse"
            >
              <div className="w-6 h-6 bg-gray-300 rounded-full"></div>
              <div className="w-12 h-3 bg-gray-300 rounded mt-2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center py-6 border-t border-border mt-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="text-sm text-muted-foreground">
            Failed to load tool status
          </div>
          <button
            onClick={refetch}
            className="text-xs text-blue-500 hover:text-blue-700 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (toolIntegrations.length === 0) {
    return null;
  }

  const normalizeSlug = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const toolIssueMap = new Map<
    string,
    { message: string; timestamp: number }
  >();
  errorSummaries.forEach(({ toolName, message, timestamp }) => {
    const slug = normalizeSlug(toolName);
    const existing = toolIssueMap.get(slug);
    if (!existing || timestamp > existing.timestamp) {
      toolIssueMap.set(slug, { message, timestamp });
    }
  });

  return (
    <div className="flex justify-center items-center py-6 border-t border-border mt-8">
      <div className="flex flex-col items-center space-y-4">
        <div className="flex items-center space-x-6">
          {toolIntegrations.map((tool, index) => {
            const rateLimitStatus = rateLimitStatuses.get(tool.slug) as
              | RateLimitStatus
              | undefined;
            const dataIssue = toolIssueMap.get(tool.slug);

            return (
              <ToolStatusIndicator
                key={`${tool.slug}-${index}`}
                tool={tool}
                authStatus={authData}
                rateLimitStatus={rateLimitStatus}
                dataIssue={dataIssue ?? null}
              />
            );
          })}
        </div>
        {errorSummaries.length > 0 && (
          <div className="flex flex-col items-center text-amber-600 text-xs">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4" />
              <span>Data issues detected</span>
            </div>
            <ul className="mt-1 space-y-1 text-center">
              {errorSummaries.map(
                ({ toolName, endpoints, message, timestamp }) => (
                  <li key={`${toolName}-${message}`}>
                    {toolName} ({endpoints.join(", ")}): {message} ·{" "}
                    {new Date(timestamp).toLocaleTimeString()}
                  </li>
                ),
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
