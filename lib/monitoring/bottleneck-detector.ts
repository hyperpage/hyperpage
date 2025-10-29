import { performanceDashboard, DashboardMetrics, AlertType } from '../monitoring/performance-dashboard';
import { alertService } from '../alerting/alert-service';
import { EventEmitter } from 'events';
import logger from '../logger';

export interface BottleneckCondition {
  metric: string;           // e.g., 'overall.averageResponseTime'
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number;
  duration: number;         // ms over which condition must hold
  weight: number;           // Contribution to confidence score 0-100
}

export interface AnomalyDetector {
  windowSize: number;       // Historical data points to analyze
  sensitivity: number;      // 0-1, how sensitive to changes
  baselinePeriod: number;   // ms, how long baseline should be
}

export interface BottleneckPattern {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'performance' | 'capacity' | 'reliability' | 'efficiency';

  // Detection Rules
  conditions: BottleneckCondition[];

  // Correlation Analysis
  primaryIndicators: string[];     // Main symptoms
  correlatedIndicators: string[];  // Supporting metrics

  // Analysis Rules
  anomalyDetector: AnomalyDetector;
  minimumConfidence: number;       // 0-100%
  impactThreshold: number;         // Impact score threshold

  // Recommendations
  recommendations: BottleneckRecommendation[];
  automatedActions?: AutomatedAction[];
}

export interface BottleneckRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'immediate' | 'preventative' | 'configuration' | 'monitoring';
  action: string;
  expectedImpact: string;
  automated?: boolean;             // Can this be auto-executed?
  estimatedTime?: number;           // Minutes to resolve if manually
  rolloutStrategy?: string;        // How to safely implement
}

export interface AutomatedAction {
  id: string;
  name: string;
  script: string;             // Executable script or function name
  rollbackScript?: string;    // How to undo if needed
  requiresApproval: boolean;  // Needs human confirmation?
}

export interface Correlation {
  metric1: string;
  metric2: string;
  correlationCoefficient: number;  // -1 to 1
  strength: 'weak' | 'moderate' | 'strong' | 'very_strong';
  direction: 'positive' | 'negative' | 'neutral';
}

export interface BottleneckAnalysis {
  confidence: number;
  impact: 'minor' | 'moderate' | 'severe' | 'critical';
  metrics: Record<string, { value: number; threshold: number; breached: boolean; weight: number }>;
  correlations: Correlation[];
  trendAnalysis: 'rising' | 'falling' | 'stable' | 'erratic';
  timeToResolve: number;  // Estimated minutes
}

export interface DetectedBottleneck {
  id: string;
  patternId: string;
  timestamp: number;
  confidence: number;
  impact: 'minor' | 'moderate' | 'severe' | 'critical';
  metrics: Record<string, { value: number; threshold: number; breached: boolean }>;
  correlations: Correlation[];
  recommendations: BottleneckRecommendation[];
  resolution?: BottleneckResolution;
  resolved?: boolean;
  resolutionTime?: number;
}

export interface BottleneckResolution {
  resolvedBy: 'automatic' | 'manual';
  actionTaken: string;
  resolutionTime?: number;
  followUpActions?: string[];
}

export interface BottleneckHistory {
  bottleneckId: string;
  patternId: string;
  detectedAt: number;
  resolvedAt?: number;
  confidence: number;
  actionsTaken: string[];
  lessonsLearned?: string;
}

/**
 * Enterprise Bottleneck Detection Service
 * Automatically identifies performance bottlenecks through intelligent pattern recognition
 * and correlation analysis of multiple system metrics
 */
export class BottleneckDetector extends EventEmitter {
  private patterns: Map<string, BottleneckPattern> = new Map();
  private activeBottlenecks: Map<string, DetectedBottleneck> = new Map();
  private historicalBottlenecks: BottleneckHistory[] = [];
  private metricHistory: MetricHistory[] = [];
  private periodicCheck: NodeJS.Timeout;
  private maxHistorySize = 10000;

  constructor(patterns: BottleneckPattern[]) {
    super();

    // Load predefined patterns
    patterns.forEach(pattern => this.patterns.set(pattern.id, pattern));

    // Start periodic bottleneck detection
    this.periodicCheck = setInterval(() => {
      this.detectBottlenecks();
    }, 30000); // Check every 30 seconds

    logger.info('BottleneckDetector initialized', {
      patternCount: patterns.length,
      checkInterval: 30000
    });
  }

