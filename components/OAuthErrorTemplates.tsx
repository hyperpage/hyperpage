"use client";

import { OAuthErrorType } from "@/lib/oauth-errors";
import OAuthErrorDisplay from "@/app/components/OAuthErrorDisplay";

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
