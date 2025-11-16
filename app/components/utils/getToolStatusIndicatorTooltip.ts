import { ToolStatusTooltip } from "@/app/components/ToolStatusTooltip";
import { RateLimitStatus } from "@/lib/types/rate-limit";

interface ToolStatusIndicatorTooltipArgs {
  toolName: string;
  status: string;
  authStatus: { connected: boolean } | undefined;
  rateLimitStatus: RateLimitStatus | undefined;
  dataIssue?: { message: string; timestamp: number } | null;
}

export function getToolStatusIndicatorTooltip({
  toolName,
  status,
  authStatus,
  rateLimitStatus,
  dataIssue = null,
}: ToolStatusIndicatorTooltipArgs) {
  const baseTooltip = ToolStatusTooltip({
    toolName,
    status,
    authStatus,
    rateLimitStatus,
  });

  if (!dataIssue) {
    return baseTooltip;
  }

  return `${baseTooltip}\nData issue: ${dataIssue.message} (since ${new Date(dataIssue.timestamp).toLocaleTimeString()})\nClick to view widget telemetry.`;
}

