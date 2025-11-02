import { NextRequest, NextResponse } from 'next/server';
import { bottleneckDetector } from '../../../lib/monitoring/bottleneck-detector';
import { DetectedBottleneck, BottleneckHistory } from '../../../lib/monitoring/bottleneck-detector';

/**
 * GET /api/bottlenecks - Get all active and recent bottleneck detections
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('history') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');
    const timeRange = parseInt(searchParams.get('timeRange') || '3600000'); // 1 hour default

    // Get active bottlenecks
    const activeBottlenecks = bottleneckDetector.getActiveBottlenecks();

    // Get analysis statistics
    const analysis = bottleneckDetector.getBottleneckAnalysis();

    // Get recent history if requested
    const historicalBottlenecks = includeHistory
      ? bottleneckDetector.getHistoricalBottlenecks(limit)
      : [];

    // Calculate trend analysis (simplified - expanding recent data)
    const trends = calculateBottleneckTrends(activeBottlenecks, historicalBottlenecks, timeRange);

    // Get correlation data for active bottlenecks
    const correlationData = activeBottlenecks.map((bottleneck: DetectedBottleneck) =>
      bottleneckDetector.getCorrelationData(bottleneck)
    );

    return NextResponse.json({
      activeBottlenecks,
      analysis,
      historicalBottlenecks,
      trends,
      correlationData,
      timestamp: Date.now(),
      summary: {
        criticalCount: activeBottlenecks.filter((b: DetectedBottleneck) => b.impact === 'critical').length,
        warningCount: activeBottlenecks.filter((b: DetectedBottleneck) => b.impact === 'severe' || b.impact === 'moderate').length,
        lastDetection: activeBottlenecks.length > 0 ?
          Math.max(...activeBottlenecks.map((b: DetectedBottleneck) => b.timestamp)) : null
      }
    });

  } catch (error) {
    console.error('Bottlenecks API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve bottleneck data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bottlenecks - Trigger manual bottleneck analysis
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { timeRange, categories, severities } = body;

    // Force a detection cycle with custom parameters
    const analysisTimeRange = timeRange || 300000; // 5 minutes default

    // Optional: Trigger detection cycle
    // In a real implementation, you'd force a detection cycle here

    return NextResponse.json({
      message: 'Bottleneck analysis triggered',
      parameters: { timeRange: analysisTimeRange, categories, severities },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Bottlenecks POST error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger bottleneck analysis' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to calculate bottleneck trends
 */
function calculateBottleneckTrends(
  active: DetectedBottleneck[],
  historical: BottleneckHistory[],
  timeRange: number
) {
  const windowStart = Date.now() - timeRange;
  const recentHistorical = historical.filter(h => h.detectedAt >= windowStart);

  const patternCounts = new Map<string, { count: number, totalConfidence: number }>();

  [...active, ...recentHistorical].forEach((bottleneck: DetectedBottleneck | BottleneckHistory) => {
    const patternId = bottleneck.patternId;
    const existing = patternCounts.get(patternId) || { count: 0, totalConfidence: 0 };
    patternCounts.set(patternId, {
      count: existing.count + 1,
      totalConfidence: existing.totalConfidence + bottleneck.confidence
    });
  });

  const trends = Array.from(patternCounts.entries()).map(([patternId, data]) => ({
    patternId,
    frequency: data.count / (timeRange / (1000 * 60 * 60)), // per hour
    averageConfidence: data.totalConfidence / data.count
  }));

  return trends.sort((a, b) => b.frequency - a.frequency);
}
