import { CacheFactory } from '../cache/cache-factory';
import { CacheBackend } from '../cache/cache-interface';
import logger from '../logger';

export interface SessionData {
  userId?: string;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    timezone: string;
    language: string;
    refreshInterval: number;
  };
  uiState: {
    expandedWidgets: string[];
    lastVisitedTools: string[];
    dashboardLayout: string;
    filterSettings: Record<string, any>;
  };
  toolConfigs: {
    [toolId: string]: {
      enabled: boolean;
      settings: Record<string, any>;
      lastUsed: Date;
    };
  };
  lastActivity: Date;
  metadata: {
    ipAddress: string;
    userAgent: string;
    created: Date;
    updated: Date;
  };
}

export class SessionManager {
  private redisClient: any;
  private connected = false;
  private readonly sessionPrefix = 'hyperpage:session:';
  private readonly sessionTTL = 24 * 60 * 60; // 24 hours in seconds
  private readonly cleanupInterval = 60 * 60 * 1000; // 1 hour
  private cleanupTimer?: NodeJS.Timeout;

  constructor(redisUrl?: string) {
    // Create a dedicated Redis instance for sessions
    this.initializeRedis(redisUrl);
  }

  private async initializeRedis(redisUrl?: string) {
    try {
      const cache = await CacheFactory.create({
        backend: CacheBackend.HYBRID,
        redisUrl: redisUrl || process.env.REDIS_URL,
        enableFallback: true,
      });

      // Get the underlying Redis client - this is a bit hacky but necessary
      // for direct Redis operations like SCAN, DEL, etc.
      this.redisClient = (cache as any).redisClient.getClient();
      this.connected = true;

      // Start cleanup interval
      this.startCleanupInterval();

      logger.info('Session Manager Redis connection established');
    } catch (error) {
      logger.error('Failed to initialize Redis for sessions, using memory-only mode:', error);
      // Fallback to in-memory implementation
      this.redisClient = null;
      this.connected = false;
    }
  }

  /**
   * Generate a unique session ID
   */
  generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${timestamp}-${random}`;
  }

  /**
   * Create a new session with default values
   */
  createSession(sessionId?: string): SessionData {
    const id = sessionId || this.generateSessionId();
    const now = new Date();

    return {
      preferences: {
        theme: 'system',
        timezone: 'UTC',
        language: 'en',
        refreshInterval: 300000, // 5 minutes
      },
      uiState: {
        expandedWidgets: [],
        lastVisitedTools: [],
        dashboardLayout: 'default',
        filterSettings: {},
      },
      toolConfigs: {},
      lastActivity: now,
      metadata: {
        ipAddress: '',
        userAgent: '',
        created: now,
        updated: now,
      },
    };
  }

  /**
   * Get session data by ID
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    if (!this.connected || !this.redisClient) {
      logger.warn('Redis not connected, session operations unavailable');
      return null;
    }

    try {
      const key = this.buildSessionKey(sessionId);
      const data = await this.redisClient.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to get session:', error);
      return null;
    }
  }

  /**
   * Save session data
   */
  async setSession(sessionId: string, sessionData: SessionData): Promise<void> {
    if (!this.connected || !this.redisClient) {
      logger.warn('Redis not connected, session operations unavailable');
      return;
    }

    try {
      const key = this.buildSessionKey(sessionId);
      const data = JSON.stringify({
        ...sessionData,
        lastActivity: new Date(),
        metadata: {
          ...sessionData.metadata,
          updated: new Date(),
        },
      });

      // Set with TTL in seconds
      await this.redisClient.set(key, data, 'EX', this.sessionTTL);

      logger.debug(`Session ${sessionId} saved`);
    } catch (error) {
      logger.error('Failed to save session:', error);
      throw error;
    }
  }

  /**
   * Update specific session properties
   */
  async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void> {
    const existingSession = await this.getSession(sessionId) ||
      this.createSession(sessionId);

    const updatedSession = {
      ...existingSession,
      ...updates,
      lastActivity: new Date(),
      metadata: {
        ...existingSession.metadata,
        ...updates.metadata,
        updated: new Date(),
      },
    };

    await this.setSession(sessionId, updatedSession);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.connected || !this.redisClient) {
      logger.warn('Redis not connected, session operations unavailable');
      return;
    }

    try {
      const key = this.buildSessionKey(sessionId);
      await this.redisClient.del(key);

      logger.debug(`Session ${sessionId} deleted`);
    } catch (error) {
      logger.error('Failed to delete session:', error);
      throw error;
    }
  }

  /**
   * Get active sessions count (admin function)
   */
  async getActiveSessionsCount(): Promise<number> {
    if (!this.connected || !this.redisClient) {
      return 0;
    }

    try {
      // SCAN returns array of [cursor, keys[]]
      const [cursor, keys] = await this.redisClient.scan(0, 'MATCH', `${this.buildSessionKey('*')}`, 'COUNT', 1000);
      return keys.length;
    } catch (error) {
      logger.error('Failed to count active sessions:', error);
      return 0;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      // Redis handles TTL automatically, but we can log expired sessions
      const activeCount = await this.getActiveSessionsCount();
      logger.info(`Active sessions after cleanup: ${activeCount}`);
    } catch (error) {
      logger.error('Session cleanup failed:', error);
    }
  }

  /**
   * Extend session TTL
   */
  async extendSession(sessionId: string, additionalSeconds?: number): Promise<void> {
    if (!this.connected || !this.redisClient) {
      logger.warn('Redis not connected, session operations unavailable');
      return;
    }

    try {
      const key = this.buildSessionKey(sessionId);
      const extendBy = additionalSeconds || this.sessionTTL;

      await this.redisClient.expire(key, extendBy);
      logger.debug(`Session ${sessionId} extended by ${extendBy} seconds`);
    } catch (error) {
      logger.error('Failed to extend session:', error);
      throw error;
    }
  }

  /**
   * Check if session exists
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    if (!this.connected || !this.redisClient) {
      return false;
    }

    try {
      const key = this.buildSessionKey(sessionId);
      const result = await this.redisClient.exists(key);
      return result === 1;
    } catch (error) {
      return false;
    }
  }

  /**
   * Build Redis key for session
   */
  private buildSessionKey(sessionId: string): string {
    return `${this.sessionPrefix}${sessionId}`;
  }

  /**
   * Start periodic cleanup
   */
  private startCleanupInterval(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions().catch(error => {
        logger.error('Cleanup interval failed:', error);
      });
    }, this.cleanupInterval);
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
}

// Default singleton instance
export const sessionManager = new SessionManager();
