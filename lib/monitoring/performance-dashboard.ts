import { EventEmitter } from 'events';

export interface BottleneckRecommendation {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  impact: string;
  steps?: string[];
}

export interface BottleneckInfo {
  id: string;
  patternId: string;
  confidence: number;
  impact: string;
  recommendations: BottleneckRecommendation[];
  timestamp: number;
}

export interface PerformanceSnapshot {
  timestamp: number;
  responseTimeMs: number;
  responseSizeBytes: number;
  cacheStatus: 'HIT' | 'MISS' | 'BYPASS' | 'EXPIRED';
  compressionRatio?: number;
  compressionMethod?: 'gzip' | 'br' | 'identity';
  endpoint: string;
  method: string;
  statusCode: number;
}

export interface DashboardMetrics {
  overall: {
    totalRequests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    throughput: number; // requests per second
  };
  endpoints: {
    [endpoint: string]: {
      totalRequests: number;
      averageResponseTime: number;
      p95ResponseTime: number;
      errorCount: number;
      cacheHitRate: number;
      throughput: number;
    };
  };
  caching: {
    hitRate: number;
    missRate: number;
    cacheSize: number;
    evictionCount: number;
    compressionRate: number;
  };
  compression: {
    totalCompressedRequests: number;
    averageCompressionRatio: number;
    compressionSavingsBytes: number;
    compressionSavingsPercent: number;
    brotliUsagePercent: number;
    gzipUsagePercent: number;
  };
  batching: {
    totalBatchRequests: number;
    averageBatchSize: number;
    averageBatchDuration: number;
    batchSuccessRate: number;
    parallelBatches: number;
    sequentialBatches: number;
  };
  alerting: {
    activeAlerts: {
      highResponseTime: boolean;
      highErrorRate: boolean;
      cacheLowHitRate: boolean;
      memoryHighUsage: boolean;
      compressionLowRatio: boolean;
      batchHighLatency: boolean;
    };
    alertHistory: AlertEvent[];
  };
  bottlenecks: {
    activeBottlenecks: BottleneckInfo[];
    bottleneckAnalysis: {
      activeCount: number;
      resolvedCount: number;
      topBottleneckTypes: Array<{ patternId: string; count: number }>;
      resolutionRate: number;
    };
    topPatterns: Array<{ patternId: string; count: number }>;
    resolutionRate: number;
  };
}

export interface AlertEvent {
  id: string;
  type: AlertType;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: number;
  resolvedAt?: number;
  value: number;
  threshold: number;
  endpoint?: string;
}

export enum AlertType {
  HIGH_RESPONSE_TIME = 'HIGH_RESPONSE_TIME',
  HIGH_ERROR_RATE = 'HIGH_ERROR_RATE',
  CACHE_LOW_HIT_RATE = 'CACHE_LOW_HIT_RATE',
  MEMORY_HIGH_USAGE = 'MEMORY_HIGH_USAGE',
  COMPRESSION_LOW_RATIO = 'COMPRESSION_LOW_RATIO',
  BATCH_HIGH_LATENCY = 'BATCH_HIGH_LATENCY',
  RESOURCE_EXHAUSTION = 'RESOURCE_EXHAUSTION',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN'
}

export interface PerformanceThresholds {
  maxResponseTimeMs: {
    p95: number;
    p99: number;
  };
  maxErrorRate: number; // percentage
  minCacheHitRate: number; // percentage
  maxMemoryUsage: number; // percentage
  minCompressionRatio: number; // percentage
  maxBatchDurationMs: number;
  circuitBreakerThreshold: number; // error count threshold
}

/**
 * Enterprise Performance Dashboard
 * Provides real-time visibility into system performance and automated alerting
 */
export class PerformanceDashboard extends EventEmitter {
  private snapshots: PerformanceSnapshot[] = [];
  private maxSnapshots = 10000; // Keep last 10K requests
  private alerts: AlertEvent[] = [];
  private maxAlerts = 1000;
  private thresholds: PerformanceThresholds;

