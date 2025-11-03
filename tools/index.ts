import { ReactNode } from "react";
import { Tool, ToolRegistry, ToolIntegration } from "./tool-types";
import { getToolIcon } from "./ui-props";
import { toolRegistry } from "./registry";
import { validateToolConfig } from "./validation";

// Import tools server-side - each tool registers itself and checks enabled status
// This eliminates client-side race conditions
import "./github";
import "./jira";
import "./gitlab";
import "./code-reviews";
import "./ci-cd";
import "./ticketing";

// Helper function to discover available tool APIs at runtime
// This provides a registry-based approach without dynamic filesystem access

// Helper function to get enabled tools
export const getEnabledTools = (): Tool[] => {
  return Object.values(toolRegistry).filter(
    (tool): tool is Tool => tool?.enabled === true,
  );
};

// Helper function to get all tools (enabled or not)
export const getAllTools = (): Tool[] => {
  return Object.values(toolRegistry).filter(
    (tool): tool is Tool => tool !== undefined,
  );
};

// Helper function to get a tool by name
export const getToolByName = (name: string): Tool | undefined => {
  // Normalize the name: handle URL-encoded spaces and convert spaces to hyphens
  const normalizedName = name
    .toLowerCase()
    .replace(/%20/g, " ") // Decode URL-encoded spaces
    .replace(/[\s]+/g, "-") // Convert spaces to hyphens (consistent with registration)
    .replace(/[^a-z0-9-]/g, ""); // Remove any other invalid characters

  return toolRegistry[normalizedName];
};

// Helper function to find tools that provide a specific API
export const getToolsByApi = (apiEndpoint: string): Tool[] => {
  return getAllTools().filter((tool) => tool.apis && tool.apis[apiEndpoint]);
};

// Helper function to get all available APIs across enabled tools
export const getAvailableApis = (): Record<
  string,
  { tool: string; api: unknown }
> => {
  const apis: Record<string, { tool: string; api: unknown }> = {};

  getEnabledTools().forEach((tool) => {
    if (tool.apis) {
      Object.entries(tool.apis).forEach(([apiName, apiConfig]) => {
        apis[`${tool.name.toLowerCase()}/${apiName}`] = {
          tool: tool.name,
          api: apiConfig,
        };
      });
    }
  });

  return apis;
};

// Helper function to get icon components using the centralized UI props
const getIconComponent = (name: string): ReactNode => {
  return getToolIcon(name);
};

// Helper function to get tool integrations for UI display
// Returns tools with their integration status for sidebar/components
export const getToolIntegrations = (): ToolIntegration[] => {
  return getEnabledTools().map((tool) => {
    // Use the validation system to determine status
    const healthCheck = validateToolConfig(tool);
    const status =
      healthCheck.status === "configuration_error"
        ? "error"
        : healthCheck.status;

    return {
      name: tool.name,
      enabled: true,
      icon: getIconComponent(tool.name),
      status,
    };
  });
};

// Helper function to get client-safe tools (without handlers or sensitive config)
// This excludes handler functions and config objects that can't be serialized in client components
export const getClientTools = (): Omit<Tool, "handlers" | "config">[] => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return getAllTools().map(
    ({ handlers: _, config: __, ...clientTool }) => clientTool,
  );
};

// Helper function to get client-safe enabled tools
export const getEnabledClientTools = (): Omit<
  Tool,
  "handlers" | "config"
>[] => {
  return getClientTools().filter((tool) => tool.enabled);
};

// Helper function to get data key from tool API response declaration
export const getToolDataKey = (
  toolName: string,
  apiEndpoint: string,
): string | undefined => {
  const tool = getToolByName(toolName);
  if (
    tool &&
    tool.apis &&
    tool.apis[apiEndpoint] &&
    tool.apis[apiEndpoint].response
  ) {
    return tool.apis[apiEndpoint].response!.dataKey;
  }
  return undefined;
};

// Helper function to get web URL and API URL for a tool using tool-owned logic
export const getToolUrls = (tool: Tool) => {
  const slug = tool.slug;
  if (!slug) return { webUrl: undefined, apiUrl: undefined };

  const envWebUrl = process.env[`${slug.toUpperCase()}_WEB_URL`];
  const envApiUrl = process.env[`${slug.toUpperCase()}_API_URL`];

  // Let the tool define how to get web URL and format API URL
  const webUrl = envWebUrl || tool.config?.getWebUrl?.() || tool.config?.webUrl;
  const apiUrl =
    envApiUrl ||
    tool.config?.formatApiUrl?.(webUrl || "") ||
    tool.config?.apiUrl;

  return { webUrl, apiUrl };
};

// Export the registry for debugging/advanced usage
export { toolRegistry };

// Re-export types for convenience
export type { Tool, ToolRegistry };

// Re-export UI props for components to use
export { getToolColor, getToolIcon } from "./ui-props";
