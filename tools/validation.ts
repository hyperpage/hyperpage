import { Tool } from "./tool-types";
import { getToolUrls, getAllTools } from "./index";

/**
 * Tool configuration validation and error recovery system
 * Provides runtime health checks and detailed error states for tools
 */

export interface ToolValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  status: "connected" | "connecting" | "error" | "configuration_error";
  connectivity?: ToolValidationResult;
  circuitBreaker?: {
    state: "closed" | "open" | "half-open";
    failures: number;
  };
}

/**
 * Validates tool configuration and returns detailed status
 * Uses tool-owned validation requirements instead of hardcoded mappings
 */
export function validateToolConfig(tool: Tool): ToolValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if tool has validation requirements defined
  if (!tool.validation) {
    // Tool doesn't have validation requirements, check basic config
    return validateBasicConfig(tool);
  }

  const requirements = tool.validation;

  // Check required environment variables
  for (const envVar of requirements.required) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  // Check optional environment variables (generate warnings)
  for (const envVar of requirements.optional) {
    if (!process.env[envVar]) {
      warnings.push(`Optional environment variable not set: ${envVar}`);
    }
  }

  // Validate URLs
  const { webUrl, apiUrl } = getToolUrls(tool);
  if (!webUrl) {
    errors.push("Cannot determine web URL from configuration");
  }
  if (!apiUrl) {
    errors.push("Cannot determine API URL from configuration");
  }

  // Determine status
  let status: ToolValidationResult["status"] = "connected";
  if (errors.length > 0) {
    status = "configuration_error";
  } else if (warnings.length > 0) {
    status = "connected"; // Still connected but with warnings
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    status,
  };
}

/**
 * Validates basic tool configuration for tools without specific requirements
 */
function validateBasicConfig(tool: Tool): ToolValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic checks for any tool
  if (!tool.name) {
    errors.push("Tool missing name");
  }
  if (!tool.slug) {
    errors.push("Tool missing slug");
  }

  const { webUrl, apiUrl } = getToolUrls(tool);
  if (webUrl && !isValidUrl(webUrl)) {
    errors.push("Invalid web URL format");
  }
  if (apiUrl && !isValidUrl(apiUrl)) {
    errors.push("Invalid API URL format");
  }

  let status: ToolValidationResult["status"] = "connected";
  if (errors.length > 0) {
    status = "configuration_error";
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    status,
  };
}

/**
 * Tests API connectivity for a tool
 */
export async function testToolConnectivity(
  tool: Tool,
  timeout: number = 5000,
): Promise<ToolValidationResult> {
  const configValidation = validateToolConfig(tool);

  // If basic config is invalid, don't bother testing connectivity
  if (!configValidation.isValid) {
    return configValidation;
  }

  const result = { ...configValidation };

  try {
    // Test connectivity based on tool's first API endpoint
    if (tool.apis && Object.keys(tool.apis).length > 0) {
      // Create a test request to the tool's API endpoint
      const { apiUrl } = getToolUrls(tool);
      if (apiUrl) {
        // Use AbortSignal for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          // Test with a simple HEAD or GET request
          const response = await fetch(`${apiUrl}/user`, {
            method: "HEAD", // HEAD request is more efficient for connectivity tests
            signal: controller.signal,
            headers: {
              "User-Agent": "Hyperpage-HealthCheck/1.0",
            },
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            result.status = "connected";
          } else if (response.status === 401) {
            result.errors.push("API authentication failed");
            result.status = "configuration_error";
          } else {
            result.errors.push(`API responded with status ${response.status}`);
            result.status = "error";
          }
        } catch {
          clearTimeout(timeoutId);
          result.errors.push("API connectivity test failed");
          result.status = "error";
        }
      }
    }
  } catch {
    result.errors.push("Unexpected error during connectivity test");
    result.status = "error";
  }

  return result;
}

/**
 * Validates URL format
 */
function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

/**
 * Circuit breaker state management (simple in-memory implementation)
 * In production, this could be stored in Redis or similar
 */
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: "closed" | "open" | "half-open";
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

/**
 * Checks if a tool should be allowed to make requests (based on circuit breaker)
 */
export function canExecuteRequest(toolName: string): boolean {
  const breaker = circuitBreakers.get(toolName);
  if (!breaker) {
    return true; // No failures yet
  }

  const now = Date.now();

  // If circuit is open and timeout has passed, move to half-open
  if (
    breaker.state === "open" &&
    now - breaker.lastFailure > CIRCUIT_BREAKER_TIMEOUT
  ) {
    breaker.state = "half-open";
    breaker.failures = 0; // Reset failure count for half-open state
  }

  // Allow requests in closed or half-open states
  return breaker.state === "closed" || breaker.state === "half-open";
}

/**
 * Records a successful request (resets circuit breaker)
 */
export function recordRequestSuccess(toolName: string): void {
  circuitBreakers.delete(toolName);
}

/**
 * Records a failed request (increments circuit breaker failures)
 */
export function recordRequestFailure(toolName: string): void {
  const breaker = circuitBreakers.get(toolName) || {
    failures: 0,
    lastFailure: 0,
    state: "closed",
  };

  breaker.failures++;
  breaker.lastFailure = Date.now();

  if (breaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    breaker.state = "open";
  }

  circuitBreakers.set(toolName, breaker);
}

/**
 * Gets circuit breaker status for a tool
 */
export function getCircuitBreakerStatus(toolName: string) {
  return circuitBreakers.get(toolName) || { state: "closed", failures: 0 };
}

/**
 * Gets health status for all tools
 */
export function getAllToolsHealth(): Record<string, ToolValidationResult> {
  const health: Record<string, ToolValidationResult> = {};

  getAllTools().forEach((tool: Tool) => {
    health[tool.slug] = validateToolConfig(tool);
  });

  return health;
}
