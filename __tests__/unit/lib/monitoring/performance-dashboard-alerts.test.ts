import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  PerformanceDashboard,
  type PerformanceSnapshot,
} from "@/lib/monitoring/performance-dashboard";
import { alertService } from "@/lib/alerting/alert-service";

describe("PerformanceDashboard alerts", () => {
  const dashboard = new PerformanceDashboard();

  beforeEach(() => {
    vi.spyOn(alertService, "processAlert").mockClear();
  });

  it("forwards alerts to alertService", () => {
    const spy = vi.spyOn(alertService, "processAlert");

    const snapshot: PerformanceSnapshot = {
      timestamp: Date.now(),
      responseTimeMs: 9999,
      responseSizeBytes: 100,
      cacheStatus: "MISS" as const,
      endpoint: "/api/test",
      method: "GET",
      statusCode: 200,
    };

    (
      dashboard as unknown as { snapshots: PerformanceSnapshot[] }
    ).snapshots.push(snapshot);
    (
      dashboard as unknown as {
        checkAlertConditions: (snapshot: PerformanceSnapshot) => void;
      }
    ).checkAlertConditions(snapshot);

    expect(spy).toHaveBeenCalled();
  });
});
