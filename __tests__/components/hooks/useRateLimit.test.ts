// Mock the rate limit monitor before importing
vi.mock('../../../lib/rate-limit-monitor', () => ({
  getRateLimitStatus: vi.fn(),
  clearRateLimitCache: vi.fn()
}));

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRateLimit, useMultipleRateLimits, getRateLimitStatusColor, getRateLimitStatusBgColor, formatUsagePercent, formatTimeUntilReset } from '../../../app/components/hooks/useRateLimit';
import { TEST_BASE_URL } from '../../test-constants';

import { getRateLimitStatus, clearRateLimitCache } from '../../../lib/rate-limit-monitor';

const mockGetRateLimitStatus = vi.mocked(getRateLimitStatus);

describe('useRateLimit Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location.origin for CORS testing
    Object.defineProperty(window, 'location', {
      value: { origin: TEST_BASE_URL },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return null status when disabled', async () => {
    const { result } = renderHook(() => useRateLimit('github', false));

    await waitFor(() => {
      expect(result.current.status).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isStale).toBe(false);
    });
  });

  it('should return null status when platform is empty', async () => {
    const { result } = renderHook(() => useRateLimit('', true));

    await waitFor(() => {
      expect(result.current.status).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isStale).toBe(false);
    });
  });

  it('should handle successful rate limit data', async () => {
    const mockRateLimitStatus = {
      platform: 'github',
      lastUpdated: Date.now(),
      dataFresh: true,
      status: 'normal' as const,
      limits: {
        github: {
          core: { limit: 5000, remaining: 4000, used: 1000, usagePercent: 20, resetTime: Date.now() + 3600000, retryAfter: null },
          search: { limit: 30, remaining: 25, used: 5, usagePercent: 17, resetTime: Date.now() + 3600000, retryAfter: null },
          graphql: { limit: 5000, remaining: 4750, used: 250, usagePercent: 5, resetTime: Date.now() + 3600000, retryAfter: null }
        }
      }
    };

    mockGetRateLimitStatus.mockResolvedValue(mockRateLimitStatus);

    const { result } = renderHook(() => useRateLimit('github', true));

    await waitFor(() => {
      expect(result.current.status).toEqual(mockRateLimitStatus);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isStale).toBe(false);
    });

    expect(getRateLimitStatus).toHaveBeenCalledWith('github', TEST_BASE_URL);
  });

  it('should handle rate limit fetch failure', async () => {
    mockGetRateLimitStatus.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useRateLimit('github', true));

    await waitFor(() => {
      expect(result.current.status).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Failed to fetch rate limit status: API Error');
      expect(result.current.isStale).toBe(false);
    });
  });

  it('should handle null rate limit response', async () => {
    mockGetRateLimitStatus.mockResolvedValue(null);

    const { result } = renderHook(() => useRateLimit('nonexistent', true));

    await waitFor(() => {
      expect(result.current.status).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Rate limit monitoring not supported for platform: nonexistent');
      expect(result.current.isStale).toBe(false);
    });
  });

  it('should mark data as stale after 5 minutes', async () => {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000) - 1000;
    const mockRateLimitStatus = {
      platform: 'github',
      lastUpdated: fiveMinutesAgo,
      dataFresh: false,
      status: 'normal' as const,
      limits: {
        github: {
          core: { limit: 5000, remaining: 4000, used: 1000, usagePercent: 20, resetTime: Date.now() + 3600000, retryAfter: null },
          search: { limit: 30, remaining: 25, used: 5, usagePercent: 17, resetTime: Date.now() + 3600000, retryAfter: null },
          graphql: { limit: 5000, remaining: 4750, used: 250, usagePercent: 5, resetTime: Date.now() + 3600000, retryAfter: null }
        }
      }
    };

    mockGetRateLimitStatus.mockResolvedValue(mockRateLimitStatus);

    const { result } = renderHook(() => useRateLimit('github', true));

    await waitFor(() => {
      expect(result.current.status).toEqual(mockRateLimitStatus);
      expect(result.current.isStale).toBe(true);
    });
  });

  it('should call refresh function', async () => {
    const mockRateLimitStatus = {
      platform: 'github',
      lastUpdated: Date.now(),
      dataFresh: true,
      status: 'normal' as const,
      limits: {}
    };

    mockGetRateLimitStatus.mockResolvedValue(mockRateLimitStatus);

    const { result } = renderHook(() => useRateLimit('github', true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(getRateLimitStatus).toHaveBeenCalledTimes(2);
    });
  });

  it('should reset state when disabled after being enabled', async () => {
    const mockRateLimitStatus = {
      platform: 'github',
      lastUpdated: Date.now(),
      dataFresh: true,
      status: 'normal' as const,
      limits: {}
    };

    mockGetRateLimitStatus.mockResolvedValue(mockRateLimitStatus);

    const { result, rerender } = renderHook(({ enabled }) => useRateLimit('github', enabled), {
      initialProps: { enabled: true }
    });

    await waitFor(() => {
      expect(result.current.status).toBeTruthy();
    });

    rerender({ enabled: false });

    expect(result.current.status).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});

