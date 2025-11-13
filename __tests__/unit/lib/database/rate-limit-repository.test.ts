import { describe, expect, it, vi, beforeEach } from "vitest";

import * as pgSchema from "@/lib/database/pg-schema";

/**
 * Hermetic tests for RateLimitRepository Postgres-backed behavior.
 *
 * This harness:
 * - Provides a minimal fake Postgres drizzle-like client.
 * - Asserts mapping and selection logic without relying on drizzle internals.
 * - Uses the repository directly (no global singletons).
 *
 * NOTE:
 * - cleanupOlderThan is intentionally a logged no-op for Postgres.
 *   This test asserts that no deletion is attempted.
 */

function createFakePostgresDb() {
  type Row = typeof pgSchema.rateLimits.$inferInsert & {
    key: string;
  };

  const rows = new Map<string, Row>();

  const db = {
    $schema: {
      rateLimits: pgSchema.rateLimits,
    },
    select() {
      return {
        from(table: unknown) {
          if (table === pgSchema.rateLimits) {
            return Array.from(rows.values()).map((row) => ({
              key: row.key,
              remaining: row.remaining ?? null,
              resetAt: row.resetAt ?? null,
              metadata: row.metadata ?? null,
            }));
          }
          // For any other table, return empty; the repository never uses it here.
          return [];
        },
      };
    },
    insert(table: unknown) {
      return {
        values(value: Row) {
          if (table === pgSchema.rateLimits) {
            const key = value.key;
            rows.set(key, value);
            return {
              onConflictDoUpdate(opts: {
                target: unknown;
                set: Partial<Row>;
              }) {
                void opts.target;
                const existing = rows.get(key) ?? value;
                rows.set(key, { ...existing, ...opts.set });
              },
            };
          }
          return {
            onConflictDoUpdate() {
              // no-op for unsupported tables
            },
          };
        },
      };
    },
    delete(table: unknown) {
      return {
        where() {
          // For the cleanupOlderThan Postgres code path, we expect no delete()
          // to be invoked; tests can still spy on this method.
          if (table === pgSchema.rateLimits) {
            throw new Error(
              "delete.where should not be called for Postgres cleanupOlderThan",
            );
          }
        },
      };
    },
    _rows: rows,
  };

  return db;
}

describe("RateLimitRepository - Postgres behavior (contract only)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  /**
   * NOTE:
   * As with the SQLite tests, we avoid brittle coupling to the singleton
   * + isPostgresDb detection. These tests assert only:
   * - loadAll() does not throw when wired to a Postgres-shaped db
   * - upsert() does not throw when wired to a Postgres-shaped db
   * - cleanupOlderThan() does not call delete() for Postgres (documented no-op)
   */

  it("loadAll executes without error against a Postgres-shaped db", async () => {
    const fakePg = createFakePostgresDb();

    fakePg._rows.set("github:global", {
      key: "github:global",
      remaining: 42,
      resetAt: new Date(1700000000000),
      metadata: {
        platform: "github",
        limitTotal: 5000,
        lastUpdated: 1700000000000,
      },
    });

    vi.doMock("@/lib/database/connection", () => ({
      getReadWriteDb: () => fakePg,
    }));

    const { rateLimitRepository } = await import(
      "@/lib/database/rate-limit-repository"
    );

    await expect(rateLimitRepository.loadAll()).resolves.toBeDefined();
  });

  it("upsert executes without error against a Postgres-shaped db", async () => {
    const fakePg = createFakePostgresDb();

    vi.doMock("@/lib/database/connection", () => ({
      getReadWriteDb: () => fakePg,
    }));

    const { rateLimitRepository } = await import(
      "@/lib/database/rate-limit-repository"
    );

    await expect(
      rateLimitRepository.upsert({
        id: "github:global",
        platform: "github",
        limitRemaining: 10,
        limitTotal: 5000,
        resetTime: 1700000000000,
        lastUpdated: 1700000000000,
      }),
    ).resolves.toBeUndefined();
  });

  it("cleanupOlderThan does not attempt deletes on Postgres (documented no-op)", async () => {
    const fakePg = createFakePostgresDb();
    const deleteSpy = vi.spyOn(fakePg, "delete");

    vi.doMock("@/lib/database/connection", () => ({
      getReadWriteDb: () => fakePg,
    }));

    const { rateLimitRepository } = await import(
      "@/lib/database/rate-limit-repository"
    );

    await rateLimitRepository.cleanupOlderThan();

    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
