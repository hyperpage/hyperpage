/**
 * Tool Configuration Persistence Manager
 *
 * Manages user-configurable tool settings that persist across application restarts.
 * Provides type-safe configuration loading, saving, and management.
 */

import { toolRegistry } from "@/tools/registry";
import logger from "@/lib/logger";
import {
  toolConfigRepository,
  type NormalizedToolConfig,
} from "@/lib/database/tool-config-repository";

/**
 * User-configurable tool settings interface
 */
export interface UserToolConfig {
  /** Whether the tool is enabled */
  enabled: boolean;
  /** User overrides for tool configuration */
  config?: Record<string, unknown>;
  /** Custom refresh interval (overrides default) */
  refreshInterval?: number;
  /** Whether to show notifications for this tool */
  notifications: boolean;
}

/**
 * Internal configuration state manager
 */
class ToolConfigManager {
  private configCache: Map<string, UserToolConfig> = new Map();

  /**
   * Load persisted tool configurations from database at startup
   */
  async loadToolConfigurations(): Promise<number> {
    try {
      const persistedConfigs = await toolConfigRepository.getAll();
      let loadedCount = 0;

      for (const config of persistedConfigs) {
        try {
          const userConfig = this.fromNormalizedConfig(config);

          await this.applyToolConfiguration(config.toolName, userConfig);

          this.configCache.set(config.toolName, userConfig);
          loadedCount++;
        } catch (error) {
          logger.error("Failed to load configuration for tool", {
            toolName: config.toolName,
            error: error instanceof Error ? error.message : error,
          });
          continue;
        }
      }

      return loadedCount;
    } catch (error) {
      logger.error("Failed to load tool configurations", {
        error: error instanceof Error ? error.message : error,
      });
      return 0;
    }
  }

  /**
   * Save tool configuration to database
   */
  async saveToolConfiguration(
    toolName: string,
    config: Partial<UserToolConfig>,
  ): Promise<void> {
    try {
      // Get current config from cache or defaults
      const currentConfig =
        this.configCache.get(toolName) || this.getDefaultConfig();
      const mergedConfig = { ...currentConfig, ...config };

      await toolConfigRepository.upsert({
        toolName,
        enabled: mergedConfig.enabled,
        config: mergedConfig.config,
        refreshInterval: mergedConfig.refreshInterval,
        notifications: mergedConfig.notifications,
      });

      // Update cache
      this.configCache.set(toolName, mergedConfig);

      // Apply changes to tool registry
      await this.applyToolConfiguration(toolName, mergedConfig);
    } catch (error) {
      logger.error("Failed to save configuration for tool", {
        toolName,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Get current configuration for a tool (from cache or database)
   */
  async getToolConfiguration(toolName: string): Promise<UserToolConfig | null> {
    // Check cache first
    if (this.configCache.has(toolName)) {
      return this.configCache.get(toolName)!;
    }

    const normalized = await toolConfigRepository.get(toolName);

    if (!normalized) {
      return null;
    }

    const userConfig = this.fromNormalizedConfig(normalized);

    this.configCache.set(toolName, userConfig);
    return userConfig;
  }

  /**
   * Delete configuration for a tool (revert to defaults)
   */
  async deleteToolConfiguration(toolName: string): Promise<boolean> {
    try {
      await toolConfigRepository.delete(toolName);

      // Remove from cache regardless of whether db had the record
      this.configCache.delete(toolName);

      // Reapply default configuration
      await this.applyToolConfiguration(toolName, this.getDefaultConfig());

      return true;
    } catch (error) {
      logger.error("Failed to delete configuration for tool", {
        toolName,
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  /**
   * Clear the configuration cache (for testing)
   */
  clearCache(): void {
    this.configCache.clear();
  }

  /**
   * Enable/disable a tool
   */
  async toggleToolState(toolName: string, enabled: boolean): Promise<void> {
    await this.saveToolConfiguration(toolName, { enabled });
  }

  /**
   * Update refresh interval for a tool
   */
  async updateToolRefreshInterval(
    toolName: string,
    refreshInterval: number,
  ): Promise<void> {
    await this.saveToolConfiguration(toolName, { refreshInterval });
  }

  /**
   * Get all configured tools
   */
  async getAllToolConfigurations(): Promise<Record<string, UserToolConfig>> {
    const result: Record<string, UserToolConfig> = {};

    const allConfigs = await toolConfigRepository.getAll();

    for (const config of allConfigs) {
      result[config.toolName] = this.fromNormalizedConfig(config);
    }

    return result;
  }

  private fromNormalizedConfig(config: NormalizedToolConfig): UserToolConfig {
    return {
      enabled: config.enabled,
      config: config.config,
      refreshInterval:
        typeof config.refreshInterval === "number"
          ? config.refreshInterval
          : undefined,
      notifications: config.notifications,
    };
  }

  /**
   * Apply tool configuration to the tool registry
   */
  private async applyToolConfiguration(
    toolName: string,
    config: UserToolConfig,
  ): Promise<void> {
    const tool = toolRegistry[toolName];
    if (!tool) {
      logger.warn("Tool not found in registry", { toolName });
      return;
    }

    // Update tool's enabled state
    tool.enabled = config.enabled;

    // Update widget refresh intervals (apply to all dynamic widgets for this tool)
    if (config.refreshInterval && config.refreshInterval !== 0) {
      tool.widgets = tool.widgets.map((widget) => ({
        ...widget,
        refreshInterval: config.refreshInterval,
      }));
    }

    // Apply custom configuration overrides to tool config
    if (config.config) {
      tool.config = { ...tool.config, ...config.config };
    }

    logger.debug("Applied configuration to tool", {
      toolName,
      enabled: config.enabled,
      refreshInterval: config.refreshInterval,
    });
  }

  /**
   * Get default configuration values
   */
  private getDefaultConfig(): UserToolConfig {
    return {
      enabled: false, // Tools start disabled by default
      notifications: true,
      config: undefined,
      refreshInterval: undefined,
    };
  }
}

/**
 * Default export - singleton instance
 */
export const toolConfigManager = new ToolConfigManager();

/**
 * Convenience functions for external use
 */
export const loadToolConfigurations = () =>
  toolConfigManager.loadToolConfigurations();
export const saveToolConfiguration = (
  toolName: string,
  config: Partial<UserToolConfig>,
) => toolConfigManager.saveToolConfiguration(toolName, config);
export const getToolConfiguration = (toolName: string) =>
  toolConfigManager.getToolConfiguration(toolName);
export const deleteToolConfiguration = (toolName: string) =>
  toolConfigManager.deleteToolConfiguration(toolName);
export const toggleToolState = (toolName: string, enabled: boolean) =>
  toolConfigManager.toggleToolState(toolName, enabled);
export const updateToolRefreshInterval = (
  toolName: string,
  refreshInterval: number,
) => toolConfigManager.updateToolRefreshInterval(toolName, refreshInterval);
export const getAllToolConfigurations = () =>
  toolConfigManager.getAllToolConfigurations();
