import { SessionData } from "./session-manager";
import logger from "../logger";

export class MemorySessionStore {
  private sessions = new Map<string, SessionData>();
  private readonly maxSessions = 1000;

  /**
   * Store a session by ID
   */
  set(sessionId: string, sessionData: SessionData): void {
    if (this.sessions.size >= this.maxSessions) {
      // Remove oldest sessions if we're at capacity
      const oldestId = Array.from(this.sessions.keys())[0];
      this.sessions.delete(oldestId);
      logger.warn(`Session store full, removed oldest session: ${oldestId}`);
    }

    sessionData.lastActivity = new Date();
    sessionData.metadata = {
      ...sessionData.metadata,
      updated: new Date(),
    };

    this.sessions.set(sessionId, sessionData);
    logger.debug(`Session stored in memory: ${sessionId}`);
  }

  /**
   * Retrieve a session by ID
   */
  get(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Update last activity
      session.lastActivity = new Date();
      session.metadata.updated = new Date();
    }
    return session || null;
  }

  /**
   * Delete a session by ID
   */
  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Check if session exists
   */
  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Get number of active sessions
   */
  size(): number {
    return this.sessions.size;
  }

  /**
   * Clear all sessions (for testing)
   */
  clear(): void {
    this.sessions.clear();
  }
}
