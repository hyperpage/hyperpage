import { beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as pgSchema from "./lib/database/pg-schema";

/**
 * Test database configuration
 *
 * DATABASE_URL is the single source of truth for Postgres in tests.
 *
 * Expected usage:
 * - When running tests locally or in CI, ensure DATABASE_URL is set:
 *   - For the Docker-based testing stack, load `.env.testing` and
 *     `docker-compose.testing.yml` so DATABASE_URL points at the test Postgres.
 *
 * Behavior:
 * - If DATABASE_URL is not set, setup fails fast with a clear message.
 * - If connection/auth fails, setup logs a concise hint (including DATABASE_URL)
 *   and rethrows the error.
 */
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    [
      "DATABASE_URL is not set.",
      "Tests require a PostgreSQL database URL to be configured.",
      "",
      "For local/testing environments:",
      "- Create and populate .env.testing",
      "- Use docker-compose.testing.yml to start the testing Postgres service",
      "- Ensure DATABASE_URL in .env.testing points at the testing Postgres database",
    ].join("\n"),
  );
}

// PostgreSQL Test Database Manager
export class TestDatabaseManager {
  private pool: Pool | null = null;
  private db: ReturnType<typeof drizzle<typeof pgSchema>> | null = null;

  private readonly dbName: string;
  private readonly adminUrl: string;

  constructor() {
    // Derive the target database name from DATABASE_URL so all operations
    // (create/drop/migrate/seed) are aligned on a single Postgres database.
    const url = new URL(DATABASE_URL!);
    this.dbName = url.pathname.replace(/^\//, "") || "postgres";

    // Admin URL always points at the default "postgres" database on same host.
    this.adminUrl = `${url.protocol}//${url.username ? `${url.username}${url.password ? `:${url.password}` : ""}@` : ""}${url.hostname}${url.port ? `:${url.port}` : ""}/postgres${url.search}`;
  }

  async setup(): Promise<void> {
    try {
      console.log("🧪 Setting up PostgreSQL test database...");

      // Drop and recreate test database, then initialize pool + drizzle
      await this.dropDatabase();
      await this.createDatabase();
      await this.initPoolAndDrizzle();
      await this.runMigrations();

      console.log("✅ PostgreSQL test database setup complete");
    } catch (error) {
      const { default: logger } = await import("./lib/logger");
      const message =
        error instanceof Error ? error.message : String(error);

      // Provide a concise, environment-tolerant hint instead of only raw driver errors.
      logger.error(
        [
          "Test DB setup failed.",
          "Verify DATABASE_URL points to a reachable Postgres instance with permissions to:",
          "  - Connect using the provided credentials",
          "  - CREATE/DROP the database specified in DATABASE_URL",
          "",
          "For the Docker-based testing stack:",
          "  - Run: docker compose -f docker-compose.yml -f docker-compose.testing.yml up -d postgres",
          "  - Ensure .env.testing defines:",
          "      DATABASE_URL=postgresql://postgres:password@postgres:5432/hyperpage-testing",
          "",
          "For a locally running Postgres without docker-compose.testing.yml:",
          "  - Ensure DATABASE_URL points at your local Postgres instance, e.g.:",
          "      postgresql://postgres:password@localhost:5432/hyperpage-testing",
          "",
          `Current DATABASE_URL: ${DATABASE_URL ?? "(not set)"}`,
          `Underlying error: ${message}`,
        ].join("\n"),
      );
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      console.log("🧹 Cleaning up PostgreSQL test database...");
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
      }
      this.db = null;
      await this.dropDatabase();
      console.log("✅ PostgreSQL test database cleanup complete");
    } catch (error) {
      const { default: logger } = await import("./lib/logger");
      const errMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(errMessage, "Test DB cleanup failed");
    }
  }

  private async createDatabase(): Promise<void> {
    const tempPool = new Pool({
      connectionString: this.adminUrl,
      max: 1,
    });

    try {
      await tempPool.query(`CREATE DATABASE "${this.dbName}"`);
    } catch (error) {
      const { default: logger } = await import("./lib/logger");
      const message =
        error instanceof Error ? error.message : String(error);

      logger.warn(message, "Test database already exists");
    } finally {
      await tempPool.end();
    }
  }