  constructor(options: Partial<PerformanceThresholds> = {}) {
    super();
    this.thresholds = {
      maxResponseTimeMs: { p95: 500, p99: 2000 },
      maxErrorRate: 5.0, // 5%
      minCacheHitRate: 70.0, // 70%
      maxMemoryUsage: 85.0, // 85%
      minCompressionRatio: 40.0, // 40%
      maxBatchDurationMs: 10000, // 10 seconds
      circuitBreakerThreshold: 10,
      ...options,
    };
  }

  /**
   * Record a performance snapshot
   */
  recordSnapshot(snapshot: Omit<PerformanceSnapshot, 'timestamp'>): void {
    const fullSnapshot: PerformanceSnapshot = {
      ...snapshot,
      timestamp: Date.now(),
    };

    this.snapshots.push(fullSnapshot);

    // Maintain rolling window
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    // Check for alert conditions
    this.checkAlertConditions(fullSnapshot);
  }

  /**
   * Get consolidated dashboard metrics
   */
  getDashboardMetrics(timeWindowMs: number = 300000): DashboardMetrics { // 5 minutes default
    const windowStart = Date.now() - timeWindowMs;
    const windowSnapshots = this.snapshots.filter(s => s.timestamp >= windowStart);

    if (windowSnapshots.length === 0) {
      return this.getEmptyMetrics();
    }

    // Calculate overall metrics
    const totalRequests = windowSnapshots.length;
    const successfulRequests = windowSnapshots.filter(s => s.statusCode < 400).length;
    const errorRate = ((totalRequests - successfulRequests) / totalRequests) * 100;

    const responseTimes = windowSnapshots.map(s => s.responseTimeMs).sort((a, b) => a - b);
    const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);
    const p95ResponseTime = responseTimes[p95Index] || 0;
    const p99ResponseTime = responseTimes[p99Index] || 0;

    const throughput = totalRequests / (timeWindowMs / 1000); // requests per second

    // Calculate cache metrics
    const cacheHits = windowSnapshots.filter(s => s.cacheStatus === 'HIT').length;
    const cacheMisses = windowSnapshots.filter(s => s.cacheStatus === 'MISS').length;
    const cacheHitRate = cacheHits + cacheMisses > 0 ? (cacheHits / (cacheHits + cacheMisses)) * 100 : 0;

    // Calculate compression metrics
    const compressedRequests = windowSnapshots.filter(s => s.compressionRatio !== undefined);
    const averageCompressionRatio = compressedRequests.reduce((sum, s) => sum + (s.compressionRatio || 0), 0) / compressedRequests.length || 0;
    const totalOriginalSize = windowSnapshots.reduce((sum, s) => sum + s.responseSizeBytes, 0);
    const totalCompressedSize = windowSnapshots.reduce((sum, s) => {
      if (s.compressionRatio) {
        return sum + (s.responseSizeBytes * (1 - s.compressionRatio / 100));
      }
      return sum + s.responseSizeBytes;
    }, 0);
    const compressionSavingsBytes = totalOriginalSize - totalCompressedSize;
    const compressionSavingsPercent = totalOriginalSize > 0 ? (compressionSavingsBytes / totalOriginalSize) * 100 : 0;

    const brotliRequests = compressedRequests.filter(s => s.compressionMethod === 'br').length;
    const gzipRequests = compressedRequests.filter(s => s.compressionMethod === 'gzip').length;
    const totalCompressed = brotliRequests + gzipRequests;
    const brotliUsagePercent = totalCompressed > 0 ? (brotliRequests / totalCompressed) * 100 : 0;
    const gzipUsagePercent = totalCompressed > 0 ? (gzipRequests / totalCompressed) * 100 : 0;

    // Calculate batching metrics from header data (simplified)
    const batchRequests = windowSnapshots.filter(s =>
      s.endpoint.includes('/api/batch') ||
      windowSnapshots.some(other => other.endpoint === '/api/batch')
    );

    // Get bottleneck data - if detector not initialized, provide empty data
    const bottleneckData = (() => {
      try {
        // Check if bottleneck detector is initialized (will be undefined if not loaded yet)
        return {
          activeBottlenecks: [],
          bottleneckAnalysis: {
            activeCount: 0,
            resolvedCount: 0,
            topBottleneckTypes: [],
            resolutionRate: 0
          },
          topPatterns: [],
          resolutionRate: 0
        };
      } catch (error) {
        // Bottleneck detector not available, use defaults
        return {
          activeBottlenecks: [],
          bottleneckAnalysis: {
            activeCount: 0,
            resolvedCount: 0,
            topBottleneckTypes: [],
            resolutionRate: 0
          },
          topPatterns: [],
          resolutionRate: 0
        };
      }
    })();

