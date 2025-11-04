import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock the bottleneck detector
vi.mock("../../lib/monitoring/bottleneck-detector", () => ({
  bottleneckDetector: {
    getBottleneck: vi.fn(),
    getCorrelationData: vi.fn(),
    resolveBottleneck: vi.fn(),
    getHistoricalBottlenecks: vi.fn(),
  },
}));

import { GET, PATCH, DELETE } from "../../app/api/bottlenecks/[id]/route";
import { bottleneckDetector } from "../../lib/monitoring/bottleneck-detector";

// Mock the bottleneck patterns
vi.mock("../../lib/monitoring/bottleneck-patterns", () => ({
  BOTTLENECK_PATTERNS: [
    {
      id: "memory-leak",
      name: "Memory Leak Detection",
      description: "Detects potential memory leaks in the application",
      category: "performance",
      severity: "critical",
    },
    {
      id: "cache-thrashing",
      name: "Cache Thrashing",
      description: "Identifies excessive cache eviction patterns",
      category: "efficiency",
      severity: "warning",
    },
  ],
}));

// Type definitions for test data
interface BottleneckMetrics {
  [key: string]: {
    value: number;
    threshold: number;
    breached: boolean;
  };
}

interface BottleneckRecommendation {
  priority: "critical" | "high" | "medium" | "low";
  category: "immediate" | "preventative" | "configuration" | "monitoring";
  action: string;
  expectedImpact: string;
  estimatedTime?: number;
  automated?: boolean;
  rolloutStrategy?: string;
}

interface Correlation {
  metric1: string;
  metric2: string;
  correlationCoefficient: number;
  strength: "weak" | "moderate" | "strong" | "very_strong";
  direction: "positive" | "negative" | "neutral";
}

interface DetectedBottleneck {
  id: string;
  patternId: string;
  timestamp: number;
  confidence: number;
  impact: "critical" | "severe" | "moderate" | "minor";
  metrics: BottleneckMetrics;
  correlations: Correlation[];
  recommendations: BottleneckRecommendation[];
  resolved?: boolean;
  resolution?: {
    resolvedBy: "automatic" | "manual";
    actionTaken: string;
    resolutionTime: number;
    followUpActions?: string[];
  };
  resolutionTime?: number;
}

interface HistoricalBottleneck {
  bottleneckId: string;
  patternId: string;
  detectedAt: number;
  resolvedAt?: number;
  confidence: number;
  actionsTaken: string[];
}

const mockBottleneck: DetectedBottleneck = {
  id: "test-bottleneck-1",
  patternId: "memory-leak",
  timestamp: Date.now(),
  confidence: 90,
  impact: "severe",
  metrics: {
    "memory.usage": { value: 95, threshold: 80, breached: true },
    "gc.collections": { value: 150, threshold: 100, breached: true },
  },
  correlations: [
    {
      metric1: "memory.usage",
      metric2: "gc.collections",
      correlationCoefficient: 0.85,
      strength: "strong",
      direction: "positive",
    },
  ],
  recommendations: [
    {
      priority: "high",
      category: "immediate",
      action: "Restart application to clear memory leaks",
      expectedImpact: "Reduce memory usage by 40%",
      estimatedTime: 15,
      automated: true,
    },
    {
      priority: "medium",
      category: "preventative",
      action: "Implement memory profiling in production",
      expectedImpact: "Early detection of future leaks",
      estimatedTime: 120,
    },
  ],
  resolved: false,
};

const mockResolvedBottleneck: DetectedBottleneck = {
  ...mockBottleneck,
  id: "test-bottleneck-2",
  resolved: true,
  resolution: {
    resolvedBy: "manual",
    actionTaken: "Application restart completed successfully",
    resolutionTime: Date.now() - 300000, // 5 minutes ago
    followUpActions: ["Monitor memory usage for 24 hours"],
  },
  resolutionTime: Date.now() - 300000,
};

const mockHistoricalBottlenecks: HistoricalBottleneck[] = [
  {
    bottleneckId: "historical-1",
    patternId: "memory-leak",
    detectedAt: Date.now() - 3600000,
    resolvedAt: Date.now() - 3500000,
    confidence: 85,
    actionsTaken: ["Fixed memory leak in data processing module"],
  },
];

