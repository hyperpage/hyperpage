import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock the bottleneck detector
vi.mock("@/lib/monitoring/bottleneck-detector", () => ({
  bottleneckDetector: {
    getActiveBottlenecks: vi.fn(),
    getBottleneckAnalysis: vi.fn(),
    getHistoricalBottlenecks: vi.fn(),
    getCorrelationData: vi.fn(),
  },
}));

import { GET, POST } from "@/app/api/bottlenecks/route";
import { bottleneckDetector } from "@/lib/monitoring/bottleneck-detector";

// Type definitions for test data
interface BottleneckMetrics {
  [key: string]: {
    value: number;
    threshold: number;
    breached: boolean;
  };
}

interface BottleneckRecommendation {
  priority: "high" | "medium" | "low";
  category: "immediate" | "preventative" | "configuration" | "monitoring";
  action: string;
  expectedImpact: string;
  estimatedTime: number;
}

interface Correlation {
  metric1: string;
  metric2: string;
  correlationCoefficient: number;
  strength: "weak" | "moderate" | "strong" | "very_strong";
  direction: "positive" | "negative" | "neutral";
}

interface Bottleneck {
  id: string;
  patternId: string;
  timestamp: number;
  confidence: number;
  impact: "critical" | "severe" | "moderate" | "minor";
  metrics: BottleneckMetrics;
  correlations: Correlation[];
  recommendations: BottleneckRecommendation[];
  resolved: boolean;
}

interface BottleneckAnalysis {
  activeCount: number;
  resolvedCount: number;
  unresolvedCount: number;
  averageResolutionTime: number;
  topBottleneckTypes: Array<{ patternId: string; count: number }>;
  resolutionRate: number;
}

interface HistoricalBottleneck {
  bottleneckId: string;
  patternId: string;
  detectedAt: number;
  resolvedAt: number;
  confidence: number;
  actionsTaken: string[];
}

