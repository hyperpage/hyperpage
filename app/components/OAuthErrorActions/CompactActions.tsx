"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { OAuthError } from "@/lib/oauth-errors";

interface CompactActionsProps {
  error: OAuthError;
  onRetry?: () => void;
  onDismiss?: () => void;
  showRetry?: boolean;
}

export function CompactActions({
  error,
  onRetry,
  onDismiss,
  showRetry,
}: CompactActionsProps) {
  return (
    <div className="flex items-center space-x-2">
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
