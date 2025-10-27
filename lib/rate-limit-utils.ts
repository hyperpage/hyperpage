// Rate limit utilities for adaptive polling and dynamic interval calculation

import type { RateLimitStatus, PlatformRateLimits, RateLimitUsage } from './types/rate-limit';

/**
 * Calculate dynamic poll interval based on rate limit usage and time-of-day
 * @param usagePercent Current API usage percentage (0-100)
 * @param baseInterval Base interval in milliseconds
 * @param isBusinessHours Whether it's currently business hours (optional, defaults to auto-detection)
 * @returns Adjusted interval in milliseconds
 */
export const getDynamicInterval = (
  usagePercent: number,
  baseInterval: number,
  isBusinessHours?: boolean
): number => {
  // Default to auto-detecting business hours if not provided
  const businessHours = isBusinessHours ?? detectBusinessHours();

  // Start with base multiplier
  let multiplier = 1;

  // Apply rate-based adjustments
  if (usagePercent >= 90) multiplier = 4;
  else if (usagePercent >= 75) multiplier = 2;
  else if (usagePercent >= 50) multiplier = 1.5;

  // Apply business hours adjustment (slow down during peak usage hours)
  if (businessHours) multiplier *= 1.2;

  // Ensure minimum interval of 30 seconds to prevent excessive polling
  const adjustedInterval = Math.round(baseInterval * multiplier);
  return Math.max(adjustedInterval, 30000);
};

/**
 * Detect if it's currently business hours (Mon-Fri, 9AM-6PM)
 * This can be made configurable in the future if needed
 */
export const detectBusinessHours = (): boolean => {
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

  // Monday to Friday (1-5), 9 AM to 6 PM (hour >= 9 && (hour < 18 || (hour === 18 && minutes === 0)))
  // This makes exactly 18:00 business hours, but 18:01 and later NOT business hours
  const isBusinessHours = dayOfWeek >= 1 && dayOfWeek <= 5 &&
                         hour >= 9 && (hour < 18 || (hour === 18 && minutes === 0));

  return isBusinessHours;
};

/**
 * Map tool slugs to their respective platforms for rate limit monitoring
 * This enables platform-specific rate limit awareness for each tool
 */
export const TOOL_PLATFORM_MAP: Record<string, string> = {
  github: 'github',
  gitlab: 'gitlab',
  jira: 'jira',
  // Future tools can be added here
  // 'azure-devops': 'azure',
  // 'bitbucket': 'bitbucket',
};

/**
 * Extract unique platforms from enabled tools that support rate limit monitoring
 * @param enabledTools Array of enabled tools
 * @returns Array of unique platform slugs
 */
export const getActivePlatforms = (enabledTools: Array<{ slug: string; capabilities?: string[] }>): string[] => {
  return Array.from(new Set(
    enabledTools
      .filter(tool => tool.capabilities?.includes('rate-limit'))
      .map(tool => TOOL_PLATFORM_MAP[tool.slug])
      .filter((platform): platform is string => platform !== undefined)
  ));
};

/**
 * Get the maximum usage percentage across all endpoints for a platform
 * This provides the most conservative rate limit assessment
 * @param rateLimitStatus Rate limit status for a platform
 * @returns Maximum usage percentage (0-100) or 0 if unknown
 */
export const getMaxUsageForPlatform = (rateLimitStatus: RateLimitStatus): number => {
  if (!rateLimitStatus?.limits) return 0;

  const platform = rateLimitStatus.platform as keyof PlatformRateLimits;
  const platformLimits = rateLimitStatus.limits[platform];

  if (!platformLimits) return 0;

  // Get all usage percentages for this platform's endpoints
  const usagePercents = Object.values(platformLimits)
    .map((usage: RateLimitUsage) => usage.usagePercent)
    .filter((percent): percent is number => percent !== null && percent !== undefined);

  if (usagePercents.length === 0) return 0;

  // Return the maximum usage to be conservative
  return Math.max(...usagePercents);
};

