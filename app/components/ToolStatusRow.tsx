"use client";

import { useState, useEffect } from "react";
import { getToolIcon } from "../../tools";
import { ToolIntegration } from "../../tools/tool-types";
import logger from "../../lib/logger";

import { Wifi, WifiOff, Zap, UserCheck, UserX } from "lucide-react";
import {
  useMultipleRateLimits,
  getRateLimitStatusColor,
  getRateLimitStatusBgColor,
  formatTimeUntilReset,
} from "./hooks/useRateLimit";
import { RateLimitStatus } from "../../lib/types/rate-limit";
import { useAuthStatus } from "./hooks/useAuthStatus";

interface ToolHealthInfo extends ToolIntegration {
  slug: string;
}

export default function ToolStatusRow() {
  const [toolIntegrations, setToolIntegrations] = useState<ToolHealthInfo[]>(
    [],
  );
  const [enabledPlatformSlugs, setEnabledPlatformSlugs] = useState<string[]>(
    [],
  );

  // Use the shared auth status hook to prevent duplicate requests
  const { authStatus } = useAuthStatus();

  // Get rate limit status for all enabled tools that support rate limiting - only when we have slugs
  const { statuses: rateLimitStatuses } = useMultipleRateLimits(
    enabledPlatformSlugs.length > 0 ? enabledPlatformSlugs : ["dummy"], // Use dummy to avoid empty array issues
  );

  // Load tool integrations on component mount
  useEffect(() => {
    async function loadIntegrations() {
      try {
        // Load enabled tools with basic status
        const response = await fetch("/api/tools/enabled");
        if (response.ok) {
          const data = await response.json();
          const basicIntegrations: ToolHealthInfo[] = data.enabledTools.map(
            (tool: { name: string; slug: string }) => ({
              name: tool.name,
              slug: tool.slug,
              enabled: true,
              icon: getToolIcon(tool.name),
              status: "connected" as const,
            }),
          );

          // Collect platform slugs that support rate limiting for monitoring
          const rateLimitEnabledSlugs = data.enabledTools
            .filter((tool: unknown) =>
              (tool as { capabilities?: string[] }).capabilities?.includes(
                "rate-limit",
              ),
            )
            .map((tool: unknown) => (tool as { slug: string }).slug);

          // Set platform slugs first to trigger rate limit loading
          setEnabledPlatformSlugs(rateLimitEnabledSlugs);

          // Set basic integrations (no need for detailed health info)
          setToolIntegrations(basicIntegrations);
        }
      } catch (error) {
        logger.error("Failed to load tool integrations", {
          error,
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    }

    loadIntegrations();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-500"; // Changed to green for better UX
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

  /**
   * Generate detailed tooltip text with authentication and rate limit information
   */
  const generateTooltipText = (
    tool: ToolHealthInfo,
    rateLimitStatus: RateLimitStatus | undefined,
  ): string => {
    const authTool = authStatus.authenticatedTools[tool.slug];
    let tooltip = `${tool.name} - ${tool.status}`;
    tooltip += `\nAuthentication: ${authTool?.connected ? "Connected" : "Not connected"}`;

    if (!rateLimitStatus || rateLimitStatus.status === "unknown") {
      return tooltip;
    }

    tooltip += `\nRate Limit: ${rateLimitStatus.status.charAt(0).toUpperCase() + rateLimitStatus.status.slice(1)}`;

    // Get the maximum usage percentage across all limits
    const allUsages = Object.values(rateLimitStatus.limits)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .flatMap((platformLimits: any) => Object.values(platformLimits || {}))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((usage: any) => usage.usagePercent)
      .filter((percent: number | null) => percent !== null) as number[];

    const maxUsage = allUsages.length > 0 ? Math.max(...allUsages) : null;
    if (maxUsage !== null) {
      tooltip += ` (${maxUsage}% used)`;
    }

    // Add platform-specific details
    const limits = rateLimitStatus.limits;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addApiDetails = (apiName: string, usage: any) => {
      if (!usage || usage.usagePercent === null) return;

      let details = `\n${apiName}: ${usage.usagePercent}% used`;
      if (usage.remaining !== null) {
        details += ` (${usage.remaining} remaining)`;
      }
      if (usage.resetTime) {
        details += `, resets in ${formatTimeUntilReset(usage.resetTime)}`;
      }
      tooltip += details;
    };

    // GitHub specific APIs
    if (tool.name.toLowerCase() === "github" && limits.github) {
      addApiDetails("Core API", limits.github.core);
      addApiDetails("Search API", limits.github.search);
      addApiDetails("GraphQL API", limits.github.graphql);
    }

    // GitLab global limits
    if (tool.name.toLowerCase() === "gitlab" && limits.gitlab?.global) {
      const usage = limits.gitlab.global;
      tooltip += `\nGlobal Limit: Active`;
      if (usage.retryAfter) {
        tooltip += ` (retry after ${usage.retryAfter}s)`;
      }
      if (usage.resetTime) {
        tooltip += `\nResets in: ${formatTimeUntilReset(usage.resetTime)}`;
      }
    }

    // Jira global limits
    if (tool.name.toLowerCase() === "jira" && limits.jira?.global) {
      tooltip += `\nInstance Limits: Active`;
    }

    return tooltip;
  };

  if (toolIntegrations.length === 0) {
    return null;
  }

  return (
    <div className="flex justify-center items-center py-6 border-t border-border mt-8">
      <div className="flex flex-col items-center space-y-4">
        <div className="flex items-center space-x-6">
          {toolIntegrations.map((tool, index) => {
            // Find rate limit status for this tool using the proper slug
            const rateLimitStatus = rateLimitStatuses.get(tool.slug);

            return (
              <div
                key={index}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                title={generateTooltipText(tool, rateLimitStatus)}
              >
                <div className="relative">
                  <span className="text-xl">{tool.icon}</span>
                  <div
                    className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${getStatusColor(tool.status)}`}
                    title={tool.status}
                  >
                    {getStatusIcon(tool.status)}
                  </div>

                  {/* Rate limit indicator - show usage percentage if available */}
                  {rateLimitStatus && rateLimitStatus.status !== "unknown" && (
                    <div
                      className={`absolute -bottom-1 -right-1 w-5 h-3 rounded-sm border border-background flex items-center justify-center text-[8px] font-bold ${getRateLimitStatusBgColor(rateLimitStatus.status)} ${getRateLimitStatusColor(rateLimitStatus.status)}`}
                    >
                      {(() => {
                        // Get the highest usage percentage across all limits
                        const allUsages = Object.values(rateLimitStatus.limits)
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          .flatMap((platformLimits: any) =>
                            Object.values(platformLimits || {}),
                          )
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          .map((usage: any) => usage.usagePercent)
                          .filter(
                            (percent: number | null) => percent !== null,
                          ) as number[];

                        return allUsages.length > 0
                          ? `${Math.max(...allUsages).toFixed(2)}%`
                          : "?";
                      })()}
                    </div>
                  )}

                  {/* Rate limit warning notification badge for GitLab */}
                  {rateLimitStatus &&
                    tool.slug === "gitlab" &&
                    rateLimitStatus.status === "critical" && (
                      <div className="absolute -top-2 -left-2">
                        <div className="bg-red-500 text-white text-[8px] px-1 py-0.5 rounded font-bold animate-pulse">
                          LIMITED
                        </div>
                      </div>
                    )}

                  {/* OAuth Authentication indicator - left side */}
                  <div
                    className={`absolute -top-1 -left-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${getAuthColor(tool.slug)}`}
                    title={`${tool.name} - ${authStatus.authenticatedTools[tool.slug]?.connected ? "Authenticated" : "Not authenticated"}`}
                  >
                    {getAuthIcon(tool.slug)}
                  </div>

                  {/* Rate limit warning/critical indicator */}
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
