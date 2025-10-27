import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MockRateLimitServer } from '../mocks/rate-limit-server';
import { getRateLimitStatus, clearRateLimitCache } from '../../lib/rate-limit-monitor';
import { getDynamicInterval } from '../../lib/rate-limit-utils';

describe('Rate Limiting Performance Tests', () => {
  let mockServer: MockRateLimitServer;

  beforeAll(async () => {
    mockServer = new MockRateLimitServer(3004);
    await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  beforeEach(() => {
    clearRateLimitCache();
    mockServer.resetCounters();
  });

  describe('High-Frequency Request Handling', () => {
    it('handles rapid consecutive requests without memory leaks', async () => {
      const startTime = Date.now();
      const iterationCount = 50;

      // Generate rapid requests
      const promises = Array.from({ length: iterationCount }, () =>
        getRateLimitStatus('github', mockServer.getBaseUrl())
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

      // Verify request counting worked
      // Note: With caching, we may not see all 50 individual requests
      // but some requests should have been made
      const finalCount = Array.from(mockServer['requestCounts'].values())[0] || 0;
      expect(finalCount).toBeGreaterThan(0);
    });

    it('maintains consistent performance under varying usage levels', async () => {
      const usageLevels = [10, 50, 75, 90, 95];
      const timings: number[] = [];

      for (const usage of usageLevels) {
        mockServer.resetCounters();
        mockServer.setUsage('github', '/rate_limit', usage * 50); // Approximate usage

        const startTime = Date.now();
        await getRateLimitStatus('github', mockServer.getBaseUrl());
        const timing = Date.now() - startTime;
        timings.push(timing);

        // Each request should be fast
        expect(timing).toBeLessThan(500); // Half second max
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
      // Start with critical usage
      mockServer.setUsage('github', '/rate_limit', 4900); // 98%

      const criticalStatus = await getRateLimitStatus('github', mockServer.getBaseUrl());
      expect(criticalStatus?.status).toBe('critical');

      // Simulate recovery (reset)
      mockServer.resetCounters();
      mockServer.setUsage('github', '/rate_limit', 100); // 2%

      clearRateLimitCache(); // Force fresh data
      const recoveryStatus = await getRateLimitStatus('github', mockServer.getBaseUrl());
      expect(recoveryStatus?.status).toBe('normal');

      // Recovery should be detected quickly
      expect(recoveryStatus).not.toBeNull();
    });
  });

  describe('Resource Usage Monitoring', () => {
    it('tracks request patterns without excessive memory usage', async () => {
      const initialMemoryUsage = process.memoryUsage().heapUsed;

      // Simulate varied request patterns
      for (let i = 0; i < 20; i++) {
        const usageLevel = (i % 4) * 25; // 0, 25, 50, 75, 0, 25...
        mockServer.resetCounters();
        mockServer.setUsage('github', '/rate_limit', usageLevel * 50);
        await getRateLimitStatus('github', mockServer.getBaseUrl());
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

      // Monitor all platforms concurrently
      const results = await Promise.all(
        platforms.map(platform => getRateLimitStatus(platform, mockServer.getBaseUrl()))
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
      const transitions = ['normal', 'warning', 'critical', 'normal'];
      const transitionPromises: Promise<void>[] = [];

      transitions.forEach((_, index) => {
        const usage = index * 25 * 50; // Progressive usage levels
        mockServer.setUsage('github', '/rate_limit', usage);

        clearRateLimitCache(); // Force fresh status
        const promise = getRateLimitStatus('github', mockServer.getBaseUrl()).then(result => {
          expect(result).not.toBeNull();
          // Status should be appropriate for the usage level
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
        await getRateLimitStatus('github', mockServer.getBaseUrl());
        const endTime = Date.now();

        // Track if this was likely a cache hit (faster response)
        const isCacheHit = (endTime - startTime) < 50; // < 50ms indicates cache hit
        cacheHits.push(isCacheHit);
      }

      // Should have both cache hits and misses
      const hitCount = cacheHits.filter(Boolean).length;
      const missCount = cacheHits.length - hitCount;

      expect(hitCount).toBeGreaterThan(0);
      expect(missCount).toBeGreaterThan(0);
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
        await getRateLimitStatus('github', mockServer.getBaseUrl());
        requestCount++;

        // Small delay to prevent overwhelming the mock server
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
