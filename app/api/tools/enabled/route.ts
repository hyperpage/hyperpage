import { NextResponse } from "next/server";
import { getReadWriteDb } from "@/lib/database/connection";
import * as pgSchema from "@/lib/database/pg-schema";
import { toolRegistry } from "@/tools/registry";
import type { Tool, ToolWidget, ToolApi } from "@/tools/tool-types";
import logger from "@/lib/logger";
import { and, eq } from "drizzle-orm";

/**
 * Enabled tools API endpoint (Phase 2 - PostgreSQL-backed)
 *
 * Source of truth for enablement is the tool_configs table.
 * Registry provides static metadata (widgets/apis); DB controls enabled state.
 */
export async function GET() {
  try {
    const db = getReadWriteDb();

    // Load all system/global configs
    const rows = await db
      .select()
      .from(pgSchema.toolConfigs)
      .where(
        and(
          eq(pgSchema.toolConfigs.ownerType, "system"),
          eq(pgSchema.toolConfigs.ownerId, "global"),
        ),
      );

    // Build a quick lookup map of enabled state and overrides by tool key
    const configByKey = new Map<
      string,
      {
        enabled: boolean;
        refreshInterval?: number;
        notifications?: boolean;
        config?: Record<string, unknown>;
      }
    >();

    for (const row of rows) {
      const payload = (row.config || {}) as {
        enabled?: boolean;
        refreshInterval?: number;
        notifications?: boolean;
        config?: Record<string, unknown>;
      };

      const enabled =
        typeof payload.enabled === "boolean" ? payload.enabled : false;

      configByKey.set(row.key, {
        enabled,
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

    // Merge DB configs with registry metadata
    const enabledToolsData = Object.values(toolRegistry)
      .filter((tool): tool is Tool => Boolean(tool))
      .map((tool) => {
        const cfg = configByKey.get(tool.slug) ?? null;
        if (!cfg || !cfg.enabled) {
          return null;
        }

        const widgets: ToolWidget[] = Array.isArray(tool.widgets)
          ? tool.widgets.map((widget) => {
              const merged: ToolWidget = { ...widget };

              if (cfg.refreshInterval && cfg.refreshInterval !== 0) {
                merged.refreshInterval = cfg.refreshInterval;
              }

              return merged;
            })
          : [];

        const apis =
          tool.apis != null
            ? Object.entries(tool.apis).map(
                ([endpoint, api]: [string, ToolApi]) => ({
                  endpoint,
                  method: api.method,
                  description: api.description,
                  parameters: api.parameters,
                  url: `/api/tools/${tool.slug}/${endpoint}`,
                }),
              )
            : [];

        return {
          name: tool.name,
          slug: tool.slug,
          capabilities: tool.capabilities || [],
          enabled: true,
          widgets,
          apis,
        };
      })
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

    return NextResponse.json(
      { error: "Failed to get enabled tools" },
      { status: 500 },
    );
  }
}
