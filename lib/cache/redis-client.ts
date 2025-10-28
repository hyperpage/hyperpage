import Redis from 'ioredis';

export interface RedisClientOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  lazyConnect?: boolean;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  connectTimeout?: number;
  commandTimeout?: number;
  family?: number; // 4 for IPv4, 6 for IPv6
  tls?: object;
}

export interface ConnectionHealth {
  connected: boolean;
  ready: boolean;
  pingLatency?: number;
  lastError?: string;
  uptimeSeconds?: number;
}

/**
 * Redis client abstraction for Hyperpage caching infrastructure.
 * Provides connection management, health monitoring, and graceful degradation.
 */
export class RedisClient {
  private client: Redis | null = null;
  private connectionUrl: string;
  private isConnecting = false;
  private lastError: string | null = null;
  private connectionStartTime: number | null = null;

  constructor(url?: string, options: RedisClientOptions = {}) {
    this.connectionUrl = url || process.env.REDIS_URL || 'redis://localhost:6379';

    // Initialize client but don't connect yet (lazy)
    this.client = new Redis(this.connectionUrl, {
      lazyConnect: true,
      retryDelayOnFailover: 500,
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      commandTimeout: 2000,
      family: 4, // IPv4 default
      ...options,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      this.connectionStartTime = Date.now();
      this.lastError = null;
      console.debug('Redis client connected');
    });

    this.client.on('ready', () => {
      this.isConnecting = false;
      console.debug('Redis client ready');
    });

    this.client.on('error', (error) => {
      this.lastError = error.message;
      this.isConnecting = false;
      console.error('Redis client error:', error.message);
    });

    this.client.on('close', () => {
      this.connectionStartTime = null;
      this.isConnecting = false;
      console.debug('Redis client closed');
    });

    this.client.on('reconnecting', () => {
      console.debug('Redis client reconnecting...');
    });
  }

  /**
   * Establish connection to Redis if not already connected.
   * @throws Error if connection fails after retries
   */
  async connect(): Promise<void> {
    if (this.isConnected || this.isConnecting) return;

    this.isConnecting = true;

    try {
      if (!this.client) throw new Error('Redis client not initialized');

      await this.client.connect();
      console.info('Successfully connected to Redis');
    } catch (error) {
      this.isConnecting = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.lastError = errorMessage;
      console.error('Failed to connect to Redis:', errorMessage);

      // Don't throw - graceful degradation to memory-only mode
      throw new Error(`Redis connection failed: ${errorMessage}`);
    }
  }

  /**
   * Disconnect from Redis gracefully.
   */
  async disconnect(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.quit();
      console.debug('Redis client disconnected');
    } catch (error) {
      console.warn('Error during Redis disconnection:', error);
      // Force disconnect if quit fails
      this.client.disconnect();
    } finally {
      this.client = null;
      this.connectionStartTime = null;
    }
  }

  /**
   * Get the underlying ioredis client instance.
   * Use with caution - this bypasses the abstraction layer.
   * @throws Error if not connected
   */
  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    return this.client;
  }

  /**
   * Check if Redis client is connected and ready.
   */
  get isConnected(): boolean {
    return this.client?.status === 'ready';
  }

  /**
   * Check if Redis client is in the process of connecting.
   */
  get isConnectingToRedis(): boolean {
    return this.isConnecting || this.client?.status === 'connecting';
  }

  /**
   * Get comprehensive health status of the Redis connection.
   */
  async getHealth(): Promise<ConnectionHealth> {
    const health: ConnectionHealth = {
      connected: this.client?.status === 'ready',
      ready: this.client?.status === 'ready',
      lastError: this.lastError || undefined,
      uptimeSeconds: this.connectionStartTime
        ? Math.floor((Date.now() - this.connectionStartTime) / 1000)
        : undefined,
    };

    if (this.isConnected && this.client) {
      try {
        const startTime = Date.now();
        await this.client.ping();
        health.pingLatency = Date.now() - startTime;
      } catch (error) {
        health.lastError = error instanceof Error ? error.message : String(error);
        health.connected = false;
        health.ready = false;
      }
    }

    return health;
  }

  /**
   * Test the connection with a simple ping.
   */
  async ping(): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  /**
   * Get connection information for debugging.
   */
  getConnectionInfo(): {
    url: string;
    status: string;
    uptimeSeconds?: number;
    lastError?: string;
  } {
    return {
      url: this.connectionUrl,
      status: this.client?.status || 'disconnected',
      uptimeSeconds: this.connectionStartTime
        ? Math.floor((Date.now() - this.connectionStartTime) / 1000)
        : undefined,
      lastError: this.lastError || undefined,
    };
  }
}

// Export a default instance for global use
export const redisClient = new RedisClient();

// Export Redis types for convenience
export { Redis };
