import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import {
  POST as postWidgetError,
  GET as getWidgetErrors,
} from "@/app/api/telemetry/widget-error/route";
import { GET as getMetricsRoute } from "@/app/api/metrics/route";
import metricsRegister from "@/app/api/metrics/registry";
import { clearWidgetErrorTelemetry } from "@/lib/monitoring/widget-error-telemetry";

const endpointUrl = "http://localhost/api/telemetry/widget-error";

const createRequest = (
  input: URL | RequestInfo,
  init?: ConstructorParameters<typeof NextRequest>[1],
) => new NextRequest(input, init);

describe("/api/telemetry/widget-error", () => {
  beforeEach(() => {
    clearWidgetErrorTelemetry();
  });

  it("stores events via POST and returns aggregates via GET", async () => {
    const payload = {
      tool: "GitHub",
      endpoint: "issues",
      message: "timeout",
      timestamp: Date.now(),
    };

    const postResponse = await postWidgetError(
      createRequest(endpointUrl, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(postResponse.status).toBe(200);
    const postData = await postResponse.json();
    expect(postData).toEqual({ success: true });

    const getResponse = await getWidgetErrors(
      createRequest(`${endpointUrl}?limit=10`),
    );
    expect(getResponse.status).toBe(200);
    const getData = await getResponse.json();

    expect(getData.events).toHaveLength(1);
    expect(getData.events[0]).toMatchObject(payload);
    expect(getData.aggregates).toHaveLength(1);
    expect(getData.aggregates[0]).toMatchObject({
      tool: "GitHub",
      endpoint: "issues",
      count: 1,
      lastMessage: "timeout",
    });

    await getMetricsRoute();
    const metrics = await metricsRegister.getMetricsAsJSON();
    const widgetCountMetric = metrics.find(
      (m) => m.name === "widget_errors_count",
    );
    const widgetTimestampMetric = metrics.find(
      (m) => m.name === "widget_error_last_timestamp_ms",
    );
    expect(widgetCountMetric?.values[0].value).toBe(1);
    expect(widgetTimestampMetric?.values[0].value).toBe(payload.timestamp);
  });

  it("rejects invalid payloads", async () => {
    const response = await postWidgetError(
      createRequest(endpointUrl, {
        method: "POST",
        body: JSON.stringify({ tool: "GitHub" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe("INVALID_WIDGET_ERROR_PAYLOAD");
  });
});
