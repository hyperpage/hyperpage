"use client";

import { Button } from "@/components/ui/button";

interface ErrorBoundaryFallbackProps {
  error: Error;
  retry: () => void;
  retryCount: number;
  maxRetries: number;
}

export function DefaultErrorFallback({
  error,
  retry,
  retryCount,
  maxRetries,
}: ErrorBoundaryFallbackProps) {
  const errorMessage = error?.message || "An unexpected error occurred";
  const isAuthError = errorMessage.toLowerCase().includes("authentication");
  const canRetry = retryCount < maxRetries;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="text-red-600 dark:text-red-400 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
            {isAuthError ? "Authentication Required" : "Something went wrong"}
          </h2>
          <p className="text-red-600 dark:text-red-300 text-sm mb-4">
            {isAuthError
              ? "Please authenticate to access the portal data."
              : errorMessage}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {canRetry && (
              <Button onClick={retry} variant="outline" className="text-sm">
                Try Again ({maxRetries - retryCount} attempts left)
              </Button>
            )}
            <Button
              onClick={() => window.location.reload()}
              variant="destructive"
              className="text-sm"
            >
              Refresh Page
            </Button>
          </div>
          {retryCount > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Attempt {retryCount} of {maxRetries}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
