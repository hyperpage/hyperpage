"use client";

import React from "react";

import ToolStatusIndicator from "@/app/components/ToolStatusIndicator";
import { useToolStatus } from "@/app/components/hooks/useToolStatus";
import { RateLimitStatus } from "@/lib/types/rate-limit";

export default function ToolStatusRow() {
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

  return (
    <div className="flex justify-center items-center py-6 border-t border-border mt-8">
      <div className="flex flex-col items-center space-y-4">
        <div className="flex items-center space-x-6">
          {toolIntegrations.map((tool, index) => {
            const rateLimitStatus = rateLimitStatuses.get(tool.slug) as
              | RateLimitStatus
              | undefined;

            return (
              <ToolStatusIndicator
                key={`${tool.slug}-${index}`}
                tool={tool}
                authStatus={authData}
                rateLimitStatus={rateLimitStatus}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
