// Rate limiting and retry logic for external API requests with connection pooling support

import { ToolRateLimitConfig } from "../tools/tool-types";
import { defaultHttpClient } from "./connection-pool";

export interface RetryConfig {
  rateLimitConfig: ToolRateLimitConfig;
  /** Force use of fetch instead of pooled client (for testing) */
  forceFetch?: boolean;
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
  const { rateLimitConfig, forceFetch = false } = config;
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
        return lastResponse;
      }

      // Use tool's shouldRetry logic to determine if and how long to wait
      const delayMs = rateLimitConfig.shouldRetry(lastResponse, attemptNumber);

      if (delayMs !== null) {
        const toolName = "tool"; // This could be passed in config for better logging
        console.warn(
          `${toolName}: Rate limited, waiting ${delayMs}ms before retry (attempt ${attemptNumber + 1}/${maxRetries + 1})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attemptNumber++;
        continue;
      }

      // No retry needed according to tool logic, return immediately
      break;
    } catch (error) {
      
      attemptNumber++;
      if (attemptNumber > maxRetries) {
        throw error;
      }
      const delayMs = calculateBackoffDelay(attemptNumber - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Return last response if all retries exhausted
  if (lastResponse) {
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
  const { rateLimitConfig } = config;
  const maxRetries = rateLimitConfig.maxRetries ?? 3; // Default to 3 retries

  let lastResponse: Response | null = null;
  let attemptNumber = 0;

  while (attemptNumber <= maxRetries) {
    try {
      const response = await fetch(url, options);
      lastResponse = response;

      // Check if request succeeded
      if (response.ok) {
        return response;
      }

      // Use tool's shouldRetry logic to determine if and how long to wait
      const delayMs = rateLimitConfig.shouldRetry(response, attemptNumber);

      if (delayMs !== null) {
        const toolName = "tool"; // This could be passed in config for better logging
        console.warn(
          `${toolName}: Rate limited, waiting ${delayMs}ms before retry (attempt ${attemptNumber + 1}/${maxRetries + 1})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attemptNumber++;
        continue;
      }

      // No retry needed according to tool logic, return immediately
      break;
    } catch (error) {
      
      attemptNumber++;
      if (attemptNumber > maxRetries) {
        throw error;
      }
      const delayMs = calculateBackoffDelay(attemptNumber - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Return last response if all retries exhausted
  if (lastResponse) {
    return lastResponse;
  }

  // This should never happen in practice
  throw new Error("Request failed after all retries");
}