  private async initPoolAndDrizzle(): Promise<void> {
    // Initialize a new pool connected to the freshly created test database.
    this.pool = new Pool({
      connectionString: DATABASE_URL,
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    this.db = drizzle(this.pool, { schema: pgSchema });
  }

  private async dropDatabase(): Promise<void> {
    const tempPool = new Pool({
      connectionString: this.adminUrl,
      max: 1,
    });

    try {
      // Terminate all connections to the target test database
      await tempPool.query(
        `
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = $1
        AND pid <> pg_backend_pid()
      `,
        [this.dbName],
      );

      await tempPool.query(`DROP DATABASE IF EXISTS "${this.dbName}"`);
    } catch (error) {
      const { default: logger } = await import("./lib/logger");
      const message =
        error instanceof Error ? error.message : String(error);

      logger.warn(message, "Test database already exists");
    } finally {
      await tempPool.end();
    }
  }

  private async runMigrations(): Promise<void> {
    // Create the meta directory and journal file for drizzle
    const fs = await import("fs/promises");
    const path = await import("path");

    const metaDir = path.join(
      process.cwd(),
      "lib",
      "database",
      "migrations",
      "meta",
    );
    const journalPath = path.join(metaDir, "_journal.json");

    try {
      await fs.mkdir(metaDir, { recursive: true });

      // Check if journal file exists, if not create a basic one
      try {
        await fs.access(journalPath);
      } catch {
        const journal: {
          version: string;
          dialect: string;
          entries: Array<unknown>;
        } = {
          version: "5",
          dialect: "postgresql",
          entries: [],
        };
        await fs.writeFile(journalPath, JSON.stringify(journal, null, 2));
      }
    } catch (error) {
      const { default: logger } = await import("./lib/logger");
      const errMessage =
        error instanceof Error ? error.message : String(error);

      logger.warn(errMessage, "Migration journal creation issue");
    }

    if (!this.db) {
      throw new Error("Test database not initialized before running migrations");
    }

    // First try drizzle's file-based migrator. In some TS/Vitest setups this may
    // discover zero migrations (TS files not loadable as JS), which would leave
    // the schema empty. We verify and, if needed, fall back to the registry.
    await migrate(this.db, {
      migrationsFolder: "./lib/database/migrations",
    });

    const pool = this.getPool();
    const client = await pool.connect();
    try {
      const check = await client.query<{ tablename: string }>(
        `
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename = $1
        `,
        ["app_state"],
      );

      if (check.rowCount === 0) {
        const { default: logger } = await import("./lib/logger");
        logger.warn(
          [
            'Drizzle migrate() completed but required table "app_state" is missing.',
            "This usually means no migration files were loaded from ./lib/database/migrations.",
            "Falling back to MIGRATIONS_REGISTRY to ensure the test schema is applied.",
          ].join("\n"),
        );

        const {
          MIGRATIONS_REGISTRY,
          getMigrationNames,
        } = await import("./lib/database/migrations");

        for (const name of getMigrationNames()) {
          const migration = MIGRATIONS_REGISTRY[name];
          await migration.up(this.db as never);
        }

        const verify = await client.query<{ tablename: string }>(
          `
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'public'
            AND tablename = $1
          `,
          ["app_state"],
        );

        if (verify.rowCount === 0) {
          throw new Error(
            [
              'Migrations executed via MIGRATIONS_REGISTRY but "app_state" is still missing.',
              "Check migration definitions in lib/database/migrations.",
            ].join("\n"),
          );
        }
      }
    } finally {
      client.release();
    }
  }

  async seedTestData(): Promise<void> {
    if (!this.db) {
      throw new Error("Test database not initialized before seeding");
    }

    // Ensure core tables exist before attempting inserts.
    // If migrations failed (e.g. due to permissions), fail fast with a clear error
    // instead of cascading 42P01 in tests.
    const requiredTables = [
      "app_state",
      "jobs",
      "users",
      "oauth_tokens",
      "tool_configs",
      "rate_limits",
      "job_history",
      "user_sessions",
    ] as const;

    try {
      // Use a raw query via the underlying pg client to avoid type friction.
      const client = await this.getPool().connect();
      try {
        const result = await client.query<{
          tablename: string;
        }>(
          `
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'public'
            AND tablename = ANY($1::text[])
        `,
          [requiredTables],
        );

        const existing = new Set<string>(result.rows.map((r) => r.tablename));

        for (const tableName of requiredTables) {
          if (!existing.has(tableName)) {
            throw new Error(
              `Required table "${tableName}" is missing in test database. ` +
                `Check that drizzle migrations ran successfully before seeding.`,
            );
          }
        }
      } finally {
        client.release();
      }
    } catch (error) {
      const { default: logger } = await import("./lib/logger");
      const message =
        error instanceof Error ? error.message : String(error);
      logger.error(
        message,
        "Test DB seed preflight failed - migrations likely did not run",
      );
      throw error;
    }

    // Insert test data for all tables
    const testData = this.getTestData();

    for (const [tableName, data] of Object.entries(testData)) {
      if (!data.length) continue;

      const table = this.getTableByName(tableName);
      if (!table) continue;

      await this.db.insert(table).values(data);
    }
  }

  private getTableByName(tableName: string) {
    const tableMap: Record<string, (typeof pgSchema)[keyof typeof pgSchema]> = {
      app_state: pgSchema.appState,
      jobs: pgSchema.jobs,
      job_history: pgSchema.jobHistory,
      rate_limits: pgSchema.rateLimits,
      tool_configs: pgSchema.toolConfigs,
      users: pgSchema.users,
      oauth_tokens: pgSchema.oauthTokens,
      user_sessions: pgSchema.userSessions,
    };
    return tableMap[tableName];
  }

  private getTestData(): Record<string, Array<Record<string, unknown>>> {
    const now = new Date();
    return {
      app_state: [
        { key: "version", value: "1.0.0", updatedAt: now },
        { key: "test_key", value: "test_value", updatedAt: now },
      ],
      jobs: [
        {
          type: "test",
          payload: { test: true },
          status: "pending",
          scheduledAt: now,
          attempts: 0,
          createdAt: now,
          updatedAt: now,
        },
      ],
      users: [
        {
          email: "test@example.com",
          name: "Test User",
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
  }

  getDb() {
    if (!this.db) {
      throw new Error("Test database not initialized");
    }
    return this.db;
  }

  getPool() {
    if (!this.pool) {
      throw new Error("Test database pool not initialized");
    }
    return this.pool;
  }

  // Utility methods for dual-engine testing
  async createTestJob(): Promise<Array<typeof pgSchema.jobs.$inferInsert>[0]> {
    const job = {
      type: "test",
      payload: { test: true },
      status: "pending",
      scheduledAt: new Date(),
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!this.db) {
      throw new Error("Test database not initialized before createTestJob");
    }
    const result = await this.db.insert(pgSchema.jobs).values(job).returning();
    return result[0];
  }

  async createTestUser(): Promise<Array<typeof pgSchema.users.$inferInsert>[0]> {
    const user = {
      email: "test@example.com",
      name: "Test User",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!this.db) {
      throw new Error("Test database not initialized before createTestUser");
    }
    const result = await this.db.insert(pgSchema.users).values(user).returning();
    return result[0];
  }

  async clearAllTables(): Promise<void> {
    if (!this.db) {
      throw new Error("Test database not initialized before clearAllTables");
    }

    // Only attempt to clear tables that actually exist to avoid noisy warnings
    // when migrations have not run or failed early.
    const pool = this.getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query<{ tablename: string }>(
        `
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
      `,
      );
      const existing = new Set(rows.map((r) => r.tablename));

      const tables = [
        pgSchema.jobs,
        pgSchema.jobHistory,
        pgSchema.rateLimits,
        pgSchema.toolConfigs,
        pgSchema.appState,
        pgSchema.users,
        pgSchema.oauthTokens,
        pgSchema.userSessions,
      ];

      for (const table of tables) {
        const tableName = table._.name;
        if (!existing.has(tableName)) continue;

        try {
          await this.db.delete(table);
        } catch (error) {
          const { default: logger } = await import("./lib/logger");
          const message =
            error instanceof Error ? error.message : String(error);

          logger.warn(message, "Failed to clear table during test cleanup");
        }
      }
    } finally {
      client.release();
    }
  }
}

const testDbManager = new TestDatabaseManager();

/**
 * Global, idempotent setup/teardown for PostgreSQL tests.
 *
 * Vitest may execute test files in parallel workers. To avoid concurrent
 * DROP/CREATE DATABASE operations fighting each other (causing 57P01 errors),
 * we:
 *
 * - Use a single shared TestDatabaseManager instance
 * - Guard setup/cleanup with an internal promise so only one sequence runs
 * - Make all hooks await the same in-flight setup promise
 */

let setupPromise: Promise<void> | null = null;
let isSetupComplete = false;

async function ensureTestDatabaseSetup(): Promise<void> {
  if (isSetupComplete) {
    return;
  }
  if (!setupPromise) {
    setupPromise = (async () => {
      await testDbManager.setup();
      isSetupComplete = true;
    })().catch((error) => {
      // Reset flags so a subsequent attempt can retry instead of hanging forever.
      setupPromise = null;
      isSetupComplete = false;
      throw error;
    });
  }
  await setupPromise;
}

// Setup and cleanup hooks for PostgreSQL tests
beforeAll(async () => {
  await ensureTestDatabaseSetup();
});

afterAll(async () => {
  // Only perform full cleanup once per process. Subsequent calls are no-ops.
  if (!isSetupComplete) {
    return;
  }

  // Best-effort cleanup: if it fails, we log inside TestDatabaseManager.
  await testDbManager.cleanup();
  isSetupComplete = false;
  setupPromise = null;
});

// Reset data between tests
beforeEach(async () => {
  await ensureTestDatabaseSetup();
  await testDbManager.clearAllTables();
  await testDbManager.seedTestData();
});

// Mock database connection for tests
export function getTestDatabase() {
  return {
    db: testDbManager.getDb(),
    pool: testDbManager.getPool(),
    schema: pgSchema,
  };
}

// Export for dual-engine testing
export type { pgSchema };
