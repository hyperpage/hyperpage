"use client";

import React, { useCallback } from "react";

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
  dataIssue?: { message: string; timestamp: number } | null;
  className?: string;
}

export default function ToolStatusIndicator({
  tool,
  authStatus,
  rateLimitStatus,
  dataIssue = null,
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

  const scrollToTelemetryPanel = useCallback(() => {
    if (!dataIssue) return;
    const target = document.getElementById("widget-telemetry-panel");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.classList.add("ring-2", "ring-amber-400");
      window.setTimeout(() => {
        target.classList.remove("ring-2", "ring-amber-400");
      }, 2000);
    }
  }, [dataIssue]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!dataIssue) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        scrollToTelemetryPanel();
      }
    },
    [dataIssue, scrollToTelemetryPanel],
  );

  const tooltip = `${ToolStatusTooltip({
    toolName: tool.name,
    status: tool.status,
    authStatus: authStatus.authStatus?.authenticatedTools?.[tool.slug],
    rateLimitStatus: rateLimitStatus,
  })}${
    dataIssue
      ? `\nData issue: ${dataIssue.message} (since ${new Date(dataIssue.timestamp).toLocaleTimeString()})\nClick to view widget telemetry.`
      : ""
  }`;

  return (
    <div
      className={`flex flex-col items-center justify-center p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors ${
        dataIssue ? "cursor-pointer focus:outline-none" : ""
      } ${className}`}
      title={tooltip}
      role={dataIssue ? "button" : undefined}
      tabIndex={dataIssue ? 0 : undefined}
      onClick={dataIssue ? scrollToTelemetryPanel : undefined}
      onKeyDown={dataIssue ? handleKeyDown : undefined}
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

        {dataIssue && (
          <div
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-background bg-amber-500"
            aria-label="Data issue detected"
          />
        )}
      </div>

      <span className="text-xs text-center mt-2 text-muted-foreground capitalize">
        {tool.name}
      </span>
    </div>
  );
}
