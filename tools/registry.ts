import { Tool, ToolRegistry } from "./tool-types";

// Global registry - populated automatically by tools on import
const toolRegistry: ToolRegistry = {};

// Tool registration function - called by each tool on import
export function registerTool(name: string, tool: Tool) {
  toolRegistry[name] = tool;
}

// Get all registered tools
export function getAllTools(): Tool[] {
  return Object.values(toolRegistry).filter(
    (tool): tool is Tool => tool !== undefined,
  );
}

// Get a specific tool by name
export function getTool(name: string): Tool | undefined {
  return toolRegistry[name];
}

// Get tool names
export function getToolNames(): string[] {
  return Object.keys(toolRegistry);
}

export { toolRegistry };