/**
 * Jira instance size detection based on response patterns and headers
 * Jira instances vary significantly in rate limits based on deployment type and size
 * @param response Response object from Jira API
 * @param defaultSize Fallback instance size
 * @returns Detected instance size category
 */
export const detectJiraInstanceSize = (response: Response, defaultSize: 'small' | 'medium' | 'large' | 'cloud' = 'medium'): 'small' | 'medium' | 'large' | 'cloud' => {
  // Check response headers for instance information
  const serverHeader = response.headers.get('server') || '';
  const xApplicationHost = response.headers.get('x-application-host') || '';

  // Check for specific instance patterns
  if (serverHeader.includes('atlassian') && xApplicationHost.includes('cloud')) {
    return 'cloud';
  }

  // Check for Data Center/Server pattern hints
  if (serverHeader.toLowerCase().includes('apache') ||
      serverHeader.toLowerCase().includes('nginx') &&
      !serverHeader.toLowerCase().includes('fastly')) {
    return 'large'; // Server/Data Center instances
  }

  // Cloud instances return 'fastly' in server header
  if (serverHeader.toLowerCase().includes('fastly')) {
    return 'cloud';
  }

  return defaultSize;
};

/**
 * GitHub-specific rate limit assessment that prioritizes search API limitations
 * GitHub Search API is much more restrictive (30/min) than core/GraphQL (5000/hour)
 * @param rateLimitStatus Rate limit status for GitHub
 * @param searchMultiplier Additional penalty multiplier for search-heavy operations (default: 1.5x)
 * @returns Adjusted usage percentage that prioritizes search API limits
 */
export const getGitHubWeightedUsage = (rateLimitStatus: RateLimitStatus, searchMultiplier: number = 1.5): number => {
  if (!rateLimitStatus?.limits?.github) return 0;

  const githubLimits = rateLimitStatus.limits.github;

  // Get individual API resource usages
  const searchUsage = githubLimits.search?.usagePercent ?? 0;
  const coreUsage = githubLimits.core?.usagePercent ?? 0;
  const graphqlUsage = githubLimits.graphql?.usagePercent ?? 0;

  // Prioritize search API usage with higher weighting since it's most restrictive
  // Core and GraphQL APIs have similar limits (5000/hour)
  const weightedCore = coreUsage * 0.7;      // Lower weight for core API
  const weightedGraphql = graphqlUsage * 0.8; // Medium weight for GraphQL
  const weightedSearch = searchUsage * searchMultiplier; // Higher weight for search API

  // Return the maximum of weighted usages to be conservative
  return Math.max(weightedCore, weightedGraphql, weightedSearch);
};

/**
 * Check if polling should be suspended based on user activity and tab visibility
 * @param isTabVisible Whether the browser tab is currently visible
 * @param isUserActive Whether the user has been active recently
 * @param isInBackground Whether React Query background polling is disabled
 * @returns Accelerate factor (>1 means slower polling, <1 means faster)
 */
export const getActivityAccelerationFactor = (
  isTabVisible: boolean,
  isUserActive: boolean,
  isInBackground: boolean = false
): number => {
  // Tab hidden and React Query in background mode - maximum slowdown
  if (!isTabVisible && isInBackground) return 3;

  // Tab not visible - moderate slowdown
  if (!isTabVisible) return 2;

  // React Query in background mode but tab is visible - moderate slowdown
  if (isInBackground) return 2;

  // User inactive but tab visible - light slowdown
  if (!isUserActive) return 1.5;

  // Full activity - no slowdown
  return 1;
};

/**
 * Validate that intervals stay within reasonable bounds
 * @param interval Interval in milliseconds
 * @returns Clamped interval between 30 seconds and 24 hours
 */
export const clampInterval = (interval: number): number => {
  const MIN_INTERVAL = 30 * 1000; // 30 seconds
  const MAX_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  return Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, interval));
};

/**
 * Format interval for logging/debugging purposes
 * @param intervalMs Interval in milliseconds
 * @returns Human-readable string
 */
export const formatInterval = (intervalMs: number): string => {
  const seconds = Math.round(intervalMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
};
