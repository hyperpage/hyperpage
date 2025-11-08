import { describe, it, expect } from "vitest";
import dashboardJson from "@/grafana/hyperpage-rate-limiting-dashboard.json";

// Type definitions for test
interface GrafanaVariable {
  name: string;
  definition?: string;
  [key: string]: unknown;
}

describe("Grafana Dashboard Configuration", () => {
  it("should be valid JSON", () => {
    expect(typeof dashboardJson).toBe("object");
    expect(dashboardJson).toBeDefined();
  });

  it("should have required Grafana dashboard structure", () => {
    expect(dashboardJson).toHaveProperty("dashboard");
    expect(dashboardJson.dashboard).toHaveProperty("title");
    expect(dashboardJson.dashboard).toHaveProperty("panels");
    expect(dashboardJson.dashboard).toHaveProperty("templating");
    expect(dashboardJson.dashboard).toHaveProperty("time");

    expect(dashboardJson.dashboard.title).toBe(
      "Hyperpage Rate Limiting & API Monitoring",
    );
    expect(Array.isArray(dashboardJson.dashboard.panels)).toBe(true);
    expect(dashboardJson.dashboard.panels.length).toBeGreaterThan(0);
  });

  it("should include Prometheus data source configuration", () => {
    const panels = dashboardJson.dashboard.panels;
    const firstPanel = panels[0];

    expect(firstPanel).toHaveProperty("datasource");
    expect(firstPanel.datasource.type).toBe("prometheus");
    expect(firstPanel.datasource.uid).toBe("${prometheus}");
  });

  it("should include platform template variable", () => {
    const templating = dashboardJson.dashboard.templating;
    expect(templating).toHaveProperty("list");

    const platformVar = templating.list.find(
      (variable: GrafanaVariable) => variable.name === "platform",
    );
    expect(platformVar).toBeDefined();
    expect(platformVar!.definition).toBe(
      "label_values(rate_limit_usage_percent, platform)",
    );
  });

  it("should have proper dashboard metadata", () => {
    expect(dashboardJson.dashboard.uid).toBe("hyperpage-rate-limiting");
    expect(dashboardJson.dashboard.version).toBe(1);
    expect(dashboardJson.dashboard.schemaVersion).toBe(38);
    expect(dashboardJson.dashboard.refresh).toBe("30s");
  });
});
