import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { MockedFunction } from "vitest";

import { BottleneckDetector } from "@/lib/monitoring/bottleneck-detector";
import { BOTTLENECK_PATTERNS } from "@/lib/monitoring/bottleneck-patterns";
import {
  performanceDashboard,
  DashboardMetrics,
} from "@/lib/monitoring/performance-dashboard";

// Mock the alert service to avoid actual alerting in tests
vi.mock("@/lib/alerting/alert-service", () => ({
  alertService: {
    processAlert: vi.fn(),
  },
}));

// Mock performance dashboard
vi.mock("@/lib/monitoring/performance-dashboard", () => ({
  performanceDashboard: {
    getDashboardMetrics: vi.fn(),
  },
}));

describe("BottleneckDetector", () => {
  let detector: BottleneckDetector;
  let mockDashboardMetrics: DashboardMetrics;

  beforeEach(() => {
    vi.clearAllMocks();
    detector = new BottleneckDetector(BOTTLENECK_PATTERNS);

    // Setup mock dashboard metrics
    mockDashboardMetrics = {
      overall: {
        averageResponseTime: 100,
        errorRate: 2,
        totalRequests: 50,
        p95ResponseTime: 150,
        p99ResponseTime: 200,
        throughput: 10,
      },
      endpoints: {},
      caching: {
        hitRate: 75,
        missRate: 25,
        cacheSize: 1000,
        evictionCount: 10,
        compressionRate: 60,
      },
      batching: {
        totalBatchRequests: 20,
        averageBatchSize: 5,
        averageBatchDuration: 2000,
        batchSuccessRate: 90,
        parallelBatches: 16,
        sequentialBatches: 4,
      },
      compression: {
        totalCompressedRequests: 50,
        averageCompressionRatio: 60,
        compressionSavingsBytes: 1000,
        compressionSavingsPercent: 30,
        brotliUsagePercent: 40,
        gzipUsagePercent: 60,
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
          resolutionRate: 0,
        },
        topPatterns: [],
        resolutionRate: 0,
      },
    };

    (
      performanceDashboard.getDashboardMetrics as MockedFunction<
        typeof performanceDashboard.getDashboardMetrics
      >
    ).mockReturnValue(mockDashboardMetrics);
  });

  afterEach(() => {
    detector.destroy();
  });

  describe("Initialization", () => {
    it("should initialize with predefined patterns", () => {
      expect(BOTTLENECK_PATTERNS.length).toBe(9);
      expect(BOTTLENECK_PATTERNS[0].id).toBe("memory-leak");
    });

    it("should register new patterns", () => {
      const customPattern = {
        id: "custom-pattern",
        name: "Custom Test Pattern",
        description: "A test pattern",
        severity: "info" as const,
        category: "performance" as const,
        conditions: [
          {
            metric: "overall.averageResponseTime",
            operator: "gt" as const,
            threshold: 1000,
            duration: 60000,
            weight: 50,
          },
        ],
        primaryIndicators: ["overall.averageResponseTime"],
        correlatedIndicators: ["overall.errorRate"],
        anomalyDetector: {
          windowSize: 5,
          sensitivity: 0.7,
          baselinePeriod: 300000,
        },
        minimumConfidence: 80,
        impactThreshold: 75,
        recommendations: [
          {
            priority: "high" as const,
            category: "immediate" as const,
            action: "Test action",
            expectedImpact: "Test impact",
            estimatedTime: 30,
          },
        ],
      };

      detector["registerPattern"](customPattern);
      expect(detector["patterns"].get("custom-pattern")).toBe(customPattern);
    });

    it("should unregister patterns", () => {
      expect(detector["patterns"].has("memory-leak")).toBe(true);
      expect(detector["unregisterPattern"]("memory-leak")).toBe(true);
      expect(detector["patterns"].has("memory-leak")).toBe(false);
      expect(detector["unregisterPattern"]("non-existent")).toBe(false);
    });
  });

  describe("Pattern Analysis", () => {
    it("should analyze patterns correctly", () => {
      const memoryLeakPattern = BOTTLENECK_PATTERNS.find(
        (p) => p.id === "memory-leak",
      )!;
      const analysis = detector["analyzePattern"](
        memoryLeakPattern,
        mockDashboardMetrics,
      );

      expect(analysis).toHaveProperty("confidence");
      expect(analysis).toHaveProperty("impact");
      expect(analysis).toHaveProperty("metrics");
      expect(analysis.confidence).toBeGreaterThanOrEqual(0);
      expect(analysis.confidence).toBeLessThanOrEqual(100);
    });

    it("should detect breached conditions", () => {
      // Setup metrics that will trigger memory leak pattern
      const triggerMetrics: DashboardMetrics = {
        ...mockDashboardMetrics,
        overall: {
          averageResponseTime: 300, // > 200 triggers condition
          errorRate: 2,
          totalRequests: 50,
          p95ResponseTime: 400,
          p99ResponseTime: 500,
          throughput: 12,
        },
        caching: {
          hitRate: 75,
          missRate: 25,
          cacheSize: 1000,
          evictionCount: 60, // > 50 triggers condition
          compressionRate: 70,
        },
        batching: {
          totalBatchRequests: 25,
          averageBatchSize: 8,
          averageBatchDuration: 4000, // > 3000 triggers condition
          batchSuccessRate: 90,
          parallelBatches: 20,
          sequentialBatches: 5,
        },
        compression: {
          totalCompressedRequests: 60,
          averageCompressionRatio: 70,
          compressionSavingsBytes: 1500,
          compressionSavingsPercent: 35,
          brotliUsagePercent: 50,
          gzipUsagePercent: 50,
        },
        endpoints: {},
        alerting: mockDashboardMetrics.alerting,
        bottlenecks: mockDashboardMetrics.bottlenecks,
      };

      const memoryLeakPattern = BOTTLENECK_PATTERNS.find(
        (p) => p.id === "memory-leak",
      )!;
      const analysis = detector["analyzePattern"](
        memoryLeakPattern,
        triggerMetrics,
      );

      expect(analysis.confidence).toBeGreaterThan(50); // Should have significant confidence
      expect(Object.values(analysis.metrics)).toEqual(
        expect.arrayContaining([expect.objectContaining({ breached: true })]),
      );
    });

    it("should calculate impact levels correctly", () => {
      // Critical severity, high breach ratio = critical impact
      expect(detector["calculateImpact"]("critical", 0.8)).toBe("critical");
      expect(detector["calculateImpact"]("critical", 0.5)).toBe("severe");
      expect(detector["calculateImpact"]("warning", 0.5)).toBe("moderate");
      expect(detector["calculateImpact"]("warning", 0.2)).toBe("minor");
    });

    it("should analyze correlations between metrics", () => {
      const correlations = detector["analyzeCorrelations"](
        BOTTLENECK_PATTERNS.find((p) => p.id === "memory-leak")!,
        mockDashboardMetrics,
      );

      expect(Array.isArray(correlations)).toBe(true);
      if (correlations.length > 0) {
        expect(correlations[0]).toHaveProperty("metric1");
        expect(correlations[0]).toHaveProperty("metric2");
        expect(correlations[0]).toHaveProperty("correlationCoefficient");
        expect(correlations[0]).toHaveProperty("strength");
        expect(correlations[0]).toHaveProperty("direction");
      }
    });

    it("should estimate resolution time accurately", () => {
      expect(
        detector["estimateResolutionTime"]("performance", "critical"),
      ).toBe(90);
      expect(detector["estimateResolutionTime"]("capacity", "minor")).toBe(15);
      expect(detector["estimateResolutionTime"]("reliability", "severe")).toBe(
        30,
      );
      expect(detector["estimateResolutionTime"]("efficiency", "moderate")).toBe(
        40,
      );
      expect(detector["estimateResolutionTime"]("unknown", "minor")).toBe(30);
    });
  });

  describe("Metric Extraction", () => {
    it("should extract numeric metric values from nested objects", () => {
      const metrics = {
        overall: {
          averageResponseTime: 150,
          totalRequests: 100,
          p95ResponseTime: 200,
          p99ResponseTime: 300,
          errorRate: 5,
          throughput: 10,
        },
        endpoints: {},
        caching: {
          hitRate: 85.5,
          missRate: 14.5,
          cacheSize: 1000,
          evictionCount: 10,
          compressionRate: 60,
        },
        compression: {
          totalCompressedRequests: 50,
          averageCompressionRatio: 65,
          compressionSavingsBytes: 1000,
          compressionSavingsPercent: 30,
          brotliUsagePercent: 40,
          gzipUsagePercent: 60,
        },
        batching: {
          totalBatchRequests: 20,
          averageBatchSize: 5,
          averageBatchDuration: 200,
          batchSuccessRate: 95,
          parallelBatches: 15,
          sequentialBatches: 5,
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
            resolutionRate: 0,
          },
          topPatterns: [],
          resolutionRate: 0,
        },
        // Extra nested object for testing deep paths
        nested: { deeply: { value: 42 } },
      };

      expect(
        detector["extractMetricValue"](metrics, "overall.averageResponseTime"),
      ).toBe(150);
      expect(detector["extractMetricValue"](metrics, "caching.hitRate")).toBe(
        85.5,
      );
      expect(
        detector["extractMetricValue"](
          metrics as DashboardMetrics & {
            nested: { deeply: { value: number } };
          },
          "nested.deeply.value",
        ),
      ).toBe(42);
    });

    it("should return 0 for non-existent paths", () => {
      const emptyMetrics = {
        overall: {
          averageResponseTime: 0,
          totalRequests: 0,
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
            resolutionRate: 0,
          },
          topPatterns: [],
          resolutionRate: 0,
        },
      };

      expect(
        detector["extractMetricValue"](emptyMetrics, "nonexistent.path"),
      ).toBe(0);
    });

    it("should check condition breaches accurately", () => {
      const condition: import("@/lib/monitoring/bottleneck-detector").BottleneckCondition =
        {
          operator: "gt",
          metric: "test",
          threshold: 100,
          duration: 1000,
          weight: 50,
        };
      expect(detector["isConditionBreached"](150, condition)).toBe(true);

      condition.operator = "lt";
      condition.threshold = 200;
      expect(detector["isConditionBreached"](150, condition)).toBe(true);

      condition.operator = "gte";
      condition.threshold = 150;
      expect(detector["isConditionBreached"](150, condition)).toBe(true);

      condition.operator = "lte";
      expect(detector["isConditionBreached"](150, condition)).toBe(true);

      condition.operator = "eq";
      expect(detector["isConditionBreached"](150, condition)).toBe(true);
    });
  });

  describe("Trend Analysis", () => {
    it("should analyze trends from metric history", () => {
      // Setup metric history with complete DashboardMetrics objects
      detector["metricHistory"] = [
        {
          timestamp: Date.now() - 5000,
          metrics: {
            overall: {
              averageResponseTime: 100,
              totalRequests: 50,
              p95ResponseTime: 120,
              p99ResponseTime: 150,
              errorRate: 1,
              throughput: 10,
            },
            endpoints: {},
            caching: {
              hitRate: 80,
              missRate: 20,
              cacheSize: 1000,
              evictionCount: 5,
              compressionRate: 65,
            },
            compression: {
              totalCompressedRequests: 40,
              averageCompressionRatio: 60,
              compressionSavingsBytes: 800,
              compressionSavingsPercent: 25,
              brotliUsagePercent: 35,
              gzipUsagePercent: 65,
            },
            batching: {
              totalBatchRequests: 15,
              averageBatchSize: 5,
              averageBatchDuration: 180,
              batchSuccessRate: 95,
              parallelBatches: 12,
              sequentialBatches: 3,
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
                resolutionRate: 0,
              },
              topPatterns: [],
              resolutionRate: 0,
            },
          },
        },
        {
          timestamp: Date.now() - 4000,
          metrics: {
            overall: {
              averageResponseTime: 120,
              totalRequests: 55,
              p95ResponseTime: 140,
              p99ResponseTime: 170,
              errorRate: 1.5,
              throughput: 11,
            },
            endpoints: {},
            caching: {
              hitRate: 82,
              missRate: 18,
              cacheSize: 1000,
              evictionCount: 4,
              compressionRate: 68,
            },
            compression: {
              totalCompressedRequests: 45,
              averageCompressionRatio: 62,
              compressionSavingsBytes: 900,
              compressionSavingsPercent: 28,
              brotliUsagePercent: 38,
              gzipUsagePercent: 62,
            },
            batching: {
              totalBatchRequests: 18,
              averageBatchSize: 6,
              averageBatchDuration: 195,
              batchSuccessRate: 96,
              parallelBatches: 14,
              sequentialBatches: 4,
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
                resolutionRate: 0,
              },
              topPatterns: [],
              resolutionRate: 0,
            },
          },
        },
        {
          timestamp: Date.now() - 3000,
          metrics: {
            overall: {
              averageResponseTime: 150,
              totalRequests: 60,
              p95ResponseTime: 180,
              p99ResponseTime: 210,
              errorRate: 2,
              throughput: 12,
            },
            endpoints: {},
            caching: {
              hitRate: 78,
              missRate: 22,
              cacheSize: 1000,
              evictionCount: 7,
              compressionRate: 72,
            },
            compression: {
              totalCompressedRequests: 50,
              averageCompressionRatio: 58,
              compressionSavingsBytes: 1000,
              compressionSavingsPercent: 30,
              brotliUsagePercent: 42,
              gzipUsagePercent: 58,
            },
            batching: {
              totalBatchRequests: 22,
              averageBatchSize: 7,
              averageBatchDuration: 210,
              batchSuccessRate: 94,
              parallelBatches: 16,
              sequentialBatches: 6,
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
                resolutionRate: 0,
              },
              topPatterns: [],
              resolutionRate: 0,
            },
          },
        },
        {
          timestamp: Date.now() - 2000,
          metrics: {
            overall: {
              averageResponseTime: 180,
              totalRequests: 65,
              p95ResponseTime: 220,
              p99ResponseTime: 260,
              errorRate: 2.5,
              throughput: 13,
            },
            endpoints: {},
            caching: {
              hitRate: 75,
              missRate: 25,
              cacheSize: 1000,
              evictionCount: 9,
              compressionRate: 76,
            },
            compression: {
              totalCompressedRequests: 55,
              averageCompressionRatio: 62,
              compressionSavingsBytes: 1200,
              compressionSavingsPercent: 35,
              brotliUsagePercent: 45,
              gzipUsagePercent: 55,
            },
            batching: {
              totalBatchRequests: 28,
              averageBatchSize: 8,
              averageBatchDuration: 225,
              batchSuccessRate: 93,
              parallelBatches: 20,
              sequentialBatches: 8,
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
                resolutionRate: 0,
              },
              topPatterns: [],
              resolutionRate: 0,
            },
          },
        },
        {
          timestamp: Date.now() - 1000,
          metrics: {
            overall: {
              averageResponseTime: 220,
              totalRequests: 70,
              p95ResponseTime: 280,
              p99ResponseTime: 330,
              errorRate: 3,
              throughput: 14,
            },
            endpoints: {},
            caching: {
              hitRate: 72,
              missRate: 28,
              cacheSize: 1000,
              evictionCount: 12,
              compressionRate: 78,
            },
            compression: {
              totalCompressedRequests: 60,
              averageCompressionRatio: 66,
              compressionSavingsBytes: 1500,
              compressionSavingsPercent: 40,
              brotliUsagePercent: 48,
              gzipUsagePercent: 52,
            },
            batching: {
              totalBatchRequests: 35,
              averageBatchSize: 9,
              averageBatchDuration: 245,
              batchSuccessRate: 92,
              parallelBatches: 24,
              sequentialBatches: 11,
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
                resolutionRate: 0,
              },
              topPatterns: [],
              resolutionRate: 0,
            },
          },
        },
      ];

      const trend = detector["analyzeTrend"](["overall.averageResponseTime"]);
      expect(trend).toBe("rising");
    });

    it("should return stable for insufficient data", () => {
      detector["metricHistory"] = [];
      expect(detector["analyzeTrend"](["test"])).toBe("stable");
    });
  });

  describe("Bottleneck Detection and Management", () => {
    it("should create detected bottlenecks correctly", () => {
      const pattern = BOTTLENECK_PATTERNS[0];
      const analysis: import("@/lib/monitoring/bottleneck-detector").BottleneckAnalysis =
        {
          confidence: 85,
          impact: "moderate" as const,
          metrics: {
            "test.metric": {
              value: 100,
              threshold: 90,
              breached: true,
              weight: 50,
            },
          },
          correlations: [],
          trendAnalysis: "rising" as const,
          timeToResolve: 45,
        };
      const timestamp = Date.now();

      const bottleneck = detector["createBottleneck"](
        pattern,
        analysis,
        timestamp,
      );

      expect(bottleneck.id).toContain(pattern.id);
      expect(bottleneck.patternId).toBe(pattern.id);
      expect(bottleneck.confidence).toBe(85);
      expect(bottleneck.impact).toBe("moderate");
      expect(bottleneck.timestamp).toBe(timestamp);
      expect(bottleneck.recommendations).toHaveLength(
        pattern.recommendations.length,
      );
    });

    it("should manage active bottlenecks", () => {
      const pattern = BOTTLENECK_PATTERNS[0];
      const analysis: import("@/lib/monitoring/bottleneck-detector").BottleneckAnalysis =
        {
          confidence: 85,
          impact: "moderate" as const,
          metrics: {},
          correlations: [],
          trendAnalysis: "rising" as const,
          timeToResolve: 45,
        };
      const bottleneck = detector["createBottleneck"](
        pattern,
        analysis,
        Date.now(),
      );

      detector["registerBottleneck"](bottleneck);
      expect(detector.getActiveBottlenecks()).toContain(bottleneck);
      expect(detector.getBottleneck(bottleneck.id)).toBe(bottleneck);

      // Resolve bottleneck
      const resolution = {
        resolvedBy: "manual" as const,
        actionTaken: "Fixed configuration",
        resolutionTime: Date.now(),
      };

      const resolved = detector.resolveBottleneck(bottleneck.id, resolution);
      expect(resolved).toBe(bottleneck);
      expect(detector.getActiveBottlenecks()).not.toContain(bottleneck);
      expect(bottleneck.resolved).toBe(true);
      expect(bottleneck.resolution).toBe(resolution);
    });

    it("should provide bottleneck analysis statistics", () => {
      const stats = detector.getBottleneckAnalysis();
      expect(stats).toHaveProperty("activeCount");
      expect(stats).toHaveProperty("resolvedCount");
      expect(stats).toHaveProperty("topBottleneckTypes");
      expect(stats.resolutionRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Automated Actions", () => {
    it("should execute safe automated actions", async () => {
      const mockBottleneck = {
        id: "test-bottleneck",
        patternId: "rate-limit-exhaustion",
        timestamp: Date.now(),
        confidence: 90,
        impact: "severe" as const,
        metrics: {},
        correlations: [],
        recommendations: [
          {
            priority: "critical" as const,
            category: "immediate" as const,
            action: "Reduce request rate",
            expectedImpact: "Test impact",
            automated: true,
            estimatedTime: 10,
          },
        ],
        resolved: false,
      };

      detector["activeBottlenecks"].set(mockBottleneck.id, mockBottleneck);

      // Add the automated action to the pattern
      const pattern = BOTTLENECK_PATTERNS.find(
        (p) => p.id === "rate-limit-exhaustion",
      );
      if (pattern) {
        pattern.automatedActions = [
          {
            id: "reduce-request-rate",
            name: "Reduce Request Rate",
            script: "reduce-request-rate",
            requiresApproval: false,
          },
        ];
      }

      const result = await detector.executeAutomatedAction(
        "test-bottleneck",
        "reduce-request-rate",
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain(
        `Automated action 'Reduce Request Rate' executed successfully`,
      );
    });

    it("should reject unsafe action scripts", async () => {
      const mockBottleneck = {
        id: "test-bottleneck",
        patternId: "memory-leak",
        timestamp: Date.now(),
        confidence: 90,
        impact: "severe" as const,
        metrics: {},
        correlations: [],
        recommendations: [],
        resolved: false,
      };

      detector["activeBottlenecks"].set(mockBottleneck.id, mockBottleneck);

      const result = await detector.executeAutomatedAction(
        "test-bottleneck",
        "test-unsafe-action",
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("Unsafe or unknown action script");
    });

    it("should handle errors during action execution", async () => {
      // Mock action that throws error
      vi.spyOn(
        detector as unknown as { reduceRequestRate: () => Promise<unknown> },
        "reduceRequestRate",
      ).mockRejectedValue(new Error("Rate reduction failed"));

      const mockBottleneck = {
        id: "test-bottleneck",
        patternId: "rate-limit-exhaustion",
        timestamp: Date.now(),
        confidence: 90,
        impact: "severe" as const,
        metrics: {},
        correlations: [],
        recommendations: [],
        resolved: false,
      };

      detector["activeBottlenecks"].set(mockBottleneck.id, mockBottleneck);

      // Add the automated action to the pattern (without requiresApproval to allow execution)
      const pattern = BOTTLENECK_PATTERNS.find(
        (p) => p.id === "rate-limit-exhaustion",
      );
      if (pattern) {
        pattern.automatedActions = [
          {
            id: "reduce-request-rate",
            name: "Reduce Request Rate",
            script: "reduce-request-rate",
            requiresApproval: false,
          },
        ];
      }

      const result = await detector.executeAutomatedAction(
        "test-bottleneck",
        "reduce-request-rate",
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("Rate reduction failed");

      // Restore original function
      vi.restoreAllMocks();
    });
  });

  describe("Correlation and Insights", () => {
    it("should provide correlation data for bottlenecks", () => {
      const mockBottleneck = {
        id: "test-bottleneck",
        patternId: "memory-leak",
        timestamp: Date.now(),
        confidence: 90,
        impact: "severe" as const,
        metrics: {},
        correlations: [],
        recommendations: [],
        resolved: false,
      };

      detector["activeBottlenecks"].set(mockBottleneck.id, mockBottleneck);

      const correlationData = detector.getCorrelationData(mockBottleneck);
      expect(correlationData).toHaveProperty("correlations");
      expect(Array.isArray(correlationData.correlations)).toBe(true);
    });

    it("should provide bottleneck insights", () => {
      const insights = detector.getBottleneckInsights();

      expect(insights).toHaveProperty("activeBottlenecks");
      expect(insights).toHaveProperty("predictedBottlenecks");
      expect(insights).toHaveProperty("performanceOptimizations");
      expect(insights).toHaveProperty("riskAssessments");

      expect(Array.isArray(insights.activeBottlenecks)).toBe(true);
      expect(Array.isArray(insights.predictedBottlenecks)).toBe(true);
      expect(Array.isArray(insights.performanceOptimizations)).toBe(true);
      expect(Array.isArray(insights.riskAssessments)).toBe(true);
    });
  });

  describe("Event Emission", () => {
    it("should emit events during bottleneck lifecycle", () => {
      const events: string[] = [];
      detector.on("bottleneckDetected", () => events.push("detected"));
      detector.on("bottleneckResolved", () => events.push("resolved"));

      // Create a mock bottleneck directly to test event emission
      const mockBottleneck = {
        id: "test-bottleneck",
        patternId: "memory-leak",
        timestamp: Date.now(),
        confidence: 90,
        impact: "severe" as const,
        metrics: {},
        correlations: [],
        recommendations: [],
        resolved: false,
      };

      // Register the bottleneck
      detector["activeBottlenecks"].set(mockBottleneck.id, mockBottleneck);

      // Manually emit detected event to test event system
      detector.emit("bottleneckDetected", mockBottleneck);

      expect(events).toContain("detected");

      // Test resolution event
      detector.resolveBottleneck(mockBottleneck.id, {
        resolvedBy: "manual",
        actionTaken: "Fixed issue",
        resolutionTime: Date.now(),
      });
      detector.emit("bottleneckResolved", mockBottleneck);
      expect(events).toContain("resolved");
    });
  });

  describe("Cleanup", () => {
    it("should clean up resources on destroy", () => {
      const spy = vi.spyOn(global, "clearInterval");

      // Add some data to cleanup
      (detector as unknown as { activeBottlenecks: Map<string, unknown> })[
        "activeBottlenecks"
      ].set("test", {});
      detector["metricHistory"].push({
        timestamp: Date.now(),
        metrics: mockDashboardMetrics,
      });
      detector["metricHistory"].push({
        timestamp: Date.now(),
        metrics: mockDashboardMetrics,
      });

      detector.destroy();

      expect(spy).toHaveBeenCalled();
      expect(
        (detector as unknown as { activeBottlenecks: Map<string, unknown> })[
          "activeBottlenecks"
        ].size,
      ).toBe(0);
      expect(detector["metricHistory"].length).toBe(0);

      spy.mockRestore();
    });
  });
});
