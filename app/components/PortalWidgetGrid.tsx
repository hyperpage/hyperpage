import React from "react";

import { ClientSafeTool, ToolData, ToolWidget } from "@/tools/tool-types";
import DataTable from "@/app/components/DataTable";
import { PortalEmptyState } from "@/app/components/PortalEmptyState";

interface WidgetWithToolName {
  toolName: string;
  title: string;
  type: "metric" | "chart" | "table" | "feed";
  headers?: string[];
  data: ToolData[];
  component?: ToolWidget["component"];
  apiEndpoint?: string;
}

interface PortalWidgetGridProps {
  toolWidgets: WidgetWithToolName[];
  loadingStates: Record<string, boolean>;
  enabledTools: ClientSafeTool[];
  errorStates: Record<string, { message: string; timestamp: number } | null>;
  refreshToolData: (tool: ClientSafeTool) => void;
}

export function PortalWidgetGrid({
  toolWidgets,
  loadingStates,
  enabledTools,
  errorStates,
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
              data={widget.data || []}
              tool={widget.toolName}
              isLoading={loadingStates[`${widget.toolName}-refresh`] || false}
              errorInfo={
                widget.apiEndpoint
                  ? errorStates[`${widget.toolName}-${widget.apiEndpoint}`]
                  : null
              }
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
