import { Agent, Pool, Dispatcher, request } from 'undici';

/**
 * Connection pool configuration for HTTP keep-alive optimization
 */
export interface ConnectionPoolConfig {
  /** Maximum number of connections per host */
  maxConnections?: number;
  /** Keep-alive timeout in milliseconds */
  keepAliveTimeout?: number;
  /** Maximum lifetime of a connection in milliseconds */
  maxLifetime?: number;
  /** Maximum idle time for a connection in milliseconds */
  maxIdleTimeout?: number;
  /** TLS timeout in milliseconds */
  tlsTimeout?: number;
  /** Total request timeout in milliseconds */
  timeout?: number;
  /** Whether to enable pipelining */
  pipelining?: number;
  /** User-agent for all requests */
  userAgent?: string;
  /** Whether to reuse connections for the same origin */
  keepAlive?: boolean;
}

/**
 * HTTP connection pool metrics
 */
export interface ConnectionPoolMetrics {
  /** Number of active connections */
  activeConnections: number;
  /** Number of idle connections */
  idleConnections: number;
  /** Total number of connections created */
  totalConnections: number;
  /** Number of pending requests */
  pendingRequests: number;
  /** Average connection lifetime in milliseconds */
  averageConnectionLifetime: number;
  /** Connection success rate (0.0 - 1.0) */
  connectionSuccessRate: number;
  /** Reuse ratio - percentage of connections that were reused */
  reuseRatio: number;
}

/**
 * Pooled HTTP client for connection keep-alive optimization
 * Uses undici Agent for efficient HTTP/1.1 and HTTP/2 connection pooling
 */
