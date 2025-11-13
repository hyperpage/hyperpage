"use client";

import React from "react";

import { ToolStatusTooltip } from "@/app/components/ToolStatusTooltip";
import { ToolHealthInfo } from "@/app/components/hooks/useToolStatus";
import { useAuthStatus } from "@/app/components/hooks/useAuthStatus";
import { RateLimitStatus } from "@/lib/types/rate-limit";
import { StatusCalculator } from "@/app/components/StatusCalculator";
import RateLimitIndicator from "@/app/components/RateLimitIndicator";

export interface ToolStatusIndicatorProps {
  tool: ToolHealthInfo;
  authStatus: ReturnType<typeof useAuthStatus>;
  rateLimitStatus: RateLimitStatus | undefined;
  className?: string;
}

export default function ToolStatusIndicator({
  tool,
  authStatus,
  rateLimitStatus,
  className = "",
}: ToolStatusIndicatorProps) {
  // Use the StatusCalculator to get all computed values
  const {
    statusColor,
    statusIcon,
    authColor,
    authIcon,
    rateLimitDisplay,
    effectiveStatus,
  } = StatusCalculator({
    status: tool.status,
    rateLimitStatus,
    authStatus,
    toolSlug: tool.slug,
  });

  return (
    <div
      className={`flex flex-col items-center justify-center p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors ${className}`}
      title={ToolStatusTooltip({
        toolName: tool.name,
        status: tool.status,
        authStatus: authStatus.authStatus?.authenticatedTools?.[tool.slug],
        rateLimitStatus: rateLimitStatus,
      })}
    >
      <div className="relative">
        <span className="text-xl">{tool.icon}</span>

        {/* Status indicator */}
        <div
          className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${statusColor}`}
        >
          {statusIcon}
        </div>

        {/* Auth indicator */}
        <div
          className={`absolute -top-1 -left-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${authColor}`}
        >
          {authIcon}
        </div>

        {/* Rate limit indicators */}
        <RateLimitIndicator
          rateLimitDisplay={rateLimitDisplay}
          effectiveStatus={effectiveStatus}
        />
      </div>

      <span className="text-xs text-center mt-2 text-muted-foreground capitalize">
        {tool.name}
      </span>
    </div>
  );
}
