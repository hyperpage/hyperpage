import DataTable from "@/app/components/DataTable";
import {
  ClientSafeTool,
  ClientToolWidget,
  ToolWidget,
} from "@/tools/tool-types";

type ExtendedToolWidget = (ClientToolWidget & { toolName: string }) & {
  component?: ToolWidget["component"];
};

interface ToolWidgetGridProps {
  toolWidgets: ExtendedToolWidget[];
  enabledTools: ClientSafeTool[];
  loadingStates: Record<string, boolean>;
  errorStates: Record<string, { message: string; timestamp: number } | null>;
  refreshToolData: (tool: ClientSafeTool) => Promise<void>;
}

export default function ToolWidgetGrid({
  toolWidgets,
  enabledTools,
  loadingStates,
  errorStates,
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
          {widget.type === "chart" && widget.component && (
            <widget.component {...widget} data={widget.data || []} />
          )}
        </div>
      ))}
    </div>
  );
}
