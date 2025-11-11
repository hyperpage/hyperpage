import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import type { IJob } from "@/lib/types/jobs";
import { JobPriority, JobStatus } from "@/lib/types/jobs";
import { getAppDatabase, getReadWriteDb } from "@/lib/database/connection";

/**
 * NOTE:
 * These tests are intentionally minimal and focus on:
 * - Engine selection logic in getJobRepository()
 * - Basic contract behavior via observable interactions with mocked deps
 *
 * They do NOT attempt full integration with real drizzle types.
 * Mocks are kept structurally compatible and type-safe enough for TS/Vitest.
 */

type MockSqliteDrizzle = {
  insert: (table: unknown) => {
    values: (values: unknown) => Promise<void> | void;
  };
  select: () => {
    from: (table: unknown) => {
      where: (cond: unknown) => {
        limit: (n: number) => Promise<unknown[]> | unknown[];
      };
    };
  };
  update: (table: unknown) => {
    set: (patch: unknown) => { where: (cond: unknown) => Promise<void> | void };
  };
  delete: (table: unknown) => {
    where: (
      cond: unknown,
    ) => Promise<{ rowsAffected?: number }> | { rowsAffected?: number };
  };
};

type MockPgDrizzle = {
  $schema?: Record<string, unknown>;
  insert: (table: unknown) => {
    values: (values: unknown) => {
      returning: (cols: unknown) => Promise<Array<{ id: bigint }>>;
    };
  };
  select: (cols?: unknown) => {
    from: (table: unknown) => {
      where: (cond: unknown) => { limit: (n: number) => Promise<unknown[]> };
      leftJoin: (
        other: unknown,
        on: unknown,
      ) => {
        where: (cond: unknown) => Promise<unknown[]>;
      };
    };
  };
  update: (table: unknown) => {
    set: (patch: unknown) => { where: (cond: unknown) => Promise<void> };
  };
  delete: (table: unknown) => {
    where: (cond: unknown) => Promise<{ rowsAffected?: number }>;
  };
};

vi.mock("@/lib/logger", () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/database/connection", () => ({
  getAppDatabase: vi.fn(),
  getReadWriteDb: vi.fn(),
}));

// We only need pg-schema/sqlite-schema shapes to exist; real logic is in job-repository.
vi.mock("@/lib/database/schema", () => ({
  jobs: {},
}));

vi.mock("@/lib/database/pg-schema", () => ({
  jobs: {},
  jobHistory: {},
}));

describe("getJobRepository - engine selection", () => {
  const baseJob: IJob = {
    id: "job-1",
    // Use a string literal and cast to satisfy IJob["type"] without coupling to concrete enum values
    type: "tool-execution" as IJob["type"],
    name: "Test Job",
    priority: JobPriority.MEDIUM,
    status: JobStatus.PENDING,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: {},
    retryCount: 0,
    executionHistory: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("uses SQLite-backed repository when getReadWriteDb is not Postgres", async () => {
    const sqliteLikeDb = {
      // no $schema.jobs -> isPostgresDb should be false
    } as unknown as MockPgDrizzle;

    (getReadWriteDb as unknown as Mock).mockReturnValue(sqliteLikeDb);

    const insertSpy = vi.fn().mockResolvedValue(undefined);
    const selectSpy = vi.fn().mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    });

    (getAppDatabase as unknown as Mock).mockReturnValue({
      drizzle: {
        insert: () => ({ values: insertSpy }),
        select: selectSpy,
        update: () => ({
          set: () => ({
            where: () => Promise.resolve(),
          }),
        }),
        delete: () => ({
          where: () => Promise.resolve({ rowsAffected: 0 }),
        }),
      } as unknown as MockSqliteDrizzle,
    });

    const { getJobRepository: freshGetJobRepository } = await import(
      "@/lib/database/job-repository"
    );
    const repo = freshGetJobRepository();

    await repo.insert(baseJob);

    expect(getReadWriteDb).toHaveBeenCalled();
    expect(getAppDatabase).toHaveBeenCalled();
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: baseJob.id,
      }),
    );
  });

  it("uses Postgres-backed repository when getReadWriteDb exposes pg-schema.jobs", async () => {
    const pgModule = await import("@/lib/database/pg-schema");

    const pgLikeDb: MockPgDrizzle = {
      $schema: {
        jobs: pgModule.jobs,
      },
      insert: () => ({
        values: () => ({
          returning: async () => [{ id: BigInt(123) }],
        }),
      }),
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
          leftJoin: () => ({
            where: async () => [],
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: async () => {},
        }),
      }),
      delete: () => ({
        where: async () => ({ rowsAffected: 0 }),
      }),
    };

    (getReadWriteDb as unknown as Mock).mockReturnValue(pgLikeDb);

    const { getJobRepository: freshGetJobRepository } = await import(
      "@/lib/database/job-repository"
    );
    const repo = freshGetJobRepository();

    // Should delegate to Postgres implementation and call into pgLikeDb.insert(...)
    await repo.insert(baseJob);

    // We can't access the class directly, but we can assert that insert on pgLikeDb was used
    // by checking that no getAppDatabase() call was needed.
    expect(getReadWriteDb).toHaveBeenCalled();
    expect(getAppDatabase).not.toHaveBeenCalled();
  });
});