  /**
   * Register a new bottleneck pattern
   */
  registerPattern(pattern: BottleneckPattern): void {
    this.patterns.set(pattern.id, pattern);
    logger.info('Bottleneck pattern registered', {
      patternId: pattern.id,
      name: pattern.name,
      severity: pattern.severity
    });
  }

  /**
   * Unregister a bottleneck pattern
   */
  unregisterPattern(patternId: string): boolean {
    const removed = this.patterns.delete(patternId);
    if (removed) {
      logger.info('Bottleneck pattern unregistered', { patternId });
    }
    return removed;
  }

  /**
   * Main detection loop - identifies active bottlenecks
   */
  private detectBottlenecks(): void {
    try {
      const metrics = performanceDashboard.getDashboardMetrics(300000); // 5 minute analysis window
      const currentTime = Date.now();

      // Update metric history for trend analysis
      this.updateMetricHistory(metrics, currentTime);

      // Analyze each pattern for bottlenecks
      for (const [patternId, pattern] of this.patterns) {
        try {
          const analysis = this.analyzePattern(pattern, metrics);

          if (analysis.confidence >= pattern.minimumConfidence) {
            // Bottleneck detected!
            const bottleneck = this.createBottleneck(pattern, analysis, currentTime);
            this.registerBottleneck(bottleneck);

            logger.warn('Botleneck detected', {
              patternId: pattern.id,
              name: pattern.name,
              confidence: analysis.confidence,
              impact: analysis.impact,
              recommendationCount: pattern.recommendations.length
            });

            // Emit event for alerting and dashboard integration
            this.emit('bottleneckDetected', bottleneck);

            // Send alert if critical enough
            if (pattern.severity === 'critical' || analysis.impact === 'critical') {
              this.sendBottleneckAlert(bottleneck, pattern);
            }
          }
        } catch (error) {
          logger.error('Error analyzing pattern', {
            patternId: pattern.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } catch (error) {
      logger.error('Error in bottleneck detection loop', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Analyze a specific pattern against current metrics
   */
  private analyzePattern(pattern: BottleneckPattern, metrics: DashboardMetrics): BottleneckAnalysis {
    const analysis: BottleneckAnalysis = {
      confidence: 0,
      impact: 'minor',
      metrics: {},
      correlations: [],
      trendAnalysis: 'stable',
      timeToResolve: 0
    };

    try {
      // Check all conditions and calculate confidence
      let totalConfidence = 0;
      let breachedConditionCount = 0;

      for (const condition of pattern.conditions) {
        const metricValue = this.extractMetricValue(metrics, condition.metric);
        const breached = this.isConditionBreached(metricValue, condition);
        const weight = breached ? condition.weight : 0;

        // Store metric state
        analysis.metrics[condition.metric] = {
          value: metricValue,
          threshold: condition.threshold,
          breached,
          weight
        };

        if (breached) {
          totalConfidence += weight;
          breachedConditionCount++;
        }
      }

      // Normalize confidence (max 100)
      analysis.confidence = Math.min(100, totalConfidence);

      // Calculate impact based on confidence and severity
      analysis.impact = this.calculateImpact(pattern.severity, breachedConditionCount / pattern.conditions.length);

      // Analyze correlations between metrics
      analysis.correlations = this.analyzeCorrelations(pattern, metrics);

      // Perform trend analysis
      analysis.trendAnalysis = this.analyzeTrend(pattern.primaryIndicators);

      // Estimate time to resolve (placeholder - can be made more sophisticated)
      analysis.timeToResolve = this.estimateResolutionTime(pattern.category, analysis.impact);

    } catch (error) {
      logger.error('Error in pattern analysis', {
        patternId: pattern.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return analysis;
  }

  /**
   * Create a detected bottleneck from analysis results
   */
  private createBottleneck(
    pattern: BottleneckPattern,
    analysis: BottleneckAnalysis,
    timestamp: number
  ): DetectedBottleneck {
    const suggestions = pattern.recommendations.map(rec => ({
      ...rec,
      automated: rec.automated || false,
      rolloutStrategy: rec.rolloutStrategy || 'immediate'
    }));

    return {
      id: `bottleneck-${pattern.id}-${timestamp}`,
      patternId: pattern.id,
      timestamp,
      confidence: analysis.confidence,
      impact: analysis.impact,
      metrics: Object.fromEntries(
        Object.entries(analysis.metrics).map(([key, value]) => [
          key,
          {
            value: value.value,
            threshold: value.threshold,
            breached: value.breached
          }
        ])
      ),
      correlations: analysis.correlations,
      recommendations: suggestions,
      resolved: false
    };
  }

  /**
   * Register a newly detected bottleneck
   */
  private registerBottleneck(bottleneck: DetectedBottleneck): void {
    this.activeBottlenecks.set(bottleneck.id, bottleneck);
    logger.info('Bottleneck registered', {
      bottleneckId: bottleneck.id,
      patternId: bottleneck.patternId,
      impact: bottleneck.impact
    });
  }

  /**
   * Send alert for critical bottleneck
   */
  private sendBottleneckAlert(bottleneck: DetectedBottleneck, pattern: BottleneckPattern): void {
    try {
      const primaryRecommendation = bottleneck.recommendations
        .find(rec => rec.priority === 'critical' || rec.priority === 'high');

      alertService.processAlert({
        id: `bottleneck-${bottleneck.id}-${Date.now()}`,
        type: AlertType.RESOURCE_EXHAUSTION,
        severity: pattern.severity === 'critical' ? 'critical' : 'warning',
        message: `🔍 Bottleneck detected: ${pattern.name} (${bottleneck.confidence.toFixed(1)}% confidence). ${primaryRecommendation ?
          '💡 Immediate action recommended: ' + primaryRecommendation.action : '📊 See /api/bottlenecks for details.'}`,
        timestamp: bottleneck.timestamp,
        value: bottleneck.confidence,
        threshold: pattern.minimumConfidence,
        endpoint: `/api/bottlenecks/${bottleneck.id}`
      });
    } catch (error) {
      logger.error('Failed to send bottleneck alert', {
        bottleneckId: bottleneck.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Extract metric value from dashboard metrics object
   */
  private extractMetricValue(metrics: DashboardMetrics | Record<string, any>, path: string): number {
    try {
      // Type-safe extraction for known metric paths
      switch (path) {
        case 'overall.averageResponseTime':
          return metrics.overall?.averageResponseTime ?? (metrics as any)['overall.averageResponseTime'] ?? 0;
        case 'overall.errorRate':
          return metrics.overall?.errorRate ?? (metrics as any)['overall.errorRate'] ?? 0;
        case 'caching.hitRate':
          return metrics.caching?.hitRate ?? (metrics as any)['caching.hitRate'] ?? 0;
        case 'compression.averageCompressionRatio':
          return metrics.compression?.averageCompressionRatio ?? (metrics as any)['compression.averageCompressionRatio'] ?? 0;
        case 'overall.totalRequests':
          return metrics.overall?.totalRequests ?? (metrics as any)['overall.totalRequests'] ?? 0;
        case 'overall.p95ResponseTime':
          return metrics.overall?.p95ResponseTime ?? (metrics as any)['overall.p95ResponseTime'] ?? 0;
        case 'overall.p99ResponseTime':
          return metrics.overall?.p99ResponseTime ?? (metrics as any)['overall.p99ResponseTime'] ?? 0;
        case 'overall.throughput':
          return metrics.overall?.throughput ?? (metrics as any)['overall.throughput'] ?? 0;
        // Handle caching.evictionRate and other known but potentially missing fields
        case 'caching.evictionRate':
          return (metrics.caching as any)?.evictionRate ?? (metrics as any)['caching.evictionRate'] ?? 0;
        case 'batching.averageBatchDuration':
          return (metrics.batching as any)?.averageBatchDuration ?? (metrics as any)['batching.averageBatchDuration'] ?? 0;
        case 'batching.batchSuccessRate':
          return (metrics.batching as any)?.batchSuccessRate ?? (metrics as any)['batching.batchSuccessRate'] ?? 0;
        default:
          // For unknown paths (including test-specific flat paths), use flat key lookup first
          if (typeof metrics === 'object' && path in metrics && typeof (metrics as any)[path] === 'number') {
            return (metrics as any)[path];
          }

          // Fall back to generic navigation for nested paths
          const keys = path.split('.');
          let current: any = metrics;
          for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (!current || typeof current !== 'object' || !(key in current)) {
              return 0;
            }
            current = current[key];
            // Last key must be a number, intermediate keys must be objects
            if (i === keys.length - 1) {
              return typeof current === 'number' ? current : 0;
            } else if (typeof current !== 'object') {
              return 0;
            }
          }
          return 0; // Should not reach here
      }
    } catch {
      return 0;
    }
  }

  /**
   * Check if a condition is breached
   */
  private isConditionBreached(value: number, condition: BottleneckCondition): boolean {
    switch (condition.operator) {
      case 'gt': return value > condition.threshold;
      case 'lt': return value < condition.threshold;
      case 'gte': return value >= condition.threshold;
      case 'lte': return value <= condition.threshold;
      case 'eq': return value === condition.threshold;
      default: return false;
    }
  }

  /**
   * Analyze correlations between pattern indicators
   */
  private analyzeCorrelations(pattern: BottleneckPattern, metrics: DashboardMetrics): Correlation[] {
    const correlations: Correlation[] = [];
    const allIndicators = [pattern.primaryIndicators, pattern.correlatedIndicators].flat();

    // Simple correlation analysis - could be enhanced with statistical methods
    for (let i = 0; i < allIndicators.length; i++) {
      for (let j = i + 1; j < allIndicators.length; j++) {
        const metric1 = allIndicators[i];
        const metric2 = allIndicators[j];

        const value1 = this.extractMetricValue(metrics, metric1);
        const value2 = this.extractMetricValue(metrics, metric2);

        // Simple correlation coefficient approximation
        // In a real system, you'd use actual statistical correlation
        const correlation = this.calculateCorrelation([value1], [value2]);

        if (Math.abs(correlation) > 0.5) { // Only significant correlations
          correlations.push({
            metric1,
            metric2,
            correlationCoefficient: correlation,
            strength: this.getCorrelationStrength(correlation),
            direction: correlation > 0.1 ? 'positive' :
                     correlation < -0.1 ? 'negative' : 'neutral'
          });
        }
      }
    }

    return correlations;
  }

  /**
   * Simple correlation calculation (placeholder - use proper statistical methods)
   */
  private calculateCorrelation(values1: number[], values2: number[]): number {
    if (values1.length !== values2.length || values1.length === 0) return 0;

    const mean1 = values1.reduce((a, b) => a + b, 0) / values1.length;
    const mean2 = values2.reduce((a, b) => a + b, 0) / values2.length;

    let numerator = 0;
    let sum1Sq = 0;
    let sum2Sq = 0;

    for (let i = 0; i < values1.length; i++) {
      const diff1 = values1[i] - mean1;
      const diff2 = values2[i] - mean2;
      numerator += diff1 * diff2;
      sum1Sq += diff1 * diff1;
      sum2Sq += diff2 * diff2;
    }

    if (sum1Sq === 0 || sum2Sq === 0) return 0;

    return numerator / Math.sqrt(sum1Sq * sum2Sq);
  }

  /**
   * Get correlation strength from coefficient
   */
  private getCorrelationStrength(coefficient: number): 'weak' | 'moderate' | 'strong' | 'very_strong' {
    const absCoeff = Math.abs(coefficient);
    if (absCoeff >= 0.8) return 'very_strong';
    if (absCoeff >= 0.6) return 'strong';
    if (absCoeff >= 0.3) return 'moderate';
    return 'weak';
  }

  /**
   * Calculate impact level based on severity and breach percentage
   */
  private calculateImpact(severity: 'critical' | 'warning' | 'info', breachRatio: number): 'minor' | 'moderate' | 'severe' | 'critical' {
    const severityMultiplier = severity === 'critical' ? 1.5 :
                              severity === 'warning' ? 1.0 : 0.5;
    const impactScore = breachRatio * severityMultiplier * 100;

    if (impactScore >= 90) return 'critical';
    if (impactScore >= 70) return 'severe';
    if (impactScore >= 40) return 'moderate';
    return 'minor';
  }

  /**
   * Analyze trends for primary indicators
   */
  private analyzeTrend(indicators: string[]): 'rising' | 'falling' | 'stable' | 'erratic' {
    const recentHistory = this.metricHistory.slice(-5); // Last 5 minutes of data

    if (recentHistory.length < 3) return 'stable';

    const trends: ('rising' | 'falling' | 'stable')[] = [];

    for (const indicator of indicators) {
      const values = recentHistory
        .map(record => this.extractMetricValue(record.metrics, indicator))
        .filter(v => v > 0);

      if (values.length >= 3) {
        const first = values[0];
        const last = values[values.length - 1];
        const middle = values[Math.floor(values.length / 2)];

        if (last > first * 1.1 && last > middle * 1.05) {
          trends.push('rising');
        } else if (last < first * 0.9 && last < middle * 0.95) {
          trends.push('falling');
        } else {
          trends.push('stable');
        }
      }
    }

    // Return most common trend
    const rising = trends.filter(t => t === 'rising').length;
    const falling = trends.filter(t => t === 'falling').length;
    const stable = trends.filter(t => t === 'stable').length;

    if (rising > falling && rising > stable) return 'rising';
    if (falling > rising && falling > stable) return 'falling';
    if (rising === falling && rising > stable) return 'erratic';
    return 'stable';
  }

  /**
   * Estimate time to resolve bottleneck
   */
  private estimateResolutionTime(category: string, impact: string): number {
    // Category-specific and impact-specific estimates
    const baseTimes = {
      'performance': { minor: 10, moderate: 20, severe: 45, critical: 90 },
      'capacity': { minor: 15, moderate: 30, severe: 60, critical: 120 },
      'reliability': { minor: 5, moderate: 15, severe: 30, critical: 60 },
      'efficiency': { minor: 20, moderate: 40, severe: 90, critical: 180 }
    };

    return baseTimes[category as keyof typeof baseTimes]?.[impact as keyof typeof baseTimes[keyof typeof baseTimes]] || 30;
  }

  /**
   * Update metric history for trend analysis
   */
  private updateMetricHistory(metrics: DashboardMetrics, timestamp: number): void {
    const record: MetricHistory = { timestamp, metrics };
    this.metricHistory.push(record);

    // Maintain history size limit
    if (this.metricHistory.length > this.maxHistorySize) {
      this.metricHistory.shift();
    }
  }

  /**
   * Resolve a bottleneck
   */
  resolveBottleneck(
    bottleneckId: string,
    resolution: BottleneckResolution
  ): DetectedBottleneck | null {
    const bottleneck = this.activeBottlenecks.get(bottleneckId);

    if (bottleneck) {
      bottleneck.resolved = true;
      bottleneck.resolution = resolution;
      bottleneck.resolutionTime = resolution.resolutionTime || Date.now();

      // Move to historical record
      this.addToHistory(bottleneck);

      // Remove from active list
      this.activeBottlenecks.delete(bottleneckId);

      this.emit('bottleneckResolved', bottleneck);

      logger.info('Bottleneck resolved', {
        bottleneckId,
        resolutionMethod: resolution.resolvedBy,
        resolutionTime: bottleneck.resolutionTime
      });

      return bottleneck;
    }

    return null;
  }

  /**
   * Add resolved bottleneck to history
   */
  private addToHistory(bottleneck: DetectedBottleneck): void {
    const history: BottleneckHistory = {
      bottleneckId: bottleneck.id,
      patternId: bottleneck.patternId,
      detectedAt: bottleneck.timestamp,
      resolvedAt: bottleneck.resolutionTime,
      confidence: bottleneck.confidence,
      actionsTaken: bottleneck.resolution ? [bottleneck.resolution.actionTaken] : []
    };

    this.historicalBottlenecks.push(history);

    // Keep only recent history
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    this.historicalBottlenecks = this.historicalBottlenecks
      .filter(h => h.detectedAt > oneWeekAgo);
  }

  // Public API Methods

  getActiveBottlenecks(): DetectedBottleneck[] {
    return Array.from(this.activeBottlenecks.values())
      .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
  }

  getBottleneck(bottleneckId: string): DetectedBottleneck | null {
    return this.activeBottlenecks.get(bottleneckId) || null;
  }

  getBottleneckAnalysis(): BottleneckStats {
    const active = this.getActiveBottlenecks();
    const resolved = this.historicalBottlenecks.filter(h => h.resolvedAt);
    const unresolved = this.historicalBottlenecks.filter(h => !h.resolvedAt);

    return {
      activeCount: active.length,
      resolvedCount: resolved.length,
      unresolvedCount: unresolved.length,
      averageResolutionTime: this.calculateAverageResolutionTime(),
      topBottleneckTypes: this.getTopBottleneckTypes(),
      resolutionRate: resolved.length > 0 ?
        (resolved.length / (resolved.length + unresolved.length)) * 100 : 0
    };
  }

  getHistoricalBottlenecks(limit: number = 50): BottleneckHistory[] {
    return this.historicalBottlenecks
      .sort((a, b) => b.detectedAt - a.detectedAt)
      .slice(0, limit);
  }

  private calculateAverageResolutionTime(): number {
    const resolutionTimes = this.historicalBottlenecks
      .filter(h => h.resolvedAt)
      .map(h => h.resolvedAt! - h.detectedAt);

    if (resolutionTimes.length === 0) return 0;

    return resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length / 1000 / 60; // minutes
  }

  private getTopBottleneckTypes(): { patternId: string; count: number }[] {
    const patternCounts = new Map<string, number>();

    [...this.activeBottlenecks.values(), ...this.historicalBottlenecks]
      .forEach(b => {
        const count = patternCounts.get(b.patternId) || 0;
        patternCounts.set(b.patternId, count + 1);
      });

    return Array.from(patternCounts.entries())
      .map(([patternId, count]) => ({ patternId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Get bustleneck correlation data for visualization
   */
  getCorrelationData(bottleneck: DetectedBottleneck): CorrelationData {
    const pattern = this.patterns.get(bottleneck.patternId);
    if (!pattern) return { correlations: [] };

    // Provide historical correlation data for the past hour
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const recentHistory = this.metricHistory.filter(h => h.timestamp >= hourAgo);

    const correlations = pattern.primaryIndicators.concat(pattern.correlatedIndicators)
      .map(indicator => {
        const values = recentHistory.map(h => this.extractMetricValue(h.metrics, indicator));
        const timestamps = recentHistory.map(h => h.timestamp);

        return {
          metric: indicator,
          values,
          timestamps,
          trend: this.calculateSimpleTrend(values)
        };
      });

    return { correlations };
  }

  private calculateSimpleTrend(values: number[]): 'rising' | 'falling' | 'stable' {
    if (values.length < 3) return 'stable';

    const first = values[0];
    const last = values[values.length - 1];
    const change = (last - first) / first;

    if (change > 0.1) return 'rising';
    if (change < -0.1) return 'falling';
    return 'stable';
  }

  /**
   * Execute automated action for a bottleneck
   */
  async executeAutomatedAction(
    bottleneckId: string,
    actionId: string
  ): Promise<{ success: boolean; message: string; result?: any }> {
    const bottleneck = this.activeBottlenecks.get(bottleneckId);
    if (!bottleneck) {
      return { success: false, message: 'Bottleneck not found' };
    }

    const pattern = this.patterns.get(bottleneck.patternId);
    if (!pattern) {
      return { success: false, message: 'Bottleneck pattern not found' };
    }

    const action = pattern.automatedActions?.find(a => a.id === actionId);
    if (!action) {
      return { success: false, message: 'Automated action not found' };
    }

    if (!action.requiresApproval) {
      try {
        // Execute the automated action script/function
        const result = await this.executeActionScript(action.script);

        logger.info('Automated action executed successfully', {
          bottleneckId,
          actionId,
          actionName: action.name,
          result
        });

        return {
          success: true,
          message: `Automated action '${action.name}' executed successfully`,
          result
        };
      } catch (error) {
        logger.error('Automated action execution failed', {
          bottleneckId,
          actionId,
          actionName: action.name,
          error: error instanceof Error ? error.message : String(error)
        });

        return {
          success: false,
          message: `Automated action '${action.name}' failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    } else {
      return {
        success: false,
        message: `Automated action '${action.name}' requires manual approval`
      };
    }
  }

  /**
   * Execute action script safely
   */
  private async executeActionScript(script: string): Promise<any> {
    // For security, only allow predefined safe actions
    const safeActions = {
      'reduce-request-rate': this.reduceRequestRate.bind(this),
      'enable-circuit-breaker': this.enableCircuitBreaker.bind(this),
      'increase-cache-memory': this.increaseCacheMemory.bind(this),
      'clear-cache-evictions': this.clearCacheEvictions.bind(this),
      'reduce-batch-size': this.reduceBatchSize.bind(this)
    };

    const actionFn = safeActions[script as keyof typeof safeActions];
    if (!actionFn) {
      throw new Error(`Unsafe or unknown action script: ${script}`);
    }

    return await actionFn();
  }

  /**
   * Automated actions implementation
   */
  private async reduceRequestRate(): Promise<{ reductionPercentage: number; durationMs: number }> {
    // Implement rate reduction logic
    // This would interface with the rate limiter to temporarily reduce request frequency

    const reductionPercentage = 30; // 30% reduction
    const durationMs = 5 * 60 * 1000; // 5 minutes

    logger.info('Executing automatic rate reduction', {
      reductionPercentage,
      durationMs
    });

    return { reductionPercentage, durationMs };
  }

  private async enableCircuitBreaker(): Promise<{ enabled: boolean; timeoutMs: number }> {
    // Enable circuit breaker to prevent cascade failures

    const timeoutMs = 10 * 60 * 1000; // 10 minutes

    logger.info('Enabling automatic circuit breaker', { timeoutMs });

    return { enabled: true, timeoutMs };
  }

  private async increaseCacheMemory(): Promise<{ oldSize: number; newSize: number }> {
    // Dynamically increase cache memory allocation
    // This would need to interface with the cache manager

    const oldSize = 100; // Placeholder
    const newSize = 150; // 50% increase

    logger.info('Increasing cache memory allocation', { oldSize, newSize });

    return { oldSize, newSize };
  }

  private async clearCacheEvictions(): Promise<{ clearedEntries: number }> {
    // Clear excessive cache evictions (usually due to memory pressure)

    const clearedEntries = 50; // Placeholder

    logger.info('Clearing excessive cache evictions', { clearedEntries });

    return { clearedEntries };
  }

  private async reduceBatchSize(): Promise<{ oldSize: number; newSize: number }> {
    // Reduce batch processing size to alleviate overload
    // This would need to interface with the batching system

    const oldSize = 20; // Placeholder
    const newSize = 10; // 50% reduction

    logger.info('Reducing batch processing size', { oldSize, newSize });

    return { oldSize, newSize };
  }

  /**
   * Get bottleneck insights and AI recommendations
   */
  getBottleneckInsights(
    timeRangeMs: number = 300000
  ): {
    activeBottlenecks: ActiveBottleneckInsight[];
    predictedBottlenecks: PredictedBottleneck[];
    performanceOptimizations: PerformanceOptimization[];
    riskAssessments: RiskAssessment[];
  } {
    const metrics = performanceDashboard.getDashboardMetrics(timeRangeMs);

    return {
      activeBottlenecks: this.getActiveBottleneckInsights(metrics),
      predictedBottlenecks: this.predictUpcomingBottlenecks(metrics),
      performanceOptimizations: this.generateOptimizations(metrics),
      riskAssessments: this.assessSystemRisks(metrics)
    };
  }

  private getActiveBottleneckInsights(metrics: DashboardMetrics): ActiveBottleneckInsight[] {
    const currentBottlenecks = this.activeBottlenecks.values();

    return Array.from(currentBottlenecks).map(bottleneck => ({
      id: bottleneck.id,
      patternId: bottleneck.patternId,
      confidence: bottleneck.confidence,
      impact: bottleneck.impact,
      timeline: this.buildTimeline(bottleneck),
      mitigationProgress: this.calculateMitigationProgress(bottleneck),
      upstreamDependencies: [], // Would analyze code dependencies
      downstreamEffects: [], // Would analyze impact on other systems
      aiConfidence: bottleneck.confidence,
      mitigationStrategy: 'comprehensive_recovery'
    }));
  }

  private predictUpcomingBottlenecks(metrics: DashboardMetrics): PredictedBottleneck[] {
    const predictions: PredictedBottleneck[] = [];
    const recentHistory = this.metricHistory.slice(-10); // Last 10 data points

    if (recentHistory.length >= 5) {
      // Simple trending analysis for potential bottlenecks
      const responseTimeTrend = this.calculateTrend(recentHistory.map(h => this.extractMetricValue(h.metrics, 'overall.averageResponseTime')));
      const errorRateTrend = this.calculateTrend(recentHistory.map(h => this.extractMetricValue(h.metrics, 'overall.errorRate')));

      if (responseTimeTrend === 'rising' && errorRateTrend === 'rising') {
        predictions.push({
          patternId: 'performance-degradation',
          probability: 85,
          expectedTimeMs: 15 * 60 * 1000, // 15 minutes
          severity: 'high',
          indicators: ['rising_response_times', 'increasing_errors'],
          mitigationSuggestions: ['check_server_resources', 'review_recent_deployments']
        });
      }
    }

    return predictions;
  }

  private generateOptimizations(metrics: DashboardMetrics): PerformanceOptimization[] {
    const optimizations: PerformanceOptimization[] = [];

    // Analyze cache efficiency
    const cacheHitRate = this.extractMetricValue(metrics, 'caching.hitRate');
    if (cacheHitRate < 75) {
      optimizations.push({
        category: 'caching',
        recommendation: 'optimize_cache_strategy',
        expectedBenefit: 'increase_hit_rate_by_20%',
        implementationComplexity: 'medium',
        rollbackAvailable: true,
        aiRecommendation: true
      });
    }

    // Analyze compression efficiency
    const compressionRatio = this.extractMetricValue(metrics, 'compression.averageCompressionRatio');
    if (compressionRatio < 50) {
      optimizations.push({
        category: 'compression',
        recommendation: 'upgrade_compression_algorithm',
        expectedBenefit: 'reduce_bandwidth_usage_by_30%',
        implementationComplexity: 'low',
        rollbackAvailable: true,
        aiRecommendation: true
      });
    }

    return optimizations;
  }

  private assessSystemRisks(metrics: DashboardMetrics): RiskAssessment[] {
    const assessments: RiskAssessment[] = [];

    // Memory usage risk
    const responseTime = this.extractMetricValue(metrics, 'overall.averageResponseTime');
    const errorRate = this.extractMetricValue(metrics, 'overall.errorRate');

    if (responseTime > 300 && errorRate > 2) {
      assessments.push({
        component: 'api_responsiveness',
        riskLevel: 'high',
        riskDescription: 'System showing signs of performance degradation',
        probability: 75,
        impactRadius: 'entire_system',
        mitigationStrategy: 'immediate_investigation_required',
        earlyWarning: true
      });
    }

    return assessments;
  }

  private calculateTrend(values: number[]): 'rising' | 'falling' | 'stable' {
    if (values.length < 3) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const changeRate = (secondAvg - firstAvg) / firstAvg;

    if (changeRate > 0.1) return 'rising';
    if (changeRate < -0.1) return 'falling';
    return 'stable';
  }

  private buildTimeline(bottleneck: DetectedBottleneck): BottleneckTimeline[] {
    // Build timeline of bottleneck evolution
    return [
      {
        timestamp: bottleneck.timestamp - 60000, // 1 minute before
        state: 'normal',
        metrics: {},
        action: 'baseline_measurement'
      },
      {
        timestamp: bottleneck.timestamp,
        state: 'degraded',
        metrics: {
          confidence: bottleneck.confidence,
          impact: bottleneck.impact
        },
        action: 'bottleneck_detected'
      }
    ];
  }

  private calculateMitigationProgress(bottleneck: DetectedBottleneck): MitigationProgress {
    const resolved = bottleneck.resolved ? 100 : 0; // Simplified

    return {
      progressPercentage: resolved,
      stepsCompleted: resolved >= 100 ? ['detection', 'analysis', 'resolution'] : ['detection', 'analysis'],
      remainingSteps: resolved >= 100 ? [] : ['implement_remediation'],
      estimatedTimeRemainingMs: resolved >= 100 ? 0 : 300000 // 5 minutes
    };
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    if (this.periodicCheck) {
      clearInterval(this.periodicCheck);
    }
    this.activeBottlenecks.clear();
    this.metricHistory.length = 0;
    this.removeAllListeners();
  }
}

// Additional type definitions
interface ActiveBottleneckInsight {
  id: string;
  patternId: string;
  confidence: number;
  impact: string;
  timeline: BottleneckTimeline[];
  mitigationProgress: MitigationProgress;
  upstreamDependencies: string[];
  downstreamEffects: string[];
  aiConfidence: number;
  mitigationStrategy: string;
}

interface PredictedBottleneck {
  patternId: string;
  probability: number;
  expectedTimeMs: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  indicators: string[];
  mitigationSuggestions: string[];
}

interface PerformanceOptimization {
  category: string;
  recommendation: string;
  expectedBenefit: string;
  implementationComplexity: 'low' | 'medium' | 'high';
  rollbackAvailable: boolean;
  aiRecommendation: boolean;
}

interface RiskAssessment {
  component: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskDescription: string;
  probability: number;
  impactRadius: string;
  mitigationStrategy: string;
  earlyWarning: boolean;
}

interface BottleneckTimeline {
  timestamp: number;
  state: string;
  metrics: Record<string, any>;
  action: string;
}

interface MitigationProgress {
  progressPercentage: number;
  stepsCompleted: string[];
  remainingSteps: string[];
  estimatedTimeRemainingMs: number;
}

// Type definitions
interface MetricHistory {
  timestamp: number;
  metrics: DashboardMetrics;
}

interface BottleneckStats {
  activeCount: number;
  resolvedCount: number;
  unresolvedCount: number;
  averageResolutionTime: number; // minutes
  topBottleneckTypes: { patternId: string; count: number }[];
  resolutionRate: number; // percentage
}

interface CorrelationData {
  correlations: Array<{
    metric: string;
    values: number[];
    timestamps: number[];
    trend: 'rising' | 'falling' | 'stable';
  }>;
}

// Initialize bottleneck detector with patterns
import { BOTTLENECK_PATTERNS } from './bottleneck-patterns';

// Global bottleneck detector instance
export const bottleneckDetector = new BottleneckDetector(BOTTLENECK_PATTERNS);

// Export additional utilities for initialization
export { getAllBottleneckPatterns, getQuickDetectionPatterns } from './bottleneck-patterns';
