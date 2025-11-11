import { beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as pgSchema from "./lib/database/pg-schema";

// Test database configuration
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://hyperpage_test:password@localhost:5432/hyperpage_test";

// PostgreSQL Test Database Manager
export class TestDatabaseManager {
  private pool: Pool;
  private db: ReturnType<typeof drizzle<typeof pgSchema>>;

  constructor() {
    this.pool = new Pool({
      connectionString: TEST_DATABASE_URL,
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    this.db = drizzle(this.pool, { schema: pgSchema });
  }

  async setup(): Promise<void> {
    try {
      console.log("🧪 Setting up PostgreSQL test database...");

      // Drop and recreate test database
      await this.dropDatabase();
      await this.createDatabase();
      await this.runMigrations();

      console.log("✅ PostgreSQL test database setup complete");
    } catch (error) {
      console.error("❌ PostgreSQL test database setup failed:", error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      console.log("🧹 Cleaning up PostgreSQL test database...");
      await this.dropDatabase();
      await this.pool.end();
      console.log("✅ PostgreSQL test database cleanup complete");
    } catch (error) {
      console.error("❌ PostgreSQL test database cleanup failed:", error);
    }
  }

  private async createDatabase(): Promise<void> {
    const tempPool = new Pool({
      connectionString: TEST_DATABASE_URL.replace(
        "/hyperpage_test",
        "/postgres",
      ),
      max: 1,
    });

    try {
      await tempPool.query(`CREATE DATABASE hyperpage_test`);
    } catch (error) {
      // Database might already exist
      console.log("Test database already exists");
    } finally {
      await tempPool.end();
    }
  }

  private async dropDatabase(): Promise<void> {
    const tempPool = new Pool({
      connectionString: TEST_DATABASE_URL.replace(
        "/hyperpage_test",
        "/postgres",
      ),
      max: 1,
    });

    try {
      // Terminate all connections to test database
      await tempPool.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = 'hyperpage_test'
        AND pid <> pg_backend_pid()
      `);

      await tempPool.query(`DROP DATABASE IF EXISTS hyperpage_test`);
    } catch (error) {
      console.log("Database cleanup: No existing database to drop");
    } finally {
      await tempPool.end();
    }
  }

  private async runMigrations(): Promise<void> {
    // Create the meta directory and journal file for drizzle
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const metaDir = path.join(process.cwd(), 'lib', 'database', 'migrations', 'meta');
    const journalPath = path.join(metaDir, '_journal.json');
    
    try {
      await fs.mkdir(metaDir, { recursive: true });
      
      // Check if journal file exists, if not create a basic one
      try {
        await fs.access(journalPath);
      } catch {
        const journal: { version: string; dialect: string; entries: Array<unknown> } = {
          "version": "5",
          "dialect": "postgresql",
          "entries": []
        };
        await fs.writeFile(journalPath, JSON.stringify(journal, null, 2));
      }
    } catch (error) {
      console.warn('Could not create migration journal:', error);
    }

    await migrate(this.db, {
      migrationsFolder: "./lib/database/migrations",
    });
  }

  async seedTestData(): Promise<void> {
    // Insert test data for all tables
    const testData = this.getTestData();

    for (const [tableName, data] of Object.entries(testData)) {
      if (data.length > 0) {
        // Map table names to actual schema objects
        const table = this.getTableByName(tableName);
        if (table && data.length > 0) {
          await this.db.insert(table).values(data);
        }
      }
    }
  }

  private getTableByName(tableName: string) {
    const tableMap: Record<string, unknown> = {
      app_state: pgSchema.appState,
      jobs: pgSchema.jobs,
      job_history: pgSchema.jobHistory,
      rate_limits: pgSchema.rateLimits,
      tool_configs: pgSchema.toolConfigs,
      users: pgSchema.users,
      oauth_tokens: pgSchema.oauthTokens,
      user_sessions: pgSchema.userSessions,
    };
    return tableMap[tableName] as any;
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
    return this.db;
  }

  getPool() {
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

    const result = await this.db.insert(pgSchema.users).values(user).returning();
    return result[0];
  }

  async clearAllTables(): Promise<void> {
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
      try {
        await this.db.delete(table);
      } catch (error) {
        // Table might not exist yet
      }
    }
  }
}

export const testDbManager = new TestDatabaseManager();

// Setup and cleanup hooks for PostgreSQL tests
beforeAll(async () => {
  await testDbManager.setup();
});

afterAll(async () => {
  await testDbManager.cleanup();
});

// Reset data between tests
beforeEach(async () => {
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