describe('useMultipleRateLimits Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      value: { origin: TEST_BASE_URL },
      writable: true,
    });
  });

  it('should handle empty platforms array', () => {
    const { result } = renderHook(() => useMultipleRateLimits([], true));

    expect(result.current.statuses.size).toBe(0);
    expect(result.current.loading.size).toBe(0);
    expect(result.current.errors.size).toBe(0);
  });

  it('should load rate limits for multiple platforms', async () => {
    const mockGitHubStatus = {
      platform: 'github',
      lastUpdated: Date.now(),
      dataFresh: true,
      status: 'normal' as const,
      limits: {
        github: {
          core: { limit: 5000, remaining: 4000, used: 1000, usagePercent: 20, resetTime: Date.now() + 3600000, retryAfter: null },
          search: { limit: 30, remaining: 25, used: 5, usagePercent: 17, resetTime: Date.now() + 3600000, retryAfter: null },
          graphql: { limit: 5000, remaining: 4750, used: 250, usagePercent: 5, resetTime: Date.now() + 3600000, retryAfter: null }
        }
      }
    };

    const mockGitLabStatus = {
      platform: 'gitlab',
      lastUpdated: Date.now(),
      dataFresh: true,
      status: 'warning' as const,
      limits: {
        gitlab: {
          global: { limit: 2000, remaining: 1800, used: 200, usagePercent: 10, resetTime: Date.now() + 3600000, retryAfter: null },
          api: { limit: 2000, remaining: 1900, used: 100, usagePercent: 5, resetTime: Date.now() + 3600000, retryAfter: null },
          web: { limit: 5000, remaining: 4500, used: 500, usagePercent: 10, resetTime: Date.now() + 3600000, retryAfter: null }
        }
      }
    };

    mockGetRateLimitStatus
      .mockResolvedValueOnce(mockGitHubStatus)
      .mockResolvedValueOnce(mockGitLabStatus);

    const { result } = renderHook(() => useMultipleRateLimits(['github', 'gitlab'], true));

    await waitFor(() => {
      expect(result.current.statuses.size).toBe(2);
      expect(result.current.statuses.get('github')).toEqual(mockGitHubStatus);
      expect(result.current.statuses.get('gitlab')).toEqual(mockGitLabStatus);
      expect(result.current.hasStaleData).toBe(false);
    });

    expect(getRateLimitStatus).toHaveBeenCalledWith('github', TEST_BASE_URL);
    expect(getRateLimitStatus).toHaveBeenCalledWith('gitlab', TEST_BASE_URL);
  });

    it('should handle platform loading errors', async () => {
      mockGetRateLimitStatus
        .mockRejectedValueOnce(new Error('GitHub API Error'))
        .mockResolvedValueOnce(null);

      const { result } = renderHook(() => useMultipleRateLimits(['github', 'gitlab'], true));

      await waitFor(() => {
        expect(result.current.errors.get('github')).toBe('Failed to fetch rate limit status: GitHub API Error');
        expect(result.current.errors.get('gitlab')).toBe('Rate limit monitoring not supported for platform: gitlab');
      });
    });

  it('should call refreshAll function', async () => {
    mockGetRateLimitStatus.mockResolvedValue({
      platform: 'github',
      lastUpdated: Date.now(),
      dataFresh: true,
      status: 'normal' as const,
      limits: {}
    });

    const { result } = renderHook(() => useMultipleRateLimits(['github'], true));

    await waitFor(() => {
      expect(result.current.statuses.size).toBe(1);
    });

    act(() => {
      result.current.refreshAll();
    });

    await waitFor(() => {
      expect(getRateLimitStatus).toHaveBeenCalledTimes(2);
    });
  });

  it('should call individual refresh function', async () => {
    const mockStatus = {
      platform: 'github',
      lastUpdated: Date.now(),
      dataFresh: true,
      status: 'normal' as const,
      limits: {}
    };

    mockGetRateLimitStatus.mockResolvedValue(mockStatus);

    const { result } = renderHook(() => useMultipleRateLimits(['github'], true));

    await waitFor(() => {
      expect(result.current.statuses.size).toBe(1);
    });

    act(() => {
      result.current.refresh('github');
    });

    await waitFor(() => {
      expect(getRateLimitStatus).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Utility Functions', () => {
  describe('getRateLimitStatusColor', () => {
    it('should return correct colors for status', () => {
      expect(getRateLimitStatusColor('critical')).toBe('text-red-600 dark:text-red-400');
      expect(getRateLimitStatusColor('warning')).toBe('text-yellow-600 dark:text-yellow-400');
      expect(getRateLimitStatusColor('normal')).toBe('text-green-600 dark:text-green-400');
      expect(getRateLimitStatusColor('unknown')).toBe('text-gray-500 dark:text-gray-400');
    });
  });

  describe('getRateLimitStatusBgColor', () => {
    it('should return correct background colors for status', () => {
      expect(getRateLimitStatusBgColor('critical')).toBe('bg-red-100 dark:bg-red-900/20');
      expect(getRateLimitStatusBgColor('warning')).toBe('bg-yellow-100 dark:bg-yellow-900/20');
      expect(getRateLimitStatusBgColor('normal')).toBe('bg-green-100 dark:bg-green-900/20');
      expect(getRateLimitStatusBgColor('unknown')).toBe('bg-gray-100 dark:bg-gray-800/20');
    });
  });

  describe('formatUsagePercent', () => {
    it('should format percentage correctly', () => {
      expect(formatUsagePercent(85.5)).toBe('86%');
      expect(formatUsagePercent(0)).toBe('0%');
      expect(formatUsagePercent(100)).toBe('100%');
      expect(formatUsagePercent(null)).toBe('N/A');
    });
  });

  describe('formatTimeUntilReset', () => {
    it('should format time correctly', () => {
      const futureTime = Date.now() + (2 * 60 * 60 * 1000) + (15 * 60 * 1000); // 2h 15m
      expect(formatTimeUntilReset(futureTime)).toMatch(/^2h \d+m$/);
    });

    it('should handle null reset time', () => {
      expect(formatTimeUntilReset(null)).toBe('Unknown');
    });

    it('should handle past reset time', () => {
      const pastTime = Date.now() - 1000;
      expect(formatTimeUntilReset(pastTime)).toBe('Reset pending');
    });

    it('should format short times in minutes', () => {
      const futureTime = Date.now() + (45 * 60 * 1000); // 45 minutes
      expect(formatTimeUntilReset(futureTime)).toMatch(/^\d+m$/);
    });
  });
});

describe('Cache Utility Hook', () => {
  it('should export clearCache function', () => {
    expect(typeof clearRateLimitCache).toBe('function');
  });
});
