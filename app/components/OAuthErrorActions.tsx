"use client";

import React from "react";
import { OAuthError } from "@/lib/oauth-errors";
import { CompactActions } from "./OAuthErrorActions/CompactActions";
import { FullActions } from "./OAuthErrorActions/FullActions";

interface OAuthErrorActionsProps {
  error: OAuthError;
  onRetry?: () => void;
  onDismiss?: () => void;
  showRetry?: boolean;
  compact?: boolean;
}

export default function OAuthErrorActions({
  error,
  onRetry,
  onDismiss,
  showRetry = true,
  compact = false,
}: OAuthErrorActionsProps) {
  if (compact) {
    return (
      <CompactActions
        error={error}
        onRetry={onRetry}
        onDismiss={onDismiss}
        showRetry={showRetry}
      />
    );
  }

  return (
    <FullActions
      error={error}
      onRetry={onRetry}
      onDismiss={onDismiss}
      showRetry={showRetry}
    />
  );
}
