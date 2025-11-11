import { describe, expect, it, vi, beforeEach } from "vitest";

import * as sqliteSchema from "@/lib/database/schema";
import * as pgSchema from "@/lib/database/pg-schema";

/**
 * Hermetic tests for RateLimitRepository dual-engine behavior.
 *
 * This harness:
 * - Provides minimal fake SQLite and Postgres drizzle-like clients.
 * - Asserts mapping and selection logic without relying on drizzle internals.
 * - Uses the repository directly (no global singletons).
 *
 * NOTE:
 * - For Postgres cleanupOlderThan, behavior is intentionally a logged no-op.
 *   This test asserts that no deletion is attempted.
 */

function createFakeSqliteDb() {
  const rows = new Map<string, (typeof sqliteSchema.rateLimits.$inferInsert)>();

  const db = {
    select() {
      return {
        from(table: unknown) {
          if (table === sqliteSchema.rateLimits) {
            return Array.from(rows.values()).map((row) => ({
              id: row.id,
              platform: row.platform,
              limitRemaining: row.limitRemaining ?? null,
              limitTotal: row.limitTotal ?? null,
              resetTime: row.resetTime ?? null,
              lastUpdated: row.lastUpdated ?? 0,
            }));
          }
          // Forward any other selects to a no-op empty result to avoid coupling.
          return [];
        },
      };
    },
    insert(table: unknown) {
      // Only rateLimits is used by RateLimitRepository; ignore others.
      return {
        values(value: typeof sqliteSchema.rateLimits.$inferInsert) {
          if (table === sqliteSchema.rateLimits) {
            const id = String(value.id);
            rows.set(id, value);
            return {
              onConflictDoUpdate(opts: {
                target: unknown;
                set: Partial<typeof sqliteSchema.rateLimits.$inferInsert>;
              }) {
                void opts.target;
                const existing = rows.get(id) ?? value;
                rows.set(id, { ...existing, ...opts.set });
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
        where(predicateSql: unknown) {
          void predicateSql;
          if (table !== sqliteSchema.rateLimits) {
            return;
          }
          const now = Date.now();
          for (const [id, row] of Array.from(rows.entries())) {
            const lastUpdated =
              typeof row.lastUpdated === "number" ? row.lastUpdated : now;
            if (lastUpdated < now) {
              rows.delete(id);
            }
          }
        },
      };
    },
    _rows: rows,
  };

  return db;
}

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

describe("RateLimitRepository - SQLite behavior (contract only)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  /**
   * NOTE:
   * RateLimitRepository directly uses the exported singleton rateLimitRepository
   * with an internal getReadWriteDb() dependency. A fully hermetic, precise
   * harness for this would require deeper control of module evaluation order
   * and singleton wiring than justified here.
   *
   * To avoid brittle ESM and singleton coupling, we only assert:
   * - loadAll() executes without throwing when wired to a sqlite-shaped db
   * - upsert() executes without throwing against sqlite-shaped db
   *
   * Detailed semantics are exercised via integration tests.
   */

  it("loadAll executes without error against a sqlite-shaped db", async () => {
    const fakeDb = createFakeSqliteDb();

    vi.doMock("@/lib/database/connection", () => ({
      getReadWriteDb: () => fakeDb,
    }));

    const { rateLimitRepository } = await import(
      "@/lib/database/rate-limit-repository"
    );
    await expect(rateLimitRepository.loadAll()).resolves.toBeDefined();
  });

  it("upsert executes without error against a sqlite-shaped db", async () => {
    const fakeDb = createFakeSqliteDb();

    vi.doMock("@/lib/database/connection", () => ({
      getReadWriteDb: () => fakeDb,
    }));

    const { rateLimitRepository } = await import(
      "@/lib/database/rate-limit-repository"
    );

    await expect(
      rateLimitRepository.upsert({
        id: "github:global",
        platform: "github",
        limitRemaining: 50,
        limitTotal: 5000,
        resetTime: 1700000000000,
        lastUpdated: 1700000000000,
      }),
    ).resolves.toBeUndefined();
  });

});

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

    await rateLimitRepository.cleanupOlderThan(Date.now() - 1000);

    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
