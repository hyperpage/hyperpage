import React from "react";
import { Wifi, WifiOff, UserCheck, UserX } from "lucide-react";

import { RateLimitStatus, RateLimitUsage } from "@/lib/types/rate-limit";

export function getStatusColor(status: string): string {
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
}

export function getStatusIcon(status: string): React.ReactNode {
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
}

export function getAuthIcon(
  toolSlug: string,
  authStatus: unknown,
): React.ReactNode {
  const authStatusObj = authStatus as {
    authStatus?: {
      authenticatedTools?: {
        [key: string]: {
          connected: boolean;
        };
      };
    };
  };
  const authTool = authStatusObj?.authStatus?.authenticatedTools?.[toolSlug];
  if (authTool && authTool.connected) {
    return <UserCheck className="w-3 h-3 text-green-500" />;
  }
  return <UserX className="w-3 h-3 text-gray-400" />;
}

export function getAuthColor(toolSlug: string, authStatus: unknown): string {
  const authStatusObj = authStatus as {
    authStatus?: {
      authenticatedTools?: {
        [key: string]: {
          connected: boolean;
        };
      };
    };
  };
  const authTool = authStatusObj?.authStatus?.authenticatedTools?.[toolSlug];
  if (authTool && authTool.connected) {
    return "bg-green-500";
  }
  return "bg-gray-400";
}

export function getRateLimitDisplay(
  status: RateLimitStatus | null,
): string | null {
  if (!status || status.status === "unknown") return null;

  const allUsages: number[] = [];
  Object.values(status.limits).forEach(
    (platformLimits: Record<string, RateLimitUsage> | undefined) => {
      if (platformLimits) {
        Object.values(platformLimits).forEach((usage: RateLimitUsage) => {
          if (usage && usage.usagePercent !== null) {
            allUsages.push(usage.usagePercent);
          }
        });
      }
    },
  );

  return allUsages.length > 0 ? `${Math.max(...allUsages).toFixed(2)}%` : "?";
}
