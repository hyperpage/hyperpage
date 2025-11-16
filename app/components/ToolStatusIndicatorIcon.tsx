"use client";

import React from "react";

import RateLimitIndicator, {
  RateLimitIndicatorProps,
} from "@/app/components/RateLimitIndicator";

interface ToolStatusIndicatorIconProps {
  icon: React.ReactNode;
  statusColor: string;
  statusIcon: React.ReactNode;
  authColor: string;
  authIcon: React.ReactNode;
  rateLimitDisplay: RateLimitIndicatorProps["rateLimitDisplay"];
  effectiveStatus: RateLimitIndicatorProps["effectiveStatus"];
  hasDataIssue: boolean;
}

export default function ToolStatusIndicatorIcon({
  icon,
  statusColor,
  statusIcon,
  authColor,
  authIcon,
  rateLimitDisplay,
  effectiveStatus,
  hasDataIssue,
}: ToolStatusIndicatorIconProps) {
  return (
    <div className="relative">
      <span className="text-xl">{icon}</span>

      <div
        className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${statusColor}`}
      >
        {statusIcon}
      </div>

      <div
        className={`absolute -top-1 -left-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${authColor}`}
      >
        {authIcon}
      </div>

      <RateLimitIndicator
        rateLimitDisplay={rateLimitDisplay}
        effectiveStatus={effectiveStatus}
      />

      {hasDataIssue && (
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-background bg-amber-500"
          aria-label="Data issue detected"
        />
      )}
    </div>
  );
}
