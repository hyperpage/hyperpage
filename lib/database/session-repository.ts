import { eq, lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import logger from "@/lib/logger";
import * as pgSchema from "@/lib/database/pg-schema";
import { getReadWriteDb } from "@/lib/database/connection";

/**
 * Normalized session shape used by callers.
 *
 * This is intentionally minimal and engine-agnostic.
 */
export interface Session {
  sessionToken: string;
  userId: string;
  expiresAt: Date;
  createdAt?: Date;
}

/**
 * Repository contract for session persistence.
 *
 * Implementations are engine-specific; callers should only depend on
 * this interface and getSessionRepository().
 */
export interface SessionRepository {
  createSession(session: Session): Promise<void>;
  getSession(sessionToken: string): Promise<Session | null>;
  deleteSession(sessionToken: string): Promise<void>;
  cleanupExpiredSessions(now?: Date): Promise<number>;
}

/**
 * Postgres-backed SessionRepository implementation.
 *
 * Uses pgSchema.userSessions as the canonical source.
 */
export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly db: NodePgDatabase<typeof pgSchema>) {}

  async createSession(session: Session): Promise<void> {
    await this.db.insert(pgSchema.userSessions).values({
      sessionToken: session.sessionToken,
      userId: session.userId,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt ?? new Date(),
    });
  }

  async getSession(sessionToken: string): Promise<Session | null> {
    const rows = await this.db
      .select()
      .from(pgSchema.userSessions)
      .where(eq(pgSchema.userSessions.sessionToken, sessionToken))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      sessionToken: row.sessionToken,
      userId: row.userId,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt ?? undefined,
    };
  }

  async deleteSession(sessionToken: string): Promise<void> {
    await this.db
      .delete(pgSchema.userSessions)
      .where(eq(pgSchema.userSessions.sessionToken, sessionToken));
  }

  async cleanupExpiredSessions(now: Date = new Date()): Promise<number> {
    try {
      const deleted = await this.db
        .delete(pgSchema.userSessions)
        .where(lt(pgSchema.userSessions.expiresAt, now));

      const maybe = deleted as { rowsAffected?: number } | undefined;
      return typeof maybe?.rowsAffected === "number" ? maybe.rowsAffected : 0;
    } catch (error) {
      logger.error(
        "PostgresSessionRepository.cleanupExpiredSessions: failed to delete expired sessions",
        {
          now: now.toISOString(),
          error: error instanceof Error ? error.message : String(error),
        },
      );
      return 0;
    }
  }
}

let sessionRepositorySingleton: SessionRepository | null = null;

/**
 * Returns a singleton SessionRepository backed by PostgreSQL.
 */
export function getSessionRepository(): SessionRepository {
  if (sessionRepositorySingleton) {
    return sessionRepositorySingleton;
  }

  const db = getReadWriteDb();
  logger.info("Using PostgresSessionRepository");
  sessionRepositorySingleton = new PostgresSessionRepository(db);

  return sessionRepositorySingleton;
}
