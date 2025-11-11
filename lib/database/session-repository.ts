import { eq, lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import logger from "../logger";
import * as pgSchema from "./pg-schema";
import { getReadWriteDb } from "./connection";

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
 * SQLite-backed SessionRepository placeholder.
 *
 * The legacy SQLite sessions schema is not defined here. To avoid guessing
 * column names and introducing incorrect behavior, this implementation is an
 * explicit no-op with clear logging.
 */
export class SqliteSessionRepository implements SessionRepository {
  async createSession(session: Session): Promise<void> {
    logger.warn(
      `SqliteSessionRepository.createSession not implemented for sessionToken=${session.sessionToken}; no-op`,
    );
  }

  async getSession(sessionToken: string): Promise<Session | null> {
    logger.warn(
      `SqliteSessionRepository.getSession not implemented for sessionToken=${sessionToken}; returning null`,
    );
    return null;
  }

  async deleteSession(sessionToken: string): Promise<void> {
    logger.warn(
      `SqliteSessionRepository.deleteSession not implemented for sessionToken=${sessionToken}; no-op`,
    );
  }

  async cleanupExpiredSessions(now: Date = new Date()): Promise<number> {
    logger.warn(
      `SqliteSessionRepository.cleanupExpiredSessions not implemented (now=${now.toISOString()}); no-op`,
    );
    return 0;
  }
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

/**
 * Engine detection helper for Postgres SessionRepository.
 * Mirrors the JobRepository isPostgresDb approach using $schema metadata.
 */
function isPostgresDb(db: unknown): db is NodePgDatabase<typeof pgSchema> {
  try {
    if (!db || typeof db !== "object") return false;
    // @ts-expect-error drizzle internal shape
    const schema = db.$schema as Record<string, unknown> | undefined;
    return Boolean(schema && schema.userSessions === pgSchema.userSessions);
  } catch {
    return false;
  }
}

let sessionRepositorySingleton: SessionRepository | null = null;

/**
 * Returns a singleton SessionRepository appropriate for the configured engine.
 *
 * - Postgres: PostgresSessionRepository (real implementation)
 * - Otherwise: SqliteSessionRepository (explicit, logged no-op placeholder)
 *
 * This avoids incorrect assumptions about legacy SQLite session schema while
 * providing a fully functional implementation for the new Postgres schema.
 */
export function getSessionRepository(): SessionRepository {
  if (sessionRepositorySingleton) {
    return sessionRepositorySingleton;
  }

  const db = getReadWriteDb();

  if (isPostgresDb(db)) {
    logger.info("Using PostgresSessionRepository");
    sessionRepositorySingleton = new PostgresSessionRepository(db);
  } else {
    logger.warn(
      "Using SqliteSessionRepository placeholder: SQLite session schema not defined; no-op implementation",
    );
    sessionRepositorySingleton = new SqliteSessionRepository();
  }

  return sessionRepositorySingleton;
}
