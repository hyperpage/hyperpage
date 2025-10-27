// Universal rate limit types for all platforms

export interface RateLimitUsage {
  limit: number | null;        // Maximum requests allowed (null if unknown)
  remaining: number | null;    // Requests remaining (null if unknown)
  used: number | null;         // Requests used (calculated as limit - remaining, null if unknown)
  usagePercent: number | null; // Calculated percentage: (used/limit)*100 (null if unknown)
  resetTime: number | null;    // Timestamp when limits reset (null if unknown)
  retryAfter: number | null;   // Seconds to wait for next request (null if none)
}

export interface PlatformRateLimits {
  // GitHub-specific: core, search, graphql limits
  github?: {
    core: RateLimitUsage;
    search: RateLimitUsage;
    graphql: RateLimitUsage;
  };
  // GitLab-specific: based on retry-after header logic
  gitlab?: {
    global: RateLimitUsage; // GitLab has instance-wide limits
  };
  // Jira-specific: varies by instance
  jira?: {
    global: RateLimitUsage; // Jira instance limits
  };
  // Future platforms can add their specific limits here
}

export interface RateLimitStatus {
  platform: string;      // Tool name ('github', 'gitlab', 'jira')
  lastUpdated: number;   // Timestamp when this data was last fetched
  dataFresh: boolean;    // True if data is from recent API call (< 5 min old)
  status: 'normal' | 'warning' | 'critical' | 'unknown'; // Overall status
  limits: PlatformRateLimits;
}

export interface RateLimitCache {
  [platformSlug: string]: {
    data: RateLimitStatus;
    expiresAt: number; // Cache expiration timestamp
  };
}

// Hook return type for React components
export interface UseRateLimitResult {
  status: RateLimitStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isStale: boolean; // True if cache is older than 5 minutes
}

// Platform-specific API response types
export interface GitHubRateLimitResource {
  limit: number;
  remaining: number;
  reset: number;
  used?: number;
  resource: string;
}

export interface GitHubRateLimitResponse {
  resources: {
    core: GitHubRateLimitResource;
    search: GitHubRateLimitResource;
    graphql: GitHubRateLimitResource;
  };
  rate: GitHubRateLimitResource;
}

export interface GitLabRateLimitResponse {
  // GitLab doesn't have structured rate limit responses
  message?: string;
}

export interface JiraRateLimitResponse {
  // Jira doesn't have structured rate limit responses
  message?: string;
}
