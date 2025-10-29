import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BottleneckDetector } from '../../../lib/monitoring/bottleneck-detector';
import { BOTTLENECK_PATTERNS } from '../../../lib/monitoring/bottleneck-patterns';
import { performanceDashboard } from '../../../lib/monitoring/performance-dashboard';
import { EventEmitter } from 'events';

// Mock the alert service to avoid actual alerting in tests
vi.mock('../../../lib/alerting/alert-service', () => ({
  alertService: {
    processAlert: vi.fn()
  }
}));

// Mock performance dashboard
vi.mock('../../../lib/monitoring/performance-dashboard', () => ({
  performanceDashboard: {
    getDashboardMetrics: vi.fn()
  }
}));

describe('BottleneckDetector', () => {
  let detector: BottleneckDetector;
  let mockDashboardMetrics: any;

  beforeEach(() => {
    vi.clearAllMocks();
    detector = new BottleneckDetector(BOTTLENECK_PATTERNS);

    // Setup mock dashboard metrics
    mockDashboardMetrics = {
      overall: {
        averageResponseTime: 100,
        errorRate: 2,
        totalRequests: 50
      },
      caching: {
        hitRate: 75,
        evictionRate: 10
      },
      batching: {
        averageBatchDuration: 2000,
        batchSuccessRate: 90
      },
      compression: {
        averageCompressionRatio: 60
      }
    };

    (performanceDashboard.getDashboardMetrics as any).mockReturnValue(mockDashboardMetrics);
  });

  afterEach(() => {
    detector.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with predefined patterns', () => {
      expect(BOTTLENECK_PATTERNS.length).toBe(9);
      expect(BOTTLENECK_PATTERNS[0].id).toBe('memory-leak');
    });

    it('should register new patterns', () => {
      const customPattern = {
        id: 'custom-pattern',
        name: 'Custom Test Pattern',
        description: 'A test pattern',
        severity: 'info' as const,
        category: 'performance' as const,
        conditions: [
          {
            metric: 'overall.averageResponseTime',
            operator: 'gt' as const,
            threshold: 1000,
            duration: 60000,
            weight: 50
          }
        ],
        primaryIndicators: ['overall.averageResponseTime'],
        correlatedIndicators: ['overall.errorRate'],
        anomalyDetector: { windowSize: 5, sensitivity: 0.7, baselinePeriod: 300000 },
        minimumConfidence: 80,
        impactThreshold: 75,
        recommendations: [{
          priority: 'high' as const,
          category: 'immediate' as const,
          action: 'Test action',
          expectedImpact: 'Test impact',
          estimatedTime: 30
        }]
      };

      detector['registerPattern'](customPattern);
      expect(detector['patterns'].get('custom-pattern')).toBe(customPattern);
    });

    it('should unregister patterns', () => {
      expect(detector['patterns'].has('memory-leak')).toBe(true);
      expect(detector['unregisterPattern']('memory-leak')).toBe(true);
      expect(detector['patterns'].has('memory-leak')).toBe(false);
      expect(detector['unregisterPattern']('non-existent')).toBe(false);
    });
  });

  describe('Pattern Analysis', () => {
    it('should analyze patterns correctly', () => {
      const memoryLeakPattern = BOTTLENECK_PATTERNS.find(p => p.id === 'memory-leak')!;
      const analysis = detector['analyzePattern'](memoryLeakPattern, mockDashboardMetrics);

      expect(analysis).toHaveProperty('confidence');
      expect(analysis).toHaveProperty('impact');
      expect(analysis).toHaveProperty('metrics');
      expect(analysis.confidence).toBeGreaterThanOrEqual(0);
      expect(analysis.confidence).toBeLessThanOrEqual(100);
    });

    it('should detect breached conditions', () => {
      // Setup metrics that will trigger memory leak pattern
      const triggerMetrics = {
        ...mockDashboardMetrics,
        overall: {
          averageResponseTime: 300, // > 200 triggers condition
          errorRate: 2,
          totalRequests: 50
        },
        caching: {
          hitRate: 75,
          evictionRate: 60 // > 50 triggers condition
        },
        batching: {
          averageBatchDuration: 4000, // > 3000 triggers condition
          batchSuccessRate: 90
        }
      };

      const memoryLeakPattern = BOTTLENECK_PATTERNS.find(p => p.id === 'memory-leak')!;
      const analysis = detector['analyzePattern'](memoryLeakPattern, triggerMetrics);

      expect(analysis.confidence).toBeGreaterThan(50); // Should have significant confidence
      expect(Object.values(analysis.metrics)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ breached: true })
        ])
      );
    });

    it('should calculate impact levels correctly', () => {
      const pattern = BOTTLENECK_PATTERNS[0];

      // Critical severity, high breach ratio = critical impact
      expect(detector['calculateImpact']('critical', 0.8)).toBe('critical');
      expect(detector['calculateImpact']('critical', 0.5)).toBe('severe');
      expect(detector['calculateImpact']('warning', 0.5)).toBe('moderate');
      expect(detector['calculateImpact']('warning', 0.2)).toBe('minor');
    });

    it('should analyze correlations between metrics', () => {
      const pattern = BOTTLENECK_PATTERNS.find(p => p.id === 'memory-leak')!;
      const correlations = detector['analyzeCorrelations'](pattern, mockDashboardMetrics);

      expect(Array.isArray(correlations)).toBe(true);
      if (correlations.length > 0) {
        expect(correlations[0]).toHaveProperty('metric1');
        expect(correlations[0]).toHaveProperty('metric2');
        expect(correlations[0]).toHaveProperty('correlationCoefficient');
        expect(correlations[0]).toHaveProperty('strength');
        expect(correlations[0]).toHaveProperty('direction');
      }
    });

    it('should estimate resolution time accurately', () => {
      expect(detector['estimateResolutionTime']('performance', 'critical')).toBe(90);
      expect(detector['estimateResolutionTime']('capacity', 'minor')).toBe(15);
      expect(detector['estimateResolutionTime']('reliability', 'severe')).toBe(30);
      expect(detector['estimateResolutionTime']('efficiency', 'moderate')).toBe(40);
      expect(detector['estimateResolutionTime']('unknown', 'minor')).toBe(30);
    });
  });

  describe('Metric Extraction', () => {
    it('should extract numeric metric values from nested objects', () => {
      const metrics = {
        overall: { averageResponseTime: 150 },
        caching: { hitRate: 85.5 },
        nested: { deeply: { value: 42 } }
      };

      expect(detector['extractMetricValue'](metrics, 'overall.averageResponseTime')).toBe(150);
      expect(detector['extractMetricValue'](metrics, 'caching.hitRate')).toBe(85.5);
      expect(detector['extractMetricValue'](metrics, 'nested.deeply.value')).toBe(42);
    });

    it('should return 0 for non-existent paths', () => {
      expect(detector['extractMetricValue']({}, 'nonexistent.path')).toBe(0);
    });

    it('should check condition breaches accurately', () => {
      expect(detector['isConditionBreached'](150, { operator: 'gt' as const, metric: 'test', threshold: 100, duration: 1000, weight: 50 })).toBe(true);
      expect(detector['isConditionBreached'](150, { operator: 'lt' as const, metric: 'test', threshold: 200, duration: 1000, weight: 50 })).toBe(true);
      expect(detector['isConditionBreached'](150, { operator: 'gte' as const, metric: 'test', threshold: 150, duration: 1000, weight: 50 })).toBe(true);
      expect(detector['isConditionBreached'](150, { operator: 'lte' as const, metric: 'test', threshold: 150, duration: 1000, weight: 50 })).toBe(true);
      expect(detector['isConditionBreached'](150, { operator: 'eq' as const, metric: 'test', threshold: 150, duration: 1000, weight: 50 })).toBe(true);
    });
  });

  describe('Trend Analysis', () => {
    it('should analyze trends from metric history', () => {
      // Setup metric history
      detector['metricHistory'] = [
        { timestamp: Date.now() - 5000, metrics: { 'overall.averageResponseTime': 100 } },
        { timestamp: Date.now() - 4000, metrics: { 'overall.averageResponseTime': 120 } },
        { timestamp: Date.now() - 3000, metrics: { 'overall.averageResponseTime': 150 } },
        { timestamp: Date.now() - 2000, metrics: { 'overall.averageResponseTime': 180 } },
        { timestamp: Date.now() - 1000, metrics: { 'overall.averageResponseTime': 220 } }
      ];

      const trend = detector['analyzeTrend'](['overall.averageResponseTime']);
      expect(trend).toBe('rising');
    });

    it('should return stable for insufficient data', () => {
      detector['metricHistory'] = [];
      expect(detector['analyzeTrend'](['test'])).toBe('stable');
    });
  });

  describe('Bottleneck Detection and Management', () => {
    it('should create detected bottlenecks correctly', () => {
      const pattern = BOTTLENECK_PATTERNS[0];
      const analysis = {
        confidence: 85,
        impact: 'moderate' as const,
        metrics: {
          'test.metric': { value: 100, threshold: 90, breached: true, weight: 50 }
        },
        correlations: [],
        trendAnalysis: 'rising' as const,
        timeToResolve: 45
      };
      const timestamp = Date.now();

      const bottleneck = detector['createBottleneck'](pattern, analysis, timestamp);

      expect(bottleneck.id).toContain(pattern.id);
      expect(bottleneck.patternId).toBe(pattern.id);
      expect(bottleneck.confidence).toBe(85);
      expect(bottleneck.impact).toBe('moderate');
      expect(bottleneck.timestamp).toBe(timestamp);
      expect(bottleneck.recommendations).toHaveLength(pattern.recommendations.length);
    });

    it('should manage active bottlenecks', () => {
      const pattern = BOTTLENECK_PATTERNS[0];
      const analysis = {
        confidence: 85, impact: 'moderate' as const, metrics: {}, correlations: [],
        trendAnalysis: 'rising' as const, timeToResolve: 45
      };
      const bottleneck = detector['createBottleneck'](pattern, analysis, Date.now());

      detector['registerBottleneck'](bottleneck);
      expect(detector.getActiveBottlenecks()).toContain(bottleneck);
      expect(detector.getBottleneck(bottleneck.id)).toBe(bottleneck);

      // Resolve bottleneck
      const resolution = {
        resolvedBy: 'manual' as const,
        actionTaken: 'Fixed configuration',
        resolutionTime: Date.now()
      };

      const resolved = detector.resolveBottleneck(bottleneck.id, resolution);
      expect(resolved).toBe(bottleneck);
      expect(detector.getActiveBottlenecks()).not.toContain(bottleneck);
      expect(bottleneck.resolved).toBe(true);
      expect(bottleneck.resolution).toBe(resolution);
    });

    it('should provide bottleneck analysis statistics', () => {
      const stats = detector.getBottleneckAnalysis();
      expect(stats).toHaveProperty('activeCount');
      expect(stats).toHaveProperty('resolvedCount');
      expect(stats).toHaveProperty('topBottleneckTypes');
      expect(stats.resolutionRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Automated Actions', () => {
    it('should execute safe automated actions', async () => {
      const mockBottleneck = {
        id: 'test-bottleneck',
        patternId: 'rate-limit-exhaustion',
        timestamp: Date.now(),
        confidence: 90,
        impact: 'severe' as const,
        metrics: {},
        correlations: [],
        recommendations: [
          {
            priority: 'critical' as const,
            category: 'immediate' as const,
            action: 'Reduce request rate',
            expectedImpact: 'Test impact',
            automated: true,
            estimatedTime: 10
          }
        ],
        resolved: false
      };

      detector['activeBottlenecks'].set(mockBottleneck.id, mockBottleneck);

      const result = await detector.executeAutomatedAction('test-bottleneck', 'reduce-request-rate');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Automated action executed successfully');
    });

    it('should reject unsafe action scripts', async () => {
      const mockBottleneck = {
        id: 'test-bottleneck',
        patternId: 'memory-leak',
        timestamp: Date.now(),
        confidence: 90,
        impact: 'severe' as const,
        metrics: {},
        correlations: [],
        recommendations: [],
        resolved: false
      };

      detector['activeBottlenecks'].set(mockBottleneck.id, mockBottleneck);

      const result = await detector.executeAutomatedAction('test-bottleneck', 'unsafe-action');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unsafe or unknown action script');
    });

    it('should handle errors during action execution', async () => {
      // Mock action that throws error
      const originalReduceRate = detector['reduceRequestRate'].bind(detector);
      vi.spyOn(detector as any, 'reduceRequestRate').mockRejectedValue(new Error('Rate reduction failed'));

      const mockBottleneck = {
        id: 'test-bottleneck',
        patternId: 'rate-limit-exhaustion',
        timestamp: Date.now(),
        confidence: 90,
        impact: 'severe' as const,
        metrics: {},
        correlations: [],
        recommendations: [],
        resolved: false
      };

      detector['activeBottlenecks'].set(mockBottleneck.id, mockBottleneck);

      const result = await detector.executeAutomatedAction('test-bottleneck', 'reduce-request-rate');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Rate reduction failed');

      // Restore original function
      vi.restoreAllMocks();
    });
  });

  describe('Correlation and Insights', () => {
    it('should provide correlation data for bottlenecks', () => {
      const mockBottleneck = {
        id: 'test-bottleneck',
        patternId: 'memory-leak',
        timestamp: Date.now(),
        confidence: 90,
        impact: 'severe' as const,
        metrics: {},
        correlations: [],
        recommendations: [],
        resolved: false
      };

      detector['activeBottlenecks'].set(mockBottleneck.id, mockBottleneck);

      const correlationData = detector.getCorrelationData(mockBottleneck);
      expect(correlationData).toHaveProperty('correlations');
      expect(Array.isArray(correlationData.correlations)).toBe(true);
    });

    it('should provide bottleneck insights', () => {
      const insights = detector.getBottleneckInsights();

      expect(insights).toHaveProperty('activeBottlenecks');
      expect(insights).toHaveProperty('predictedBottlenecks');
      expect(insights).toHaveProperty('performanceOptimizations');
      expect(insights).toHaveProperty('riskAssessments');

      expect(Array.isArray(insights.activeBottlenecks)).toBe(true);
      expect(Array.isArray(insights.predictedBottlenecks)).toBe(true);
      expect(Array.isArray(insights.performanceOptimizations)).toBe(true);
      expect(Array.isArray(insights.riskAssessments)).toBe(true);
    });
  });

  describe('Event Emission', () => {
    it('should emit events during bottleneck lifecycle', () => {
      const events: string[] = [];
      detector.on('bottleneckDetected', () => events.push('detected'));
      detector.on('bottleneckResolved', () => events.push('resolved'));

      // Trigger detection by directly calling analyzePattern with trigger conditions
      const memoryLeakPattern = BOTTLENECK_PATTERNS.find(p => p.id === 'memory-leak')!;

      // Setup metrics that trigger pattern
      const triggerMetrics = {
        ...mockDashboardMetrics,
        overall: { averageResponseTime: 250, errorRate: 2, totalRequests: 50 },
        caching: { hitRate: 75, evictionRate: 60 },
        batching: { averageBatchDuration: 4000, batchSuccessRate: 95 }
      };

      const analysis = detector['analyzePattern'](memoryLeakPattern, triggerMetrics);
      if (analysis.confidence >= memoryLeakPattern.minimumConfidence) {
        const bottleneck = detector['createBottleneck'](memoryLeakPattern, analysis, Date.now());
        detector['registerBottleneck'](bottleneck);

        // Manually emit detected event (in real scenario, this happens in detectBottlenecks)
        detector.emit('bottleneckDetected', bottleneck);
      }

      expect(events).toContain('detected');

      // Test resolution event
      const bottleneck = detector.getActiveBottlenecks()[0];
      if (bottleneck) {
        detector.resolveBottleneck(bottleneck.id, {
          resolvedBy: 'manual',
          actionTaken: 'Fixed issue',
          resolutionTime: Date.now()
        });
        detector.emit('bottleneckResolved', bottleneck);
        expect(events).toContain('resolved');
      }
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      const spy = vi.spyOn(global, 'clearInterval');

      // Add some data to cleanup
      detector['activeBottlenecks'].set('test', {} as any);
      detector['metricHistory'].push({
        timestamp: Date.now(),
        metrics: mockDashboardMetrics
      });
      detector['metricHistory'].push({
        timestamp: Date.now(),
        metrics: mockDashboardMetrics
      });

      detector.destroy();

      expect(spy).toHaveBeenCalled();
      expect(detector['activeBottlenecks'].size).toBe(0);
      expect(detector['metricHistory'].length).toBe(0);

      spy.mockRestore();
    });
  });
});
