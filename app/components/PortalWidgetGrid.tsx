import React from "react";
import { Tool, ToolData } from "../../tools/tool-types";
import DataTable from "./DataTable";
import { PortalEmptyState } from "./PortalEmptyState";

interface WidgetWithToolName {
  toolName: string;
  title: string;
  type: "metric" | "chart" | "table" | "feed";
  headers?: string[];
  data: ToolData[];
}

interface PortalWidgetGridProps {
  toolWidgets: WidgetWithToolName[];
  loadingStates: Record<string, boolean>;
  enabledTools: Omit<Tool, "handlers">[];
  refreshToolData: (tool: Omit<Tool, "handlers">) => void;
}

export function PortalWidgetGrid({
  toolWidgets,
  loadingStates,
  enabledTools,
  refreshToolData,
}: PortalWidgetGridProps) {
  if (toolWidgets.length === 0) {
    return <PortalEmptyState />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {toolWidgets.map((widget, index) => (
        <div key={`${widget.toolName}-${index}`}>
          {widget.type === "table" && (
            <DataTable
              title={widget.title}
              headers={widget.headers || []}
              data={widget.data}
              tool={widget.toolName}
              isLoading={loadingStates[`${widget.toolName}-refresh`] || false}
              onRefresh={() => {
                const tool = enabledTools.find(
                  (t) => t.name === widget.toolName,
                );
                if (tool) {
                  refreshToolData(tool);
                }
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
