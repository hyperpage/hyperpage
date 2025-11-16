import { z } from "zod";

import type { Tool, ToolConfig } from "@/tools/tool-types";

// Schema for validating tool configurations
// These enhance, not replace, existing tool-owned configurations

export const BaseToolConfigSchema = z.object({
  enabled: z.boolean().default(false),
  webUrl: z.string().url().optional(),
  apiUrl: z.string().url().optional(),
  refreshInterval: z.number().positive().default(300000),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  rateLimit: z
    .object({
      instanceAware: z.boolean().optional(),
      maxRetries: z.number().optional(),
      backoffStrategy: z
        .enum(["exponential", "linear", "adaptive-exponential"])
        .optional(),
    })
    .optional(),
  oauthConfig: z
    .object({
      userApiUrl: z.string().url(),
      authorizationHeader: z.enum(["Bearer", "token"]),
      authorizationUrl: z.string().url(),
      tokenUrl: z.string().url(),
      scopes: z.array(z.string()),
      clientIdEnvVar: z.string(),
      clientSecretEnvVar: z.string(),
      userMapping: z
        .object({
          id: z.string(),
          email: z.string().optional(),
          username: z.string(),
          name: z.string().optional(),
          avatar: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

// Tool-specific schemas that extend the base
export const GitHubConfigSchema = BaseToolConfigSchema.extend({
  enabled: z.boolean().default(process.env.ENABLE_GITHUB === "true"),
  webUrl: z.string().url().default("https://github.com"),
  apiUrl: z.string().url().default("https://api.github.com"),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  scopes: z.array(z.string()).default(["repo", "read:user"]),
});

export const GitLabConfigSchema = BaseToolConfigSchema.extend({
  enabled: z.boolean().default(process.env.ENABLE_GITLAB === "true"),
  webUrl: z.string().url().optional(),
  apiUrl: z.string().url().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  scopes: z.array(z.string()).default(["api", "read_user"]),
});

export const JiraConfigSchema = BaseToolConfigSchema.extend({
  enabled: z.boolean().default(process.env.ENABLE_JIRA === "true"),
  webUrl: z.string().url().optional(),
  apiUrl: z.string().url().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  scopes: z.array(z.string()).default(["read:jira-user", "read:jira-work"]),
  cloudId: z.string().optional(),
});

// Types for validation results
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Validation helper that works with existing registry
class ToolConfigValidator {
  static validateToolConfig(tool: Tool): ValidationResult {
    const errors: ValidationError[] = [];
    const config = tool.config || {};

    try {
      // Use tool-specific schema for validation
      const schema = this.getToolSchema(tool.name);
      schema.parse(config);

      // Tool-specific validation rules
      if (config.enabled) {
        const toolErrors = this.validateEnabledTool(tool, config);
        errors.push(...toolErrors);
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.issues.map((err: z.ZodIssue) => ({
            field: err.path.join("."),
            message: err.message,
            code: "SCHEMA_VALIDATION_ERROR",
          })),
        };
      }

      return {
        isValid: false,
        errors: [
          {
            field: "configuration",
            message: `Validation failed: ${(error as Error).message}`,
            code: "VALIDATION_ERROR",
          },
        ],
      };
    }
  }

  private static getToolSchema(toolName: string): z.ZodSchema {
    switch (toolName.toLowerCase()) {
      case "github":
        return GitHubConfigSchema;
      case "gitlab":
        return GitLabConfigSchema;
      case "jira":
        return JiraConfigSchema;
      default:
        return BaseToolConfigSchema;
    }
  }

  private static validateEnabledTool(
    tool: Tool,
    config: ToolConfig,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Enhanced validation that works with existing tool patterns
    if (config.oauthConfig) {
      // Validate OAuth configuration if present
      const requiredEnvVars = [
        config.oauthConfig.clientIdEnvVar,
        config.oauthConfig.clientSecretEnvVar,
      ];

      for (const envVar of requiredEnvVars) {
        if (envVar && !process.env[envVar]) {
          errors.push({
            field: `oauthConfig.${envVar.toLowerCase()}`,
            message: `${envVar} environment variable is required for OAuth`,
            code: "MISSING_OAUTH_CREDENTIAL",
          });
        }
      }
    }

    // Tool-specific validations
    if (tool.validation) {
      for (const requiredVar of tool.validation.required) {
        if (!process.env[requiredVar]) {
          errors.push({
            field: requiredVar,
            message: `Required environment variable ${requiredVar} is missing`,
            code: "MISSING_REQUIRED_VAR",
          });
        }
      }
    }

    return errors;
  }
}

// Export for use with existing registry
export { ToolConfigValidator };
