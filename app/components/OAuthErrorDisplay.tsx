"use client";

import { AlertTriangle, Info, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { OAuthError, OAuthErrorType } from "../../lib/oauth-errors";

interface OAuthErrorDisplayProps {
  error: OAuthError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  showRetry?: boolean;
  compact?: boolean;
}

export default function OAuthErrorDisplay({
  error,
  onRetry,
  onDismiss,
  showRetry = true,
  compact = false,
}: OAuthErrorDisplayProps) {
  if (!error) return null;

  const getSeverityIcon = (severity: "error" | "warning" | "info") => {
    switch (severity) {
      case "error":
        return <AlertCircle className="h-4 w-4" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4" />;
      case "info":
        return <Info className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getSeverityVariant = (severity: "error" | "warning" | "info") => {
    switch (severity) {
      case "error":
        return "destructive";
      case "warning":
        return "default";
      case "info":
        return "default";
      default:
        return "destructive";
    }
  };

  const getErrorDetails = (error: OAuthError) => {
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

    const getErrorTitle = (errorType: string) => {
      const titles = {
        CONFIGURATION_ERROR: "Configuration Error",
        NETWORK_ERROR: "Connection Error",
        AUTHENTICATION_FAILED: "Authentication Failed",
        TOKEN_EXCHANGE_FAILED: "Token Exchange Failed",
        TOKEN_REFRESH_FAILED: "Connection Renewal Failed",
        PERMISSION_DENIED: "Permission Denied",
        STATE_MISMATCH: "Session Expired",
        INVALID_REQUEST: "Invalid Request",
        RATE_LIMITED: "Rate Limited",
        SERVICE_UNAVAILABLE: "Service Unavailable",
        UNKNOWN_ERROR: "Authentication Error",
      };
      return titles[errorType as keyof typeof titles] || "Authentication Error";
    };

    return {
      title: getErrorTitle(error.type),
      description: error.userMessage,
      action:
        error.suggestedAction || "Contact support if the problem persists.",
      severity,
    };
  };

  const { title, description, action, severity } = getErrorDetails(error);

  if (compact) {
    return (
      <div
        className={`flex items-center space-x-2 p-2 rounded-md border ${
          severity === "error"
            ? "bg-destructive/10 border-destructive/20"
            : severity === "warning"
              ? "bg-yellow-500/10 border-yellow-500/20"
              : "bg-blue-500/10 border-blue-500/20"
        }`}
      >
        {getSeverityIcon(severity)}
        <div className="flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs opacity-90">{description}</p>
        </div>
        {showRetry && error.retryable && onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="h-auto p-1 text-xs"
          >
            Retry
          </Button>
        )}
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-auto p-1"
          >
            ×
          </Button>
        )}
      </div>
    );
  }

  return (
    <Alert variant={getSeverityVariant(severity)} className="mb-4">
      <div className="flex items-start space-x-2">
        {getSeverityIcon(severity)}
        <div className="flex-1">
          <AlertTitle className="flex items-center justify-between">
            <span>{title}</span>
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-auto p-1 ml-2"
              >
                ×
              </Button>
            )}
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-2">{description}</p>
            <p className="text-sm opacity-80">{action}</p>

            {error.toolName && (
              <div className="mt-3 pt-2 border-t border-border/50">
                <p className="text-xs opacity-70">
                  Tool: <span className="font-medium">{error.toolName}</span>
                  {error.provider && (
                    <>
                      {" "}
                      • Provider:{" "}
                      <span className="font-medium">{error.provider}</span>
                    </>
                  )}
                </p>
              </div>
            )}

            <div className="mt-3 flex space-x-2">
              {showRetry && error.retryable && onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="text-xs"
                >
                  Try Again
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Copy error details to clipboard for debugging
                  const errorDetails = {
                    type: error.type,
                    tool: error.toolName,
                    provider: error.provider,
                    message: error.message,
                    details: error.technicalDetails,
                    timestamp: new Date().toISOString(),
                  };

                  navigator.clipboard
                    .writeText(JSON.stringify(errorDetails, null, 2))
                    .then(() => {
                      // Could show a toast notification here
                      
                    })
                    .catch(() => {
                      
                    });
                }}
                className="text-xs"
              >
                Copy Debug Info
              </Button>
            </div>
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}

export function OAuthConnectionError({
  toolName,
  onRetry,
}: {
  toolName: string;
  onRetry?: () => void;
}) {
  return (
    <OAuthErrorDisplay
      error={{
        type: OAuthErrorType.NETWORK_ERROR,
        message: `Connection failed for ${toolName}`,
        userMessage: `Unable to connect to ${toolName}. Please check your configuration and try again.`,
        suggestedAction:
          "Verify your OAuth settings are correct and the service is available.",
        retryable: true,
        toolName,
        provider: toolName.toLowerCase(),
      }}
      onRetry={onRetry}
      compact
    />
  );
}

export function OAuthConfigError({
  toolName,
  provider,
}: {
  toolName: string;
  provider: string;
}) {
  return (
    <OAuthErrorDisplay
      error={{
        type: OAuthErrorType.CONFIGURATION_ERROR,
        message: `${toolName} OAuth not configured`,
        userMessage: `${toolName} authentication is not configured. Please add your ${provider} OAuth credentials to complete setup.`,
        suggestedAction: `Configure ${provider.toUpperCase()}_OAUTH_CLIENT_ID and ${provider.toUpperCase()}_OAUTH_CLIENT_SECRET in your environment variables.`,
        retryable: false,
        toolName,
        provider,
      }}
      showRetry={false}
      compact
    />
  );
}

export function OAuthPermissionError({
  toolName,
  provider,
}: {
  toolName: string;
  provider: string;
}) {
  return (
    <OAuthErrorDisplay
      error={{
        type: OAuthErrorType.PERMISSION_DENIED,
        message: `Insufficient permissions for ${toolName}`,
        userMessage: `You don't have the required permissions to access ${toolName}.`,
        suggestedAction: `Request additional permissions from your ${provider} administrator.`,
        retryable: false,
        toolName,
        provider,
      }}
      showRetry={false}
      compact
    />
  );
}
