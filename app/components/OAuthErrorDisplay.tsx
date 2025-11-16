"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { OAuthError } from "@/lib/oauth-errors";
import { useErrorDetails } from "@/app/components/hooks/useErrorDetails";
import OAuthErrorActions from "@/app/components/OAuthErrorActions";
import { getSeverityIcon, getSeverityVariant } from "@/lib/oauth-error-utils";

interface ErrorLayoutProps {
  error: OAuthError;
  errorDetails: NonNullable<ReturnType<typeof useErrorDetails>>;
  onRetry?: () => void;
  onDismiss?: () => void;
  showRetry: boolean;
}

function OAuthErrorCompact({
  error,
  errorDetails,
  onRetry,
  onDismiss,
  showRetry,
}: ErrorLayoutProps) {
  const severityClass =
    errorDetails.severity === "error"
      ? "bg-destructive/10 border-destructive/20"
      : errorDetails.severity === "warning"
        ? "bg-yellow-500/10 border-yellow-500/20"
        : "bg-blue-500/10 border-blue-500/20";

  return (
    <div
      className={`flex items-center space-x-2 p-2 rounded-md border ${severityClass}`}
    >
      {getSeverityIcon(errorDetails.severity)}
      <div className="flex-1">
        <p className="text-sm font-medium">{errorDetails.title}</p>
        <p className="text-xs opacity-90">{errorDetails.description}</p>
      </div>
      <OAuthErrorActions
        error={error}
        onRetry={onRetry}
        onDismiss={onDismiss}
        showRetry={showRetry}
        compact
      />
    </div>
  );
}

function OAuthErrorAlert({
  error,
  errorDetails,
  onRetry,
  onDismiss,
  showRetry,
}: ErrorLayoutProps) {
  return (
    <Alert variant={getSeverityVariant(errorDetails.severity)} className="mb-4">
      <div className="flex items-start space-x-2">
        {getSeverityIcon(errorDetails.severity)}
        <div className="flex-1">
          <AlertTitle className="flex items-center justify-between">
            <span>{errorDetails.title}</span>
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-2">{errorDetails.description}</p>
            <p className="text-sm opacity-80">{errorDetails.action}</p>

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

            <OAuthErrorActions
              error={error}
              onRetry={onRetry}
              onDismiss={onDismiss}
              showRetry={showRetry}
            />
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}

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
  const errorDetails = useErrorDetails(error);

  if (!error || !errorDetails) return null;

  return compact ? (
    <OAuthErrorCompact
      error={error}
      errorDetails={errorDetails}
      onRetry={onRetry}
      onDismiss={onDismiss}
      showRetry={showRetry}
    />
  ) : (
    <OAuthErrorAlert
      error={error}
      errorDetails={errorDetails}
      onRetry={onRetry}
      onDismiss={onDismiss}
      showRetry={showRetry}
    />
  );
}
