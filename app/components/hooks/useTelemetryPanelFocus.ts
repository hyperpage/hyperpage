"use client";

import React, { useCallback, useMemo } from "react";

type TelemetryInteractionProps = Pick<
  React.HTMLAttributes<HTMLDivElement>,
  "role" | "tabIndex" | "onClick" | "onKeyDown"
>;

interface DataIssueMeta {
  message: string;
  timestamp: number;
}

export function useTelemetryPanelFocus(dataIssue?: DataIssueMeta | null) {
  const hasDataIssue = Boolean(dataIssue);

  const scrollToTelemetryPanel = useCallback(() => {
    if (!hasDataIssue) return;
    const target = document.getElementById("widget-telemetry-panel");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.classList.add("ring-2", "ring-amber-400");
      window.setTimeout(() => {
        target.classList.remove("ring-2", "ring-amber-400");
      }, 2000);
    }
  }, [hasDataIssue]);

  const interactionProps: TelemetryInteractionProps | Record<string, never> = useMemo(() => {
    if (!hasDataIssue) {
      return {};
    }

    return {
      role: "button" as const,
      tabIndex: 0,
      onClick: () => {
        scrollToTelemetryPanel();
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          scrollToTelemetryPanel();
        }
      },
    };
  }, [hasDataIssue, scrollToTelemetryPanel]);

  return {
    hasDataIssue,
    interactionProps,
  };
}
