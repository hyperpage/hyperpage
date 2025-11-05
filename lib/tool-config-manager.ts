/**
 * Tool Configuration Persistence Manager
 *
 * Manages user-configurable tool settings that persist across application restarts.
 * Provides type-safe configuration loading, saving, and management.
 */

import { db } from "./database";
import { toolConfigs } from "./database/schema";
import { eq } from "drizzle-orm";
import { toolRegistry } from "../tools/registry";
import logger from "./logger";

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
      const persistedConfigs = await db.select().from(toolConfigs);
      let loadedCount = 0;

      for (const config of persistedConfigs) {
        try {
          // Convert database format to UserToolConfig
          const userConfig: UserToolConfig = {
            enabled: Boolean(config.enabled),
            config: config.config || undefined,
            refreshInterval: config.refreshInterval
              ? Number(config.refreshInterval)
              : undefined,
            notifications: Boolean(config.notifications),
          };

          // Update the tool registry with persisted configuration
          await this.applyToolConfiguration(config.toolName, userConfig);

          // Cache for quick access
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

      // Persist to database
      await db
        .insert(toolConfigs)
        .values({
          toolName,
          enabled: mergedConfig.enabled,
          config: mergedConfig.config,
          refreshInterval: mergedConfig.refreshInterval,
          notifications: mergedConfig.notifications,
          updatedAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: toolConfigs.toolName,
          set: {
            enabled: mergedConfig.enabled,
            config: mergedConfig.config,
            refreshInterval: mergedConfig.refreshInterval,
            notifications: mergedConfig.notifications,
            updatedAt: Date.now(),
          },
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

    // Load from database
    const result = await db
      .select()
      .from(toolConfigs)
      .where(eq(toolConfigs.toolName, toolName));

    if (result.length > 0) {
      const config = result[0];
      const userConfig: UserToolConfig = {
        enabled: Boolean(config.enabled),
        config: config.config || undefined,
        refreshInterval: config.refreshInterval
          ? Number(config.refreshInterval)
          : undefined,
        notifications: Boolean(config.notifications),
      };

      // Cache it
      this.configCache.set(toolName, userConfig);
      return userConfig;
    }

    return null; // No configuration found
  }

  /**
   * Delete configuration for a tool (revert to defaults)
   */
  async deleteToolConfiguration(toolName: string): Promise<boolean> {
    try {
      // Perform the delete operation
      await db.delete(toolConfigs).where(eq(toolConfigs.toolName, toolName));

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

    // Load all from database
    const allConfigs = await db.select().from(toolConfigs);

    for (const config of allConfigs) {
      result[config.toolName] = {
        enabled: Boolean(config.enabled),
        config: config.config || undefined,
        refreshInterval: config.refreshInterval
          ? Number(config.refreshInterval)
          : undefined,
        notifications: Boolean(config.notifications),
      };
    }

    return result;
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
