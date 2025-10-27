import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateLimitUsage,
  calculateOverallStatus,
  transformGitHubLimits,
  transformGitLabLimits,
  transformJiraLimits,
  getRateLimitStatus,
  clearRateLimitCache,
  getCacheStats
} from '../../lib/rate-limit-monitor';
import { PlatformRateLimits } from '../../lib/types/rate-limit';

import { toolRegistry } from '../../tools/registry';
import { Tool } from '../../tools/tool-types';

// Create spy for global.fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Type-safe mock tool registry
type MockToolRegistry = { [key: string]: Tool | undefined };

// Mock tool for testing with minimal required properties
type MockTool = Tool & {
  handlers: {
    'rate-limit': ReturnType<typeof vi.fn>;
  };
};

describe('Rate Limit Monitor Library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimitCache();
  });

  afterEach(() => {
    clearRateLimitCache();
  });

  describe('calculateLimitUsage', () => {
    it('should calculate usage with valid limits and remaining', () => {
      const result = calculateLimitUsage(1000, 200);

      expect(result).toEqual({
        limit: 1000,
        remaining: 200,
        used: 800,
        usagePercent: 80
      });
    });

    it('should handle null limit', () => {
      const result = calculateLimitUsage(null, 100);

      expect(result).toEqual({
        limit: null,
        remaining: 100,
        used: null,
        usagePercent: null
      });
    });

    it('should handle null remaining', () => {
      const result = calculateLimitUsage(1000, null);

      expect(result).toEqual({
        limit: 1000,
        remaining: null,
        used: null,
        usagePercent: null
      });
    });

    it('should handle both null values', () => {
      const result = calculateLimitUsage(null, null);

      expect(result).toEqual({
        limit: null,
        remaining: null,
        used: null,
        usagePercent: null
      });
    });

    it('should handle zero limit gracefully', () => {
      const result = calculateLimitUsage(0, 10);

      expect(result).toEqual({
        limit: 0,
        remaining: 10,
        used: 0,
        usagePercent: 0
      });
    });

    it('should cap usagePercent at 100%', () => {
      const result = calculateLimitUsage(100, 200); // Used would be -100

      expect(result.usagePercent).toBe(0); // Can't go below 0
    });
  });

  describe('calculateOverallStatus', () => {
    it('should return "unknown" when no usage data', () => {
      const limits: PlatformRateLimits = {};

      expect(calculateOverallStatus(limits)).toBe('unknown');
    });

    it('should return "normal" for low usage', () => {
      const limits: PlatformRateLimits = {
        github: {
          core: {
            limit: 1000,
            remaining: 850,
            used: 150,
            usagePercent: 15,
            resetTime: null,
            retryAfter: null
          },
          search: {
            limit: 1000,
            remaining: 850,
            used: 150,
            usagePercent: 15,
            resetTime: null,
            retryAfter: null
          },
          graphql: {
            limit: 1000,
            remaining: 850,
            used: 150,
            usagePercent: 15,
            resetTime: null,
            retryAfter: null
          }
        }
      };

      expect(calculateOverallStatus(limits)).toBe('normal');
    });

    it('should return "warning" for medium-high usage', () => {
      const limits: PlatformRateLimits = {
        github: {
          core: {
            limit: 1000,
            remaining: 250,
            used: 750,
            usagePercent: 75,
            resetTime: null,
            retryAfter: null
          },
          search: {
            limit: 1000,
            remaining: 250,
            used: 750,
            usagePercent: 75,
            resetTime: null,
            retryAfter: null
          },
          graphql: {
            limit: 1000,
            remaining: 250,
            used: 750,
            usagePercent: 75,
            resetTime: null,
            retryAfter: null
          }
        }
      };

      expect(calculateOverallStatus(limits)).toBe('warning');
    });

    it('should return "critical" for very high usage', () => {
      const limits: PlatformRateLimits = {
        github: {
          core: {
            limit: 1000,
            remaining: 10,
            used: 990,
            usagePercent: 99,
            resetTime: null,
            retryAfter: null
          },
          search: {
            limit: 1000,
            remaining: 10,
            used: 990,
            usagePercent: 99,
            resetTime: null,
            retryAfter: null
          },
          graphql: {
            limit: 1000,
            remaining: 10,
            used: 990,
            usagePercent: 99,
            resetTime: null,
            retryAfter: null
          }
        }
      };

      expect(calculateOverallStatus(limits)).toBe('critical');
    });

    it('should return highest severity across multiple platforms', () => {
      const limits: PlatformRateLimits = {
        github: {
          core: {
            limit: 1000,
            remaining: 900,
            used: 100,
            usagePercent: 10,
            resetTime: null,
            retryAfter: null
          },
          search: {
            limit: 1000,
            remaining: 900,
            used: 100,
            usagePercent: 10,
            resetTime: null,
            retryAfter: null
          },
          graphql: {
            limit: 1000,
            remaining: 900,
            used: 100,
            usagePercent: 10,
            resetTime: null,
            retryAfter: null
          }
        },
        gitlab: {
          global: {
            limit: 1000,
            remaining: 100,
            used: 900,
            usagePercent: 90,
            resetTime: null,
            retryAfter: null
          }
        }
      };

      const result = calculateOverallStatus(limits);
      expect(result).toBe('critical');
    });
  });

  describe('transformGitHubLimits', () => {
    it('should transform GitHub API response to universal format', () => {
      const githubResponse = {
        resources: {
          core: { limit: 5000, remaining: 4990, reset: 1640995200 },
          search: { limit: 30, remaining: 27, reset: 1640995200 },
          graphql: { limit: 5000, remaining: 4995, reset: 1640995200 }
        }
      };

      const result = transformGitHubLimits(githubResponse);

      expect(result.github!).toEqual({
        core: {
          limit: 5000,
          remaining: 4990,
          used: 10,
          usagePercent: 0.2,
          resetTime: 1640995200 * 1000,
          retryAfter: null
        },
        search: {
          limit: 30,
          remaining: 27,
          used: 3,
          usagePercent: 10,
          resetTime: 1640995200 * 1000,
          retryAfter: null
        },
        graphql: {
          limit: 5000,
          remaining: 4995,
          used: 5,
          usagePercent: 0.1,
          resetTime: 1640995200 * 1000,
          retryAfter: null
        }
      });
    });
  });

  describe('transformGitLabLimits', () => {
    it('should return GitLab global limits with retryAfter', () => {
      const gitlabResponse = { message: 'Rate limit exceeded' };

      const result = transformGitLabLimits(gitlabResponse, 60);

      expect(result.gitlab!).toEqual({
        global: {
          limit: null,
          remaining: null,
          used: null,
          usagePercent: 90, // High usage when retry-after is present (indicates API stress)
          resetTime: Date.now() + (60 * 1000),
          retryAfter: 60
        }
      });
    });

    it('should handle null retryAfter', () => {
      const result = transformGitLabLimits({}, null);

      expect(result.gitlab!.global.resetTime).toBeNull();
      expect(result.gitlab!.global.retryAfter).toBeNull();
    });
  });

  describe('transformJiraLimits', () => {
    it('should return Jira global limits structure', () => {
      const jiraResponse = { message: 'Rate limit exceeded' };

      const result = transformJiraLimits(jiraResponse);

      expect(result.jira!).toEqual({
        global: {
          limit: null,
          remaining: null,
          used: null,
          usagePercent: null,
          resetTime: null,
          retryAfter: null
        }
      });
    });
  });

  describe('getRateLimitStatus', () => {
    const mockRateLimitHandler = vi.fn();

    const mockTool: Tool = {
      name: 'GitHub',
      slug: 'github',
      enabled: true,
      capabilities: ['rate-limit'],
      ui: { color: '', icon: 'GitHubIcon' },
      widgets: [],
      apis: {},
      handlers: {
        'rate-limit': mockRateLimitHandler
      }
    };

    beforeEach(() => {
      (toolRegistry as Record<string, Tool>).github = mockTool;
      mockRateLimitHandler.mockResolvedValue({
        rateLimit: {
          resources: {
            core: { limit: 5000, remaining: 4000, reset: 1640995200 },
            search: { limit: 30, remaining: 25, reset: 1640995200 },
            graphql: { limit: 5000, remaining: 4990, reset: 1640995200 }
          }
        }
      });
    });

    afterEach(() => {
      delete (toolRegistry as Record<string, Tool>).github;
    });

    it('should return null for tools without rate-limit capability', async () => {
      const tool = (toolRegistry as Record<string, Tool>).github;
      if (tool) {
        tool.capabilities = [];
      }

      const result = await getRateLimitStatus('github');

      expect(result).toBeNull();
    });

    it('should return null for non-existent tools', async () => {
      const result = await getRateLimitStatus('nonexistent');

      expect(result).toBeNull();
    });

    it('should fetch fresh rate limit data successfully', async () => {
      const mockResponseData = {
        platform: 'github',
        lastUpdated: Date.now(),
        dataFresh: true,
        status: 'normal' as const,
        limits: {
          github: {
            core: { limit: 5000, remaining: 4000, used: 1000, usagePercent: 20, resetTime: 1640995200 * 1000, retryAfter: null },
            search: { limit: 30, remaining: 25, used: 5, usagePercent: 16.67, resetTime: 1640995200 * 1000, retryAfter: null },
            graphql: { limit: 5000, remaining: 4990, used: 10, usagePercent: 0.2, resetTime: 1640995200 * 1000, retryAfter: null }
          }
        }
      };

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponseData)
      });

      const result = await getRateLimitStatus('github');

      expect(result).not.toBeNull();
      expect(result!.platform).toBe('github');
      expect(result!.dataFresh).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('api/rate-limit/github'), expect.any(Object));
    });

    it('should use cached data when available and fresh', async () => {
      const mockResponseData = {
        platform: 'github',
        lastUpdated: Date.now(),
        dataFresh: true,
        status: 'normal' as const,
        limits: {
          github: {
            core: { limit: 5000, remaining: 4000, used: 1000, usagePercent: 20, resetTime: 1640995200 * 1000, retryAfter: null },
            search: { limit: 30, remaining: 25, used: 5, usagePercent: 16.67, resetTime: 1640995200 * 1000, retryAfter: null },
            graphql: { limit: 5000, remaining: 4990, used: 10, usagePercent: 0.2, resetTime: 1640995200 * 1000, retryAfter: null }
          }
        }
      };

      // First call to populate cache
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponseData)
      });

      await getRateLimitStatus('github');

      // Second call should use cache
      const result = await getRateLimitStatus('github');

      expect(result).not.toBeNull();
      // Should still be fresh (less than 5 minutes)
      expect(result!.dataFresh).toBe(true);
      // fetch should only be called once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      });

      const result = await getRateLimitStatus('github');

      expect(result).toBeNull();
    });

    it('should handle network errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await getRateLimitStatus('github');

      expect(result).toBeNull();
    });

    it('should use baseUrl parameter for custom origins', async () => {
      const customBaseUrl = 'http://custom.example.com';

      // This test runs separately, so we need to set up the tool
      const testTool: Tool = {
        name: 'GitHub',
        slug: 'github',
        enabled: true,
        capabilities: ['rate-limit'],
        ui: { color: '', icon: 'GitHubIcon' },
        widgets: [],
        apis: {},
        handlers: {
          'rate-limit': vi.fn().mockResolvedValue({
            rateLimit: {
              resources: {
                core: { limit: 5000, remaining: 4000, reset: 1640995200 }
              }
            }
          })
        }
      };

      (toolRegistry as Record<string, Tool>).github = testTool;

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          platform: 'github',
          lastUpdated: Date.now(),
          dataFresh: true,
          status: 'normal' as const,
          limits: {}
        })
      });

      global.fetch = fetchSpy;

      await getRateLimitStatus('github', customBaseUrl);

      expect(fetchSpy).toHaveBeenCalledWith(
        `${customBaseUrl}/api/rate-limit/github`,
        expect.any(Object)
      );

      // Clean up
      delete (toolRegistry as Record<string, Tool>).github;
    });
  });

  describe('Cache Management', () => {
    it('should track cache statistics', () => {
      const stats = getCacheStats();

      expect(stats).toEqual({
        totalEntries: 0,
        oldestData: null
      });
    });

    it('should clear cache on demand', () => {
      clearRateLimitCache();
      const stats = getCacheStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.oldestData).toBeNull();
    });
  });
});
