import React from "react";
import { toolRegistry } from "@/tools/registry";

// Helper function to normalize tool name for registry lookup
const normalizeToolName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/%20/g, " ") // Decode URL-encoded spaces
    .replace(/[\s\/]+/g, "-") // Convert spaces and slashes to hyphens (consistent with registration)
    .replace(/[^a-z0-9-]/g, ""); // Remove any other invalid characters
};

// Helper function to get tool color class from registry
export const getToolColor = (toolName: string): string => {
  const normalizedName = normalizeToolName(toolName);
  const tool = toolRegistry[normalizedName];
  if (tool && tool.ui) {
    return tool.ui.color;
  }
  // Fallback color for unknown tools
  return "bg-gray-500/10 border-gray-400/30 text-gray-400";
};

// Helper function to get tool icon component from registry
export const getToolIcon = (name: string): React.ReactNode => {
  const normalizedName = normalizeToolName(name);
  const tool = toolRegistry[normalizedName];
  if (tool && tool.ui && tool.ui.icon) {
    return tool.ui.icon;
  }
  // Fallback icon for unknown tools
  return React.createElement("span", { className: "text-lg" }, "🔧");
};
