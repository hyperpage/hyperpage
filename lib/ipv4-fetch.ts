/**
 * IPv4-forced fetch utility for IPv6-only network environments
 *
 * Node.js often prefers IPv6 DNS resolution, but IPv6 connections can timeout on IPv6-only networks.
 * This utility forces IPv4 connections to ensure reliable connectivity to external APIs.
 */

import type { Agent as HttpsAgent } from 'https';

/**
 * Server-side module cache to avoid repeated imports
 */
const getNodeModules = () => {
  if (typeof window === 'undefined') {
    // Server-side - use require to avoid bundling issues
    const https = require('https');
    const dns = require('dns');
    return { https, dns };
  }
  return null;
};

/**
 * Creates a fetch function that forces IPv4 connections to avoid IPv6 timeout issues
 * in IPv6-only network environments.
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns Promise<Response>
 */
export function createIPv4Fetch(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Force IPv4 connections to avoid IPv6 timeout issues on IPv6-only networks
    const enhancedOptions: RequestInit & { agent?: HttpsAgent } = {
      ...options,
      signal: controller.signal,
    };

    // Only configure IPv4 forcing server-side where Node.js modules are available
    if (typeof window === 'undefined') {
      try {
        const modules = getNodeModules();
        if (modules) {
          // Force IPv4 DNS resolution and connection
          // Create an HTTPS agent that forces IPv4 family
          enhancedOptions.agent = new modules.https.Agent({
            family: 4, // Force IPv4
            lookup: modules.dns.lookup, // Explicitly use DNS lookup
            timeout: timeoutMs, // Set connection timeout at agent level too
            keepAlive: false, // Disable keep-alive to avoid connection pooling issues
          });
            console.log(`IPv4 fetch configured for ${url} - agent with IPv4 family:`, enhancedOptions.agent?.constructor.name || 'unknown');
        }
      } catch (error) {
        // If modules aren't available, log but continue with standard fetch
        console.warn(`IPv4 forcing failed for ${url}, using standard fetch:`, error);
      }
    } else {
      console.log(`IPv4 fetch skipped for ${url} - running in browser environment`);
    }

    const fetchPromise = fetch(url, enhancedOptions);

    return fetchPromise
      .then(response => {
        clearTimeout(timeoutId);
        return response;
      })
      .catch(error => {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          throw new Error(`Request timed out after ${timeoutMs}ms - this may indicate IPv6 connectivity issues`);
        }

        // Re-throw other errors
        throw error;
      });

  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Wrapper function that mimics the standard fetch API but forces IPv4 connections
 * Can be used as a drop-in replacement for fetch() calls that need IPv4 forcing.
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @returns Promise<Response>
 */
export const ipv4Fetch = (url: string, options?: RequestInit): Promise<Response> => {
  return createIPv4Fetch(url, options);
};

/**
 * Convenience function for JSON APIs that need IPv4 forcing
 *
 * @param url - The API URL
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise<any> - Parsed JSON response
 */
export async function ipv4FetchJson<T = any>(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 10000
): Promise<T> {
  const response = await createIPv4Fetch(url, options, timeoutMs);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}
