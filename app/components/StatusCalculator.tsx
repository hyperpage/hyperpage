"use client";

import React from "react";

import { RateLimitStatus } from "@/lib/types/rate-limit";
import {
  getStatusColor,
  getStatusIcon,
  getAuthIcon,
  getAuthColor,
} from "@/lib/status-calculator-utils";

interface StatusCalculatorProps {
  status: string;
  rateLimitStatus: RateLimitStatus | undefined;
  authStatus: unknown;
  toolSlug: string;
}

export interface StatusCalculatorResult {
  statusColor: string;
  statusIcon: React.ReactNode;
  authColor: string;
  authIcon: React.ReactNode;
  rateLimitDisplay: string | null;
  effectiveStatus: "normal" | "warning" | "critical" | "unknown";
}

export function StatusCalculator({
  status,
  rateLimitStatus,
  authStatus,
  toolSlug,
}: StatusCalculatorProps): StatusCalculatorResult {
  // Rate limit calculation
  const getRateLimitDisplay = (
    status: RateLimitStatus | undefined,
  ): string | null => {
    if (!status || status.status === "unknown") return null;

    const allUsages: number[] = [];
    Object.values(status.limits).forEach((platformLimits) => {
      if (platformLimits) {
        Object.values(platformLimits).forEach((usage) => {
          const rateLimitUsage = usage as {
            usagePercent: number | null;
          };
          if (rateLimitUsage && rateLimitUsage.usagePercent !== null) {
            allUsages.push(rateLimitUsage.usagePercent);
          }
        });
      }
    });

    return allUsages.length > 0 ? `${Math.max(...allUsages).toFixed(2)}%` : "?";
  };

  const rateLimitDisplay = getRateLimitDisplay(rateLimitStatus);
  const effectiveStatus = rateLimitStatus?.status || "unknown";

  return {
    statusColor: getStatusColor(status),
    statusIcon: getStatusIcon(status),
    authColor: getAuthColor(toolSlug, authStatus),
    authIcon: getAuthIcon(toolSlug, authStatus),
    rateLimitDisplay,
    effectiveStatus,
  };
}
