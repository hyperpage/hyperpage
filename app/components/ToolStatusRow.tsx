"use client";

import { useState, useEffect } from "react";
import { getToolIcon } from "../../tools";
import { ToolIntegration } from "../../tools/tool-types";

export default function ToolStatusRow() {
  const [toolIntegrations, setToolIntegrations] = useState<ToolIntegration[]>(
    [],
  );

  // Load tool integrations from API on component mount
  useEffect(() => {
    async function loadIntegrations() {
      try {
        const response = await fetch("/api/tools/enabled");
        if (response.ok) {
          const data = await response.json();
          const integrations: ToolIntegration[] = data.enabledTools.map(
            (tool: { name: string }) => ({
              name: tool.name,
              enabled: true,
              icon: getToolIcon(tool.name),
              status: "connected" as const, // Default status for enabled tools
            }),
          );
          setToolIntegrations(integrations);
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
        return "bg-teal-600";
      case "connecting":
        return "bg-yellow-500";
      default:
        return "bg-red-500";
    }
  };

  if (toolIntegrations.length === 0) {
    return null;
  }

  return (
    <div className="flex justify-center items-center py-6 border-t border-base-200 mt-8">
      <div className="flex items-center space-x-6">
        {toolIntegrations.map((tool, index) => (
          <div
            key={index}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-base-200 hover:bg-base-300 transition-colors"
            title={`${tool.name} - ${tool.status}`}
          >
            <div className="relative">
              <span className="text-xl">{tool.icon}</span>
              <div
                className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-base-100 ${getStatusColor(tool.status)}`}
                title={tool.status}
              />
            </div>
            <span className="text-xs text-center mt-2 text-base-content/70 capitalize">
              {tool.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
