"use client";

import React from "react";

import { Button } from "@/components/ui/button";
import { OAuthError } from "@/lib/oauth-errors";

interface FullActionsProps {
  error: OAuthError;
  onRetry?: () => void;
  onDismiss?: () => void;
  showRetry?: boolean;
}

export function FullActions({
  error,
  onRetry,
  onDismiss,
  showRetry,
}: FullActionsProps) {
  const handleCopyDebugInfo = React.useCallback(() => {
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
      .catch(() => {
        // Handle clipboard access denied
      });
  }, [error]);

  return (
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
        onClick={handleCopyDebugInfo}
        className="text-xs"
      >
        Copy Debug Info
      </Button>

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
    </div>
  );
}