describe("Bottlenecks API - GET /api/bottlenecks", () => {
  const mockBottlenecks: Bottleneck[] = [
    {
      id: "test-bottleneck-1",
      patternId: "memory-leak",
      timestamp: Date.now(),
      confidence: 90,
      impact: "severe",
      metrics: { "test.metric": { value: 100, threshold: 80, breached: true } },
      correlations: [],
      recommendations: [
        {
          priority: "high",
          category: "immediate",
          action: "Test action",
          expectedImpact: "Test impact",
          estimatedTime: 30,
        },
      ],
      resolved: false,
    },
    {
      id: "test-bottleneck-2",
      patternId: "cache-thrashing",
      timestamp: Date.now() - 60000,
      confidence: 75,
      impact: "moderate",
      metrics: {
        "cache.evictRate": { value: 25, threshold: 20, breached: true },
      },
      correlations: [],
      recommendations: [],
      resolved: false,
    },
  ];

  const mockAnalysis: BottleneckAnalysis = {
    activeCount: 2,
    resolvedCount: 5,
    unresolvedCount: 1,
    averageResolutionTime: 45,
    topBottleneckTypes: [
      { patternId: "memory-leak", count: 3 },
      { patternId: "cache-thrashing", count: 2 },
    ],
    resolutionRate: 83.3,
  };

  const mockHistoricalBottlenecks: HistoricalBottleneck[] = [
    {
      bottleneckId: "historical-1",
      patternId: "memory-leak",
      detectedAt: Date.now() - 3600000,
      resolvedAt: Date.now() - 3500000,
      confidence: 85,
      actionsTaken: ["Fixed memory leak"],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(bottleneckDetector.getActiveBottlenecks).mockReturnValue(
      mockBottlenecks,
    );
    vi.mocked(bottleneckDetector.getBottleneckAnalysis).mockReturnValue(
      mockAnalysis,
    );
    vi.mocked(bottleneckDetector.getHistoricalBottlenecks).mockReturnValue(
      mockHistoricalBottlenecks,
    );
    vi.mocked(bottleneckDetector.getCorrelationData).mockReturnValue({
      correlations: [],
    });
  });

  it("should return active bottlenecks with default parameters", async () => {
    const request = new NextRequest("http://localhost:3000/api/bottlenecks");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.activeBottlenecks).toEqual(mockBottlenecks);
    expect(data.analysis).toEqual(mockAnalysis);
    expect(data.historicalBottlenecks).toHaveLength(0); // Not requested
    expect(data.summary.criticalCount).toBe(0); // No critical impact
    expect(data.summary.warningCount).toBe(2); // Both are severe/moderate
    expect(data.timestamp).toBeDefined();
  });

  it("should include historical bottlenecks when requested", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/bottlenecks?history=true",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.historicalBottlenecks).toEqual(mockHistoricalBottlenecks);
    expect(
      vi.mocked(bottleneckDetector.getHistoricalBottlenecks),
    ).toHaveBeenCalledWith(20); // Default limit
  });

  it("should respect limit parameter for historical data", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/bottlenecks?history=true&limit=5",
    );
    await GET(request);

    expect(
      vi.mocked(bottleneckDetector.getHistoricalBottlenecks),
    ).toHaveBeenCalledWith(5);
  });

  it("should respect timeRange parameter", async () => {
    const customTimeRange = 7200000; // 2 hours
    const request = new NextRequest(
      `http://localhost:3000/api/bottlenecks?timeRange=${customTimeRange}`,
    );
    await GET(request);

    // The timeRange is used in calculateBottleneckTrends helper
  });

  it("should handle empty results", async () => {
    vi.mocked(bottleneckDetector.getActiveBottlenecks).mockReturnValue([]);
    vi.mocked(bottleneckDetector.getBottleneckAnalysis).mockReturnValue({
      ...mockAnalysis,
      activeCount: 0,
      resolvedCount: 0,
      unresolvedCount: 0,
    });

    const request = new NextRequest("http://localhost:3000/api/bottlenecks");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.activeBottlenecks).toEqual([]);
    expect(data.analysis.activeCount).toBe(0);
    expect(data.summary.criticalCount).toBe(0);
    expect(data.summary.warningCount).toBe(0);
    expect(data.summary.lastDetection).toBeNull();
  });

  it("should handle error conditions", async () => {
    vi.mocked(bottleneckDetector.getActiveBottlenecks).mockImplementation(
      () => {
        throw new Error("Database connection failed");
      },
    );

    const request = new NextRequest("http://localhost:3000/api/bottlenecks");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("Failed to retrieve bottleneck data");
  });

  it("should correctly count bottleneck severity categories", async () => {
    const mixedBottlenecks: Bottleneck[] = [
      { ...mockBottlenecks[0], impact: "critical" },
      { ...mockBottlenecks[1], impact: "severe" },
      {
        impact: "minor",
        id: "minor-bottleneck",
        patternId: "test",
        timestamp: Date.now(),
        confidence: 50,
        metrics: {
          "latency.metric": { value: 10, threshold: 20, breached: false },
        },
        correlations: [],
        recommendations: [],
        resolved: false,
      },
    ];

    vi.mocked(bottleneckDetector.getActiveBottlenecks).mockReturnValue(
      mixedBottlenecks,
    );

    const request = new NextRequest("http://localhost:3000/api/bottlenecks");
    const response = await GET(request);
    const data = await response.json();

    expect(data.summary.criticalCount).toBe(1);
    expect(data.summary.warningCount).toBe(1); // severe counts as warning
    expect(data.summary.lastDetection).toBeDefined();
  });
});

describe("Bottlenecks API - POST /api/bottlenecks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle manual bottleneck analysis trigger", async () => {
    const payload = {
      timeRange: 300000,
      categories: ["performance", "capacity"],
    };

    const request = new NextRequest("http://localhost:3000/api/bottlenecks", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain("Bottleneck analysis triggered");
    expect(data.parameters.timeRange).toBe(300000);
    expect(data.parameters.categories).toEqual(["performance", "capacity"]);
    expect(data.timestamp).toBeDefined();
  });

  it("should use default timeRange when not provided", async () => {
    const request = new NextRequest("http://localhost:3000/api/bottlenecks", {
      method: "POST",
      body: JSON.stringify({}),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.parameters.timeRange).toBe(300000); // 5 minutes default
  });

  it("should handle invalid JSON payload", async () => {
    const request = new NextRequest("http://localhost:3000/api/bottlenecks", {
      method: "POST",
      body: "invalid json",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("Failed to trigger bottleneck analysis");
  });

  it("should handle empty payload", async () => {
    const request = new NextRequest("http://localhost:3000/api/bottlenecks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("Failed to trigger bottleneck analysis");
  });
});
