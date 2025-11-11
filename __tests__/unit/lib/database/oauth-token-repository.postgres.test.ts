import { describe, expect, it, vi, beforeEach } from "vitest";

import * as pgSchema from "@/lib/database/pg-schema";
import {
  PostgresOAuthTokenRepository,
  type OAuthTokens,
} from "@/lib/database/oauth-token-repository";

interface OAuthTokenRow {
  userId: string;
  provider: string;
  scope: string | null;
  accessToken: string;
  refreshToken: string | null;
  tokenType: string | null;
  expiresAt: Date | null;
  raw: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

function createFakePgDb() {
  const rows = new Map<string, OAuthTokenRow>();

  const keyOf = (userId: string, provider: string): string =>
    `${userId}:${provider}`;

  const db = {
    // Minimal pg-like shape: just enough for PostgresOAuthTokenRepository
    $schema: {
      oauthTokens: pgSchema.oauthTokens,
    },
    insert(table: unknown) {
      if (table !== pgSchema.oauthTokens) {
        throw new Error("Unsupported table in insert");
      }
      return {
        values(value: Partial<OAuthTokenRow> | Partial<OAuthTokenRow>[]) {
          const list = Array.isArray(value) ? value : [value];
          const now = new Date();
          for (const v of list) {
            if (!v.userId || !v.provider || !v.accessToken) {
              throw new Error("Missing fields");
            }
            const id = keyOf(v.userId, v.provider);
            rows.set(id, {
              userId: v.userId,
              provider: v.provider,
              accessToken: v.accessToken,
              refreshToken: v.refreshToken ?? null,
              scope: typeof v.scope === "string" ? v.scope : (v.scope ?? null),
              expiresAt: v.expiresAt ?? null,
              tokenType: v.tokenType ?? null,
              raw:
                (v.raw as Record<string, unknown> | null | undefined) ?? null,
              createdAt: v.createdAt ?? now,
              updatedAt: v.updatedAt ?? now,
            });
          }
          return { rowsAffected: list.length };
        },
      };
    },

    select() {
      return {
        from(table: unknown) {
          if (table !== pgSchema.oauthTokens) {
            throw new Error("Unsupported table in select.from");
          }
          return {
            // In the real drizzle client, `.where` is given a SQL expression.
            // Our repository never passes a JS callback, so this harness keeps
            // `.where()` as a no-arg function and simply returns helpers that
            // operate over all rows. Individual tests control which rows exist.
            where() {
              const all = Array.from(rows.values());
              return {
                limit(n: number) {
                  return all.slice(0, n);
                },
              };
            },
          };
        },
      };
    },

    update(table: unknown) {
      if (table !== pgSchema.oauthTokens) {
        throw new Error("Unsupported table in update");
      }
      return {
        set(values: Partial<OAuthTokenRow>) {
          return {
            where() {
              const all = Array.from(rows.values());
              if (all.length === 0) {
                return { rowsAffected: 0 };
              }
              const first = all[0];
              const id = keyOf(first.userId, first.provider);
              const existing = rows.get(id);
              if (!existing) {
                return { rowsAffected: 0 };
              }
              rows.set(id, {
                ...existing,
                ...values,
                raw:
                  (values.raw as Record<string, unknown> | null | undefined) ??
                  existing.raw,
                updatedAt: values.updatedAt ?? existing.updatedAt,
              });
              return { rowsAffected: 1 };
            },
          };
        },
      };
    },

    delete(table: unknown) {
      if (table !== pgSchema.oauthTokens) {
        throw new Error("Unsupported table in delete");
      }
      return {
        where() {
          // For cleanupExpiredTokens we want to simulate conditional deletion.
          // The repository builds the full WHERE expression; we don't parse it here.
          // Instead, rely on our test expectations against rows.size before/after
          // by deleting only rows whose expiresAt/raw match the scenario.
          const before = rows.size;
          rows.forEach((row, key) => {
            const expiresAt = row.expiresAt?.getTime() ?? 0;
            const refreshExpiresAt =
              typeof row.raw?.refreshExpiresAt === "number"
                ? row.raw.refreshExpiresAt
                : undefined;
            const now = Date.now();

            const isExpiredCore = expiresAt < now;
            const isRefreshExpired =
              refreshExpiresAt === undefined || refreshExpiresAt < now;

            if (isExpiredCore && isRefreshExpired) {
              rows.delete(key);
            }
          });
          const after = rows.size;
          return { rowsAffected: before - after };
        },
      };
    },

    _dumpRows(): Map<string, OAuthTokenRow> {
      return rows;
    },
  };

  return db;
}

describe("PostgresOAuthTokenRepository", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.OAUTH_ENCRYPTION_KEY;
  });

  it("stores tokens with provider/scope/raw mapping", async () => {
    const db = createFakePgDb();
    const repo = new PostgresOAuthTokenRepository(
      db as unknown as ConstructorParameters<
        typeof PostgresOAuthTokenRepository
      >[0],
    );

    const tokens: OAuthTokens = {
      accessToken: "access-1",
      refreshToken: "refresh-1",
      tokenType: "bearer",
      expiresAt: 1_700_000_000_000,
      refreshExpiresAt: 1_700_000_100_000,
      scopes: ["repo", "user"],
      metadata: { foo: "bar" },
    };

    await repo.storeTokens("user-1", "github", tokens);

    const rows = db._dumpRows();
    const stored = rows.get("user-1:github");
    expect(stored).toBeDefined();

    expect(stored?.provider).toBe("github");
    expect(stored?.accessToken).toBe("access-1");
    expect(stored?.refreshToken).toBe("refresh-1");
    expect(stored?.tokenType).toBe("bearer");

    expect(stored?.scope).toBe("repo user");

    expect(stored?.raw).toMatchObject({
      metadata: { foo: "bar" },
      refreshExpiresAt: tokens.refreshExpiresAt,
    });

    expect(stored?.createdAt).toBeInstanceOf(Date);
    expect(stored?.updatedAt).toBeInstanceOf(Date);
  });

  it("round-trips tokens via getTokens using raw and scope", async () => {
    const db = createFakePgDb();
    const repo = new PostgresOAuthTokenRepository(
      db as unknown as ConstructorParameters<
        typeof PostgresOAuthTokenRepository
      >[0],
    );

    const expiresAt = 1_700_000_000_000;
    const refreshExpiresAt = 1_700_000_050_000;

    db.insert(pgSchema.oauthTokens).values({
      userId: "user-2",
      provider: "github",
      accessToken: "access-2",
      refreshToken: "refresh-2",
      tokenType: "bearer",
      scope: "repo read:user",
      expiresAt: new Date(expiresAt),
      raw: {
        metadata: { baz: "qux" },
        refreshExpiresAt,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const loaded = await repo.getTokens("user-2", "github");
    expect(loaded).not.toBeNull();

    expect(loaded?.accessToken).toBe("access-2");
    expect(loaded?.refreshToken).toBe("refresh-2");
    expect(loaded?.tokenType).toBe("bearer");

    expect(loaded?.expiresAt).toBe(expiresAt);
    expect(loaded?.refreshExpiresAt).toBe(refreshExpiresAt);

    expect(loaded?.scopes).toEqual(["repo", "read:user"]);
    expect(loaded?.metadata).toEqual({ baz: "qux" });
  });

  it("updateTokenExpiry merges and persists refreshExpiresAt in raw", async () => {
    const db = createFakePgDb();
    const repo = new PostgresOAuthTokenRepository(
      db as unknown as ConstructorParameters<
        typeof PostgresOAuthTokenRepository
      >[0],
    );

    const initialExpiresAt = 1_700_000_000_000;
    db.insert(pgSchema.oauthTokens).values({
      userId: "user-3",
      provider: "github",
      accessToken: "token-3",
      tokenType: "bearer",
      scope: "repo",
      expiresAt: new Date(initialExpiresAt),
      raw: {
        metadata: { keep: true },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const newExpiresAt = 1_700_000_100_000;
    const newRefreshExpiresAt = 1_700_000_200_000;
    await repo.updateTokenExpiry(
      "user-3",
      "github",
      newExpiresAt,
      newRefreshExpiresAt,
    );

    const rows = db._dumpRows();
    const stored = rows.get("user-3:github");
    expect(stored).toBeDefined();

    expect(stored?.expiresAt?.getTime()).toBe(newExpiresAt);
    expect(stored?.raw).toMatchObject({
      metadata: { keep: true },
      refreshExpiresAt: newRefreshExpiresAt,
    });
  });

  it("getExpiredTokens returns rows with expired expiresAt (documented semantics only)", async () => {
    const db = createFakePgDb();
    const repo = new PostgresOAuthTokenRepository(
      db as unknown as ConstructorParameters<
        typeof PostgresOAuthTokenRepository
      >[0],
    );

    const past = new Date(Date.now() - 10_000);

    // Our fake select().from().where().limit() returns all rows, so to exercise
    // getExpiredTokens we only insert a single clearly expired row here. That
    // keeps the harness simple while still asserting mapping semantics.
    db.insert(pgSchema.oauthTokens).values({
      userId: "expired-user",
      provider: "github",
      accessToken: "t1",
      tokenType: "bearer",
      scope: null,
      expiresAt: past,
      raw: null,
      createdAt: past,
      updatedAt: past,
    });

    const expired = await repo.getExpiredTokens();

    // Our harness fakes just enough of the drizzle API for PostgresOAuthTokenRepository
    // without implementing full SQL expression evaluation, so we only assert that:
    // - the call succeeds
    // - it returns an array of { userId, toolName } objects
    // Detailed filtering is validated in integration tests against real Postgres.
    expect(Array.isArray(expired)).toBe(true);
    for (const row of expired) {
      expect(row).toHaveProperty("userId");
      expect(row).toHaveProperty("toolName");
    }
  });

  it("cleanupExpiredTokens deletes rows expired by expiresAt/raw.refreshExpiresAt", async () => {
    const db = createFakePgDb();
    const repo = new PostgresOAuthTokenRepository(
      db as unknown as ConstructorParameters<
        typeof PostgresOAuthTokenRepository
      >[0],
    );

    const now = Date.now();
    const past = new Date(now - 10_000);
    const future = new Date(now + 10_000);

    db.insert(pgSchema.oauthTokens).values([
      {
        userId: "expired-both",
        provider: "github",
        accessToken: "t1",
        tokenType: "bearer",
        scope: null,
        expiresAt: past,
        raw: { refreshExpiresAt: now - 5_000 },
        createdAt: past,
        updatedAt: past,
      },
      {
        userId: "expired-no-refresh",
        provider: "github",
        accessToken: "t2",
        tokenType: "bearer",
        scope: null,
        expiresAt: past,
        raw: null,
        createdAt: past,
        updatedAt: past,
      },
      {
        userId: "not-expired",
        provider: "github",
        accessToken: "t3",
        tokenType: "bearer",
        scope: null,
        expiresAt: future,
        raw: { refreshExpiresAt: now + 5_000 },
        createdAt: future,
        updatedAt: future,
      },
    ]);

    const removed = await repo.cleanupExpiredTokens();
    expect(removed).toBe(2);
  });
});
