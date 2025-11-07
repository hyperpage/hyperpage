import { useMemo } from "react";
import { OAuthError, OAuthErrorType } from "@/lib/oauth-errors";

export interface ErrorDetails {
  title: string;
  description: string;
  action: string;
  severity: "error" | "warning" | "info";
  retryable: boolean;
}

export function useErrorDetails(error: OAuthError | null): ErrorDetails | null {
  return useMemo(() => {
    if (!error) return null;

    let severity: "error" | "warning" | "info" = "error";

    // Adjust severity based on error type
    if (
      error.type === "CONFIGURATION_ERROR" ||
      error.type === "PERMISSION_DENIED" ||
      error.type === "AUTHENTICATION_FAILED"
    ) {
      severity = "warning";
    } else if (
      error.type === "RATE_LIMITED" ||
      error.type === "SERVICE_UNAVAILABLE"
    ) {
      severity = "info";
    }

    const getErrorTitle = (errorType: OAuthErrorType): string => {
      const titles = {
        [OAuthErrorType.CONFIGURATION_ERROR]: "Configuration Error",
        [OAuthErrorType.NETWORK_ERROR]: "Connection Error",
        [OAuthErrorType.AUTHENTICATION_FAILED]: "Authentication Failed",
        [OAuthErrorType.TOKEN_EXCHANGE_FAILED]: "Token Exchange Failed",
        [OAuthErrorType.TOKEN_REFRESH_FAILED]: "Connection Renewal Failed",
        [OAuthErrorType.PERMISSION_DENIED]: "Permission Denied",
        [OAuthErrorType.STATE_MISMATCH]: "Session Expired",
        [OAuthErrorType.INVALID_REQUEST]: "Invalid Request",
        [OAuthErrorType.RATE_LIMITED]: "Rate Limited",
        [OAuthErrorType.SERVICE_UNAVAILABLE]: "Service Unavailable",
        [OAuthErrorType.UNKNOWN_ERROR]: "Authentication Error",
      };
      return titles[errorType] || "Authentication Error";
    };

    return {
      title: getErrorTitle(error.type),
      description: error.userMessage,
      action:
        error.suggestedAction || "Contact support if the problem persists.",
      severity,
      retryable: error.retryable,
    };
  }, [error]);
}
