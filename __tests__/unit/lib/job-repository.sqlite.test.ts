/**
 * LEGACY TEST SUITE - SQLite Job Repository behavior
 *
 * Phase 1 PostgreSQL-only runtime:
 * - This suite exercises historical SQLite-specific behavior via getJobRepository.
 * - It relies on SQLite-era helpers that are no longer part of the active runtime.
 *
 * IMPORTANT:
 * - This file is retained ONLY for migration/forensics reference.
 * - It is excluded from Phase 1 by using describe.skip and by NOT importing
 *   non-existent exports from the current connection module.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

const shouldRunLegacySqlite = process.env.LEGACY_SQLITE_TESTS === "1";
const describeLegacy = shouldRunLegacySqlite ? describe : describe.skip;

import type { IJob } from "@/lib/types/jobs";
import { JobPriority, JobStatus } from "@/lib/types/jobs";
// Note: We do NOT import getAppDatabase from the current connection facade.
// Any attempt to run this suite against the Phase 1 codebase is unsupported.
import * as sqliteSchema from "@/lib/database/schema";

/**
 * Unit tests for SqliteJobRepository behavior via getJobRepository.
 *
 * These tests:
 * - Force SQLite engine selection by returning a non-Postgres-like drizzle instance
 * - Mock a legacy getAppDatabase() to expose a minimal sqlite drizzle API
 * - Assert that repository methods issue correct queries/shapes
 *
 * We deliberately avoid real drizzle/sqlite and keep mocks structurally aligned
 * with the historical lib/database/job-repository.ts implementation.
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

// Legacy-style connection mocks: provide getAppDatabase/getReadWriteDb only within this suite.
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

describeLegacy(
  "SqliteJobRepository via getJobRepository (LEGACY - skipped in Phase 1)",
  () => {
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

      const { getAppDatabase, getReadWriteDb } = (await import(
        "@/lib/database/connection"
      )) as unknown as {
        getAppDatabase: Mock;
        getReadWriteDb: Mock;
      };

      // Force SQLite path: getReadWriteDb returns object without pg-schema markers
      getReadWriteDb.mockReturnValue({});

      getAppDatabase.mockReturnValue({
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

      const { getAppDatabase, getReadWriteDb } = (await import(
        "@/lib/database/connection"
      )) as unknown as {
        getAppDatabase: Mock;
        getReadWriteDb: Mock;
      };

      getReadWriteDb.mockReturnValue({});
      getAppDatabase.mockReturnValue({
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
  },
);
