import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/health/route";
import { toolRegistry } from "@/tools/registry";
import { defaultCache } from "@/lib/cache/cache-factory";
import { checkPostgresConnectivity } from "@/lib/database/connection";

// Type definitions for test
interface MockTool {
  name: string;
  slug: string;
  enabled: boolean;
  capabilities: string[];
  ui: { color: string; icon: string };
  widgets: unknown[];
  apis: Record<string, unknown>;
  handlers: Record<string, unknown>;
}

vi.mock("@/lib/database/connection", () => ({
  checkPostgresConnectivity: vi.fn(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("GET /api/health", () => {
  const mockRateLimitHandler = vi.fn();
  const mockCheckPostgresConnectivity =
    checkPostgresConnectivity as unknown as ReturnType<typeof vi.fn>;

  const mockToolGitHub: MockTool = {
    name: "GitHub",
    slug: "github",
    enabled: true,
    capabilities: ["rate-limit"],
    ui: { color: "", icon: "GitHubIcon" },
    widgets: [],
    apis: {},
    handlers: {
      "rate-limit": mockRateLimitHandler,
    },
  };

  const mockToolGitLab: MockTool = {
    name: "GitLab",
    slug: "gitlab",
    enabled: true,
    capabilities: ["rate-limit"],
    ui: { color: "", icon: "GitLabIcon" },
    widgets: [],
    apis: {},
    handlers: {
      "rate-limit": mockRateLimitHandler,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Ensure DB health is mocked for each test (default healthy)
    mockCheckPostgresConnectivity.mockResolvedValue({
      status: "healthy",
      details: {
        message: "OK",
      },
    } as never);

    // Set up mock tools in registry
    (toolRegistry as Record<string, MockTool>).github = mockToolGitHub;
    (toolRegistry as Record<string, MockTool>).gitlab = mockToolGitLab;

    // Mock cache stats
    vi.mocked(defaultCache.getStats).mockResolvedValue({
      size: 5,
      hits: 100,
      misses: 50,
      expiries: 2,
      evictions: 1,
      backend: "memory",
    });

    // Mock successful rate limit responses directly on the mock function
    mockRateLimitHandler.mockResolvedValue({
      rateLimit: {
        resources: {
          core: { limit: 5000, remaining: 4000, reset: 1640995200 },
          search: { limit: 30, remaining: 25, reset: 1640995200 },
          graphql: { limit: 5000, remaining: 4990, reset: 1640995200 },
        },
      },
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    // Clean up mock tools after each test
    delete (toolRegistry as Record<string, MockTool>).github;
    delete (toolRegistry as Record<string, MockTool>).gitlab;
  });

  it("should return enhanced health status with Postgres and rate limiting metrics when DB is healthy", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("healthy");
    expect(data.timestamp).toBeDefined();
    expect(data.environment).toBeDefined();

    // Database health (Postgres-only)
    expect(data.database).toBeDefined();
    expect(data.database.status).toBe("healthy");

    // Check cache stats
    expect(data.cache).toBeDefined();
    expect(data.cache.hitRate).toBe(67); // (100 / (100 + 50)) * 100 rounded

    // Check rate limiting metrics (new schema)
    expect(data.rateLimits).toBeDefined();
    expect(data.rateLimits.overallHealth).toBeDefined();
    expect(data.rateLimits.enabledPlatforms).toBe(2);
    expect(data.rateLimits.averageUsagePercent).toBeDefined();
    expect(data.rateLimits.platforms).toBeDefined();
    expect(Object.keys(data.rateLimits.platforms)).toHaveLength(2);
    expect(data.rateLimits.platforms.github).toBeDefined();
    expect(data.rateLimits.platforms.gitlab).toBeDefined();
  });

  it("should handle rate limit API failures gracefully while DB is healthy", async () => {
    // Mock platform failures
    mockRateLimitHandler.mockRejectedValue(new Error("API Error"));

    const response = await GET();
    const data = await response.json();

    // DB is still mocked as healthy
    expect(response.status).toBe(200);
    expect(data.status).toBe("healthy");
    expect(data.database.status).toBe("healthy");

    // Should report platforms as unknown when API fails
    expect(data.rateLimits.platforms.github.status).toBe("unknown");
    expect(data.rateLimits.platforms.gitlab.status).toBe("unknown");
  });

  it("should report unhealthy when Postgres connectivity fails", async () => {
    mockCheckPostgresConnectivity.mockResolvedValueOnce({
      status: "unhealthy",
      details: {
        message: "connection failed",
      },
    } as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("unhealthy");
    expect(data.database.status).toBe("unhealthy");
  });
});
