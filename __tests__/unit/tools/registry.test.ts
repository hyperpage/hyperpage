import { beforeEach, describe, expect, it } from "vitest";

import {
  getAllTools,
  getTool,
  getToolNames,
  registerTool,
  toolRegistry,
} from "@/tools/registry";
import { Tool } from "@/tools/tool-types";

const createTool = (overrides: Partial<Tool> = {}): Tool => ({
  name: "TestTool",
  slug: "test-tool",
  enabled: true,
  ui: {
    color: "bg-blue-500",
    icon: null,
  },
  widgets: [],
  apis: {},
  handlers: {},
  capabilities: [],
  ...overrides,
});

beforeEach(() => {
  for (const key of Object.keys(toolRegistry)) {
    delete toolRegistry[key as keyof typeof toolRegistry];
  }
});

describe("registerTool", () => {
  it("registers a tool in the registry under the given name", () => {
    const tool = createTool({ name: "ToolA", slug: "tool-a" });

    registerTool("toolA", tool);

    expect(toolRegistry.toolA).toBe(tool);
  });

  it("overwrites an existing registration with the same name", () => {
    const original = createTool({ name: "Original", slug: "original" });
    const updated = createTool({
      name: "Updated",
      slug: "updated",
      enabled: false,
    });

    registerTool("toolX", original);
    registerTool("toolX", updated);

    expect(toolRegistry.toolX).toBe(updated);
    expect(toolRegistry.toolX?.name).toBe("Updated");
    expect(toolRegistry.toolX?.enabled).toBe(false);
  });

  it("supports registering multiple distinct tools", () => {
    const tool1 = createTool({ name: "Tool1", slug: "tool-1" });
    const tool2 = createTool({
      name: "Tool2",
      slug: "tool-2",
      ui: { color: "bg-green-500", icon: null },
    });

    registerTool("tool1", tool1);
    registerTool("tool2", tool2);

    expect(Object.keys(toolRegistry)).toHaveLength(2);
    expect(toolRegistry.tool1).toBe(tool1);
    expect(toolRegistry.tool2).toBe(tool2);
  });
});

describe("toolRegistry initial state", () => {
  it("is empty before any registrations", () => {
    expect(Object.keys(toolRegistry)).toHaveLength(0);
  });
});

describe("getTool", () => {
  it("returns a registered tool by name", () => {
    const tool = createTool({ name: "Lookup", slug: "lookup" });

    registerTool("lookup", tool);

    expect(getTool("lookup")).toBe(tool);
  });

  it("returns undefined for unknown tools", () => {
    expect(getTool("missing")).toBeUndefined();
  });
});

describe("getAllTools", () => {
  it("returns all registered tools", () => {
    const tool1 = createTool({ name: "T1", slug: "t1" });
    const tool2 = createTool({ name: "T2", slug: "t2" });

    registerTool("t1", tool1);
    registerTool("t2", tool2);

    const all = getAllTools();
    expect(all).toHaveLength(2);
    expect(all).toContain(tool1);
    expect(all).toContain(tool2);
  });

  it("does not include missing or undefined entries", () => {
    const tool = createTool({ name: "Only", slug: "only" });

    registerTool("only", tool);

    const all = getAllTools();
    expect(all).toEqual([tool]);
  });
});

describe("getToolNames", () => {
  it("returns all registered tool names", () => {
    const tool1 = createTool({ name: "Tool1", slug: "tool-1" });
    const tool2 = createTool({ name: "Tool2", slug: "tool-2" });

    registerTool("alpha", tool1);
    registerTool("beta", tool2);

    const names = getToolNames().sort();
    expect(names).toEqual(["alpha", "beta"]);
  });

  it("returns an empty array when no tools are registered", () => {
    expect(getToolNames()).toEqual([]);
  });
});
