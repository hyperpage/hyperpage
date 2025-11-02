import type { RateLimitUsage } from '../../lib/types/rate-limit';
import type { Server } from 'http';

/**
 * Mock rate limit server that simulates API platform behaviors
 * Supports configurable rate limits, reset timers, and different usage scenarios
 */
export class MockRateLimitServer {
  private serverUrl: string;
  private requestCounts: Map<string, number> = new Map();
  private resetTimes: Map<string, number> = new Map();
  private server: Server | null = null;

  constructor(port: number = 3000) {
    this.serverUrl = `http://localhost:${port}`;
  }

  /**
   * Configure rate limit scenarios for different platforms
   */
  private rateLimitScenarios: Record<string, {
    endpoints: Record<string, {
      limit: number;
      windowSeconds: number;
      currentUsage: number;
      responseDelay?: number;
      customResponse?: (count: number) => {
        statusCode?: number;
        retryAfter?: string | number | null;
        [key: string]: any;
      };
    }>
  }> = {
    github: {
      endpoints: {
        '/rate_limit': {
          limit: 5000,
          windowSeconds: 3600,
          currentUsage: 0,
          customResponse: (count: number) => {
            const timestamp = Math.floor(Date.now() / 1000);
            const resetTime = timestamp + 3600; // 1 hour from now

            return {
              resources: {
                core: {
                  limit: 5000,
                  used: Math.min(count % 5000, 5000),
                  remaining: Math.max(0, 5000 - (count % 5000)),
                  reset: resetTime
                },
                search: {
                  limit: 30,
                  used: Math.min(count % 30, 30),
                  remaining: Math.max(0, 30 - (count % 30)),
                  reset: resetTime
                },
                graphql: {
                  limit: 5000,
                  used: Math.min(count % 5000, 5000),
                  remaining: Math.max(0, 5000 - (count % 5000)),
                  reset: resetTime
                }
              }
            };
          }
        }
      }
    },
    gitlab: {
      endpoints: {
        '/api/v4/rate_limit': {
          limit: 2000,
          windowSeconds: 60,
          currentUsage: 0,
          customResponse: (count: number) => {
            const isLimited = count >= 2000;
            const retryAfter = isLimited ? 60 : null;

            if (isLimited) {
              return {
                message: 'Rate limit exceeded',
                retryAfter: retryAfter,
                statusCode: 429
              };
            }

            return {
              data: `mock-${count}`,
              statusCode: 200
            };
          }
        }
      }
    },
    jira: {
      endpoints: {
        '/rest/api/3/rate_limit': {
          limit: 1000,
          windowSeconds: 3600,
          currentUsage: 0,
          customResponse: (count: number) => {
            const isLimited = count >= 1000;

            if (isLimited) {
              return {
                message: 'Too many requests',
                retryAfter: '3600',
                statusCode: 429
              };
            }

            return {
              data: `jira-mock-${count}`,
              statusCode: 200
            };
          }
        }
      }
    }
  };

  async start(): Promise<void> {
    const http = await import('http');

    this.server = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const platform = this.getPlatformFromUrl(url.pathname);
      const endpoint = platform ? `/${platform}${url.pathname.replace(`/${platform}`, '')}`.split('?')[0] : url.pathname;

      if (!platform) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Platform not found' }));
        return;
      }

