import { toolRegistry } from "@/tools/registry";
import type { Tool } from "@/tools/tool-types";
import logger from "@/lib/logger";
import { ToolConfigValidator } from "@/lib/config/tool-schemas";
import { RegistryEnvironmentHelper } from "@/lib/config/environment-helper";

export class ConfigurationMonitor {
  private logger: typeof logger;
  private healthCheckCache: Map<string, HealthCheckResult> = new Map();

  constructor() {
    this.logger = logger;
  }

  async performHealthChecks(): Promise<RegistryHealthStatus> {
    const results: Record<string, ToolHealthStatus> = {};

    // Check each registered tool
    for (const [toolName, tool] of Object.entries(toolRegistry)) {
      if (!tool) continue;

      const healthResult = await this.checkToolHealth(toolName, tool);
      results[toolName] = healthResult;
    }

    const overallHealth = this.calculateOverallHealth(results);

    this.logger.info("Configuration health check completed", {
      overall: overallHealth,
      toolCount: Object.keys(results).length,
    });

    return {
      overall: overallHealth,
      tools: results,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkToolHealth(
    toolName: string,
    tool: Tool,
  ): Promise<ToolHealthStatus> {
    const cacheKey = `${toolName}-${tool.enabled}`;

    // Use cached result if available and recent
    const cached = this.healthCheckCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      return cached.result;
    }

    const result: ToolHealthStatus = {
      name: tool.name,
      enabled: tool.enabled,
      healthy: true,
      checks: {
        registration: true,
        validation: false,
        environment: false,
        configuration: false,
      },
      issues: [],
      lastChecked: new Date().toISOString(),
    };

    try {
      // 1. Check tool registration
      if (!this.isToolProperlyRegistered(toolName, tool)) {
        result.healthy = false;
        result.issues.push("Tool not properly registered in registry");
        result.checks.registration = false;
      }

      // 2. Check configuration validation
      const validation = ToolConfigValidator.validateToolConfig(tool);
      if (!validation.isValid) {
        result.healthy = false;
        result.issues.push(...validation.errors.map((e) => e.message));
        result.checks.validation = false;
      } else {
        result.checks.validation = true;
      }

      // 3. Check environment configuration
      const envConfig =
        RegistryEnvironmentHelper.getToolEnvironmentConfig(toolName);
      if (tool.enabled && envConfig.missing.length > 0) {
        result.healthy = false;
        result.issues.push(
          `Missing environment variables: ${envConfig.missing.join(", ")}`,
        );
        result.checks.environment = false;
      } else {
        result.checks.environment = true;
      }

      // 4. Check configuration completeness
      const configCheck = this.checkConfigurationCompleteness(tool);
      if (!configCheck.complete) {
        result.healthy = false;
        result.issues.push(...configCheck.issues);
        result.checks.configuration = false;
      } else {
        result.checks.configuration = true;
      }
    } catch (error) {
      result.healthy = false;
      result.issues.push(`Health check error: ${(error as Error).message}`);
      this.logger.error(`Health check failed for tool: ${toolName}`, { error });
    }

    // Cache the result
    this.healthCheckCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });

    return result;
  }

  private isToolProperlyRegistered(toolName: string, tool: Tool): boolean {
    // Check that tool has required properties for registry
    return !!(
      tool.name &&
      tool.slug &&
      tool.enabled !== undefined &&
      tool.ui &&
      tool.widgets &&
      tool.apis &&
      tool.handlers
    );
  }

  private checkConfigurationCompleteness(tool: Tool): {
    complete: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (tool.enabled) {
      // Check for required tool properties when enabled
      if (!tool.apis || Object.keys(tool.apis).length === 0) {
        issues.push("Enabled tool has no API endpoints defined");
      }

      if (!tool.handlers || Object.keys(tool.handlers).length === 0) {
        issues.push("Enabled tool has no handlers defined");
      }

      // Tool-specific checks
      if (tool.config?.oauthConfig) {
        // Validate OAuth configuration structure
        const oauth = tool.config.oauthConfig;
        if (!oauth.authorizationUrl || !oauth.tokenUrl) {
          issues.push("OAuth configuration missing required URLs");
        }
      }
    }

    return {
      complete: issues.length === 0,
      issues,
    };
  }

  private isCacheValid(cached: { timestamp: number }): boolean {
    // Cache valid for 5 minutes
    return Date.now() - cached.timestamp < 5 * 60 * 1000;
  }

  private calculateOverallHealth(
    results: Record<string, ToolHealthStatus>,
  ): "healthy" | "degraded" | "unhealthy" {
    const tools = Object.values(results);
    const enabledTools = tools.filter((t) => t.enabled);

    if (enabledTools.length === 0) {
      return "healthy"; // No tools enabled is technically healthy
    }

    const healthyCount = enabledTools.filter((t) => t.healthy).length;
    const healthyRatio = healthyCount / enabledTools.length;

    if (healthyRatio === 1) return "healthy";
    if (healthyRatio >= 0.5) return "degraded";
    return "unhealthy";
  }

  // Get configuration status for a specific tool
  getToolConfigurationStatus(name: string): ToolConfigurationStatus | null {
    const tool = toolRegistry[name.toLowerCase()];
    if (!tool) return null;

    const validation = ToolConfigValidator.validateToolConfig(tool);
    const envConfig = RegistryEnvironmentHelper.getToolEnvironmentConfig(name);

    return {
      toolName: name,
      toolDisplayName: tool.name,
      enabled: tool.enabled,
      validation: {
        valid: validation.isValid,
        errors: validation.errors,
      },
      environment: envConfig,
      health:
        this.healthCheckCache.get(`${name}-${tool.enabled}`)?.result || null,
    };
  }

  // Clear health check cache
  clearCache(): void {
    this.healthCheckCache.clear();
  }
}

// Types for the monitoring system
interface HealthCheckResult {
  result: ToolHealthStatus;
  timestamp: number;
}

interface ToolHealthStatus {
  name: string;
  enabled: boolean;
  healthy: boolean;
  checks: {
    registration: boolean;
    validation: boolean;
    environment: boolean;
    configuration: boolean;
  };
  issues: string[];
  lastChecked: string;
}

interface RegistryHealthStatus {
  overall: "healthy" | "degraded" | "unhealthy";
  tools: Record<string, ToolHealthStatus>;
  timestamp: string;
}

interface ToolConfigurationStatus {
  toolName: string;
  toolDisplayName: string;
  enabled: boolean;
  validation: {
    valid: boolean;
    errors: import("@/lib/config/tool-schemas").ValidationError[];
  };
  environment: import("@/lib/config/environment-helper").ToolEnvironmentConfig;
  health: ToolHealthStatus | null;
}

// Re-export types for convenience
export type { ToolHealthStatus, RegistryHealthStatus, ToolConfigurationStatus };

// Singleton instance
export const configurationMonitor = new ConfigurationMonitor();
