import { BottleneckPattern } from './bottleneck-detector';

/**
 * Predefined bottleneck detection patterns for enterprise performance monitoring
 * These patterns identify common performance bottlenecks through metric correlations
 * and intelligent threshold analysis
 */
export const BOTTLENECK_PATTERNS: BottleneckPattern[] = [
  {
    id: 'memory-leak',
    name: 'Memory Leak Bottleneck',
    description: 'Rising memory usage with degrading response times and increasing GC activity',
    severity: 'critical',
    category: 'performance',

    conditions: [
      { metric: 'overall.averageResponseTime', operator: 'gt', threshold: 200, duration: 300000, weight: 30 },
      { metric: 'batching.averageBatchDuration', operator: 'gt', threshold: 3000, duration: 300000, weight: 25 },
      { metric: 'caching.evictionRate', operator: 'gt', threshold: 50, duration: 300000, weight: 45 }
    ],

    primaryIndicators: ['overall.averageResponseTime', 'caching.evictionRate'],
    correlatedIndicators: ['batching.averageBatchDuration', 'overall.p95ResponseTime'],

    anomalyDetector: {
      windowSize: 10,
      sensitivity: 0.7,
      baselinePeriod: 600000 // 10 minutes
    },
    minimumConfidence: 85,
    impactThreshold: 80,

    recommendations: [
      {
        priority: 'high',
        category: 'immediate',
        action: 'Investigate memory usage patterns and consider container restart',
        expectedImpact: 'Reduce memory pressure and improve response times',
        estimatedTime: 45,
        rolloutStrategy: 'immediate'
      },
      {
        priority: 'medium',
        category: 'preventative',
        action: 'Implement memory profiling to identify allocation patterns',
        expectedImpact: 'Prevent future memory leaks',
        estimatedTime: 120,
        rolloutStrategy: 'staged'
      },
      {
        priority: 'low',
        category: 'monitoring',
        action: 'Increase memory usage alert thresholds',
        expectedImpact: 'Earlier detection of memory issues',
        estimatedTime: 15,
        rolloutStrategy: 'immediate'
      }
    ],

    automatedActions: [
      {
        id: 'test-unsafe-action',
        name: 'Test Unsafe Action',
        script: 'unsafe-script-name',
        requiresApproval: false
      }
    ]
  },

  {
    id: 'cache-thrashing',
    name: 'Cache Thrashing Bottleneck',
    description: 'Low cache hit rate causing high database load and increased response times',
    severity: 'warning',
    category: 'performance',

    conditions: [
      { metric: 'caching.hitRate', operator: 'lt', threshold: 60, duration: 300000, weight: 40 },
      { metric: 'caching.evictionRate', operator: 'gt', threshold: 30, duration: 300000, weight: 35 },
      { metric: 'overall.averageResponseTime', operator: 'gt', threshold: 150, duration: 300000, weight: 25 }
    ],

    primaryIndicators: ['caching.hitRate', 'caching.evictionRate'],
    correlatedIndicators: ['overall.averageResponseTime'],

    anomalyDetector: {
      windowSize: 8,
      sensitivity: 0.6,
      baselinePeriod: 480000 // 8 minutes
    },
    minimumConfidence: 80,
    impactThreshold: 70,

    recommendations: [
      {
        priority: 'high',
        category: 'configuration',
        action: 'Increase cache memory allocation and review cache key strategy',
        expectedImpact: 'Improve hit rates and reduce database load',
        automated: false,
        estimatedTime: 60,
        rolloutStrategy: 'gradual'
      },
      {
        priority: 'medium',
        category: 'configuration',
        action: 'Implement cache warming for frequently accessed data',
        expectedImpact: 'Reduce cold start latency',
        automated: false,
        estimatedTime: 90,
        rolloutStrategy: 'staged'
      }
    ]
  },

  {
    id: 'rate-limit-exhaustion',
    name: 'Rate Limit Exhaustion Bottleneck',
    description: 'Platform rate limits causing throttling, errors, and degraded performance',
    severity: 'critical',
    category: 'reliability',

    conditions: [
      { metric: 'overall.errorRate', operator: 'gt', threshold: 10, duration: 60000, weight: 30 },
      { metric: 'batching.successRate', operator: 'lt', threshold: 90, duration: 300000, weight: 35 },
      { metric: 'batching.batchSuccessRate', operator: 'lt', threshold: 95, duration: 300000, weight: 35 }
    ],

    primaryIndicators: ['overall.errorRate', 'batching.successRate'],
    correlatedIndicators: ['batching.batchSuccessRate', 'batching.averageBatchDuration'],

    anomalyDetector: {
      windowSize: 5,
      sensitivity: 0.8,
      baselinePeriod: 180000 // 3 minutes
    },
    minimumConfidence: 85,
    impactThreshold: 85,

    recommendations: [
      {
        priority: 'critical',
        category: 'immediate',
        action: 'Reduce request frequency by 30% and enable exponential backoff',
        expectedImpact: 'Prevent API throttling and service degradation',
        automated: true,
        estimatedTime: 5,
        rolloutStrategy: 'immediate'
      },
      {
        priority: 'high',
        category: 'configuration',
        action: 'Request platform rate limit increase or implement load distribution',
        expectedImpact: 'Increase available requests per minute',
        automated: false,
        estimatedTime: 480, // Next business day
        rolloutStrategy: 'coordinated'
      },
      {
        priority: 'medium',
        category: 'preventative',
        action: 'Implement smart retry logic with circuit breaker pattern',
        expectedImpact: 'More resilient API consumption',
        automated: false,
        estimatedTime: 180,
        rolloutStrategy: 'staged'
      }
    ],

    automatedActions: [
      {
        id: 'reduce-request-rate',
        name: 'Reduce Request Rate',
        script: 'reduce-request-rate',
        requiresApproval: true
      }
    ]
  },

  {
    id: 'database-connection-pool-exhaustion',
    name: 'Database Connection Pool Exhaustion',
    description: 'Connection pool exhausted causing request queuing and timeouts',
    severity: 'critical',
    category: 'capacity',

    conditions: [
      { metric: 'overall.p95ResponseTime', operator: 'gt', threshold: 2000, duration: 60000, weight: 40 },
      { metric: 'overall.errorRate', operator: 'gt', threshold: 5, duration: 300000, weight: 30 },
      { metric: 'overall.totalRequests', operator: 'gt', threshold: 100, duration: 30000, weight: 30 } // High throughput
    ],

    primaryIndicators: ['overall.p95ResponseTime', 'overall.errorRate'],
    correlatedIndicators: ['overall.averageResponseTime', 'overall.totalRequests'],

    anomalyDetector: {
      windowSize: 6,
      sensitivity: 0.75,
      baselinePeriod: 240000 // 4 minutes
    },
    minimumConfidence: 90,
    impactThreshold: 85,

    recommendations: [
      {
        priority: 'high',
        category: 'configuration',
        action: 'Increase connection pool size and optimize query efficiency',
        expectedImpact: 'Reduce request queuing and improve response times',
        automated: false,
        estimatedTime: 30,
        rolloutStrategy: 'immediate'
      },
      {
        priority: 'high',
        category: 'immediate',
        action: 'Implement connection pooling monitoring and alerts',
        expectedImpact: 'Early detection of pool exhaustion',
        automated: false,
        estimatedTime: 15,
        rolloutStrategy: 'immediate'
      },
      {
        priority: 'medium',
        category: 'preventative',
        action: 'Review and optimize database queries for better efficiency',
        expectedImpact: 'Reduced lock times and faster query execution',
        automated: false,
        estimatedTime: 120,
        rolloutStrategy: 'staged'
      }
    ]
  },

  {
    id: 'compression-efficiency-degradation',
    name: 'Compression Efficiency Degradation',
    description: 'Poor compression ratios causing high bandwidth usage and slower responses',
    severity: 'info',
    category: 'efficiency',

    conditions: [
      { metric: 'compression.averageCompressionRatio', operator: 'lt', threshold: 40, duration: 300000, weight: 50 },
      { metric: 'overall.averageResponseTime', operator: 'gt', threshold: 100, duration: 300000, weight: 30 },
      { metric: 'compression.compressionSavingsBytes', operator: 'lt', threshold: 50000, duration: 300000, weight: 20 } // 50KB minimum
    ],

    primaryIndicators: ['compression.averageCompressionRatio'],
    correlatedIndicators: ['overall.averageResponseTime', 'compression.compressionSavingsBytes'],

    anomalyDetector: {
      windowSize: 12,
      sensitivity: 0.4,
      baselinePeriod: 600000 // 10 minutes
    },
    minimumConfidence: 65,
    impactThreshold: 60,

    recommendations: [
      {
        priority: 'medium',
        category: 'configuration',
        action: 'Optimize compression algorithm selection (Broti vs Gzip)',
        expectedImpact: 'Better compression ratios and lower bandwidth',
        automated: false,
        estimatedTime: 45,
        rolloutStrategy: 'gradual'
      },
      {
        priority: 'low',
        category: 'monitoring',
        action: 'Monitor compression ratios and adjust based on content types',
        expectedImpact: 'Optimized compression for different response types',
        automated: false,
        estimatedTime: 30,
        rolloutStrategy: 'ongoing'
      }
    ]
  },

  {
    id: 'batch-processing-overload',
    name: 'Batch Processing Overload',
    description: 'Batch operations overwhelmed causing high latency and individual failures',
    severity: 'warning',
    category: 'performance',

    conditions: [
      { metric: 'batching.averageBatchDuration', operator: 'gt', threshold: 5000, duration: 300000, weight: 40 },
      { metric: 'batching.batchSuccessRate', operator: 'lt', threshold: 85, duration: 300000, weight: 35 },
      { metric: 'batching.averageBatchSize', operator: 'gt', threshold: 15, duration: 300000, weight: 25 }
    ],

    primaryIndicators: ['batching.averageBatchDuration', 'batching.batchSuccessRate'],
    correlatedIndicators: ['batching.averageBatchSize'],

    anomalyDetector: {
      windowSize: 8,
      sensitivity: 0.65,
      baselinePeriod: 480000 // 8 minutes
    },
    minimumConfidence: 75,
    impactThreshold: 70,

    recommendations: [
      {
        priority: 'high',
        category: 'configuration',
        action: 'Reduce batch sizes and implement adaptive batching',
        expectedImpact: 'Lower latency and higher success rates',
        automated: true,
        estimatedTime: 10,
        rolloutStrategy: 'immediate'
      },
      {
        priority: 'medium',
        category: 'configuration',
        action: 'Implement batch priority queuing (critical requests first)',
        expectedImpact: 'Better handling of critical operations',
        automated: false,
        estimatedTime: 90,
        rolloutStrategy: 'staged'
      },
      {
        priority: 'low',
        category: 'preventative',
        action: 'Add batch performance profiling and optimization',
        expectedImpact: 'Ongoing batch performance improvements',
        automated: false,
        estimatedTime: 60,
        rolloutStrategy: 'ongoing'
      }
    ],

    automatedActions: [
      {
        id: 'reduce-batch-size',
        name: 'Reduce Batch Size',
        script: 'reduce-batch-size',
        requiresApproval: false
      }
    ]
  },

  {
    id: 'circuit-breaker-failover',
    name: 'Circuit Breaker Failover Triggered',
    description: 'Circuit breaker activated, indicating persistent service issues',
    severity: 'critical',
    category: 'reliability',

    conditions: [
      { metric: 'overall.errorRate', operator: 'gt', threshold: 25, duration: 60000, weight: 50 },
      { metric: 'overall.p95ResponseTime', operator: 'gt', threshold: 5000, duration: 300000, weight: 30 },
      { metric: 'batching.batchSuccessRate', operator: 'lt', threshold: 50, duration: 60000, weight: 20 }
    ],

    primaryIndicators: ['overall.errorRate', 'overall.p95ResponseTime'],
    correlatedIndicators: ['batching.batchSuccessRate'],

    anomalyDetector: {
      windowSize: 4,
      sensitivity: 0.9,
      baselinePeriod: 120000 // 2 minutes
    },
    minimumConfidence: 95,
    impactThreshold: 90,

    recommendations: [
      {
        priority: 'critical',
        category: 'immediate',
        action: 'Investigate upstream service availability and implement failover',
        expectedImpact: 'Prevent total service degradation',
        automated: false,
        estimatedTime: 30,
        rolloutStrategy: 'immediate'
      },
      {
        priority: 'critical',
        category: 'immediate',
        action: 'Activate circuit breaker fast-fail mode',
        expectedImpact: 'Prevent cascade failures',
        automated: true,
        estimatedTime: 5,
        rolloutStrategy: 'immediate'
      },
      {
        priority: 'high',
        category: 'preventative',
        action: 'Implement alternative service routes and backup endpoints',
        expectedImpact: 'Better service resilience',
        automated: false,
        estimatedTime: 240,
        rolloutStrategy: 'planned'
      }
    ],

    automatedActions: [
      {
        id: 'enable-circuit-breaker',
        name: 'Enable Circuit Breaker',
        script: 'enable-circuit-breaker',
        requiresApproval: true
      }
    ]
  },

  {
    id: 'high-throughput-saturation',
    name: 'High Throughput Saturation',
    description: 'System throughput approaching capacity limits requiring scaling',
    severity: 'warning',
    category: 'capacity',

    conditions: [
      { metric: 'overall.throughput', operator: 'gt', threshold: 900, duration: 60000, weight: 35 }, // 900+ rps
      { metric: 'overall.averageResponseTime', operator: 'gt', threshold: 100, duration: 300000, weight: 35 },
      { metric: 'overall.p95ResponseTime', operator: 'gt', threshold: 300, duration: 300000, weight: 30 }
    ],

    primaryIndicators: ['overall.throughput', 'overall.averageResponseTime'],
    correlatedIndicators: ['overall.p95ResponseTime'],

    anomalyDetector: {
      windowSize: 10,
      sensitivity: 0.55,
      baselinePeriod: 600000 // 10 minutes
    },
    minimumConfidence: 70,
    impactThreshold: 75,

    recommendations: [
      {
        priority: 'high',
        category: 'configuration',
        action: 'Scale horizontally by adding more pods/instances',
        expectedImpact: 'Increase overall capacity',
        automated: false,
        estimatedTime: 120,
        rolloutStrategy: 'immediate'
      },
      {
        priority: 'medium',
        category: 'configuration',
        action: 'Enable request queuing and load shedding for non-critical requests',
        expectedImpact: 'Maintain service for priority operations',
        automated: false,
        estimatedTime: 60,
        rolloutStrategy: 'staged'
      },
      {
        priority: 'low',
        category: 'monitoring',
        action: 'Adjust scaling thresholds and monitor growth patterns',
        expectedImpact: 'Proactive scaling decisions',
        automated: false,
        estimatedTime: 45,
        rolloutStrategy: 'ongoing'
      }
    ]
  },

  {
    id: 'persistent-slow-operations',
    name: 'Persistent Slow Operations',
    description: 'Consistently slow operations indicating underlying performance issues',
    severity: 'warning',
    category: 'performance',

    conditions: [
      { metric: 'overall.p95ResponseTime', operator: 'gt', threshold: 500, duration: 900000, weight: 40 }, // 15 minutes
      { metric: 'overall.averageResponseTime', operator: 'gt', threshold: 100, duration: 900000, weight: 40 },
      { metric: 'caching.hitRate', operator: 'lt', threshold: 75, duration: 900000, weight: 20 }
    ],

    primaryIndicators: ['overall.p95ResponseTime', 'overall.averageResponseTime'],
    correlatedIndicators: ['caching.hitRate', 'compression.averageCompressionRatio'],

    anomalyDetector: {
      windowSize: 15,
      sensitivity: 0.5,
      baselinePeriod: 1800000 // 30 minutes
    },
    minimumConfidence: 85,
    impactThreshold: 80,

    recommendations: [
      {
        priority: 'high',
        category: 'configuration',
        action: 'Conduct comprehensive performance profiling and optimization',
        expectedImpact: 'Identify and fix underlying performance bottlenecks',
        automated: false,
        estimatedTime: 300, // 5 hours
        rolloutStrategy: 'focused'
      },
      {
        priority: 'medium',
        category: 'immediate',
        action: 'Implement response time profiling and slow query detection',
        expectedImpact: 'Identify specific operations causing slowness',
        automated: false,
        estimatedTime: 90,
        rolloutStrategy: 'immediate'
      },
      {
        priority: 'low',
        category: 'preventative',
        action: 'Establish regular performance baseline testing',
        expectedImpact: 'Continuous performance monitoring and improvement',
        automated: false,
        estimatedTime: 180,
        rolloutStrategy: 'ongoing'
      }
    ]
  }
];

/**
 * Get all predefined bottleneck patterns
 */
export function getAllBottleneckPatterns(): BottleneckPattern[] {
  return [...BOTTLENECK_PATTERNS];
}

/**
 * Get patterns by category
 */
export function getPatternsByCategory(category: string): BottleneckPattern[] {
  return BOTTLENECK_PATTERNS.filter(pattern => pattern.category === category);
}

/**
 * Get patterns by severity
 */
export function getPatternsBySeverity(severity: 'critical' | 'warning' | 'info'): BottleneckPattern[] {
  return BOTTLENECK_PATTERNS.filter(pattern => pattern.severity === severity);
}

/**
 * Get a specific pattern by ID
 */
export function getBottleneckPattern(id: string): BottleneckPattern | undefined {
  return BOTTLENECK_PATTERNS.find(pattern => pattern.id === id);
}

/**
 * Get patterns suitable for quick detection (high confidence, low false positive rate)
 */
export function getQuickDetectionPatterns(): BottleneckPattern[] {
  return BOTTLENECK_PATTERNS.filter(pattern =>
    pattern.minimumConfidence >= 80 &&
    pattern.category !== 'efficiency' // Skip efficiency issues for quick detection
  );
}
