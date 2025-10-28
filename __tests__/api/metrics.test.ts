import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '../../app/api/metrics/route';
import { defaultCache } from '../../lib/cache/memory-cache';
import { getRateLimitStatus } from '../../lib/rate-limit-monitor';
import { getActivePlatforms } from '../../lib/rate-limit-utils';
import { toolRegistry } from '../../tools/registry';

// Mock prom-client to avoid global registry conflicts in tests
vi.mock('prom-client', () => {
  const mockGauge = vi.fn().mockImplementation(() => ({
    set: vi.fn(),
    reset: vi.fn(),
    inc: vi.fn(),
  }));

  const mockCounter = vi.fn().mockImplementation(() => ({
    reset: vi.fn(),
    inc: vi.fn(),
  }));

  const mockHistogram = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
  }));

  const mockRegistry = vi.fn().mockImplementation(() => ({
    metrics: vi.fn().mockResolvedValue('# Prometheus metrics output'),
  }));

  const promClient = {
    Registry: mockRegistry,
    Gauge: mockGauge,
    Counter: mockCounter,
    Histogram: mockHistogram,
    collectDefaultMetrics: vi.fn(),
  };

  return {
    default: promClient,
  };
});

// Mock cache stats
vi.mock('../../lib/cache/memory-cache', () => ({
  defaultCache: {
    getStats: vi.fn(),
  },
}));

// Mock rate limit utilities
vi.mock('../../lib/rate-limit-utils', () => ({
  getActivePlatforms: vi.fn(),
  getRateLimitStatus: vi.fn(),
}));

// Mock tool registry
vi.mock('../../tools/registry', () => ({
  toolRegistry: {},
}));

describe('GET /api/metrics', () => {
  const mockCacheStats = {
    size: 42,
    hits: 1000,
    misses: 200,
    expiries: 50,
    evictions: 25,
  };

  const mockRateLimitStatus = {
    platform: 'github',
    lastUpdated: Date.now(),
    dataFresh: true,
    status: 'warning' as const,
    limits: {
      github: {
        core: { limit: 5000, remaining: 4500, usagePercent: 10, used: null, resetTime: null, retryAfter: null },
        search: { limit: 30, remaining: 20, usagePercent: 33, used: null, resetTime: null, retryAfter: null },
        graphql: { limit: 5000, remaining: 4990, usagePercent: 0.2, used: null, resetTime: null, retryAfter: null },
      },
    },
  };

  const mockEnabledTools = [
    {
      name: 'GitHub',
      slug: 'github',
      enabled: true,
      capabilities: ['rate-limit'],
    },
    {
      name: 'GitLab',
      slug: 'gitlab',
      enabled: true,
      capabilities: ['rate-limit'],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mocks
    vi.mocked(defaultCache.getStats).mockReturnValue(mockCacheStats);
    vi.mocked(getActivePlatforms).mockReturnValue(['github', 'gitlab']);
    vi.mocked(getRateLimitStatus)
      .mockResolvedValueOnce(mockRateLimitStatus) // github
      .mockResolvedValueOnce(mockRateLimitStatus); // gitlab
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('GET endpoint', () => {
    it('should return successful Prometheus metrics response', async () => {
      const response = await GET();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');

      const metricsOutput = await response.text();
      expect(metricsOutput).toContain('# Prometheus metrics output');
    });

    it('should update metrics before serving them', async () => {
      await GET();

      // Verify metrics were updated
      expect(vi.mocked(defaultCache.getStats)).toHaveBeenCalled();
      expect(vi.mocked(getActivePlatforms)).toHaveBeenCalled();
    });

    it('should handle errors during metrics generation', async () => {
      const promClient = await import('prom-client');
      const mockRegistry = promClient.Registry as any;
      const registryInstance = mockRegistry.mock.results[0]?.value;
      if (registryInstance) {
        registryInstance.metrics = vi.fn().mockRejectedValue(new Error('Registry error'));
      }

      const response = await GET();

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Failed to generate metrics');
    });

    it('should handle Prometheus client initialization errors', async () => {
      // Mock Registry constructor to throw
      const promClient = await import('prom-client');
      const mockRegistry = promClient.Registry as any;
      mockRegistry.mockImplementation(() => {
        throw new Error('Client initialization failed');
      });

      await expect(GET()).resolves.toBeDefined(); // Should return error response
    });
  });
});
