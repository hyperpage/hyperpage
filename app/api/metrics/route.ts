/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import promClient from 'prom-client';
import { defaultCache } from '../../../lib/cache/memory-cache';
import { getActivePlatforms } from '../../../lib/rate-limit-utils';
import { getRateLimitStatus } from '../../../lib/rate-limit-monitor';
import { toolRegistry } from '../../../tools/registry';

// Initialize Prometheus registry and metrics
const register = new promClient.Registry();

// Add default metrics (process, heap, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics for rate limiting
const rateLimitUsageGauge = new promClient.Gauge({
  name: 'rate_limit_usage_percent',
  help: 'Current rate limit usage percentage per platform (0-100)',
  labelNames: ['platform'],
  registers: [register],
});

const rateLimitStatusGauge = new promClient.Gauge({
  name: 'rate_limit_status',
  help: 'Current rate limit status per platform (0=normal, 1=warning, 2=critical, 3=unknown)',
  labelNames: ['platform'],
  registers: [register],
});

const rateLimitRemainingGauge = new promClient.Gauge({
  name: 'rate_limit_remaining',
  help: 'Remaining API calls for rate limits',
  labelNames: ['platform', 'endpoint'],
  registers: [register],
});

const rateLimitMaxGauge = new promClient.Gauge({
  name: 'rate_limit_max',
  help: 'Maximum API calls allowed per rate limit',
  labelNames: ['platform', 'endpoint'],
  registers: [register],
});

const apiRequestDuration = new promClient.Histogram({
  name: 'api_request_duration_seconds',
  help: 'Duration of API requests to external platforms',
  labelNames: ['platform', 'endpoint', 'status'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const apiRequestTotal = new promClient.Counter({
  name: 'api_requests_total',
  help: 'Total number of API requests made',
  labelNames: ['platform', 'endpoint', 'status'],
  registers: [register],
});

const rateLimitHitsTotal = new promClient.Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits encountered',
  labelNames: ['platform'],
  registers: [register],
});

const rateLimitRetriesTotal = new promClient.Counter({
  name: 'rate_limit_retries_total',
  help: 'Total number of rate limit retries attempted',
  labelNames: ['platform', 'attempt_number'],
  registers: [register],
});

// Cache metrics
const cacheSizeGauge = new promClient.Gauge({
  name: 'cache_entries_total',
  help: 'Total number of entries in the cache',
  registers: [register],
});

const cacheHitsTotal = new promClient.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  registers: [register],
});

const cacheMissesTotal = new promClient.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  registers: [register],
});

const cacheExpiriesTotal = new promClient.Counter({
  name: 'cache_expiries_total',
  help: 'Total number of cache entries that expired',
  registers: [register],
});

const cacheEvictionsTotal = new promClient.Counter({
  name: 'cache_evictions_total',
  help: 'Total number of cache entries evicted due to size limits',
  registers: [register],
});

// Update metrics from current state
async function updateMetrics() {
  try {
    // Update cache metrics
    const cacheStats = await defaultCache.getStats();
    cacheSizeGauge.set(cacheStats.size);
    cacheHitsTotal.reset(); // Reset counter and set to current value
    cacheHitsTotal.inc(cacheStats.hits);
    cacheMissesTotal.reset();
    cacheMissesTotal.inc(cacheStats.misses);
    cacheExpiriesTotal.reset();
    cacheExpiriesTotal.inc(cacheStats.expiries);
    cacheEvictionsTotal.reset();
    cacheEvictionsTotal.inc(cacheStats.evictions);

    // Update rate limit metrics
    const enabledTools = (Object.values(toolRegistry) as any[])
      .filter((tool) =>
        tool &&
        tool.enabled === true &&
        tool.capabilities?.includes('rate-limit')
      );

    const activePlatforms = getActivePlatforms(enabledTools);

    for (const platform of activePlatforms) {
      try {
        const status = await getRateLimitStatus(platform);
        if (!status) continue;

        // Update platform-level metrics
        const maxUsage = Math.max(
          ...Object.values(status.limits).flatMap(platformLimits =>
            Object.values(platformLimits || {}).map((usage: any) => usage.usagePercent || 0)
          )
        );

        const statusValue = status.status === 'normal' ? 0 :
                           status.status === 'warning' ? 1 :
                           status.status === 'critical' ? 2 : 3;

        rateLimitUsageGauge.set({ platform }, maxUsage);
        rateLimitStatusGauge.set({ platform }, statusValue);

        // Update per-endpoint metrics
        const platformLimits = status.limits[platform as keyof typeof status.limits];
        if (platformLimits) {
          Object.entries(platformLimits).forEach(([endpoint, usage]: [string, any]) => {
            if (usage?.limit !== null && usage?.remaining !== null) {
              rateLimitMaxGauge.set({ platform, endpoint }, usage.limit);
              rateLimitRemainingGauge.set({ platform, endpoint }, usage.remaining);
            }
          });
        }
      } catch (error) {
        console.error(`Failed to fetch rate limit status for ${platform}:`, error);
        // Set status to unknown for failed platforms
        rateLimitStatusGauge.set({ platform }, 3);
      }
    }
  } catch (error) {
    console.error('Failed to update metrics:', error);
  }
}

/**
 * GET /api/metrics - Expose Prometheus metrics
 */
export async function GET() {
  try {
    // Update metrics before serving them
    await updateMetrics();

    // Generate Prometheus format response
    const metrics = await register.metrics();
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Metrics endpoint error:', error);
    return NextResponse.json({ error: 'Failed to generate metrics' }, { status: 500 });
  }
}

// Export metrics interface for use in other parts of the application
export const metrics = {
  apiRequestDuration,
  apiRequestTotal,
  rateLimitHitsTotal,
  rateLimitRetriesTotal,
  updateMetrics,
};
