// Core utilities
export { cn } from "./utils";

// API and HTTP clients
export { createHttpClient } from "./connection-pool";
export { makeRetryRequest, makeRetryRequestLegacy } from "./api-client";
export { ipv4Fetch } from "./ipv4-fetch";

// OAuth and authentication
export {
  getOAuthConfig,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  isOAuthConfigured,
  getConfiguredProviders,
  getRequiredScopes,
} from "./oauth-config";
export {
  createOAuthError,
  parseOAuthProviderError,
  getErrorDisplayProps,
} from "./oauth-errors";
export {
  getOAuthStateCookieOptions,
  createOAuthStateCookie,
  getOAuthStatePayload,
  validateOAuthState,
} from "./oauth-state-cookies";
export {
  OAuthTokenRefresh,
  getValidTokens,
  performBackgroundTokenRefresh,
} from "./oauth-token-refresh";
export { SecureTokenStorage } from "./oauth-token-store";

// Rate limiting
export { checkAuthRateLimit } from "./rate-limit-auth";
export {
  calculateLimitUsage,
  getRateLimitStatus,
  transformGitHubLimits,
} from "./rate-limit-monitor";
export {
  getServerRateLimitStatus,
  loadPersistedRateLimits,
  saveRateLimitStatus,
} from "./rate-limit-service";
export {
  getDynamicInterval,
  detectBusinessHours,
  getActivePlatforms,
  getMaxUsageForPlatform,
  detectJiraInstanceSize,
  getGitHubWeightedUsage,
  getActivityAccelerationFactor,
  clampInterval,
  formatInterval,
} from "./rate-limit-utils";

// Time utilities
export { getTimeAgo, formatTimeUntilReset } from "./time-utils";

// Configuration management
export { toolConfigManager } from "./tool-config-manager";
export {
  loadToolConfigurations,
  saveToolConfiguration,
  getToolConfiguration,
  deleteToolConfiguration,
  toggleToolState,
  updateToolRefreshInterval,
  getAllToolConfigurations,
} from "./tool-config-manager";

// Logging
export { default as logger } from "./logger";

// Subdirectory exports
// Alerting system
export * from "./alerting/alert-service";

// API infrastructure
export * from "./api/batching";
export * from "./api/compression";
export * from "./api/middleware";

// Job system
export * from "./jobs";

// Monitoring and performance
export * from "./monitoring/performance-dashboard";
export * from "./monitoring/performance-middleware";

// Database and cache
export * from "./cache";
export * from "./database";
export * from "./sessions";

// Rate limiting
export * from "./rate-limit";

// OAuth
export * from "./oauth";
