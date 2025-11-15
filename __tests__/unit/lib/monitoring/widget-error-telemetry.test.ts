import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  recordWidgetError,
  getWidgetErrorEvents,
  clearWidgetErrorTelemetry,
} from "@/lib/monitoring/widget-error-telemetry";
import { alertService } from "@/lib/alerting/alert-service";

describe("widget-error-telemetry", () => {
  beforeEach(() => {
    clearWidgetErrorTelemetry();
    vi.restoreAllMocks();
  });

  it("records events and exposes them", () => {
    const now = Date.now();
    recordWidgetError({
      tool: "GitHub",
      endpoint: "issues",
      message: "timeout",
      timestamp: now,
    });

    const events = getWidgetErrorEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      tool: "GitHub",
      endpoint: "issues",
      message: "timeout",
    });
  });

  it("emits alerts with cooldown per tool/endpoint", () => {
    const spy = vi.spyOn(alertService, "processAlert");
    const baseTime = Date.now();

    recordWidgetError({
      tool: "GitHub",
      endpoint: "issues",
      message: "timeout",
      timestamp: baseTime,
    });
    recordWidgetError({
      tool: "GitHub",
      endpoint: "issues",
      message: "timeout again",
      timestamp: baseTime + 1000,
    });
    expect(spy).toHaveBeenCalledTimes(1);

    recordWidgetError({
      tool: "GitHub",
      endpoint: "issues",
      message: "still failing",
      timestamp: baseTime + 6 * 60 * 1000,
    });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
