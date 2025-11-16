import { NextRequest, NextResponse } from "next/server";

import {
  recordWidgetError,
  getWidgetErrorAggregates,
  getWidgetErrorEvents,
} from "@/lib/monitoring/widget-error-telemetry";
import { createErrorResponse } from "@/lib/api/responses";
import logger from "@/lib/logger";

interface WidgetErrorPayload {
  tool?: string;
  endpoint?: string;
  message?: string;
  timestamp?: number;
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as WidgetErrorPayload;

    if (
      !payload.tool ||
      !payload.endpoint ||
      !payload.message ||
      typeof payload.timestamp !== "number"
    ) {
      return createErrorResponse({
        status: 400,
        code: "INVALID_WIDGET_ERROR_PAYLOAD",
        message: "tool, endpoint, message, and timestamp are required",
      });
    }

    recordWidgetError({
      tool: payload.tool,
      endpoint: payload.endpoint,
      message: payload.message,
      timestamp: payload.timestamp,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to record widget error telemetry", {
      error: error instanceof Error ? error.message : String(error),
    });
    return createErrorResponse({
      status: 500,
      code: "WIDGET_TELEMETRY_ERROR",
      message: "Failed to record widget telemetry",
    });
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "100");
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 100;

  return NextResponse.json({
    events: getWidgetErrorEvents(safeLimit),
    aggregates: getWidgetErrorAggregates(),
  });
}
