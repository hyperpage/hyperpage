"use client";

import React from "react";

import { ToolHealthInfo } from "@/app/components/hooks/useToolStatus";
import { useAuthStatus } from "@/app/components/hooks/useAuthStatus";
import { RateLimitStatus } from "@/lib/types/rate-limit";
import { StatusCalculator } from "@/app/components/StatusCalculator";
import { useTelemetryPanelFocus } from "@/app/components/hooks/useTelemetryPanelFocus";
import { getToolStatusIndicatorTooltip } from "@/app/components/utils/getToolStatusIndicatorTooltip";
import ToolStatusIndicatorIcon from "@/app/components/ToolStatusIndicatorIcon";

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
  const { hasDataIssue, interactionProps } = useTelemetryPanelFocus(dataIssue);

  const tooltip = getToolStatusIndicatorTooltip({
    toolName: tool.name,
    status: tool.status,
    authStatus: authStatus.authStatus?.authenticatedTools?.[tool.slug],
    rateLimitStatus,
    dataIssue,
  });

  return (
    <div
      className={`flex flex-col items-center justify-center p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors ${
        hasDataIssue ? "cursor-pointer focus:outline-none" : ""
      } ${className}`}
      title={tooltip}
      {...interactionProps}
    >
      <ToolStatusIndicatorIcon
        icon={tool.icon}
        statusColor={statusColor}
        statusIcon={statusIcon}
        authColor={authColor}
        authIcon={authIcon}
        rateLimitDisplay={rateLimitDisplay}
        effectiveStatus={effectiveStatus}
        hasDataIssue={hasDataIssue}
      />

      <span className="text-xs text-center mt-2 text-muted-foreground capitalize">
        {tool.name}
      </span>
    </div>
  );
}
