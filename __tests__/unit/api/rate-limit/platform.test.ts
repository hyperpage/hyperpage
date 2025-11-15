import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { GET as getRateLimit } from "@/app/api/rate-limit/[platform]/route";
import { toolRegistry } from "@/tools/registry";
import { getServerRateLimitStatus } from "@/lib/rate-limit-service";
import type { Tool } from "@/tools/tool-types";
import type { RateLimitStatus } from "@/lib/types/rate-limit";

vi.mock("@/tools/registry", () => ({
  toolRegistry: {},
}));

vi.mock("@/lib/rate-limit-service", () => ({
  getServerRateLimitStatus: vi.fn(),
}));

const mockedRegistry = vi.mocked(toolRegistry);
const mockGetServerRateLimitStatus = vi.mocked(getServerRateLimitStatus);

const createRequest = (url: string) => new NextRequest(url);

describe("GET /api/rate-limit/[platform]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockedRegistry).forEach((key) => delete mockedRegistry[key]);
  });

  it("returns 400 for invalid platform parameter", async () => {
    const response = await getRateLimit(createRequest("http://test"), {
      params: Promise.resolve({ platform: "invalid!*" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 when platform lacks rate-limit capability", async () => {
    const githubTool: Tool = {
      name: "GitHub",
      slug: "github",
      enabled: true,
      handlers: {},
      apis: {},
      ui: { color: "", icon: null },
      widgets: [],
      capabilities: [],
    };
    mockedRegistry["github"] = githubTool;

    const response = await getRateLimit(createRequest("http://test"), {
      params: Promise.resolve({ platform: "github" }),
    });

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe("PLATFORM_NOT_SUPPORTED");
  });

  it("returns rate-limit data for supported platform", async () => {
    const githubTool: Tool = {
      name: "GitHub",
      slug: "github",
      enabled: true,
      handlers: {
        "rate-limit": vi.fn().mockResolvedValue({ rateLimit: {} }),
      },
      apis: {},
      ui: { color: "", icon: null },
      widgets: [],
      capabilities: ["rate-limit"],
    };
    mockedRegistry["github"] = githubTool;

    const rateLimitStatus: RateLimitStatus = {
      platform: "github",
      lastUpdated: Date.now(),
      dataFresh: true,
      status: "normal",
      limits: {
        github: {
          core: {
            limit: 5000,
            remaining: 4999,
            used: 1,
            usagePercent: 0.02,
            resetTime: null,
            retryAfter: null,
          },
          search: {
            limit: null,
            remaining: null,
            used: null,
            usagePercent: null,
            resetTime: null,
            retryAfter: null,
          },
          graphql: {
            limit: null,
            remaining: null,
            used: null,
            usagePercent: null,
            resetTime: null,
            retryAfter: null,
          },
        },
      },
    };

    mockGetServerRateLimitStatus.mockResolvedValue(rateLimitStatus);

    const response = await getRateLimit(createRequest("http://test"), {
      params: Promise.resolve({ platform: "github" }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.platform).toBe("github");
    expect(payload.status).toBe("normal");
  });
});
