// Rate limiting and retry logic for external API requests with connection pooling support

import { ToolRateLimitConfig } from "@/tools/tool-types";
import { defaultHttpClient } from "@/lib/connection-pool";
import logger from "@/lib/logger";

export interface RetryConfig {
  rateLimitConfig: ToolRateLimitConfig;
  /** Force use of fetch instead of pooled client (for testing) */
  forceFetch?: boolean;
  /** Tool name for logging purposes */
  toolName?: string;
}

/**
 * Calculates backoff delay in milliseconds using exponential backoff
 */
export function calculateBackoffDelay(
  attemptNumber: number,
  baseDelayMs: number = 1000,
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attemptNumber);
  return Math.min(exponentialDelay, 60000); // Cap at 60 seconds
}

/**
 * Makes an API request with intelligent retry logic and optional connection pooling
 * Uses connection pooling in production for optimal performance, falls back to fetch for testing
 */
export async function makeRetryRequest(
  url: string,
  options: RequestInit,
  config: RetryConfig,
): Promise<Response> {
  const {
    rateLimitConfig,
    forceFetch = false,
    toolName = "api-client",
  } = config;
  const maxRetries = rateLimitConfig.maxRetries ?? 3; // Default to 3 retries

  let lastResponse: Response | null = null;
  let attemptNumber = 0;

  while (attemptNumber <= maxRetries) {
    try {
      let response: Response;

      // Use connection pool by default (production), fall back to fetch for testing
      if (forceFetch) {
        // Use legacy fetch-based implementation for testing
        response = await fetch(url, options);
      } else {
        // Use pooled HTTP client for connection keep-alive optimization
        const pooledResponse = await defaultHttpClient.request(url, {
          method: options.method || "GET",
          headers: (options.headers as Record<string, string>) || {},
          body: options.body as string | Buffer,
        });

        // Convert pooled response back to standard Response format for compatibility
        const responseBody = pooledResponse.body.toString();

        response = new Response(responseBody, {
          status: pooledResponse.statusCode,
          statusText: pooledResponse.statusCode >= 400 ? "Client Error" : "OK",
          headers: Object.entries(pooledResponse.headers).reduce(
            (acc, [key, value]) => {
              if (typeof value === "string") {
                acc.set(key, value);
              }
              return acc;
            },
            new Headers(),
          ),
        });
      }

      lastResponse = response;

      // Check if request succeeded
      if (lastResponse.ok) {
        logger.debug(`API request successful`, {
          toolName,
          url,
          attemptNumber: attemptNumber + 1,
          statusCode: response.status,
        });
        return lastResponse;
      }

      // Use tool's shouldRetry logic to determine if and how long to wait
      const delayMs = rateLimitConfig.shouldRetry(lastResponse, attemptNumber);

      if (delayMs !== null) {
        logger.warn("API request rate limited, retrying", {
          toolName,
          url,
          attemptNumber: attemptNumber + 1,
          maxRetries: maxRetries + 1,
          delayMs,
          statusCode: response.status,
          statusText: response.statusText,
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attemptNumber++;
        continue;
      }

      // No retry needed according to tool logic, return immediately
      break;
    } catch (error) {
      logger.warn("API request failed, will retry if possible", {
        toolName,
        url,
        attemptNumber: attemptNumber + 1,
        maxRetries: maxRetries + 1,
        error: error instanceof Error ? error.message : String(error),
      });

      attemptNumber++;
      if (attemptNumber > maxRetries) {
        logger.error("API request failed after all retries", {
          toolName,
          url,
          maxRetries: maxRetries + 1,
          finalError: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
      const delayMs = calculateBackoffDelay(attemptNumber - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Return last response if all retries exhausted
  if (lastResponse) {
    logger.warn("API request exhausted retries, returning last response", {
      toolName,
      url,
      statusCode: lastResponse.status,
      statusText: lastResponse.statusText,
    });
    return lastResponse;
  }

  // This should never happen in practice
  throw new Error("Request failed after all retries");
}

/**
 * Legacy makeRetryRequest function for backward compatibility
 * @deprecated Use makeRetryRequest with pooled connections instead
 */
export async function makeRetryRequestLegacy(
  url: string,
  options: RequestInit,
  config: RetryConfig,
): Promise<Response> {
  const { rateLimitConfig, toolName = "api-client" } = config;
  const maxRetries = rateLimitConfig.maxRetries ?? 3; // Default to 3 retries

  let lastResponse: Response | null = null;
  let attemptNumber = 0;

  while (attemptNumber <= maxRetries) {
    try {
      const response = await fetch(url, options);
      lastResponse = response;

      // Check if request succeeded
      if (response.ok) {
        logger.debug(`Legacy API request successful`, {
          toolName,
          url,
          attemptNumber: attemptNumber + 1,
          statusCode: response.status,
        });
        return response;
      }

      // Use tool's shouldRetry logic to determine if and how long to wait
      const delayMs = rateLimitConfig.shouldRetry(response, attemptNumber);

      if (delayMs !== null) {
        logger.warn("Legacy API request rate limited, retrying", {
          toolName,
          url,
          attemptNumber: attemptNumber + 1,
          maxRetries: maxRetries + 1,
          delayMs,
          statusCode: response.status,
          statusText: response.statusText,
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attemptNumber++;
        continue;
      }

      // No retry needed according to tool logic, return immediately
      break;
    } catch (error) {
      logger.warn("Legacy API request failed, will retry if possible", {
        toolName,
        url,
        attemptNumber: attemptNumber + 1,
        maxRetries: maxRetries + 1,
        error: error instanceof Error ? error.message : String(error),
      });

      attemptNumber++;
      if (attemptNumber > maxRetries) {
        logger.error("Legacy API request failed after all retries", {
          toolName,
          url,
          maxRetries: maxRetries + 1,
          finalError: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
      const delayMs = calculateBackoffDelay(attemptNumber - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Return last response if all retries exhausted
  if (lastResponse) {
    logger.warn(
      "Legacy API request exhausted retries, returning last response",
      {
        toolName,
        url,
        statusCode: lastResponse.status,
        statusText: lastResponse.statusText,
      },
    );
    return lastResponse;
  }

  // This should never happen in practice
  throw new Error("Request failed after all retries");
}
