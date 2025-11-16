"use client";

import { OAuthError } from "@/lib/oauth-errors";
import { useErrorDetails } from "@/app/components/hooks/useErrorDetails";
import {
  OAuthErrorAlert,
  OAuthErrorCompact,
} from "@/app/components/OAuthErrorLayouts";

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
