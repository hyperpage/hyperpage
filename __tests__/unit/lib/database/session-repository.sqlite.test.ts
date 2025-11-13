import { describe, expect, it } from "vitest";

const shouldRunLegacySqlite = process.env.LEGACY_SQLITE_TESTS === "1";
const describeLegacy = shouldRunLegacySqlite ? describe : describe.skip;

import {
  SqliteSessionRepository,
  type Session,
} from "../../../../lib/database/session-repository";

/**
 * SqliteSessionRepository is an explicit no-op placeholder.
 *
 * These tests:
 * - Ensure methods do not throw
 * - Ensure documented return values are preserved
 * - Do not rely on any SQLite schema details
 */

describeLegacy("SqliteSessionRepository (LEGACY SQLITE)", () => {
  const repo = new SqliteSessionRepository();

  it("createSession is a logged no-op and does not throw", async () => {
    const session: Session = {
      sessionToken: "token-sqlite-1",
      userId: "user-1",
      expiresAt: new Date("2024-01-02T00:00:00.000Z"),
    };

    await expect(repo.createSession(session)).resolves.toBeUndefined();
  });

  it("getSession is a logged no-op and always returns null", async () => {
    const result = await repo.getSession("any-token");
    expect(result).toBeNull();
  });

  it("deleteSession is a logged no-op and does not throw", async () => {
    await expect(repo.deleteSession("any-token")).resolves.toBeUndefined();
  });

  it("cleanupExpiredSessions is a logged no-op and returns 0", async () => {
    const now = new Date("2024-01-10T00:00:00.000Z");
    const deleted = await repo.cleanupExpiredSessions(now);
    expect(deleted).toBe(0);
  });
});
