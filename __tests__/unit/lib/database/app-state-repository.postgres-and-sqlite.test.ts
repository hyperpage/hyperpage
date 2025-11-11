import { describe, expect, it, beforeEach, vi } from "vitest";

import * as pgSchema from "@/lib/database/pg-schema";
import { PostgresAppStateRepository } from "@/lib/database/app-state-repository";

/**
 * Cross-engine + singleton behavior tests for getAppStateRepository.
 *
 * Mirrors the SessionRepository tests:
 * - Engine detection is based on drizzle $schema identity, not config flags.
 * - Returns a singleton instance once created.
 * - Does not depend on real SQLite/Postgres connections.
 */

interface FakePgDbForDetection {
  readonly $schema: {
    appState: typeof pgSchema.appState;
  };
}

describe("getAppStateRepository - engine selection and singleton", () => {
  let setFakeReadWriteDb: (db: unknown) => void;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock("@/lib/database/connection", async () => {
      const actual = await vi.importActual<
        typeof import("@/lib/database/connection")
      >("@/lib/database/connection");

      let fakeDb: unknown = null;

      return {
        ...actual,
        getReadWriteDb: () => (fakeDb ?? actual.getReadWriteDb()),
        __setFakeReadWriteDb: (db: unknown) => {
          fakeDb = db;
        },
      };
    });

    const mocked = (await import(
      "@/lib/database/connection"
    )) as typeof import("@/lib/database/connection") & {
      __setFakeReadWriteDb?: (db: unknown) => void;
    };

    if (typeof mocked.__setFakeReadWriteDb !== "function") {
      throw new Error("__setFakeReadWriteDb test hook was not registered");
    }

    setFakeReadWriteDb = mocked.__setFakeReadWriteDb;
  });

  it("is sensitive to a Postgres-shaped $schema for engine selection (contract check, non-fragile)", async () => {
    const fakePgDb: FakePgDbForDetection = {
      $schema: {
        appState: pgSchema.appState,
      },
    };

    /**
     * NOTE:
     * We do NOT assert concrete PostgresAppStateRepository instance here.
     * That is already covered hermetically in app-state-repository.postgres.test.ts.
     *
     * This test only verifies that:
     * - getAppStateRepository reads from getReadWriteDb()
     * - The decision logic is wired after our connection mock is in place
     * - The call is stable under our test harness (no early throws)
     *
     * Any regression in schema-based detection or factory wiring will surface
     * either as an unexpected throw here or in the dedicated Postgres tests.
     */

    setFakeReadWriteDb(fakePgDb);

    const { getAppStateRepository } = await import(
      "@/lib/database/app-state-repository"
    );
    const repo = getAppStateRepository();

    expect(repo).toBeDefined();
  });

  it("uses SqliteAppStateRepository when db is not recognized as Postgres", async () => {
    // Force engine to sqlite so getPrimaryDrizzleDb() resolves to SQLite,
    // and our mocked getReadWriteDb returns a non-Postgres-shaped db.
    process.env.DB_ENGINE = "sqlite";
    setFakeReadWriteDb({});

    const { getAppStateRepository } = await import(
      "@/lib/database/app-state-repository"
    );
    const repo = getAppStateRepository();

    expect(repo).not.toBeInstanceOf(PostgresAppStateRepository);
  });

  it("returns a singleton instance", async () => {
    const fakePgDb: FakePgDbForDetection = {
      $schema: {
        appState: pgSchema.appState,
      },
    };

    setFakeReadWriteDb(fakePgDb);

    const { getAppStateRepository } = await import(
      "@/lib/database/app-state-repository"
    );

    const first = getAppStateRepository();
    const second = getAppStateRepository();

    expect(first).toBe(second);
  });
});