      const scenario = this.rateLimitScenarios[platform];
      if (!scenario) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Scenario not configured' }));
        return;
      }

      // Track requests for this platform
      const requestKey = `${platform}${endpoint}`;
      const count = (this.requestCounts.get(requestKey) || 0) + 1;
      this.requestCounts.set(requestKey, count);

      // Get endpoint configuration
      let endpointConfig = scenario.endpoints[endpoint];
      if (!endpointConfig && endpoint === `/${platform}/rate_limit`) {
        endpointConfig = scenario.endpoints['/rate_limit'];
      }

      if (!endpointConfig || !endpointConfig.customResponse) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Endpoint not configured', requestKey, endpoint }));
        return;
      }

      // Simulate network delay
      if (endpointConfig.responseDelay) {
        await new Promise(resolve => setTimeout(resolve, endpointConfig.responseDelay));
      }

      // Generate response
      const responseData = endpointConfig.customResponse(count);

      // Set response headers and status
      res.writeHead(responseData.statusCode || 200, {
        'Content-Type': 'application/json',
        'X-RateLimit-Request-Count': count.toString(),
        ...(responseData.retryAfter && { 'Retry-After': responseData.retryAfter.toString() })
      });

      // Remove statusCode from response body
      const responseBody = { ...responseData };
      delete responseBody.statusCode;

      res.end(JSON.stringify(responseBody));
    });

    const port = parseInt(this.serverUrl.split(':')[2]);
    await new Promise<void>((resolve, reject) => {
      this.server.listen(port, () => resolve()).on('error', reject);
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve, reject) => {
        this.server.close((err?: Error) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.server = null;
    }
  }

  getBaseUrl(): string {
    return this.serverUrl;
  }

  // Reset request counts for testing
  resetCounters(platform?: string): void {
    if (platform) {
      // Reset specific platform
      Array.from(this.requestCounts.keys())
        .filter(key => key.startsWith(platform))
        .forEach(key => this.requestCounts.delete(key));
    } else {
      // Reset all counters
      this.requestCounts.clear();
    }
  }

  // Set custom usage for testing specific scenarios
  setUsage(platform: string, endpoint: string, usage: number): void {
    this.requestCounts.set(`${platform}${endpoint}`, usage);
  }

  // Configure a custom endpoint for testing
  configureEndpoint(platform: string, endpoint: string, config: {
    limit: number;
    responseDelay?: number;
    customResponse?: (count: number) => {
      statusCode?: number;
      retryAfter?: string | number | null;
      [key: string]: any;
    };
  }): void {
    if (!this.rateLimitScenarios[platform]) {
      this.rateLimitScenarios[platform] = { endpoints: {} };
    }
    this.rateLimitScenarios[platform].endpoints[endpoint] = {
      limit: config.limit,
      windowSeconds: 3600, // Default 1 hour window
      currentUsage: 0,
      responseDelay: config.responseDelay,
      customResponse: config.customResponse
    };
  }

  private getPlatformFromUrl(pathname: string): string | null {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return null;

    const firstSegment = segments[0];

    // Check if it's a known platform
    if (firstSegment in this.rateLimitScenarios) {
      return firstSegment;
    }

    // For GitLab-style paths
    if (segments.includes('api') && segments.includes('v4')) {
      return 'gitlab';
    }

    return null;
  }
}

/**
 * Test utility functions for setting up mock server scenarios
 */
export const RateLimitTestUtils = {
  /**
   * Create a rate limit scenario that triggers at specific usage level
   */
  createRateLimitScenario: (
    platform: string,
    triggerUsage: number,
    limit: number = 100
  ): ((count: number) => {
    statusCode?: number;
    retryAfter?: string | number | null;
    resources?: any;
    message?: string;
    data?: string;
    [key: string]: any;
  }) => {
    return (count: number) => {
      const used = count % (limit + 1);
      const isLimited = used >= triggerUsage;

      if (platform === 'github') {
        return {
          resources: {
            core: {
              limit,
              used: Math.min(used, limit),
              remaining: Math.max(0, limit - used),
              reset: Math.floor(Date.now() / 1000) + 3600
            }
          }
        };
      }

      if (platform === 'gitlab') {
        if (isLimited) {
          return {
            message: 'Rate limit exceeded',
            retryAfter: 60,
            statusCode: 429
          };
        }
        return { data: `mock-${count}`, statusCode: 200 };
      }

      if (platform === 'jira') {
        if (isLimited) {
          return {
            message: 'Too many requests',
            retryAfter: '3600',
            statusCode: 429
          };
        }
        return { data: `jira-mock-${count}`, statusCode: 200 };
      }

      return { statusCode: 200 };
    };
  },

  /**
   * Simulate network conditions for testing
   */
  simulateNetworkDelay: (minDelayMs: number, maxDelayMs: number): number => {
    return Math.random() * (maxDelayMs - minDelayMs) + minDelayMs;
  }
};