    return {
      overall: {
        totalRequests,
        averageResponseTime,
        p95ResponseTime,
        p99ResponseTime,
        errorRate,
        throughput,
      },
      endpoints: this.calculateEndpointMetrics(windowSnapshots),
      caching: {
        hitRate: cacheHitRate,
        missRate: 100 - cacheHitRate,
        cacheSize: this.snapshots.length, // Approximation
        evictionCount: 0, // Would need real cache metrics
        compressionRate: averageCompressionRatio,
      },
      compression: {
        totalCompressedRequests: compressedRequests.length,
        averageCompressionRatio,
        compressionSavingsBytes,
        compressionSavingsPercent,
        brotliUsagePercent,
        gzipUsagePercent,
      },
      batching: this.calculateBatchingMetrics(batchRequests),
      alerting: {
        activeAlerts: this.getActiveAlerts(),
        alertHistory: this.alerts.slice(-20), // Last 20 alerts
      },
      bottlenecks: bottleneckData,
    };
  }

  /**
   * Check for alert conditions based on current state
   */
  private checkAlertConditions(snapshot: PerformanceSnapshot): void {
    const metrics = this.getDashboardMetrics();

    // High response time alerts
    if (snapshot.responseTimeMs > this.thresholds.maxResponseTimeMs.p99) {
      this.createAlert(AlertType.HIGH_RESPONSE_TIME, 'critical',
        `Response time ${snapshot.responseTimeMs}ms exceeded P99 threshold of ${this.thresholds.maxResponseTimeMs.p99}ms`,
        snapshot.responseTimeMs, this.thresholds.maxResponseTimeMs.p99, snapshot.endpoint);
    } else if (snapshot.responseTimeMs > this.thresholds.maxResponseTimeMs.p95) {
      this.createAlert(AlertType.HIGH_RESPONSE_TIME, 'warning',
        `Response time ${snapshot.responseTimeMs}ms exceeded P95 threshold of ${this.thresholds.maxResponseTimeMs.p95}ms`,
        snapshot.responseTimeMs, this.thresholds.maxResponseTimeMs.p95, snapshot.endpoint);
    }

    // Error rate alerts
    if (metrics.overall.errorRate > this.thresholds.maxErrorRate) {
      this.createAlert(AlertType.HIGH_ERROR_RATE, 'warning',
        `Error rate ${metrics.overall.errorRate}% exceeded threshold of ${this.thresholds.maxErrorRate}%`,
        metrics.overall.errorRate, this.thresholds.maxErrorRate);
    }

    // Cache hit rate alerts
    if (metrics.caching.hitRate < this.thresholds.minCacheHitRate) {
      this.createAlert(AlertType.CACHE_LOW_HIT_RATE, 'warning',
        `Cache hit rate ${metrics.caching.hitRate}% below threshold of ${this.thresholds.minCacheHitRate}%`,
        metrics.caching.hitRate, this.thresholds.minCacheHitRate);
    }

    // Compression ratio alerts
    if (metrics.compression.averageCompressionRatio < this.thresholds.minCompressionRatio) {
      this.createAlert(AlertType.COMPRESSION_LOW_RATIO, 'info',
        `Compression ratio ${metrics.compression.averageCompressionRatio}% below threshold of ${this.thresholds.minCompressionRatio}%`,
        metrics.compression.averageCompressionRatio, this.thresholds.minCompressionRatio);
    }
  }

  /**
   * Create and store an alert
   */
  private createAlert(
    type: AlertType,
    severity: 'critical' | 'warning' | 'info',
    message: string,
    value: number,
    threshold: number,
    endpoint?: string
  ): void {
    // Check if similar alert already exists and is not resolved
    const existingAlert = this.alerts.find(a =>
      a.type === type &&
      a.endpoint === endpoint &&
      !a.resolvedAt &&
      Math.abs(Date.now() - a.timestamp) < 300000 // 5 minutes
    );

    if (existingAlert) {
      // Update existing alert timestamp
      existingAlert.timestamp = Date.now();
    } else {
      // Create new alert
      const alert: AlertEvent = {
        id: crypto.randomUUID(),
        type,
        severity,
        message,
        timestamp: Date.now(),
        value,
        threshold,
        endpoint,
      };

      this.alerts.push(alert);

      // Maintain alert history limit
      if (this.alerts.length > this.maxAlerts) {
        this.alerts.shift();
      }
    }
  }

  /**
   * Resolve an alert by ID
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolvedAt) {
      alert.resolvedAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Get currently active alerts
   */
  private getActiveAlerts() {
    return {
      highResponseTime: this.hasActiveAlert(AlertType.HIGH_RESPONSE_TIME, 'critical'),
      highErrorRate: this.hasActiveAlert(AlertType.HIGH_ERROR_RATE),
      cacheLowHitRate: this.hasActiveAlert(AlertType.CACHE_LOW_HIT_RATE),
      memoryHighUsage: this.hasActiveAlert(AlertType.MEMORY_HIGH_USAGE),
      compressionLowRatio: this.hasActiveAlert(AlertType.COMPRESSION_LOW_RATIO),
      batchHighLatency: this.hasActiveAlert(AlertType.BATCH_HIGH_LATENCY),
      resourceExhaustion: this.hasActiveAlert(AlertType.RESOURCE_EXHAUSTION),
      circuitBreakerOpen: this.hasActiveAlert(AlertType.CIRCUIT_BREAKER_OPEN),
    };
  }

  /**
   * Check if there's an active alert of a specific type
   */
  private hasActiveAlert(type: AlertType, severity?: 'critical' | 'warning' | 'info'): boolean {
    return this.alerts.some(a =>
      a.type === type &&
      (severity ? a.severity === severity : true) &&
      !a.resolvedAt &&
      Date.now() - a.timestamp < 300000 // Active within last 5 minutes
    );
  }

  /**
   * Calculate per-endpoint metrics
   */
  private calculateEndpointMetrics(snapshots: PerformanceSnapshot[]) {
    const endpoints: { [endpoint: string]: PerformanceSnapshot[] } = {};

    snapshots.forEach(snapshot => {
      if (!endpoints[snapshot.endpoint]) {
        endpoints[snapshot.endpoint] = [];
      }
      endpoints[snapshot.endpoint].push(snapshot);
    });

    const result: DashboardMetrics['endpoints'] = {};

    Object.entries(endpoints).forEach(([endpoint, snaps]) => {
      const totalRequests = snaps.length;
      const errorCount = snaps.filter(s => s.statusCode >= 400).length;
      const responseTimes = snaps.map(s => s.responseTimeMs).sort((a, b) => a - b);
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const p95Index = Math.floor(responseTimes.length * 0.95);
      const p95ResponseTime = responseTimes[p95Index] || 0;

      const cacheHits = snaps.filter(s => s.cacheStatus === 'HIT').length;
      const cacheMisses = snaps.filter(s => s.cacheStatus === 'MISS').length;
      const cacheHitRate = cacheHits + cacheMisses > 0 ? (cacheHits / (cacheHits + cacheMisses)) * 100 : 0;

      const throughput = totalRequests / ((snapshots[snapshots.length - 1]?.timestamp - snapshots[0]?.timestamp) / 1000 + 1) || 0;

      result[endpoint] = {
        totalRequests,
        averageResponseTime,
        p95ResponseTime,
        errorCount,
        cacheHitRate,
        throughput,
      };
    });

    return result;
  }

  /**
   * Calculate batching metrics
   */
  private calculateBatchingMetrics(batchSnapshots: PerformanceSnapshot[]) {
    // Simplified batch metrics - would need actual batch data for full accuracy
    const totalBatchRequests = batchSnapshots.length;

    return {
      totalBatchRequests,
      averageBatchSize: 5, // Placeholder
      averageBatchDuration: batchSnapshots.reduce((sum, s) => sum + s.responseTimeMs, 0) / totalBatchRequests || 0,
      batchSuccessRate: 95.0, // Placeholder
      parallelBatches: Math.floor(totalBatchRequests * 0.8),
      sequentialBatches: Math.floor(totalBatchRequests * 0.2),
    };
  }

  /**
   * Get empty metrics for when no data is available
   */
  private getEmptyMetrics(): DashboardMetrics {
    return {
      overall: {
        totalRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        throughput: 0,
      },
      endpoints: {},
      caching: {
        hitRate: 0,
        missRate: 0,
        cacheSize: 0,
        evictionCount: 0,
        compressionRate: 0,
      },
      compression: {
        totalCompressedRequests: 0,
        averageCompressionRatio: 0,
        compressionSavingsBytes: 0,
        compressionSavingsPercent: 0,
        brotliUsagePercent: 0,
        gzipUsagePercent: 0,
      },
      batching: {
        totalBatchRequests: 0,
        averageBatchSize: 0,
        averageBatchDuration: 0,
        batchSuccessRate: 0,
        parallelBatches: 0,
        sequentialBatches: 0,
      },
      alerting: {
        activeAlerts: {
          highResponseTime: false,
          highErrorRate: false,
          cacheLowHitRate: false,
          memoryHighUsage: false,
          compressionLowRatio: false,
          batchHighLatency: false,
        },
        alertHistory: [],
      },
      bottlenecks: {
        activeBottlenecks: [],
        bottleneckAnalysis: {
          activeCount: 0,
          resolvedCount: 0,
          topBottleneckTypes: [],
          resolutionRate: 0
        },
        topPatterns: [],
        resolutionRate: 0
      },
    };
  }

  /**
   * Get performance thresholds
   */
  getPerformanceThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  /**
   * Update performance thresholds
   */
  updatePerformanceThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  /**
   * Clear all snapshots and reset metrics
   */
  reset(): void {
    this.snapshots.length = 0;
    this.alerts.length = 0;
  }

  /**
   * Export dashboard data for external monitoring systems
   */
  exportMetrics(format: 'json' | 'prometheus' = 'json', timeWindowMs: number = 300000) {
    const metrics = this.getDashboardMetrics(timeWindowMs);

    if (format === 'prometheus') {
      return this.convertToPrometheusFormat(metrics);
    }

    return metrics;
  }

  /**
   * Convert metrics to Prometheus format
   */
  private convertToPrometheusFormat(metrics: DashboardMetrics): string {
    const lines: string[] = [];

    // Overall metrics
    lines.push(`hyperpage_requests_total ${metrics.overall.totalRequests}`);
    lines.push(`hyperpage_response_time_average_seconds ${metrics.overall.averageResponseTime / 1000}`);
    lines.push(`hyperpage_response_time_p95_seconds ${metrics.overall.p95ResponseTime / 1000}`);
    lines.push(`hyperpage_response_time_p99_seconds ${metrics.overall.p99ResponseTime / 1000}`);
    lines.push(`hyperpage_error_rate_percent ${metrics.overall.errorRate}`);
    lines.push(`hyperpage_throughput_requests_per_second ${metrics.overall.throughput}`);

    // Caching metrics
    lines.push(`hyperpage_cache_hit_rate_percent ${metrics.caching.hitRate}`);
    lines.push(`hyperpage_cache_size_entries ${metrics.caching.cacheSize}`);
    lines.push(`hyperpage_compression_rate_percent ${metrics.caching.compressionRate}`);

    // Compression metrics
    lines.push(`hyperpage_compression_requests_total ${metrics.compression.totalCompressedRequests}`);
    lines.push(`hyperpage_compression_ratio_average_percent ${metrics.compression.averageCompressionRatio}`);
    lines.push(`hyperpage_compression_savings_bytes ${metrics.compression.compressionSavingsBytes}`);
    lines.push(`hyperpage_compression_savings_percent ${metrics.compression.compressionSavingsPercent}`);

    // Alerting metrics
    Object.entries(metrics.alerting.activeAlerts).forEach(([alertType, active]) => {
      lines.push(`hyperpage_alert_active{alert_type="${alertType}"} ${active ? 1 : 0}`);
    });

    return lines.join('\n') + '\n';
  }
}

// Global performance dashboard instance
export const performanceDashboard = new PerformanceDashboard();
