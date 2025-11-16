/**
 * Backward Compatibility Exports
 *
 * This file provides backward compatibility for existing code that imports from
 * the original rate limit files. These exports will be deprecated in future versions.
 */

import type { NextRequest } from "next/server";

import { UnifiedRateLimitService } from "@/lib/rate-limit/index";
import type {
  PlatformRateLimits,
  RateLimitStatus,
} from "@/lib/types/rate-limit";

// Export the main service for new code
export { UnifiedRateLimitService };

// Re-export all unified service functionality
export * from "@/lib/rate-limit/index";

// Create a default service instance for backward compatibility
let defaultService: UnifiedRateLimitService | null = null;

export function getDefaultRateLimitService(): UnifiedRateLimitService {
  if (!defaultService) {
    defaultService = new UnifiedRateLimitService({
      maxAuthRequests: 5,
      authWindowMs: 15 * 60 * 1000, // 15 minutes
      cacheTtlMs: 5 * 60 * 1000, // 5 minutes
    });
  }
  return defaultService;
}

// Legacy function exports that delegate to the unified service
export const getServerRateLimitStatus = async (
  platform: string,
  baseUrl?: string,
): Promise<RateLimitStatus | null> => {
  const service = getDefaultRateLimitService();
  return service.getRateLimitStatus(platform, baseUrl);
};

export const loadPersistedRateLimits = async (): Promise<number> => {
  const service = getDefaultRateLimitService();
  return service.loadPersistedRateLimits();
};

export const getActivePlatforms = (): string[] => {
  const service = getDefaultRateLimitService();
  return service.getActivePlatforms();
};

export const checkAuthRateLimit = (request: NextRequest): Response | null => {
  const service = getDefaultRateLimitService();
  return service.checkAuthRateLimit(request);
};

export const calculateOptimalInterval = (
  platform: string,
  limits: PlatformRateLimits,
): number => {
  const service = getDefaultRateLimitService();
  return service.calculateOptimalInterval(platform, limits);
};

// Legacy utility functions for backward compatibility
export const getRateLimitStatus = async (
  platform: string,
  baseUrl?: string,
): Promise<RateLimitStatus | null> => {
  const service = getDefaultRateLimitService();
  return service.getRateLimitStatusClient(platform, baseUrl);
};

export const clearRateLimitCache = (): void => {
  const service = getDefaultRateLimitService();
  return service.clearCache();
};

export const getCacheStats = (): {
  totalEntries: number;
  oldestData: number | null;
} => {
  const service = getDefaultRateLimitService();
  return service.getCacheStats();
};
