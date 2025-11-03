import DataTable from "./DataTable";
import { Tool, ToolWidget } from "../../tools/tool-types";

type ExtendedToolWidget = ToolWidget & { toolName: string };

interface ToolWidgetGridProps {
  toolWidgets: ExtendedToolWidget[];
  enabledTools: Omit<Tool, "handlers">[];
  loadingStates: Record<string, boolean>;
  refreshToolData: (tool: Omit<Tool, "handlers">) => Promise<void>;
}

export default function ToolWidgetGrid({
  toolWidgets,
  enabledTools,
  loadingStates,
  refreshToolData,
}: ToolWidgetGridProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Dynamic Tool Widgets */}
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
          {widget.type === "chart" && widget.component && (
            <widget.component {...widget} />
          )}
        </div>
      ))}
    </div>
  );
}
