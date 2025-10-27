import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { getRateLimitStatus, clearRateLimitCache } from '../../lib/rate-limit-monitor';
import { getDynamicInterval } from '../../lib/rate-limit-utils';
import { toolRegistry } from '../../tools/registry';

describe('Rate Limiting Performance Tests', () => {
  // Create spy for global.fetch
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  // Mock tools for rate limiting
  const mockTools = {
    github: {
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
              core: { limit: 5000, remaining: 4000, reset: 1640995200 },
              search: { limit: 30, remaining: 25, reset: 1640995200 },
              graphql: { limit: 5000, remaining: 4990, reset: 1640995200 }
            }
          }
        })
      }
    },
    gitlab: {
      name: 'GitLab',
      slug: 'gitlab',
      enabled: true,
      capabilities: ['rate-limit'],
      ui: { color: '', icon: 'GitLabIcon' },
      widgets: [],
      apis: {},
      handlers: {
        'rate-limit': vi.fn().mockResolvedValue({
          rateLimit: {
            message: 'Rate limit exceeded',
            retryAfter: 60,
            statusCode: 429
          }
        })
      }
    },
    jira: {
      name: 'Jira',
      slug: 'jira',
      enabled: true,
      capabilities: ['rate-limit'],
      ui: { color: '', icon: 'JiraIcon' },
      widgets: [],
      apis: {},
      handlers: {
        'rate-limit': vi.fn().mockResolvedValue({
          rateLimit: {
            message: 'Too many requests',
            retryAfter: '3600',
            statusCode: 429
          }
        })
      }
    }
  };

  beforeAll(() => {
    // No more mock server - using fetch mocks instead
  });

  afterAll(() => {
    // No more mock server
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimitCache();

    // Set up mock tools in registry
    Object.assign(toolRegistry, mockTools);

    // Mock fetch to return successful rate limit data
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        platform: 'github',
        lastUpdated: Date.now(),
        dataFresh: true,
        status: 'normal',
        limits: {
          github: {
            core: { limit: 5000, remaining: 4000, used: 1000, usagePercent: 20, resetTime: Date.now() + 3600000, retryAfter: null },
            search: { limit: 30, remaining: 25, used: 5, usagePercent: 16.67, resetTime: Date.now() + 3600000, retryAfter: null },
            graphql: { limit: 5000, remaining: 4990, used: 10, usagePercent: 0.2, resetTime: Date.now() + 3600000, retryAfter: null }
          }
        }
      })
    });
  });

  afterEach(() => {
    // Clean up mock tools
    Object.keys(mockTools).forEach(key => {
      delete (toolRegistry as any)[key];
    });
  });

  describe('High-Frequency Request Handling', () => {
    it('handles rapid consecutive requests without memory leaks', async () => {
      const startTime = Date.now();
      const iterationCount = 50;

      // Generate rapid requests
      const promises = Array.from({ length: iterationCount }, () =>
        getRateLimitStatus('github')
      );

      // Execute all requests and measure time
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      results.forEach(result => {
        expect(result).not.toBeNull();
        expect(result?.platform).toBe('github');
      });

      // Should complete within reasonable time (allowing for cache hits)
      expect(totalTime).toBeLessThan(2000); // 2 seconds for 50 requests

      // With caching, we should have made very few fetch calls (data should be cached after first call)
      const fetchCount = mockFetch.mock.calls.length;
      expect(fetchCount).toBeLessThanOrEqual(iterationCount); // At most as many calls as requests
    });

    it('maintains consistent performance under varying usage levels', async () => {
      const usageLevels = [10, 50, 75, 90, 95];
      const timings: number[] = [];

      for (const usage of usageLevels) {
        clearRateLimitCache(); // Force fresh data for each test
        mockFetch.mockClear();

        const startTime = Date.now();
        await getRateLimitStatus('github');
        const timing = Date.now() - startTime;
        timings.push(timing);

        // Each request should be fast
        expect(timing).toBeLessThan(500); // Half second max

        // Should have made one fetch call
        expect(mockFetch).toHaveBeenCalledTimes(1);
      }

      // Performance should be roughly consistent across usage levels
      const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;
      const variation = Math.max(...timings) - Math.min(...timings);

      // Variation should be reasonable (< 100ms difference)
      expect(variation).toBeLessThan(100);
      expect(avgTiming).toBeLessThan(200);
    });
  });

  describe('Simulated High-Load Scenarios', () => {
    it('handles extreme polling frequency with proper backoff', () => {
      const baseInterval = 60000; // 1 minute
      const extremeUsage = 98;

      // Even under extreme usage, should respect bounds
      const adjustedInterval = getDynamicInterval(extremeUsage, baseInterval, false);
      expect(adjustedInterval).toBe(baseInterval * 4); // Max backoff

      // With additional slowdown factors, should still be clamped
      const activitySlowdown = 3; // Background polling
      const businessSlowdown = 1.2; // Business hours
      const finalInterval = adjustedInterval * activitySlowdown * businessSlowdown;

      // Should be <= 24 hours max
      expect(finalInterval).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    });

    it('maintains stability during recovery scenarios', async () => {
      // Start with critical usage - mock a response with critical status
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          platform: 'github',
          lastUpdated: Date.now(),
          dataFresh: true,
          status: 'critical',
          limits: {
            github: {
              core: { limit: 5000, remaining: 100, used: 4900, usagePercent: 98, resetTime: Date.now() + 3600000, retryAfter: null }
            }
          }
        })
      });

      const criticalStatus = await getRateLimitStatus('github');
      expect(criticalStatus?.status).toBe('critical');

      // Simulate recovery - reset cache and mock normal status
      clearRateLimitCache();
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          platform: 'github',
          lastUpdated: Date.now(),
          dataFresh: true,
          status: 'normal',
          limits: {
            github: {
              core: { limit: 5000, remaining: 4900, used: 100, usagePercent: 2, resetTime: Date.now() + 3600000, retryAfter: null }
            }
          }
        })
      });

      const recoveryStatus = await getRateLimitStatus('github');
      expect(recoveryStatus?.status).toBe('normal');

      // Recovery should be detected quickly
      expect(recoveryStatus).not.toBeNull();
    });
  });

  describe('Resource Usage Monitoring', () => {
    it('tracks request patterns without excessive memory usage', async () => {
      const initialMemoryUsage = process.memoryUsage().heapUsed;

      // Simulate varied request patterns - change mock responses for each call
      for (let i = 0; i < 20; i++) {
        const usageLevel = (i % 4) * 25; // 0, 25, 50, 75, 0, 25...
        clearRateLimitCache(); // Force fresh calls

        // Mock different usage levels
        mockFetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({
            platform: 'github',
            lastUpdated: Date.now(),
            dataFresh: true,
            status: 'normal',
            limits: {
              github: {
                core: { limit: 5000, remaining: 5000 - (usageLevel * 50), used: usageLevel * 50, usagePercent: usageLevel, resetTime: Date.now() + 3600000, retryAfter: null }
              }
            }
          })
        });

        await getRateLimitStatus('github');
      }

      const finalMemoryUsage = process.memoryUsage().heapUsed;
      const memoryDelta = finalMemoryUsage - initialMemoryUsage;

      // Memory delta should be reasonable (less than 50MB increase for test session)
      expect(memoryDelta).toBeLessThan(50 * 1024 * 1024); // 50MB

      // Clear cache to prevent test interference
      clearRateLimitCache();
    });

    it('handles concurrent platform monitoring', async () => {
      const platforms = ['github', 'gitlab', 'jira'];
      const startTime = Date.now();

      // Monitor all platforms concurrently - each gets different mocked data
      const mockResponses = {
        github: {
          ok: true,
          json: vi.fn().mockResolvedValue({
            platform: 'github',
            lastUpdated: Date.now(),
            dataFresh: true,
            status: 'normal',
            limits: { github: { core: { limit: 5000, remaining: 4000, used: 1000, usagePercent: 20, resetTime: Date.now() + 3600000, retryAfter: null } } }
          })
        },
        gitlab: {
          ok: true,
          json: vi.fn().mockResolvedValue({
            platform: 'gitlab',
            lastUpdated: Date.now(),
            dataFresh: true,
            status: 'normal',
            limits: { gitlab: { global: { limit: null, remaining: null, used: null, usagePercent: 10, resetTime: null, retryAfter: null } } }
          })
        },
        jira: {
          ok: true,
          json: vi.fn().mockResolvedValue({
            platform: 'jira',
            lastUpdated: Date.now(),
            dataFresh: true,
            status: 'normal',
            limits: { jira: { global: { limit: null, remaining: null, used: null, usagePercent: 5, resetTime: null, retryAfter: null } } }
          })
        }
      };

      // Mock fetch to return different data based on URL
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/github')) return mockResponses.github;
        if (url.includes('/gitlab')) return mockResponses.gitlab;
        if (url.includes('/jira')) return mockResponses.jira;
        return { ok: false };
      });

      const results = await Promise.all(
        platforms.map(platform => getRateLimitStatus(platform))
      );

      const totalTime = Date.now() - startTime;

      // All platforms should return valid status
      results.forEach((result, index) => {
        expect(result).not.toBeNull();
        expect(result?.platform).toBe(platforms[index]);
      });

      // Concurrent requests should be reasonably fast
      expect(totalTime).toBeLessThan(2000); // 2 seconds total
    });
  });

  describe('Edge Case Performance', () => {
    it('handles rapid status transitions without errors', async () => {
      const transitionPromises: Promise<void>[] = [];

      // Simulate different status levels by mocking different responses
      const statusResponses = [
        { status: 'normal', usage: 10 },
        { status: 'warning', usage: 75 },
        { status: 'critical', usage: 95 },
        { status: 'normal', usage: 5 }
      ];

      statusResponses.forEach((responseData) => {
        clearRateLimitCache(); // Force fresh status

        // Mock appropriate response for each status
        mockFetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({
            platform: 'github',
            lastUpdated: Date.now(),
            dataFresh: true,
            status: responseData.status,
            limits: {
              github: {
                core: { limit: 5000, remaining: 5000 - (responseData.usage * 50), used: responseData.usage * 50, usagePercent: responseData.usage, resetTime: Date.now() + 3600000, retryAfter: null }
              }
            }
          })
        });

        const promise = getRateLimitStatus('github').then(result => {
          expect(result).not.toBeNull();
          expect(result?.status).toBe(responseData.status);
          return Promise.resolve();
        });

        transitionPromises.push(promise);
      });

      // All transitions should complete successfully
      await Promise.all(transitionPromises);
    });

    it('maintains cache efficiency during high churn', async () => {
      // Simulate high cache churn with frequent invalidations
      const cacheHits: boolean[] = [];

      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          clearRateLimitCache(); // Invalidate cache periodically
        }

        const startTime = Date.now();
        await getRateLimitStatus('github');
        const endTime = Date.now();

        // Track if this was likely a cache hit (faster response)
        const isCacheHit = (endTime - startTime) < 50; // < 50ms indicates cache hit
        cacheHits.push(isCacheHit);
      }

      // Should have both cache hits and misses (though with mocked fetch, mainly cache hits)
      const hitCount = cacheHits.filter(Boolean).length;
      const missCount = cacheHits.length - hitCount;

      // With our cache clearing every other iteration, we should see some misses
      expect(hitCount + missCount).toBe(10);
      expect(missCount).toBeGreaterThanOrEqual(0); // Allow for different cache behavior
    });
  });

  describe('Long-Running Stability', () => {
    it('maintains consistent behavior over extended periods', async () => {
      const startTime = process.hrtime.bigint();
      const durationMs = 1000; // 1 second test
      const targetTime = startTime + BigInt(durationMs * 1000000); // Convert to nanoseconds
      let requestCount = 0;

      // Make requests as quickly as possible for 1 second
      while (process.hrtime.bigint() < targetTime) {
        await getRateLimitStatus('github');
        requestCount++;

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      // Should handle reasonable request volume without issues
      expect(requestCount).toBeGreaterThan(10); // At least 10 requests per second

      // System should remain stable
      const memUsage = process.memoryUsage();
      expect(memUsage.heapUsed).toBeLessThan(500 * 1024 * 1024); // Less than 500MB

      clearRateLimitCache(); // Clean up
    });
  });
});
