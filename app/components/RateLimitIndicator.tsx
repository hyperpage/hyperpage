"use client";

import React from "react";
import { Zap } from "lucide-react";

import {
  getRateLimitStatusColor,
  getRateLimitStatusBgColor,
} from "@/app/components/hooks/useRateLimit";

export type EffectiveStatus = "normal" | "warning" | "critical" | "unknown";

export interface RateLimitIndicatorProps {
  rateLimitDisplay: string | null;
  effectiveStatus: EffectiveStatus;
  className?: string;
}

export default function RateLimitIndicator({
  rateLimitDisplay,
  effectiveStatus,
  className = "",
}: RateLimitIndicatorProps) {
  if (!rateLimitDisplay) return null;

  return (
    <div className={className}>
      {/* Rate limit percentage indicator */}
      <div
        className={`absolute -bottom-1 -right-1 w-5 h-3 rounded-sm border border-background flex items-center justify-center text-[8px] font-bold ${getRateLimitStatusBgColor(effectiveStatus)} ${getRateLimitStatusColor(effectiveStatus)}`}
      >
        {rateLimitDisplay}
      </div>

      {/* Rate limit warning indicator */}
      {(effectiveStatus === "warning" || effectiveStatus === "critical") && (
        <div className="absolute -top-2 -left-2">
          <Zap
            className={`w-3 h-3 ${getRateLimitStatusColor(effectiveStatus)}`}
          />
        </div>
      )}
    </div>
  );
}
