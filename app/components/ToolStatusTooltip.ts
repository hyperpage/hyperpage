import { RateLimitStatus, RateLimitUsage } from "@/lib/types/rate-limit";
import { formatTimeUntilReset } from "@/lib/time-utils";

interface ToolStatusTooltipProps {
  toolName: string;
  status: string;
  authStatus: { connected: boolean } | undefined;
  rateLimitStatus: RateLimitStatus | undefined;
}

export function ToolStatusTooltip({
  toolName,
  status,
  authStatus,
  rateLimitStatus,
}: ToolStatusTooltipProps) {
  const generateTooltipText = (): string => {
    let tooltip = `${toolName} - ${status}`;
    tooltip += `\nAuthentication: ${authStatus?.connected ? "Connected" : "Not connected"}`;

    if (!rateLimitStatus || rateLimitStatus.status === "unknown") {
      return tooltip;
    }

    tooltip += `\nRate Limit: ${rateLimitStatus.status.charAt(0).toUpperCase() + rateLimitStatus.status.slice(1)}`;

    // Get the maximum usage percentage across all limits
    const allUsages = Object.values(rateLimitStatus.limits)
      .flatMap((platformLimits) => Object.values(platformLimits || {}))
      .map((usage) => (usage as RateLimitUsage).usagePercent)
      .filter((percent) => percent !== null) as number[];

    const maxUsage = allUsages.length > 0 ? Math.max(...allUsages) : null;
    if (maxUsage !== null) {
      tooltip += ` (${maxUsage}% used)`;
    }

    // Add platform-specific details
    const limits = rateLimitStatus.limits;
    const addApiDetails = (
      apiName: string,
      usage: RateLimitUsage | undefined,
    ) => {
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
    if (toolName.toLowerCase() === "github" && limits.github) {
      addApiDetails("Core API", limits.github.core);
      addApiDetails("Search API", limits.github.search);
      addApiDetails("GraphQL API", limits.github.graphql);
    }

    // GitLab global limits
    if (toolName.toLowerCase() === "gitlab" && limits.gitlab?.global) {
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
    if (toolName.toLowerCase() === "jira" && limits.jira?.global) {
      tooltip += `\nInstance Limits: Active`;
    }

    return tooltip;
  };

  return generateTooltipText();
}
