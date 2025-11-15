import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getReadWriteDb } from "@/lib/database/connection";
import * as pgSchema from "@/lib/database/pg-schema";
import { getEnabledTools as getRegistryEnabledTools } from "@/tools";
import type { Tool, ToolWidget, ToolApi } from "@/tools/tool-types";
import logger from "@/lib/logger";
import { createErrorResponse } from "@/lib/api/responses";

type ToolConfigPayload = {
  enabled?: boolean;
  refreshInterval?: number;
  notifications?: boolean;
  config?: Record<string, unknown>;
};

type ToolConfigOverride = {
  enabled?: boolean;
  refreshInterval?: number;
  notifications?: boolean;
  config?: Record<string, unknown>;
};

type PublicWidget = {
  title: string;
  type: "table" | "chart" | "feed" | "card";
  headers?: string[];
  dynamic?: boolean;
  refreshInterval?: number;
};

type PublicApi = {
  endpoint: string;
  method: ToolApi["method"];
  description: string;
  parameters?: ToolApi["parameters"];
  url: string;
};

/**
 * Enabled tools API endpoint (Phase 2 - PostgreSQL-backed)
 *
 * Source of truth for enablement is the tool_configs table.
 * Registry provides static metadata (widgets/apis); DB controls enabled state.
 */
export async function GET(_request: NextRequest) {
  try {
    const configByKey = await loadToolConfigOverrides();
    const registryTools = getRegistryEnabledTools();

    const enabledToolsData = registryTools
      .map((tool) => transformTool(tool, configByKey.get(tool.slug)))
      .filter((tool): tool is NonNullable<typeof tool> => tool !== null);

    return NextResponse.json({
      enabledTools: enabledToolsData,
      count: enabledToolsData.length,
      apis: enabledToolsData.flatMap((tool) =>
        tool.apis.map((api) => ({
          tool: tool.name,
          ...api,
        })),
      ),
    });
  } catch (error) {
    logger.error("Failed to get enabled tools", {
      error: error instanceof Error ? error.message : String(error),
    });

    return createErrorResponse({
      code: "ENABLED_TOOLS_ERROR",
      message: "Failed to get enabled tools",
      status: 500,
    });
  }
}

async function loadToolConfigOverrides(): Promise<
  Map<string, ToolConfigOverride>
> {
  const configByKey = new Map<string, ToolConfigOverride>();

  try {
    const db = getReadWriteDb();
    const rows = await db
      .select()
      .from(pgSchema.toolConfigs)
      .where(
        and(
          eq(pgSchema.toolConfigs.ownerType, "system"),
          eq(pgSchema.toolConfigs.ownerId, "global"),
        ),
      );

    for (const row of rows) {
      const payload = ((row.config || {}) as ToolConfigPayload) ?? {};

      configByKey.set(row.key, {
        enabled:
          typeof payload.enabled === "boolean" ? payload.enabled : undefined,
        refreshInterval:
          typeof payload.refreshInterval === "number"
            ? payload.refreshInterval
            : undefined,
        notifications:
          typeof payload.notifications === "boolean"
            ? payload.notifications
            : undefined,
        config: payload.config,
      });
    }
  } catch (error) {
    logger.warn(
      "Failed to load tool config overrides, falling back to registry",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }

  return configByKey;
}

function transformTool(
  tool: Tool,
  override?: ToolConfigOverride,
): {
  name: string;
  slug: string;
  enabled: boolean;
  capabilities: string[];
  widgets: PublicWidget[];
  apis: PublicApi[];
} | null {
  if (!tool) {
    return null;
  }

  const safeName = tool.name || "Unknown Tool";
  const slug =
    tool.slug ||
    safeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const isDisabledOverride = override && override.enabled === false;
  if (isDisabledOverride) {
    return null;
  }

  const widgets = Array.isArray(tool.widgets)
    ? tool.widgets.map((widget) =>
        transformWidget(widget, override?.refreshInterval),
      )
    : [];

  const apis = tool.apis
    ? Object.entries(tool.apis).map(([endpoint, api]) =>
        transformApi(endpoint, api, slug),
      )
    : [];

  return {
    name: safeName,
    slug,
    enabled: true,
    capabilities: Array.isArray(tool.capabilities) ? tool.capabilities : [],
    widgets,
    apis,
  };
}

function transformWidget(
  widget: ToolWidget,
  overrideRefreshInterval?: number,
): PublicWidget {
  const widgetType =
    widget?.type === "metric" && widget?.dynamic
      ? "card"
      : (widget?.type ?? "card");
  const isTable = widgetType === "table";
  const headers =
    Array.isArray(widget.headers) && widget.headers.length > 0
      ? widget.headers
      : isTable
        ? (widget.headers ?? [])
        : undefined;

  const transformed: PublicWidget = {
    title: widget?.title || "Widget",
    type: widgetType as PublicWidget["type"],
    dynamic: widget?.dynamic ?? false,
  };

  if (typeof overrideRefreshInterval === "number") {
    transformed.refreshInterval = overrideRefreshInterval;
  } else if (typeof widget.refreshInterval === "number") {
    transformed.refreshInterval = widget.refreshInterval;
  }

  if (isTable) {
    transformed.headers = headers ?? [];
  } else if (headers && headers.length > 0) {
    transformed.headers = headers;
  }

  return transformed;
}

function transformApi(endpoint: string, api: ToolApi, slug: string): PublicApi {
  return {
    endpoint,
    method: api.method,
    description: api.description,
    parameters: api.parameters || {},
    url: slug ? `/api/tools/${slug}/${endpoint}` : `/api/tools/${endpoint}`,
  };
}
