import { ErrorInfo } from "react";
import logger from "@/lib/logger";

export function logErrorToService(error: Error, errorInfo: ErrorInfo) {
  logger.error("ErrorBoundary caught an error:", {
    error: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
  });
}

export function canRetry(retryCount: number, maxRetries: number): boolean {
  return retryCount < maxRetries;
}
