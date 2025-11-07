import { toolRegistry } from "@/tools/registry";

export class RegistryEnvironmentHelper {
  // Enhance existing environment variable handling
  // Works WITH the registry, not against it

  static getEnabledToolsFromRegistry(): string[] {
    const enabledTools: string[] = [];

    for (const [name, tool] of Object.entries(toolRegistry)) {
      if (tool?.enabled === true) {
        enabledTools.push(name);
      }
    }

    return enabledTools;
  }

  static getToolEnvironmentConfig(toolName: string): ToolEnvironmentConfig {
    // Uses existing registry patterns to get environment config
    const tool = toolRegistry[toolName.toLowerCase()];
    if (!tool) {
      return { configured: false, missing: [], warnings: [] };
    }

    const config: ToolEnvironmentConfig = {
      configured: tool.enabled,
      missing: [],
      warnings: [],
    };

    // Check environment variables based on existing tool patterns
    if (tool.validation) {
      for (const requiredVar of tool.validation.required) {
        if (!process.env[requiredVar]) {
          config.missing.push(requiredVar);
        }
      }

      for (const optionalVar of tool.validation.optional) {
        if (!process.env[optionalVar]) {
          config.warnings.push(`Optional ${optionalVar} not configured`);
        }
      }
    }

    // Check OAuth configuration if present
    if (tool.config?.oauthConfig) {
      const oauthConfig = tool.config.oauthConfig;
      if (!process.env[oauthConfig.clientIdEnvVar]) {
        config.missing.push(oauthConfig.clientIdEnvVar);
      }
      if (!process.env[oauthConfig.clientSecretEnvVar]) {
        config.missing.push(oauthConfig.clientSecretEnvVar);
      }
    }

    return config;
  }

  static generateEnvironmentTemplate(): string {
    // Generate template based on ACTUAL registered tools
    let template = `# Hyperpage Environment Configuration Template
# Auto-generated based on registered tools
# Copy this file to .env.local and fill in the values

# Required Configuration
NEXTAUTH_SECRET=your-32-character-secret-here

# Optional Configuration (with defaults)
NODE_ENV=development
NEXTAUTH_URL=http://localhost:3000

`;

    // Add tool-specific configuration based on registered tools
    for (const [toolName, tool] of Object.entries(toolRegistry)) {
      if (!tool) continue;

      const upperTool = toolName.toUpperCase();

      template += `\n# ${tool.name} Integration\n`;
      template += `ENABLE_${upperTool}=${tool.enabled ? "true" : "false"}\n`;

      // Add OAuth configuration if tool has it
      if (tool.config?.oauthConfig) {
        const oauth = tool.config.oauthConfig;
        template += `${oauth.clientIdEnvVar}=\n`;
        template += `${oauth.clientSecretEnvVar}=\n`;

        if (
          tool.validation?.required.includes("GITHUB_WEB_URL") ||
          tool.validation?.required.includes("GITLAB_WEB_URL") ||
          tool.validation?.required.includes("JIRA_WEB_URL")
        ) {
          template += `${upperTool}_WEB_URL=\n`;
        }
      }

      // Add tool-specific required variables
      if (tool.validation?.required) {
        for (const requiredVar of tool.validation.required) {
          if (
            !requiredVar.includes("CLIENT_ID") &&
            !requiredVar.includes("CLIENT_SECRET") &&
            !requiredVar.includes("WEB_URL")
          ) {
            template += `${requiredVar}=\n`;
          }
        }
      }
    }

    return template;
  }

  static validateRegistryEnvironment(): RegistryValidationResult {
    const result: RegistryValidationResult = {
      valid: true,
      tools: {},
      summary: {
        total: 0,
        enabled: 0,
        configured: 0,
        missing: 0,
      },
    };

    const enabledTools = this.getEnabledToolsFromRegistry();
    result.summary.total = Object.keys(toolRegistry).length;
    result.summary.enabled = enabledTools.length;

    for (const toolName of enabledTools) {
      const tool = toolRegistry[toolName];
      if (!tool) continue;

      const envConfig = this.getToolEnvironmentConfig(toolName);
      const isConfigured = envConfig.missing.length === 0;

      result.tools[toolName] = {
        name: tool.name,
        enabled: tool.enabled,
        configured: isConfigured,
        missing: envConfig.missing,
        warnings: envConfig.warnings,
      };

      if (!isConfigured) {
        result.valid = false;
        result.summary.missing++;
      } else {
        result.summary.configured++;
      }
    }

    return result;
  }
}

// Types for the enhanced environment system
export interface ToolEnvironmentConfig {
  configured: boolean;
  missing: string[];
  warnings: string[];
}

export interface RegistryValidationResult {
  valid: boolean;
  tools: Record<
    string,
    {
      name: string;
      enabled: boolean;
      configured: boolean;
      missing: string[];
      warnings: string[];
    }
  >;
  summary: {
    total: number;
    enabled: number;
    configured: number;
    missing: number;
  };
}
