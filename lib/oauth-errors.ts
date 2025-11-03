/**
 * OAuth Authentication Error Handling
 * Comprehensive error management for OAuth flows with user-friendly messaging
 */

export enum OAuthErrorType {
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
  TOKEN_EXCHANGE_FAILED = "TOKEN_EXCHANGE_FAILED",
  TOKEN_REFRESH_FAILED = "TOKEN_REFRESH_FAILED",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  STATE_MISMATCH = "STATE_MISMATCH",
  INVALID_REQUEST = "INVALID_REQUEST",
  RATE_LIMITED = "RATE_LIMITED",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export interface OAuthError {
  type: OAuthErrorType;
  message: string;
  userMessage: string;
  technicalDetails?: string;
  suggestedAction?: string;
  retryable: boolean;
  toolName: string;
  provider: string;
}

// Error message mappings for user-friendly display
const ERROR_MESSAGES = {
  [OAuthErrorType.CONFIGURATION_ERROR]: {
    userMessage:
      "Authentication is not configured for this tool. Please check your settings.",
    suggestedAction:
      "Ensure OAuth credentials are properly configured in environment variables.",
  },
  [OAuthErrorType.NETWORK_ERROR]: {
    userMessage:
      "Unable to connect to the authentication service. Please check your internet connection.",
    suggestedAction:
      "Try again in a few moments or check your network connection.",
  },
  [OAuthErrorType.AUTHENTICATION_FAILED]: {
    userMessage: "Authentication was denied. Please try again.",
    suggestedAction:
      "Make sure you have the necessary permissions for this tool.",
  },
  [OAuthErrorType.TOKEN_EXCHANGE_FAILED]: {
    userMessage:
      "Failed to complete authentication. The authorization may have expired.",
    suggestedAction: "Please try connecting again.",
  },
  [OAuthErrorType.TOKEN_REFRESH_FAILED]: {
    userMessage:
      "Your connection has expired and could not be renewed automatically.",
    suggestedAction: "Please reconnect to this tool.",
  },
  [OAuthErrorType.PERMISSION_DENIED]: {
    userMessage: "You don't have the required permissions for this tool.",
    suggestedAction: "Request additional permissions from your administrator.",
  },
  [OAuthErrorType.STATE_MISMATCH]: {
    userMessage: "Authentication session has expired. Please try again.",
    suggestedAction: "Restart the authentication process.",
  },
  [OAuthErrorType.INVALID_REQUEST]: {
    userMessage: "There was an issue with the authentication request.",
    suggestedAction:
      "Please try connecting again. If the problem persists, contact support.",
  },
  [OAuthErrorType.RATE_LIMITED]: {
    userMessage:
      "Too many authentication attempts. Please wait before trying again.",
    suggestedAction: "Wait a few minutes before attempting to connect again.",
  },
  [OAuthErrorType.SERVICE_UNAVAILABLE]: {
    userMessage: "The authentication service is temporarily unavailable.",
    suggestedAction: "Try again later or check the service status.",
  },
  [OAuthErrorType.UNKNOWN_ERROR]: {
    userMessage: "An unexpected error occurred during authentication.",
    suggestedAction:
      "Please try again. If the problem continues, contact support.",
  },
};

/**
 * Create an OAuth error object with appropriate messaging
 */
export function createOAuthError(
  type: OAuthErrorType,
  toolName: string,
  provider: string,
  technicalDetails?: string,
  originalError?: Error | unknown,
): OAuthError {
  const messages = ERROR_MESSAGES[type];

  return {
    type,
    message: `OAuth ${type} for ${toolName} (${provider})`,
    userMessage: messages.userMessage,
    technicalDetails:
      technicalDetails ||
      (originalError instanceof Error ? originalError.message : undefined),
    suggestedAction: messages.suggestedAction,
    retryable: isRetryableError(type),
    toolName,
    provider,
  };
}

export function parseOAuthProviderError(
  toolName: string,
  provider: string,
  response: unknown,
  statusCode?: number,
): OAuthError {
  // Handle different provider error formats
  if (provider === "github") {
    return parseGitHubError(toolName, response, statusCode);
  } else if (provider === "gitlab") {
    return parseGitLabError(toolName, response, statusCode);
  } else if (provider === "jira") {
    return parseJiraError(toolName, response, statusCode);
  }

  // Generic error parsing
  return createOAuthError(
    determineErrorType(statusCode),
    toolName,
    provider,
    JSON.stringify(response),
  );
}

/**
 * Parse GitHub OAuth error responses
 */
function parseGitHubError(
  toolName: string,
  response: unknown,
  statusCode?: number,
): OAuthError {
  const responseObj = response as {
    error?: string;
    error_description?: string;
  };
  const error = responseObj.error;
  const errorDescription = responseObj.error_description;

  switch (error) {
    case "access_denied":
      return createOAuthError(
        OAuthErrorType.AUTHENTICATION_FAILED,
        toolName,
        "github",
        errorDescription || "User denied access",
      );

    case "redirect_uri_mismatch":
    case "invalid_request":
      return createOAuthError(
        OAuthErrorType.INVALID_REQUEST,
        toolName,
        "github",
        errorDescription || error || "",
      );

    default:
      const errorType = determineErrorType(statusCode);
      return createOAuthError(
        errorType,
        toolName,
        "github",
        errorDescription || error || "GitHub OAuth error",
      );
  }
}

/**
 * Parse GitLab OAuth error responses
 */
function parseGitLabError(
  toolName: string,
  response: unknown,
  statusCode?: number,
): OAuthError {
  const responseObj = response as {
    error?: string;
    error_description?: string;
  };
  const error = responseObj.error;
  const errorDescription = responseObj.error_description;

  switch (error) {
    case "access_denied":
      return createOAuthError(
        OAuthErrorType.AUTHENTICATION_FAILED,
        toolName,
        "gitlab",
        errorDescription || "User denied access",
      );

    case "invalid_request":
    case "unauthorized_client":
    case "unsupported_grant_type":
      return createOAuthError(
        OAuthErrorType.INVALID_REQUEST,
        toolName,
        "gitlab",
        errorDescription || error || "",
      );

    default:
      const errorType = determineErrorType(statusCode);
      return createOAuthError(
        errorType,
        toolName,
        "gitlab",
        errorDescription || error || "GitLab OAuth error",
      );
  }
}

/**
 * Parse Jira OAuth error responses
 */
function parseJiraError(
  toolName: string,
  response: unknown,
  statusCode?: number,
): OAuthError {
  const responseObj = response as {
    error?: string;
    error_description?: string;
  };
  const error = responseObj.error;

  switch (error) {
    case "access_denied":
      return createOAuthError(
        OAuthErrorType.AUTHENTICATION_FAILED,
        toolName,
        "jira",
        responseObj.error_description || "User denied access",
      );

    case "invalid_request":
    case "unauthorized_client":
    case "invalid_client":
      return createOAuthError(
        OAuthErrorType.INVALID_REQUEST,
        toolName,
        "jira",
        responseObj.error_description || error || "",
      );

    default:
      const errorType = determineErrorType(statusCode);
      return createOAuthError(
        errorType,
        toolName,
        "jira",
        responseObj.error_description || error || "Jira OAuth error",
      );
  }
}

/**
 * Determine error type from HTTP status code
 */
function determineErrorType(statusCode?: number): OAuthErrorType {
  if (!statusCode) return OAuthErrorType.UNKNOWN_ERROR;

  switch (statusCode) {
    case 400:
      return OAuthErrorType.INVALID_REQUEST;
    case 401:
      return OAuthErrorType.AUTHENTICATION_FAILED;
    case 403:
      return OAuthErrorType.PERMISSION_DENIED;
    case 404:
      return OAuthErrorType.INVALID_REQUEST;
    case 429:
      return OAuthErrorType.RATE_LIMITED;
    case 500:
    case 501:
    case 502:
    case 503:
    case 504:
      return OAuthErrorType.SERVICE_UNAVAILABLE;
    default:
      return OAuthErrorType.UNKNOWN_ERROR;
  }
}

/**
 * Check if an error type is retryable
 */
function isRetryableError(type: OAuthErrorType): boolean {
  const retryableErrors = [
    OAuthErrorType.NETWORK_ERROR,
    OAuthErrorType.TOKEN_REFRESH_FAILED,
    OAuthErrorType.RATE_LIMITED,
    OAuthErrorType.SERVICE_UNAVAILABLE,
  ];

  return retryableErrors.includes(type);
}

/**
 * Log OAuth errors with appropriate level
 */
export function logOAuthError(error: OAuthError, context?: string): void {
  const logData = {
    type: error.type,
    toolName: error.toolName,
    provider: error.provider,
    retryable: error.retryable,
    technicalDetails: error.technicalDetails,
    context,
  };

  // Use different log levels based on error type
  if (
    error.type === OAuthErrorType.CONFIGURATION_ERROR ||
    error.type === OAuthErrorType.PERMISSION_DENIED ||
    error.type === OAuthErrorType.AUTHENTICATION_FAILED
  ) {
    console.warn("OAuth Warning:", error.message, logData);
  } else {
    console.error("OAuth Error:", error.message, logData);
  }
}

/**
 * Create a user-friendly error display component props
 */
export function getErrorDisplayProps(error: OAuthError): {
  title: string;
  description: string;
  action: string;
  severity: "error" | "warning" | "info";
} {
  let severity: "error" | "warning" | "info" = "error";

  // Adjust severity based on error type
  if (
    error.type === OAuthErrorType.CONFIGURATION_ERROR ||
    error.type === OAuthErrorType.PERMISSION_DENIED
  ) {
    severity = "warning";
  } else if (
    error.type === OAuthErrorType.RATE_LIMITED ||
    error.type === OAuthErrorType.SERVICE_UNAVAILABLE
  ) {
    severity = "info";
  }

  return {
    title: getErrorTitle(error.type),
    description: error.userMessage,
    action: error.suggestedAction || "Contact support if the problem persists.",
    severity,
  };
}

/**
 * Get human-readable error title
 */
function getErrorTitle(errorType: OAuthErrorType): string {
  const titles = {
    [OAuthErrorType.CONFIGURATION_ERROR]: "Configuration Error",
    [OAuthErrorType.NETWORK_ERROR]: "Connection Error",
    [OAuthErrorType.AUTHENTICATION_FAILED]: "Authentication Failed",
    [OAuthErrorType.TOKEN_EXCHANGE_FAILED]: "Token Exchange Failed",
    [OAuthErrorType.TOKEN_REFRESH_FAILED]: "Connection Renewal Failed",
    [OAuthErrorType.PERMISSION_DENIED]: "Permission Denied",
    [OAuthErrorType.STATE_MISMATCH]: "Session Expired",
    [OAuthErrorType.INVALID_REQUEST]: "Invalid Request",
    [OAuthErrorType.RATE_LIMITED]: "Rate Limited",
    [OAuthErrorType.SERVICE_UNAVAILABLE]: "Service Unavailable",
    [OAuthErrorType.UNKNOWN_ERROR]: "Authentication Error",
  };

  return titles[errorType] || "Authentication Error";
}
