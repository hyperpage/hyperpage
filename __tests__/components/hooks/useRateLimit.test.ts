import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRateLimit, useMultipleRateLimits, getRateLimitStatusColor, getRateLimitStatusBgColor, formatUsagePercent, formatTimeUntilReset } from '../../../app/components/hooks/useRateLimit';

// Mock the rate limit monitor
vi.mock('../../../lib/rate-limit-monitor', () => ({
  getRateLimitStatus: vi.fn(),
  clearRateLimitCache: vi.fn()
}));

import { getRateLimitStatus, clearRateLimitCache } from '../../../lib/rate-limit-monitor';

describe('useRateLimit Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location.origin for CORS testing
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:3000' },
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
          core: { limit: 5000, remaining: 4000, used: 1000, usagePercent: 20, resetTime: Date.now() + 3600000, retryAfter: null }
        }
      }
    };

    (getRateLimitStatus as vi.Mock).mockResolvedValue(mockRateLimitStatus);

    const { result } = renderHook(() => useRateLimit('github', true));

    await waitFor(() => {
      expect(result.current.status).toEqual(mockRateLimitStatus);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isStale).toBe(false);
    });

    expect(getRateLimitStatus).toHaveBeenCalledWith('github', 'http://localhost:3000');
  });

  it('should handle rate limit fetch failure', async () => {
    (getRateLimitStatus as vi.Mock).mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useRateLimit('github', true));

    await waitFor(() => {
      expect(result.current.status).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Failed to fetch rate limit status: API Error');
      expect(result.current.isStale).toBe(false);
    });
  });

  it('should handle null rate limit response', async () => {
    (getRateLimitStatus as vi.Mock).mockResolvedValue(null);

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
          core: { limit: 5000, remaining: 4000, used: 1000, usagePercent: 20, resetTime: Date.now() + 3600000, retryAfter: null }
        }
      }
    };

    (getRateLimitStatus as vi.Mock).mockResolvedValue(mockRateLimitStatus);

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

    (getRateLimitStatus as vi.Mock).mockResolvedValue(mockRateLimitStatus);

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

    (getRateLimitStatus as vi.Mock).mockResolvedValue(mockRateLimitStatus);

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
      value: { origin: 'http://localhost:3000' },
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
      limits: { github: {} }
    };

    const mockGitLabStatus = {
      platform: 'gitlab',
      lastUpdated: Date.now(),
      dataFresh: true,
      status: 'warning' as const,
      limits: { gitlab: { global: {} } }
    };

    (getRateLimitStatus as vi.Mock)
      .mockResolvedValueOnce(mockGitHubStatus)
      .mockResolvedValueOnce(mockGitLabStatus);

    const { result } = renderHook(() => useMultipleRateLimits(['github', 'gitlab'], true));

    await waitFor(() => {
      expect(result.current.statuses.size).toBe(2);
      expect(result.current.statuses.get('github')).toEqual(mockGitHubStatus);
      expect(result.current.statuses.get('gitlab')).toEqual(mockGitLabStatus);
      expect(result.current.hasStaleData).toBe(false);
    });

    expect(getRateLimitStatus).toHaveBeenCalledWith('github', 'http://localhost:3000');
    expect(getRateLimitStatus).toHaveBeenCalledWith('gitlab', 'http://localhost:3000');
  });

    it('should handle platform loading errors', async () => {
      (getRateLimitStatus as vi.Mock)
        .mockRejectedValueOnce(new Error('GitHub API Error'))
        .mockResolvedValueOnce(null);

      const { result } = renderHook(() => useMultipleRateLimits(['github', 'gitlab'], true));

      await waitFor(() => {
        expect(result.current.errors.get('github')).toBe('Failed to fetch rate limit status: GitHub API Error');
        expect(result.current.errors.get('gitlab')).toBe('Rate limit monitoring not supported for platform: gitlab');
      });
    });

  it('should call refreshAll function', async () => {
    (getRateLimitStatus as vi.Mock).mockResolvedValue({
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

    (getRateLimitStatus as vi.Mock).mockResolvedValue(mockStatus);

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
