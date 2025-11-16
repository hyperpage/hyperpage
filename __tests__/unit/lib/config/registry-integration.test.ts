import { describe, it, expect } from "vitest";

import { toolRegistry } from "@/tools/registry";
import { ToolConfigValidator } from "@/lib/config/tool-schemas";
import { RegistryEnvironmentHelper } from "@/lib/config/environment-helper";
import { configurationMonitor } from "@/lib/config/monitor";

describe("Configuration Optimization - Registry Integration", () => {
  it("should validate existing tool configurations", () => {
    // Test that the new validation system works with existing tools
    for (const [, /* toolName unused */ tool] of Object.entries(toolRegistry)) {
      if (!tool) continue;

      const validation = ToolConfigValidator.validateToolConfig(tool);

      // Basic validation should work for all tools
      expect(validation).toBeDefined();
      expect(validation.isValid).toBeDefined();
      expect(validation.errors).toBeDefined();
      expect(Array.isArray(validation.errors)).toBe(true);
    }
  });

  it("should generate environment template from registry", () => {
    const template = RegistryEnvironmentHelper.generateEnvironmentTemplate();

    expect(template).toContain(
      "# Hyperpage Environment Configuration Template",
    );
    expect(template).toContain("NEXTAUTH_SECRET=your-32-character-secret-here");

    // Should include basic configuration structure
    expect(template).toContain("NODE_ENV=development");
    expect(template).toContain("NEXTAUTH_URL=http://localhost:3000");
  });

  it("should get enabled tools from registry", () => {
    const enabledTools =
      RegistryEnvironmentHelper.getEnabledToolsFromRegistry();

    expect(Array.isArray(enabledTools)).toBe(true);

    // All enabled tools should exist in the registry
    for (const toolName of enabledTools) {
      const tool = toolRegistry[toolName];
      expect(tool).toBeDefined();
      expect(tool?.enabled).toBe(true);
    }
  });

  it("should perform health checks on tools", async () => {
    const healthStatus = await configurationMonitor.performHealthChecks();

    expect(healthStatus).toBeDefined();
    expect(["healthy", "degraded", "unhealthy"]).toContain(
      healthStatus.overall,
    );
    expect(healthStatus.tools).toBeDefined();
    expect(typeof healthStatus.timestamp).toBe("string");
  });
});
