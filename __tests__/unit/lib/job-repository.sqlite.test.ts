import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import type { IJob } from "@/lib/types/jobs";
import { JobPriority, JobStatus } from "@/lib/types/jobs";
import { getAppDatabase, getReadWriteDb } from "@/lib/database/connection";
import * as sqliteSchema from "@/lib/database/schema";

/**
 * Unit tests for SqliteJobRepository behavior via getJobRepository.
 *
 * These tests:
 * - Force SQLite engine selection by returning a non-Postgres-like drizzle instance
 * - Mock getAppDatabase() to expose a minimal sqlite drizzle API
 * - Assert that repository methods issue correct queries/shapes
 *
 * We deliberately avoid real drizzle/sqlite and keep mocks structurally aligned
 * with lib/database/job-repository.ts implementation.
 */

type SqliteInsertValues = typeof sqliteSchema.jobs.$inferInsert;
type SqliteUpdateValues = Partial<typeof sqliteSchema.jobs.$inferInsert>;

type MockSqliteDrizzle = {
  select: () => {
    from: (table: unknown) => {
      where: (cond: unknown) => {
        limit: (n: number) => Promise<unknown[]> | unknown[];
      };
    };
  };
  insert: (table: unknown) => {
    values: (values: SqliteInsertValues) => Promise<void> | void;
  };
  update: (table: unknown) => {
    set: (patch: SqliteUpdateValues) => {
      where: (cond: unknown) => Promise<void> | void;
    };
  };
  delete: (table: unknown) => {
    where: (
      cond: unknown,
    ) => Promise<{ rowsAffected?: number }> | { rowsAffected?: number };
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

// Use actual sqlite schema; we only need shapes.
vi.mock("@/lib/database/schema", async () => {
  const actual = await import("@/lib/database/schema");
  return {
    ...actual,
  };
});

describe("SqliteJobRepository via getJobRepository", () => {
  const baseJob: IJob = {
    id: "sqlite-job-1",
    type: "tool-execution" as IJob["type"],
    name: "SQLite Test Job",
    priority: JobPriority.MEDIUM,
    status: JobStatus.PENDING,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: {
      data: { foo: "bar" },
      timeoutMs: 1000,
      maxRetries: 3,
      dependencies: [],
      tags: [],
    },
    retryCount: 0,
    executionHistory: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("insert() enforces unique id and persists expected fields", async () => {
    const selectSpy = vi.fn().mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]), // no existing job -> ok
        }),
      }),
    });

    const insertSpy = vi.fn((values: SqliteInsertValues) => {
      expect(values.id).toBe(baseJob.id);
      expect(values.type).toBe(baseJob.type);
      expect(values.name).toBe(baseJob.name);
      expect(values.priority).toBe(baseJob.priority);
      expect(values.status).toBe(baseJob.status);
      expect(typeof values.payload).toBe("string");
      expect(values.createdAt).toBe(baseJob.createdAt);
      expect(values.updatedAt).toBe(baseJob.updatedAt);
      expect(values.retryCount).toBe(baseJob.retryCount);
      expect(typeof values.persistedAt).toBe("number");
    });

    const mockDrizzle: MockSqliteDrizzle = {
      select: selectSpy,
      insert: () => ({
        values: insertSpy,
      }),
      update: () => ({
        set: () => ({
          where: vi.fn(),
        }),
      }),
      delete: () => ({
        where: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      }),
    };

    // Force SQLite path: getReadWriteDb returns object without $schema.jobs === pgSchema.jobs
    (getReadWriteDb as unknown as Mock).mockReturnValue({
      // no $schema pointing to pgSchema.jobs
    });

    (getAppDatabase as unknown as Mock).mockReturnValue({
      drizzle: mockDrizzle,
    });

    const { getJobRepository: freshGetJobRepository } = await import(
      "@/lib/database/job-repository"
    );
    const repo = freshGetJobRepository();

    await repo.insert(baseJob);

    expect(getReadWriteDb).toHaveBeenCalled();
    expect(selectSpy).toHaveBeenCalled();
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });

  it("exists() returns true when row present and false otherwise", async () => {
    const existingRow = { id: baseJob.id };

    const selectSpy = vi
      .fn()
      // First call: present
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([existingRow]),
          }),
        }),
      })
      // Second call: empty
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      });

    const mockDrizzle: MockSqliteDrizzle = {
      select: selectSpy,
      insert: () => ({
        values: vi.fn(),
      }),
      update: () => ({
        set: () => ({
          where: vi.fn(),
        }),
      }),
      delete: () => ({
        where: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      }),
    };

    (getReadWriteDb as unknown as Mock).mockReturnValue({});
    (getAppDatabase as unknown as Mock).mockReturnValue({
      drizzle: mockDrizzle,
    });

    const { getJobRepository: freshGetJobRepository } = await import(
      "@/lib/database/job-repository"
    );
    const repo = freshGetJobRepository();

    const existsTrue = await repo.exists(baseJob.id);
    const existsFalse = await repo.exists("missing-id");

    expect(existsTrue).toBe(true);
    expect(existsFalse).toBe(false);
    expect(selectSpy).toHaveBeenCalledTimes(2);
  });
});
