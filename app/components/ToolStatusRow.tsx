"use client";

import { useState, useEffect } from "react";
import { getToolIcon } from "../../tools";
import { ToolIntegration } from "../../tools/tool-types";
import { ToolValidationResult } from "../../tools/validation";
import { AlertTriangle, Info, Wifi, WifiOff } from "lucide-react";

interface ToolHealthInfo extends ToolIntegration {
  health?: ToolValidationResult;
}

export default function ToolStatusRow() {
  const [toolIntegrations, setToolIntegrations] = useState<ToolHealthInfo[]>(
    [],
  );
  const [detailedView, setDetailedView] = useState(false);

  // Load tool integrations and health info on component mount
  useEffect(() => {
    async function loadIntegrations() {
      try {
        // Load enabled tools with basic status
        const response = await fetch("/api/tools/enabled");
        if (response.ok) {
          const data = await response.json();
          const basicIntegrations: ToolHealthInfo[] = data.enabledTools.map(
            (tool: { name: string }) => ({
              name: tool.name,
              enabled: true,
              icon: getToolIcon(tool.name),
              status: "connected" as const,
            }),
          );

          // Now load detailed health information
          const healthResponse = await fetch("/api/tools/health");
          if (healthResponse.ok) {
            const healthData = await healthResponse.json();

            const integrationsWithHealth = basicIntegrations.map(tool => {
              const health = healthData.tools[tool.name.toLowerCase()];
              if (health) {
                return {
                  ...tool,
                  status: health.status as ToolIntegration['status'],
                  health
                };
              }
              return tool;
            });

            setToolIntegrations(integrationsWithHealth);
          } else {
            setToolIntegrations(basicIntegrations);
          }
        } else {
          console.error("Failed to fetch enabled tools");
        }
      } catch (error) {
        console.error("Error loading tool integrations:", error);
      }
    }

    loadIntegrations();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-500"; // Changed to green for better UX
      case "connecting":
        return "bg-yellow-500";
      case "configuration_error":
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <Wifi className="w-3 h-3" />;
      case "connecting":
        return <Wifi className="w-3 h-3" />;
      case "configuration_error":
      case "error":
        return <WifiOff className="w-3 h-3" />;
      default:
        return <WifiOff className="w-3 h-3" />;
    }
  };

  if (toolIntegrations.length === 0) {
    return null;
  }

  return (
    <div className="flex justify-center items-center py-6 border-t border-border mt-8">
      <div className="flex flex-col items-center space-y-4">
        <div className="flex items-center space-x-6">
          {toolIntegrations.map((tool, index) => (
            <div
              key={index}
              className="flex flex-col items-center justify-center p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors cursor-pointer"
              onClick={() => setDetailedView(!detailedView)}
              title={`${tool.name} - ${tool.status}`}
            >
              <div className="relative">
                <span className="text-xl">{tool.icon}</span>
                <div
                  className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${getStatusColor(tool.status)}`}
                  title={tool.status}
                >
                  {getStatusIcon(tool.status)}
                </div>
              </div>
              <span className="text-xs text-center mt-2 text-muted-foreground capitalize">
                {tool.name}
              </span>
            </div>
          ))}
        </div>

        {/* Detailed health information */}
        {detailedView && (
          <div className="bg-background border border-border rounded-lg p-4 w-full max-w-4xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Tool Health Status</h3>
              <button
                onClick={() => setDetailedView(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4">
              {toolIntegrations.map((tool, index) => (
                tool.health && (
                  <div key={index} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">{tool.name}</span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          tool.health.status === 'connected' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          tool.health.status === 'configuration_error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          tool.health.status === 'error' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                        }`}>
                          {tool.health.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Errors */}
                    {tool.health.errors.length > 0 && (
                      <div className="mb-2">
                        <div className="flex items-center space-x-1 mb-1">
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                          <span className="text-xs text-red-600 dark:text-red-400">Errors:</span>
                        </div>
                        <ul className="text-xs text-red-600 dark:text-red-400 ml-4 list-disc">
                          {tool.health.errors.map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Warnings */}
                    {tool.health.warnings.length > 0 && (
                      <div className="mb-2">
                        <div className="flex items-center space-x-1 mb-1">
                          <Info className="w-3 h-3 text-yellow-500" />
                          <span className="text-xs text-yellow-600 dark:text-yellow-400">Warnings:</span>
                        </div>
                        <ul className="text-xs text-yellow-600 dark:text-yellow-400 ml-4 list-disc">
                          {tool.health.warnings.map((warning, i) => (
                            <li key={i}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
