import type Redis from "ioredis";

import { MemorySessionStore } from "@/lib/sessions/memory-session-store";
import logger from "@/lib/logger";

// Import Redis type from ioredis

export interface SessionData {
  userId?: string;
  user?: {
    id: string;
    provider: string;
    email?: string;
    username?: string;
    displayName?: string;
    avatarUrl?: string;
  };
  preferences: {
    theme: "light" | "dark" | "system";
    timezone: string;
    language: string;
    refreshInterval: number;
  };
  uiState: {
    expandedWidgets: string[];
    lastVisitedTools: string[];
    dashboardLayout: string;
    filterSettings: Record<string, unknown>;
  };
  toolConfigs: {
    [toolId: string]: {
      enabled: boolean;
      settings: Record<string, unknown>;
      lastUsed: Date;
    };
  };
  authenticatedTools: {
    [toolName: string]: {
      connected: boolean;
      connectedAt: Date;
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
  private redisClient: Redis | null = null;
  private connected = false;
  private initializing = true;
  private memoryStore: MemorySessionStore;
  private readonly sessionPrefix = "hyperpage:session:";
  private readonly sessionTTL = 24 * 60 * 60; // 24 hours in seconds
  private readonly cleanupInterval = 60 * 60 * 1000; // 1 hour
  private cleanupTimer?: NodeJS.Timeout;
  private initPromise: Promise<void> | null = null;

  constructor(redisUrl?: string) {
    // Create fallback memory store for development
    this.memoryStore = new MemorySessionStore();

    // Create a dedicated Redis instance for sessions
    this.initPromise = this.initializeRedis(redisUrl);
  }

  private async initializeRedis(redisUrl?: string) {
    try {
      // Create a dedicated Redis client for sessions
      // We can't get the client from the cache, so create our own
      const sessionRedisUrl = redisUrl || process.env.REDIS_URL;
      if (!sessionRedisUrl) {
        throw new Error("No Redis URL available for sessions");
      }

      // Import RedisClient directly and create a dedicated instance
      const { RedisClient } = await import("@/lib/cache/redis-client");
      const sessionRedisClient = new RedisClient(sessionRedisUrl);

      // Connect to Redis
      await sessionRedisClient.connect();

      // Store the client for session operations
      this.redisClient = sessionRedisClient.getClient();
      this.connected = true;

      // Start cleanup interval
      this.startCleanupInterval();

      logger.info("Session Manager Redis connection established");
    } catch (error) {
      logger.error(
        "Failed to initialize Redis for sessions, using memory-only mode:",
        error,
      );
      // Fallback to in-memory implementation
      this.redisClient = null;
      this.connected = false;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Wait for initialization to complete
   */
  private async waitForInitialization(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
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
  createSession(): SessionData {
    const now = new Date();

    return {
      preferences: {
        theme: "system",
        timezone: "UTC",
        language: "en",
        refreshInterval: 300000, // 5 minutes
      },
      uiState: {
        expandedWidgets: [],
        lastVisitedTools: [],
        dashboardLayout: "default",
        filterSettings: {},
      },
      toolConfigs: {},
      authenticatedTools: {},
      lastActivity: now,
      metadata: {
        ipAddress: "",
        userAgent: "",
        created: now,
        updated: now,
      },
    };
  }

  /**
   * Get session data by ID
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    // Wait for initialization to complete
    await this.waitForInitialization();

    if (this.connected && this.redisClient) {
      try {
        const key = this.buildSessionKey(sessionId);
        const data = await this.redisClient.get(key);

        if (!data) {
          return null;
        }

        return JSON.parse(data) as SessionData;
      } catch (error) {
        logger.error("Failed to get session from Redis:", error);
        return null;
      }
    } else {
      // Fallback to memory store with debug info
      logger.debug(
        `Session Manager not connected to Redis, using memory store. Connected: ${this.connected}, RedisClient: ${!!this.redisClient}`,
      );
      return this.memoryStore.get(sessionId);
    }
  }

  /**
   * Save session data
   */
  async setSession(sessionId: string, sessionData: SessionData): Promise<void> {
    // Wait for initialization to complete
    await this.waitForInitialization();

    if (this.connected && this.redisClient) {
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
        await this.redisClient.set(key, data, "EX", this.sessionTTL);

        logger.debug(`Session ${sessionId} saved to Redis`);
      } catch (error) {
        logger.error("Failed to save session to Redis:", error);
        throw error;
      }
    } else {
      // Fallback to memory store
      this.memoryStore.set(sessionId, sessionData);
      logger.debug(`Session ${sessionId} saved to memory store`);
    }
  }

  /**
   * Update specific session properties
   */
  async updateSession(
    sessionId: string,
    updates: Partial<SessionData>,
  ): Promise<void> {
    const existingSession =
      (await this.getSession(sessionId)) || this.createSession();

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
    if (this.connected && this.redisClient) {
      try {
        const key = this.buildSessionKey(sessionId);
        await this.redisClient.del(key);

        logger.debug(`Session ${sessionId} deleted from Redis`);
      } catch (error) {
        logger.error("Failed to delete session from Redis:", error);
        throw error;
      }
    } else {
      // Fallback to memory store
      this.memoryStore.delete(sessionId);
      logger.debug(`Session ${sessionId} deleted from memory store`);
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
      const [, keys] = await this.redisClient.scan(
        0,
        "MATCH",
        `${this.buildSessionKey("*")}`,
        "COUNT",
        "1000",
      );
      return keys.length;
    } catch (error) {
      logger.error("Failed to count active sessions:", error);
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
    } catch {
      logger.error("Session cleanup failed");
    }
  }

  /**
   * Extend session TTL
   */
  async extendSession(
    sessionId: string,
    additionalSeconds?: number,
  ): Promise<void> {
    if (!this.connected || !this.redisClient) {
      logger.warn("Redis not connected, session operations unavailable");
      return;
    }

    try {
      const key = this.buildSessionKey(sessionId);
      const extendBy = additionalSeconds || this.sessionTTL;

      await this.redisClient.expire(key, extendBy);
      logger.debug(`Session ${sessionId} extended by ${extendBy} seconds`);
    } catch (err) {
      logger.error("Failed to extend session:", err);
      throw err;
    }
  }

  /**
   * Check if session exists
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    if (this.connected && this.redisClient) {
      try {
        const key = this.buildSessionKey(sessionId);
        const result = await this.redisClient.exists(key);
        return result === 1;
      } catch {
        return false;
      }
    } else {
      // Fallback to memory store
      return this.memoryStore.has(sessionId);
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
      void this.cleanupExpiredSessions().catch(() => {
        logger.error("Cleanup interval failed");
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