describe("Bottlenecks Individual API - GET /api/bottlenecks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bottleneckDetector.getBottleneck).mockReturnValue(mockBottleneck);
    vi.mocked(bottleneckDetector.getCorrelationData).mockReturnValue({
      correlations: [
        {
          metric: "memory.usage",
          values: [80, 85, 90, 95],
          timestamps: [Date.now() - 300000, Date.now() - 200000, Date.now() - 100000, Date.now()],
          trend: "rising",
        },
      ],
    });
    vi.mocked(bottleneckDetector.getHistoricalBottlenecks).mockReturnValue(
      mockHistoricalBottlenecks,
    );
  });

  it("should return detailed bottleneck information for valid ID", async () => {
    const request = new NextRequest("http://localhost:3000/api/bottlenecks/test-bottleneck-1");
    
    // Mock the context.params
    const mockParams = Promise.resolve({ id: "test-bottleneck-1" });
    const response = await GET(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.bottleneck).toEqual(mockBottleneck);
    expect(data.pattern).toEqual({
      name: "Memory Leak Detection",
      description: "Detects potential memory leaks in the application",
      category: "performance",
      severity: "critical",
    });
    expect(data.correlationData).toBeDefined();
    expect(data.relatedBottlenecks).toHaveLength(1);
    expect(data.recommendations).toHaveLength(2);
    expect(data.metadata).toBeDefined();
    expect(data.metadata.timestamp).toBeDefined();
  });

  it("should return 400 for missing bottleneck ID", async () => {
    const request = new NextRequest("http://localhost:3000/api/bottlenecks/");
    const mockParams = Promise.resolve({ id: "" });
    
    const response = await GET(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Bottleneck ID is required");
  });

  it("should return 404 for non-existent bottleneck", async () => {
    vi.mocked(bottleneckDetector.getBottleneck).mockReturnValue(null);
    
    const request = new NextRequest("http://localhost:3000/api/bottlenecks/non-existent");
    const mockParams = Promise.resolve({ id: "non-existent" });
    
    const response = await GET(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Bottleneck not found");
  });

  it("should return 500 for internal server error", async () => {
    vi.mocked(bottleneckDetector.getBottleneck).mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const request = new NextRequest("http://localhost:3000/api/bottlenecks/test-bottleneck-1");
    const mockParams = Promise.resolve({ id: "test-bottleneck-1" });

    const response = await GET(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to retrieve bottleneck details");
  });

  it("should include metadata with bottleneck age and time to resolve", async () => {
    const request = new NextRequest("http://localhost:3000/api/bottlenecks/test-bottleneck-1");
    const mockParams = Promise.resolve({ id: "test-bottleneck-1" });
    
    const response = await GET(request, { params: mockParams });
    const data = await response.json();

    expect(data.metadata.age).toBeGreaterThan(0);
    expect(data.metadata.timeToResolve).toBeNull(); // Not resolved yet
    expect(data.metadata.confidenceReasoning).toEqual([
      "2/2 conditions were breached",
      "Strong correlations detected: very_strong patterns",
    ]);
    expect(data.metadata.nextSteps).toHaveLength(2); // Top 3 recommendations
  });

  it("should return resolved bottleneck with proper metadata", async () => {
    vi.mocked(bottleneckDetector.getBottleneck).mockReturnValue(mockResolvedBottleneck);

    const request = new NextRequest("http://localhost:3000/api/bottlenecks/test-bottleneck-2");
    const mockParams = Promise.resolve({ id: "test-bottleneck-2" });
    
    const response = await GET(request, { params: mockParams });
    const data = await response.json();

    expect(data.bottleneck.resolved).toBe(true);
    expect(data.metadata.timeToResolve).toBeGreaterThan(0);
    expect(data.metadata.nextSteps).toEqual([
      {
        action: "Monitor memory usage for 24 hours",
        priority: "medium",
        category: "preventative",
        type: "follow-up",
      },
    ]);
  });
});

describe("Bottlenecks Individual API - PATCH /api/bottlenecks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bottleneckDetector.resolveBottleneck).mockReturnValue(mockResolvedBottleneck);
  });

  it("should resolve bottleneck with automatic resolution", async () => {
    const payload = {
      resolution: "automatic" as const,
      actionTaken: "Automated cleanup executed",
      followUpActions: ["Monitor for 1 hour"],
    };

    const request = new NextRequest("http://localhost:3000/api/bottlenecks/test-bottleneck-1", {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const mockParams = Promise.resolve({ id: "test-bottleneck-1" });
    const response = await PATCH(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.resolvedBottleneck).toEqual(mockResolvedBottleneck);
    expect(data.message).toBe("Bottleneck test-bottleneck-1 marked as resolved");

    expect(bottleneckDetector.resolveBottleneck).toHaveBeenCalledWith(
      "test-bottleneck-1",
      {
        resolvedBy: "automatic",
        actionTaken: "Automated cleanup executed",
        resolutionTime: expect.any(Number),
        followUpActions: ["Monitor for 1 hour"],
      },
    );
  });

  it("should resolve bottleneck with manual resolution", async () => {
    const payload = {
      resolution: "manual" as const,
      actionTaken: "Manual intervention completed",
    };

    const request = new NextRequest("http://localhost:3000/api/bottlenecks/test-bottleneck-1", {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const mockParams = Promise.resolve({ id: "test-bottleneck-1" });
    const response = await PATCH(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(bottleneckDetector.resolveBottleneck).toHaveBeenCalledWith(
      "test-bottleneck-1",
      {
        resolvedBy: "manual",
        actionTaken: "Manual intervention completed",
        resolutionTime: expect.any(Number),
        followUpActions: [],
      },
    );
  });

  it("should return 400 for missing resolution type", async () => {
    const payload = {
      actionTaken: "Test action",
    };

    const request = new NextRequest("http://localhost:3000/api/bottlenecks/test-bottleneck-1", {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const mockParams = Promise.resolve({ id: "test-bottleneck-1" });
    const response = await PATCH(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Valid resolution type (automatic/manual) is required");
  });

  it("should return 400 for invalid resolution type", async () => {
    const payload = {
      resolution: "invalid" as const,
      actionTaken: "Test action",
    };

    const request = new NextRequest("http://localhost:3000/api/bottlenecks/test-bottleneck-1", {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const mockParams = Promise.resolve({ id: "test-bottleneck-1" });
    const response = await PATCH(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Valid resolution type (automatic/manual) is required");
  });

  it("should return 400 for missing action taken", async () => {
    const payload = {
      resolution: "automatic" as const,
    };

    const request = new NextRequest("http://localhost:3000/api/bottlenecks/test-bottleneck-1", {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const mockParams = Promise.resolve({ id: "test-bottleneck-1" });
    const response = await PATCH(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Action taken description is required");
  });

  it("should return 404 for non-existent bottleneck", async () => {
    vi.mocked(bottleneckDetector.resolveBottleneck).mockReturnValue(null);

    const payload = {
      resolution: "manual" as const,
      actionTaken: "Test action",
    };

    const request = new NextRequest("http://localhost:3000/api/bottlenecks/non-existent", {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const mockParams = Promise.resolve({ id: "non-existent" });
    const response = await PATCH(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Bottleneck not found or already resolved");
  });

  it("should return 500 for internal server error during PATCH", async () => {
    vi.mocked(bottleneckDetector.resolveBottleneck).mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const payload = {
      resolution: "manual" as const,
      actionTaken: "Test action",
    };

    const request = new NextRequest("http://localhost:3000/api/bottlenecks/test-bottleneck-1", {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const mockParams = Promise.resolve({ id: "test-bottleneck-1" });
    const response = await PATCH(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to resolve bottleneck");
  });
});

describe("Bottlenecks Individual API - DELETE /api/bottlenecks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should remove resolved bottleneck from active tracking", async () => {
    vi.mocked(bottleneckDetector.getBottleneck).mockReturnValue(mockResolvedBottleneck);

    const request = new NextRequest("http://localhost:3000/api/bottlenecks/test-bottleneck-2", {
      method: "DELETE",
    });

    const mockParams = Promise.resolve({ id: "test-bottleneck-2" });
    const response = await DELETE(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("Resolved bottleneck test-bottleneck-2 acknowledged and removed from active tracking");
  });

  it("should return 404 for non-existent bottleneck", async () => {
    vi.mocked(bottleneckDetector.getBottleneck).mockReturnValue(null);

    const request = new NextRequest("http://localhost:3000/api/bottlenecks/non-existent", {
      method: "DELETE",
    });

    const mockParams = Promise.resolve({ id: "non-existent" });
    const response = await DELETE(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Bottleneck not found");
  });

  it("should return 400 for unresolved bottleneck", async () => {
    vi.mocked(bottleneckDetector.getBottleneck).mockReturnValue(mockBottleneck);

    const request = new NextRequest("http://localhost:3000/api/bottlenecks/test-bottleneck-1", {
      method: "DELETE",
    });

    const mockParams = Promise.resolve({ id: "test-bottleneck-1" });
    const response = await DELETE(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Bottleneck must be resolved before deletion");
  });

  it("should return 500 for internal server error", async () => {
    vi.mocked(bottleneckDetector.getBottleneck).mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const request = new NextRequest("http://localhost:3000/api/bottlenecks/test-bottleneck-1", {
      method: "DELETE",
    });

    const mockParams = Promise.resolve({ id: "test-bottleneck-1" });
    const response = await DELETE(request, { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to delete bottleneck");
  });
});
