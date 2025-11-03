/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getToolDiscovery } from "../../app/api/tools/discovery/route";
import * as toolsModule from "../../tools";

// Mock the tools module
vi.mock("../../tools", () => ({
  getAllTools: vi.fn(),
  getAvailableApis: vi.fn(),
}));

const mockGetAllTools = vi.mocked(toolsModule.getAllTools);
const mockGetAvailableApis = vi.mocked(toolsModule.getAvailableApis);

describe("GET /api/tools/discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful responses", () => {
    it("returns tool discovery data with correct transformation", async () => {
      const mockTools = [
        {
          name: "GitHub",
          enabled: true,
          widgets: [
            {
              title: "Pull Requests",
              type: "table",
              headers: ["Title", "Status"],
              dynamic: true,
            },
          ],
          apis: {
            pulls: {
              method: "GET",
              description: "Get pull requests",
              parameters: {
                state: {
                  type: "string",
                  required: false,
                  description: "PR state",
                },
              },
            },
          },
        },
        {
          name: "Jira",
          enabled: false,
          widgets: [
            {
              title: "Issues",
              type: "metric",
              headers: undefined,
              dynamic: true,
            },
          ],
          apis: {
            issues: {
              method: "GET",
              description: "Get issues",
              parameters: {},
            },
          },
        },
      ];

      const mockApis = {
        "github/pulls": {
          tool: "GitHub",
          api: { method: "GET", description: "Get PRs" },
        },
        "jira/issues": {
          tool: "Jira",
          api: { method: "GET", description: "Get issues" },
        },
      };

      mockGetAllTools.mockReturnValue(mockTools as any);
      mockGetAvailableApis.mockReturnValue(mockApis);

      const response = await getToolDiscovery();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tools).toHaveLength(2);
      expect(data.totalTools).toBe(2);
      expect(data.enabledTools).toBe(1);

      // Check tool transformation
      expect(data.tools[0]).toEqual({
        name: "GitHub",
        enabled: true,
        widgets: [
          {
            title: "Pull Requests",
            type: "table",
            headers: ["Title", "Status"],
            dynamic: true,
          },
        ],
        apis: [
          {
            endpoint: "pulls",
            method: "GET",
            description: "Get pull requests",
            parameters: {
              state: {
                type: "string",
                required: false,
                description: "PR state",
              },
            },
          },
        ],
      });

      // Check available APIs
      expect(data.apis).toEqual(mockApis);
    });

    it("handles tools without APIs gracefully", async () => {
      const mockTools = [
        {
          name: "ToolWithoutAPIs",
          enabled: true,
          widgets: [{ title: "Dashboard", type: "card", dynamic: false }],
          apis: undefined,
        },
      ];

      mockGetAllTools.mockReturnValue(mockTools as any);
      mockGetAvailableApis.mockReturnValue({});

      const response = await getToolDiscovery();
      const data = await response.json();

      expect(data.tools[0].apis).toEqual([]);
    });

    it("handles tools without widgets gracefully", async () => {
      const mockTools = [
        {
          name: "ToolWithoutWidgets",
          enabled: true,
          widgets: null,
          apis: {},
        },
      ];

      mockGetAllTools.mockReturnValue(mockTools as any);
      mockGetAvailableApis.mockReturnValue({});

      const response = await getToolDiscovery();
      const data = await response.json();

      expect(data.tools[0].widgets).toEqual([]);
    });

    it("returns empty data when no tools exist", async () => {
      mockGetAllTools.mockReturnValue([]);
      mockGetAvailableApis.mockReturnValue({});

      const response = await getToolDiscovery();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tools).toEqual([]);
      expect(data.totalTools).toBe(0);
      expect(data.enabledTools).toBe(0);
      expect(data.apis).toEqual({});
    });
  });

  describe("error handling", () => {
    it("returns 500 error when getAllTools throws", async () => {
      mockGetAllTools.mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const response = await getToolDiscovery();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to discover tools");
    });

    it("handles malformed tool structure gracefully", async () => {
      const mockTools = [
        { name: "ValidTool", enabled: true, widgets: [], apis: {} },
        { invalidField: "InvalidTool" }, // Missing required fields
      ];

      mockGetAllTools.mockReturnValue(mockTools as any);
      mockGetAvailableApis.mockReturnValue({});

      const response = await getToolDiscovery();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tools).toHaveLength(1); // Malformed tool is filtered out
      expect(data.tools[0].name).toBe("ValidTool");
      expect(data.totalTools).toBe(2); // Total still counts all tools
      // Should handle malformed tools without crashing
    });
  });
});
