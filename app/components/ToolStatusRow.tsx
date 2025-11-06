"use client";

import React from "react";
import { ToolStatusTooltip } from "./ToolStatusTooltip";
import { ToolIntegration } from "@/tools/tool-types";
import { RateLimitUsage } from "@/lib/types/rate-limit";
import { useAuthStatus } from "./hooks/useAuthStatus";
import {
  useMultipleRateLimits,
  getRateLimitStatusColor,
  getRateLimitStatusBgColor,
} from "./hooks/useRateLimit";
import { Wifi, WifiOff, Zap, UserCheck, UserX } from "lucide-react";
import logger from "@/lib/logger";

interface ToolHealthInfo extends ToolIntegration {
  slug: string;
}

export default function ToolStatusRow() {
  const [toolIntegrations, setToolIntegrations] = React.useState<
    ToolHealthInfo[]
  >([]);
  const [enabledPlatformSlugs, setEnabledPlatformSlugs] = React.useState<
    string[]
  >([]);

  const { authStatus } = useAuthStatus();
  const { statuses: rateLimitStatuses } = useMultipleRateLimits(
    enabledPlatformSlugs.length > 0 ? enabledPlatformSlugs : ["dummy"],
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-500";
      case "connecting":
        return "bg-yellow-500";
      case "configuration_error":
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <Wifi className="w-3 h-3" />;
      case "connecting":
        return <Wifi className="w-3 h-3" />;
      case "configuration_error":
      case "error":
        return <WifiOff className="w-3 h-3" />;
      default:
        return <WifiOff className="w-3 h-3" />;
    }
  };

  const getAuthIcon = (toolSlug: string) => {
    const authTool = authStatus.authenticatedTools[toolSlug];
    if (authTool && authTool.connected) {
      return <UserCheck className="w-3 h-3 text-green-500" />;
    }
    return <UserX className="w-3 h-3 text-gray-400" />;
  };

  const getAuthColor = (toolSlug: string) => {
    const authTool = authStatus.authenticatedTools[toolSlug];
    if (authTool && authTool.connected) {
      return "bg-green-500";
    }
    return "bg-gray-400";
  };

  React.useEffect(() => {
    async function loadIntegrations() {
      try {
        const response = await fetch("/api/tools/enabled");
        if (response.ok) {
          const data = await response.json();
          const basicIntegrations: ToolHealthInfo[] = data.enabledTools.map(
            (tool: { name: string; slug: string }) => ({
              name: tool.name,
              slug: tool.slug,
              enabled: true,
              icon: tool.name,
              status: "connected" as const,
            }),
          );

          const rateLimitEnabledSlugs = data.enabledTools
            .filter((tool: unknown) =>
              (tool as { capabilities?: string[] }).capabilities?.includes(
                "rate-limit",
              ),
            )
            .map((tool: unknown) => (tool as { slug: string }).slug);

          setEnabledPlatformSlugs(rateLimitEnabledSlugs);
          setToolIntegrations(basicIntegrations);
        }
      } catch (error) {
        logger.error("Failed to load tool integrations", { error });
      }
    }

    loadIntegrations();
  }, []);

  if (toolIntegrations.length === 0) {
    return null;
  }

  return (
    <div className="flex justify-center items-center py-6 border-t border-border mt-8">
      <div className="flex flex-col items-center space-y-4">
        <div className="flex items-center space-x-6">
          {toolIntegrations.map((tool, index) => {
            const rateLimitStatus = rateLimitStatuses.get(tool.slug);

            return (
              <div
                key={index}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                title={ToolStatusTooltip({
                  toolName: tool.name,
                  status: tool.status,
                  authStatus: authStatus.authenticatedTools[tool.slug],
                  rateLimitStatus,
                })}
              >
                <div className="relative">
                  <span className="text-xl">{tool.icon}</span>

                  {/* Status indicator */}
                  <div
                    className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${getStatusColor(tool.status)}`}
                  >
                    {getStatusIcon(tool.status)}
                  </div>

                  {/* Rate limit indicator */}
                  {rateLimitStatus && rateLimitStatus.status !== "unknown" && (
                    <div
                      className={`absolute -bottom-1 -right-1 w-5 h-3 rounded-sm border border-background flex items-center justify-center text-[8px] font-bold ${getRateLimitStatusBgColor(rateLimitStatus.status)} ${getRateLimitStatusColor(rateLimitStatus.status)}`}
                    >
                      {(() => {
                        const allUsages = Object.values(rateLimitStatus.limits)
                          .flatMap((platformLimits) =>
                            Object.values(platformLimits || {}),
                          )
                          .map(
                            (usage) => (usage as RateLimitUsage).usagePercent,
                          )
                          .filter(
                            (percent: number | null) => percent !== null,
                          ) as number[];

                        return allUsages.length > 0
                          ? `${Math.max(...allUsages).toFixed(2)}%`
                          : "?";
                      })()}
                    </div>
                  )}

                  {/* Auth indicator */}
                  <div
                    className={`absolute -top-1 -left-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${getAuthColor(tool.slug)}`}
                  >
                    {getAuthIcon(tool.slug)}
                  </div>

                  {/* Rate limit warning indicator */}
                  {rateLimitStatus &&
                    (rateLimitStatus.status === "warning" ||
                      rateLimitStatus.status === "critical") && (
                      <div className="absolute -top-2 -left-2">
                        <Zap
                          className={`w-3 h-3 ${getRateLimitStatusColor(rateLimitStatus.status)}`}
                        />
                      </div>
                    )}
                </div>

                <span className="text-xs text-center mt-2 text-muted-foreground capitalize">
                  {tool.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
