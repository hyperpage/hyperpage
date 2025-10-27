// Rate limiting and retry logic for external API requests

import { ToolRateLimitConfig } from '../tools/tool-types';

export interface RetryConfig {
  rateLimitConfig: ToolRateLimitConfig;
}

/**
 * Calculates backoff delay in milliseconds using exponential backoff
 */
export function calculateBackoffDelay(attemptNumber: number, baseDelayMs: number = 1000): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attemptNumber);
  return Math.min(exponentialDelay, 60000); // Cap at 60 seconds
}

/**
 * Makes an API request with intelligent retry logic for rate limiting
 */
export async function makeRetryRequest(
  url: string,
  options: RequestInit,
  config: RetryConfig
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
        const toolName = 'tool'; // This could be passed in config for better logging
        console.warn(`${toolName}: Rate limited, waiting ${delayMs}ms before retry (attempt ${attemptNumber + 1}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        attemptNumber++;
        continue;
      }

      // No retry needed according to tool logic, return immediately
      break;

    } catch (error) {
      console.warn(`Request failed on attempt ${attemptNumber + 1}:`, error);
      attemptNumber++;
      if (attemptNumber > maxRetries) {
        throw error;
      }
      const delayMs = calculateBackoffDelay(attemptNumber - 1);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Return last response if all retries exhausted
  if (lastResponse) {
    return lastResponse;
  }

  // This should never happen in practice
  throw new Error('Request failed after all retries');
}
