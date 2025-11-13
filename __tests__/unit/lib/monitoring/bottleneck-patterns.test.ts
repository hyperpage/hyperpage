import { describe, it, expect } from "vitest";

import {
  BOTTLENECK_PATTERNS,
  getAllBottleneckPatterns,
  getPatternsByCategory,
  getPatternsBySeverity,
  getBottleneckPattern,
} from "@/lib/monitoring/bottleneck-patterns";

describe("Bottleneck Patterns", () => {
  describe("Pattern Structure Validation", () => {
    it("should have all required enterprise patterns", () => {
      expect(BOTTLENECK_PATTERNS).toHaveLength(9);
      expect(BOTTLENECK_PATTERNS).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "memory-leak" }),
          expect.objectContaining({ id: "cache-thrashing" }),
          expect.objectContaining({ id: "rate-limit-exhaustion" }),
          expect.objectContaining({
            id: "database-connection-pool-exhaustion",
          }),
          expect.objectContaining({ id: "compression-efficiency-degradation" }),
          expect.objectContaining({ id: "batch-processing-overload" }),
          expect.objectContaining({ id: "circuit-breaker-failover" }),
          expect.objectContaining({ id: "high-throughput-saturation" }),
          expect.objectContaining({ id: "persistent-slow-operations" }),
        ]),
      );
    });

    it("should have valid pattern structure", () => {
      BOTTLENECK_PATTERNS.forEach((pattern) => {
        // Validate required properties
        expect(pattern).toHaveProperty("id");
        expect(pattern).toHaveProperty("name");
        expect(pattern).toHaveProperty("description");
        expect(pattern).toHaveProperty("severity");
        expect(pattern).toHaveProperty("category");
        expect(pattern).toHaveProperty("conditions");
        expect(pattern).toHaveProperty("primaryIndicators");
        expect(pattern).toHaveProperty("correlatedIndicators");
        expect(pattern).toHaveProperty("anomalyDetector");
        expect(pattern).toHaveProperty("minimumConfidence");
        expect(pattern).toHaveProperty("impactThreshold");
        expect(pattern).toHaveProperty("recommendations");

        // Validate types
        expect(typeof pattern.id).toBe("string");
        expect(typeof pattern.name).toBe("string");
        expect(typeof pattern.description).toBe("string");
        expect(["critical", "warning", "info"]).toContain(pattern.severity);
        expect([
          "performance",
          "capacity",
          "reliability",
          "efficiency",
        ]).toContain(pattern.category);

        // Validate conditions structure
        expect(Array.isArray(pattern.conditions)).toBe(true);
        pattern.conditions.forEach((condition) => {
          expect(condition).toHaveProperty("metric");
          expect(condition).toHaveProperty("operator");
          expect(condition).toHaveProperty("threshold");
          expect(condition).toHaveProperty("duration");
          expect(condition).toHaveProperty("weight");
          expect(["gt", "lt", "gte", "lte", "eq"]).toContain(
            condition.operator,
          );
        });

        // Validate recommendations
        expect(Array.isArray(pattern.recommendations)).toBe(true);
        pattern.recommendations.forEach((rec) => {
          expect(rec).toHaveProperty("priority");
          expect(rec).toHaveProperty("category");
          expect(rec).toHaveProperty("action");
          expect(rec).toHaveProperty("expectedImpact");
          expect(["critical", "high", "medium", "low"]).toContain(rec.priority);
          expect([
            "immediate",
            "preventative",
            "configuration",
            "monitoring",
          ]).toContain(rec.category);
        });
      });
    });
  });

  describe("Pattern Categories", () => {
    it("should include performance bottlenecks", () => {
      const performancePatterns = BOTTLENECK_PATTERNS.filter(
        (p) => p.category === "performance",
      );
      expect(performancePatterns.length).toBeGreaterThan(0);
      expect(performancePatterns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "memory-leak" }),
          expect.objectContaining({ id: "cache-thrashing" }),
          expect.objectContaining({ id: "batch-processing-overload" }),
          expect.objectContaining({ id: "persistent-slow-operations" }),
        ]),
      );
    });

    it("should include capacity bottlenecks", () => {
      const capacityPatterns = BOTTLENECK_PATTERNS.filter(
        (p) => p.category === "capacity",
      );
      expect(capacityPatterns.length).toBeGreaterThan(0);
      expect(capacityPatterns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "database-connection-pool-exhaustion",
          }),
          expect.objectContaining({ id: "high-throughput-saturation" }),
        ]),
      );
    });

    it("should include reliability bottlenecks", () => {
      const reliabilityPatterns = BOTTLENECK_PATTERNS.filter(
        (p) => p.category === "reliability",
      );
      expect(reliabilityPatterns.length).toBeGreaterThan(0);
      expect(reliabilityPatterns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "rate-limit-exhaustion" }),
          expect.objectContaining({ id: "circuit-breaker-failover" }),
        ]),
      );
    });

    it("should include efficiency bottlenecks", () => {
      const efficiencyPatterns = BOTTLENECK_PATTERNS.filter(
        (p) => p.category === "efficiency",
      );
      expect(efficiencyPatterns.length).toBeGreaterThan(0);
      expect(efficiencyPatterns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "compression-efficiency-degradation" }),
        ]),
      );
    });
  });

  describe("Pattern Severities", () => {
    it("should include critical severity patterns", () => {
      const criticalPatterns = BOTTLENECK_PATTERNS.filter(
        (p) => p.severity === "critical",
      );
      expect(criticalPatterns.length).toBeGreaterThan(0);
      expect(criticalPatterns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "memory-leak" }),
          expect.objectContaining({ id: "rate-limit-exhaustion" }),
          expect.objectContaining({
            id: "database-connection-pool-exhaustion",
          }),
          expect.objectContaining({ id: "circuit-breaker-failover" }),
        ]),
      );
    });

    it("should include warning severity patterns", () => {
      const warningPatterns = BOTTLENECK_PATTERNS.filter(
        (p) => p.severity === "warning",
      );
      expect(warningPatterns.length).toBeGreaterThan(0);
      expect(warningPatterns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "cache-thrashing" }),
          expect.objectContaining({ id: "batch-processing-overload" }),
          expect.objectContaining({ id: "high-throughput-saturation" }),
          expect.objectContaining({ id: "persistent-slow-operations" }),
        ]),
      );
    });

    it("should include info severity patterns", () => {
      const infoPatterns = BOTTLENECK_PATTERNS.filter(
        (p) => p.severity === "info",
      );
      expect(infoPatterns.length).toBeGreaterThan(0);
      expect(infoPatterns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "compression-efficiency-degradation" }),
        ]),
      );
    });
  });

  describe("Automated Actions", () => {
    it("should have automated actions for rate limiting", () => {
      const rateLimitPattern = BOTTLENECK_PATTERNS.find(
        (p) => p.id === "rate-limit-exhaustion",
      )!;
      expect(rateLimitPattern.automatedActions).toBeDefined();
      expect(rateLimitPattern.automatedActions!.length).toBeGreaterThan(0);

      const reduceRateAction = rateLimitPattern.automatedActions!.find(
        (a) => a.id === "reduce-request-rate",
      );
      expect(reduceRateAction).toBeDefined();
      expect(reduceRateAction!.script).toBe("reduce-request-rate");
      expect(reduceRateAction!.requiresApproval).toBe(true);
    });

    it("should have automated actions for circuit breaker", () => {
      const circuitBreakerPattern = BOTTLENECK_PATTERNS.find(
        (p) => p.id === "circuit-breaker-failover",
      )!;
      expect(circuitBreakerPattern.automatedActions).toBeDefined();
      expect(circuitBreakerPattern.automatedActions!.length).toBeGreaterThan(0);

      const circuitBreakerAction = circuitBreakerPattern.automatedActions!.find(
        (a) => a.id === "enable-circuit-breaker",
      );
      expect(circuitBreakerAction).toBeDefined();
      expect(circuitBreakerAction!.script).toBe("enable-circuit-breaker");
      expect(circuitBreakerAction!.requiresApproval).toBe(true);
    });

    it("should handle patterns without automated actions", () => {
      const cacheThrashingPattern = BOTTLENECK_PATTERNS.find(
        (p) => p.id === "cache-thrashing",
      )!;
      expect(cacheThrashingPattern.automatedActions).toBeUndefined();
    });
  });

  describe("Confidence Thresholds", () => {
    it("should have appropriate confidence thresholds for critical patterns", () => {
      const criticalPatterns = BOTTLENECK_PATTERNS.filter(
        (p) => p.severity === "critical",
      );

      criticalPatterns.forEach((pattern) => {
        // Critical patterns should have higher confidence requirements
        expect(pattern.minimumConfidence).toBeGreaterThanOrEqual(85);

        // Impact thresholds should be significant
        expect(pattern.impactThreshold).toBeGreaterThanOrEqual(80);
      });
    });

    it("should have appropriate confidence thresholds for warning patterns", () => {
      const warningPatterns = BOTTLENECK_PATTERNS.filter(
        (p) => p.severity === "warning",
      );

      warningPatterns.forEach((pattern) => {
        // Warning patterns can have lower confidence requirements
        expect(pattern.minimumConfidence).toBeGreaterThanOrEqual(70);
        expect(pattern.minimumConfidence).toBeLessThanOrEqual(85);
      });
    });

    it("should have appropriate confidence thresholds for info patterns", () => {
      const infoPatterns = BOTTLENECK_PATTERNS.filter(
        (p) => p.severity === "info",
      );

      infoPatterns.forEach((pattern) => {
        // Info patterns can have lower confidence requirements
        expect(pattern.minimumConfidence).toBeLessThanOrEqual(75);
      });
    });
  });

  describe("Anomaly Detection Configuration", () => {
    it("should have valid anomaly detector configurations", () => {
      BOTTLENECK_PATTERNS.forEach((pattern) => {
        expect(pattern.anomalyDetector.windowSize).toBeGreaterThan(0);
        expect(pattern.anomalyDetector.sensitivity).toBeGreaterThan(0);
        expect(pattern.anomalyDetector.sensitivity).toBeLessThanOrEqual(1);
        expect(pattern.anomalyDetector.baselinePeriod).toBeGreaterThan(0);
      });
    });

    it("should have patterns with varying detection sensitivities", () => {
      const sensitivities = BOTTLENECK_PATTERNS.map(
        (p) => p.anomalyDetector.sensitivity,
      );
      const minSensitivity = Math.min(...sensitivities);
      const maxSensitivity = Math.max(...sensitivities);

      // Should have range of sensitivities for different detection needs
      expect(maxSensitivity - minSensitivity).toBeGreaterThan(0.1);
    });
  });

  describe("Utility Functions", () => {
    describe("getAllBottleneckPatterns", () => {
      it("should return all patterns", () => {
        const patterns = getAllBottleneckPatterns();
        expect(patterns).toHaveLength(9);
        expect(patterns).toEqual(BOTTLENECK_PATTERNS);
      });
    });

    describe("getPatternsByCategory", () => {
      it("should filter patterns by category", () => {
        const performancePatterns = getPatternsByCategory("performance");
        performancePatterns.forEach((pattern) => {
          expect(pattern.category).toBe("performance");
        });

        const reliabilityPatterns = getPatternsByCategory("reliability");
        reliabilityPatterns.forEach((pattern) => {
          expect(pattern.category).toBe("reliability");
        });
      });

      it("should return empty array for unknown category", () => {
        const unknownPatterns = getPatternsByCategory("unknown");
        expect(unknownPatterns).toHaveLength(0);
      });
    });

    describe("getPatternsBySeverity", () => {
      it("should filter patterns by severity", () => {
        const criticalPatterns = getPatternsBySeverity("critical");
        criticalPatterns.forEach((pattern) => {
          expect(pattern.severity).toBe("critical");
        });

        const warningPatterns = getPatternsBySeverity("warning");
        warningPatterns.forEach((pattern) => {
          expect(pattern.severity).toBe("warning");
        });
      });

      it("should return empty array for unknown severity", () => {
        const unknownPatterns = getPatternsBySeverity(
          "unknown" as "critical" | "warning" | "info",
        );
        expect(unknownPatterns).toHaveLength(0);
      });
    });

    describe("getBottleneckPattern", () => {
      it("should return pattern by id", () => {
        const memoryLeak = getBottleneckPattern("memory-leak");
        expect(memoryLeak).toBeDefined();
        expect(memoryLeak!.id).toBe("memory-leak");
      });

      it("should return undefined for unknown id", () => {
        const unknown = getBottleneckPattern("unknown-pattern");
        expect(unknown).toBeUndefined();
      });
    });
  });

  describe("Pattern Performance Characteristics", () => {
    it("should have reasonable number of conditions per pattern", () => {
      BOTTLENECK_PATTERNS.forEach((pattern) => {
        // Patterns should have between 1-4 conditions for performance
        expect(pattern.conditions.length).toBeGreaterThanOrEqual(1);
        expect(pattern.conditions.length).toBeLessThanOrEqual(4);
      });
    });

    it("should have reasonable number of indicators per pattern", () => {
      BOTTLENECK_PATTERNS.forEach((pattern) => {
        // Should have primary indicators
        expect(pattern.primaryIndicators.length).toBeGreaterThan(0);
        expect(pattern.primaryIndicators.length).toBeLessThanOrEqual(3);

        // May have correlated indicators
        expect(pattern.correlatedIndicators.length).toBeGreaterThanOrEqual(0);
        expect(pattern.correlatedIndicators.length).toBeLessThanOrEqual(3);
      });
    });

    it("should have non-zero condition weights", () => {
      BOTTLENECK_PATTERNS.forEach((pattern) => {
        pattern.conditions.forEach((condition) => {
          expect(condition.weight).toBeGreaterThan(0);
          expect(condition.weight).toBeLessThanOrEqual(100);
        });
      });
    });

    it("should have reasonable duration thresholds", () => {
      BOTTLENECK_PATTERNS.forEach((pattern) => {
        pattern.conditions.forEach((condition) => {
          // Durations should be reasonable (30 seconds to 15 minutes)
          expect(condition.duration).toBeGreaterThanOrEqual(30000);
          expect(condition.duration).toBeLessThanOrEqual(900000);
        });
      });
    });
  });

  describe("Pattern Validation", () => {
    it("should have unique pattern IDs", () => {
      const ids = BOTTLENECK_PATTERNS.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(BOTTLENECK_PATTERNS.length);
    });

    it("should have valid metric paths in conditions", () => {
      // Common metric prefixes used in patterns
      const validPrefixes = [
        "overall.",
        "caching.",
        "batching.",
        "compression.",
      ];

      BOTTLENECK_PATTERNS.forEach((pattern) => {
        pattern.conditions.forEach((condition) => {
          const hasValidPrefix = validPrefixes.some((prefix) =>
            condition.metric.startsWith(prefix),
          );
          expect(hasValidPrefix).toBe(true);
        });
      });
    });

    it("should have consistent operator usage", () => {
      // Most conditions should use 'gt' for performance issues
      const gtConditions = BOTTLENECK_PATTERNS.flatMap(
        (p) => p.conditions,
      ).filter((c) => c.operator === "gt");
      expect(gtConditions.length).toBeGreaterThan(BOTTLENECK_PATTERNS.length); // At least one per pattern

      // Some conditions should use 'lt' for efficiency issues
      const ltConditions = BOTTLENECK_PATTERNS.flatMap(
        (p) => p.conditions,
      ).filter((c) => c.operator === "lt");
      expect(ltConditions.length).toBeGreaterThan(0);
    });
  });
});
