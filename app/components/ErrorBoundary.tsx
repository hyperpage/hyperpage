"use client";

import { Component, ReactNode, ErrorInfo } from "react";
import { DefaultErrorFallback } from "@/app/components/DefaultErrorFallback";
import { logErrorToService, canRetry } from "@/lib/error-boundary-utils";

interface ErrorBoundaryFallbackProps {
  error: Error;
  retry: () => void;
  retryCount: number;
  maxRetries: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<ErrorBoundaryFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    logErrorToService(error, errorInfo);
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (canRetry(retryCount, maxRetries)) {
      this.setState((prev) => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prev.retryCount + 1,
      }));
    }
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;

      return (
        <FallbackComponent
          error={this.state.error!}
          retry={this.handleRetry}
          retryCount={this.state.retryCount}
          maxRetries={this.props.maxRetries || 3}
        />
      );
    }

    return this.props.children;
  }
}
