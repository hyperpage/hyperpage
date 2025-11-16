import { describe, it, expect, vi, beforeEach } from "vitest";

import { codeReviewsTool } from "@/tools/code-reviews";
import type { Tool } from "@/tools/tool-types";
import { getEnabledTools } from "@/tools/index";

vi.mock("@/tools/index", () => ({
  getEnabledTools: vi.fn(),
}));

const mockGetEnabledTools = vi.mocked(getEnabledTools);

const createMockTool = (overrides: Partial<Tool>): Tool =>
  ({
    name: "Mock Tool",
    slug: "mock",
    enabled: true,
    ui: { color: "", icon: null },
    widgets: [],
    apis: {},
    handlers: {},
    capabilities: [],
    ...overrides,
  }) as Tool;

describe("codeReviewsTool telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds warning rows when upstream handlers fail", async () => {
    const failingTool = createMockTool({
      name: "GitHub",
      capabilities: ["pull-requests"],
      handlers: {
        "pull-requests": vi.fn().mockRejectedValue(new Error("timeout")),
      },
    });

    mockGetEnabledTools.mockReturnValue([failingTool]);

    const response = await codeReviewsTool.handlers["pull-requests"](
      new Request("http://localhost"),
      {},
    );

    const pullRequests = response.pullRequests as Record<string, unknown>[];
    const warningRow = pullRequests.find((row) => {
      const errorMessage = row["error_message"];
      const repository = row["repository"];
      return typeof errorMessage === "string" && repository === "GitHub";
    });

    expect(warningRow).toBeDefined();
    expect(warningRow?.["error_message"] as string).toContain("timeout");
  });

  it("returns upstream data when available", async () => {
    const pullRequestTool = createMockTool({
      name: "GitHub",
      capabilities: ["pull-requests"],
      handlers: {
        "pull-requests": vi.fn().mockResolvedValue({
          pullRequests: [{ id: "PR-1", created: "2024-01-01T00:00:00.000Z" }],
        }),
      },
    });

    mockGetEnabledTools.mockReturnValue([pullRequestTool]);

    const response = await codeReviewsTool.handlers["pull-requests"](
      new Request("http://localhost"),
      {},
    );

    const pullRequests = response.pullRequests as Array<
      Record<string, unknown>
    >;
    expect(pullRequests).toHaveLength(1);
    expect(pullRequests[0]).toMatchObject({ id: "PR-1" });
  });
});
