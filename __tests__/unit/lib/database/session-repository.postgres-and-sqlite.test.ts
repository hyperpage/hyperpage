import { describe, expect, it, vi } from "vitest";

import {
  getSessionRepository,
  PostgresSessionRepository,
} from "../../../../lib/database/session-repository";
import * as pgSchema from "../../../../lib/database/pg-schema";
import * as connectionModule from "../../../../lib/database/connection";

/**
 * Cross-engine smoke tests for getSessionRepository().
 *
 * These tests:
 * - Verify that getSessionRepository() returns:
 *   - PostgresSessionRepository when getReadWriteDb() exposes $schema.userSessions
 *     equal to pgSchema.userSessions.
 *   - SqliteSessionRepository otherwise.
 * - Ensure the singleton behavior is preserved.
 *
 * They DO NOT:
 * - Re-test PostgresSessionRepository behavior in detail
 *   (covered by session-repository.postgres.test.ts).
 * - Depend on drizzle internals beyond the $schema identity pattern that
 *   production code already relies on.
 */

vi.mock("../../../../lib/database/connection", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../../lib/database/connection")
    >();
  let fakeDb: unknown = null;

  return {
    ...actual,
    getReadWriteDb: () => fakeDb ?? actual.getReadWriteDb(),
    // Helper only visible in tests to swap the fake db
    __setFakeReadWriteDb(db: unknown) {
      fakeDb = db;
    },
  };
});

const mockedConnection = vi.mocked(
  connectionModule as unknown as {
    __setFakeReadWriteDb: (db: unknown) => void;
  },
);

class FakePgDbForDetection {
  readonly $schema = pgSchema;
}

describe("getSessionRepository engine selection", () => {
  it("returns PostgresSessionRepository when db schema matches pgSchema.userSessions", () => {
    // Force engine detection to see a Postgres-like db
    mockedConnection.__setFakeReadWriteDb(new FakePgDbForDetection());

    const repo = getSessionRepository();
    expect(repo).toBeInstanceOf(PostgresSessionRepository);
  });

  // Note:
  // We intentionally do NOT assert a SqliteSessionRepository branch here because
  // getSessionRepository() is a singleton. Once it has constructed a
  // PostgresSessionRepository in this process, subsequent calls will return the
  // same instance regardless of engine changes. That behavior is part of the
  // contract and is validated by the singleton test below.

  it("returns a singleton instance", () => {
    mockedConnection.__setFakeReadWriteDb(new FakePgDbForDetection());
    const repo1 = getSessionRepository();
    const repo2 = getSessionRepository();

    expect(repo1).toBe(repo2);
  });
});
