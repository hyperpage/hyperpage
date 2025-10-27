import { NextResponse } from 'next/server';
import { defaultCache } from '../../../lib/cache/memory-cache';

export async function GET() {
  const cacheStats = defaultCache.getStats();

  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    cache: {
      ...cacheStats,
      hitRate: cacheStats.hits + cacheStats.misses > 0
        ? Math.round((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100)
        : 0,
    },
  });
}