export class PooledHttpClient {
  private agent: Agent;
  private config: Required<ConnectionPoolConfig>;
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalConnections: 0,
    activeConnections: 0,
    connectionReuseCount: 0,
    connectionCreationTime: Date.now(),
    connectionLifetimes: [] as number[],
  };

  constructor(config: ConnectionPoolConfig = {}) {
    this.config = {
      maxConnections: config.maxConnections ?? 10,
      keepAliveTimeout: config.keepAliveTimeout ?? 30000, // 30 seconds
      maxLifetime: config.maxLifetime ?? 300000, // 5 minutes
      maxIdleTimeout: config.maxIdleTimeout ?? 60000, // 1 minute
      tlsTimeout: config.tlsTimeout ?? 10000, // 10 seconds
      timeout: config.timeout ?? 30000, // 30 seconds
      pipelining: config.pipelining ?? 1,
      userAgent: config.userAgent ?? 'Hyperpage/1.0',
      keepAlive: config.keepAlive ?? true,
    };

    this.agent = new Agent({
      connections: this.config.maxConnections,
      keepAliveTimeout: this.config.keepAliveTimeout,
      keepAliveMaxTimeout: this.config.maxIdleTimeout,
      connect: {
        timeout: this.config.tlsTimeout,
      },
      bodyTimeout: this.config.timeout,
      headersTimeout: this.config.timeout,
      pipelining: this.config.pipelining,
      allowH2: true, // Enable HTTP/2 when available
      maxCachedSessions: 100, // Cache TLS sessions
    });

    // Periodically clean up old metrics data
    setInterval(() => {
      this.cleanupMetrics();
    }, 300000); // Clean up every 5 minutes
  }

  /**
   * Make an HTTP request using the connection pool
   */
  async request(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string | Buffer;
      searchParams?: URLSearchParams;
    } = {}
  ): Promise<{
    statusCode: number;
    headers: Record<string, string>;
    body: Buffer;
    metrics: {
      connectionReused: boolean;
      connectionCreated: number;
      requestStartTime: number;
      responseTime: number;
    };
  }> {
    const requestStartTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const {
        method = 'GET',
        headers = {},
        body,
        searchParams,
      } = options;

      // Build full URL with search params
      const urlObj = new URL(url);
      if (searchParams) {
        urlObj.search = searchParams.toString();
      }

      const requestHeaders = {
        'User-Agent': this.config.userAgent,
        ...headers,
      };

      const response = await request(urlObj.toString(), {
        method: method as Dispatcher.HttpMethod,
        headers: requestHeaders,
        body,
        dispatcher: this.agent,
        throwOnError: false, // Don't throw on HTTP error status
      });

      const responseTime = Date.now() - requestStartTime;
      const responseBody = await response.body.arrayBuffer();

      // Update metrics
      this.metrics.successfulRequests++;
      this.metrics.activeConnections = (this.agent as any).pending + (this.agent as any).running;

      // Check if connection was reused (undici provides this info through internal APIs)
      const connectionReused = this.checkConnectionReuse(response);

      if (connectionReused) {
        this.metrics.connectionReuseCount++;
      }

      // Track connection lifetime if this is a new connection
      if (!connectionReused) {
        this.metrics.connectionLifetimes.push(Date.now() - this.metrics.connectionCreationTime);
        this.metrics.totalConnections++;
      }

      // Convert headers to simple string format for compatibility
      const normalizedHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.headers)) {
        if (value !== undefined) {
          normalizedHeaders[key] = Array.isArray(value) ? value[0] : String(value);
        }
      }

      return {
        statusCode: response.statusCode,
        headers: normalizedHeaders,
        body: Buffer.from(responseBody),
        metrics: {
          connectionReused,
          connectionCreated: this.metrics.connectionCreationTime,
          requestStartTime,
          responseTime,
        },
      };

    } catch (error) {
      this.metrics.failedRequests++;
      throw error;
    }
  }

  /**
   * Make a GET request with connection pooling
   */
  async get(
    url: string,
    headers?: Record<string, string>,
    searchParams?: URLSearchParams
  ): Promise<Buffer> {
    const response = await this.request(url, {
      method: 'GET',
      headers,
      searchParams,
    });

    if (response.statusCode >= 400) {
      throw new Error(`HTTP ${response.statusCode}: ${response.body.toString()}`);
    }

    return response.body;
  }

  /**
   * Make a POST request with connection pooling
   */
  async post(
    url: string,
    body: string | Buffer,
    headers?: Record<string, string>,
    searchParams?: URLSearchParams
  ): Promise<Buffer> {
    const response = await this.request(url, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      searchParams,
    });

    if (response.statusCode >= 400) {
      throw new Error(`HTTP ${response.statusCode}: ${response.body.toString()}`);
    }

    return response.body;
  }

  /**
   * Get connection pool metrics
   */
  getMetrics(): ConnectionPoolMetrics {
    const totalConnections = this.metrics.totalConnections;
    const reuseRatio = totalConnections > 0 ? this.metrics.connectionReuseCount / totalConnections : 0;

    return {
      activeConnections: this.metrics.activeConnections,
      idleConnections: Math.max(0, this.metrics.totalConnections - this.metrics.activeConnections),
      totalConnections: this.metrics.totalConnections,
      pendingRequests: (this.agent as any).pending || 0,
      averageConnectionLifetime: this.calculateAverageLifetime(),
      connectionSuccessRate: this.calculateSuccessRate(),
      reuseRatio,
    };
  }

  /**
   * Get pool health status
   */
  getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  } {
    const metrics = this.getMetrics();
    const successRate = metrics.connectionSuccessRate;
    const activeConnections = metrics.activeConnections;
    const totalConnections = metrics.totalConnections;

    if (successRate >= 0.95 && totalConnections > 0) {
      return {
        status: 'healthy',
        details: {
          successRate: `${(successRate * 100).toFixed(1)}%`,
          connections: `${activeConnections}/${totalConnections}`,
          reuseRatio: `${(metrics.reuseRatio * 100).toFixed(1)}%`,
        },
      };
    } else if (successRate >= 0.80) {
      return {
        status: 'degraded',
        details: {
          successRate: `${(successRate * 100).toFixed(1)}%`,
          connections: `${activeConnections}/${totalConnections}`,
          reuseRatio: `${(metrics.reuseRatio * 100).toFixed(1)}%`,
          advice: 'Connection success rate is acceptable but could be improved',
        },
      };
    } else {
      return {
        status: 'unhealthy',
        details: {
          successRate: `${(successRate * 100).toFixed(1)}%`,
          connections: `${activeConnections}/${totalConnections}`,
          reuseRatio: `${(metrics.reuseRatio * 100).toFixed(1)}%`,
          advice: 'High connection failure rate - check network configuration',
        },
      };
    }
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    await this.agent.close();
  }

  /**
   * Check if connection was reused (best effort)
   * This is a heuristic based on undici's internal behavior
   */
  private checkConnectionReuse(response: any): boolean {
    // undici doesn't directly expose connection reuse info in the public API
    // This is a heuristic based on response metadata and timing
    return response.headers['connection'] === 'keep-alive' ||
           response.statusCode === 200 && Date.now() - this.metrics.connectionCreationTime > 100;
  }

  /**
   * Calculate average connection lifetime
   */
  private calculateAverageLifetime(): number {
    if (this.metrics.connectionLifetimes.length === 0) return 0;

    const sum = this.metrics.connectionLifetimes.reduce((a, b) => a + b, 0);
    return sum / this.metrics.connectionLifetimes.length;
  }

  /**
   * Calculate connection success rate
   */
  private calculateSuccessRate(): number {
    const total = this.metrics.totalRequests;
    if (total === 0) return 1.0;

    return this.metrics.successfulRequests / total;
  }

  /**
   * Clean up old metrics data to prevent memory leaks
   */
  private cleanupMetrics(): void {
    // Keep only recent connection lifetimes (last 1000)
    if (this.metrics.connectionLifetimes.length > 1000) {
      // Keep the most recent 500 entries
      this.metrics.connectionLifetimes = this.metrics.connectionLifetimes.slice(-500);
    }

    // Reset counters occasionally to prevent overflow
    if (this.metrics.totalRequests > 1000000) {
      this.metrics.totalRequests = Math.floor(this.metrics.totalRequests * 0.1);
      this.metrics.successfulRequests = Math.floor(this.metrics.successfulRequests * 0.1);
      this.metrics.failedRequests = Math.floor(this.metrics.failedRequests * 0.1);
    }
  }
}

// Global instance for shared use across the application
export const defaultHttpClient = new PooledHttpClient();

/**
 * Create a custom HTTP client with specific configuration
 */
export function createHttpClient(config: ConnectionPoolConfig): PooledHttpClient {
  return new PooledHttpClient(config);
}
