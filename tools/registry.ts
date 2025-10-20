import { Tool, ToolRegistry } from "./tool-types";

// Global registry - populated automatically by tools on import
const toolRegistry: ToolRegistry = {};

// Tool registration function - called by each tool on import
export function registerTool(name: string, tool: Tool) {
  toolRegistry[name] = tool;
}

export { toolRegistry };
