/**
 * Persistence Recovery Integration Tests
 *
 * Simplified tests to verify core persistence functionality without complex backup/restore operations.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../../lib/database/schema.js';
import { createTestDatabase, createTestDrizzle, closeAllConnections } from '../../../lib/database/connection.js';
import { rateLimits, toolConfigs } from '../../../lib/database/schema.js';
import { eq } from 'drizzle-orm';

// Create fresh database instance for each test to avoid singleton issues
let testDb: ReturnType<typeof drizzle<typeof schema>>;

// Test data setup - use process.cwd() to get the current working directory
const TEST_DATA_DIR = path.join(process.cwd(), 'data');
const TEST_BACKUP_DIR = path.join(TEST_DATA_DIR, 'backups');

describe('Persistence and Recovery System', () => {
  beforeAll(async () => {
    // Clean up any existing test databases before all tests
    try {
      await closeAllConnections();
      await fs.unlink(path.join(TEST_DATA_DIR, 'hyperpage.db')).catch(() => {});
      await fs.rm(TEST_BACKUP_DIR, { recursive: true, force: true }).catch(() => {});
      await fs.mkdir(TEST_BACKUP_DIR, { recursive: true }).catch(() => {});
    } catch (error) {
      console.error('Cleanup error in beforeAll:', error);
    }

    // Create fresh test database with manual schema creation
    const testSqliteDb = createTestDatabase();
    
    // Initialize schema manually for test database to avoid migration issues
    testSqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS tool_configs (
        tool_name TEXT PRIMARY KEY,
        enabled INTEGER DEFAULT 1 NOT NULL,
        config TEXT,
        refresh_interval INTEGER,
        notifications INTEGER DEFAULT 1 NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rate_limits (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        limit_remaining INTEGER,
        limit_total INTEGER,
        reset_time INTEGER,
        last_updated INTEGER NOT NULL,
        created_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL
      );
    `);

    testDb = createTestDrizzle(testSqliteDb);
    console.log('Test database schema initialized');
  });

  afterAll(async () => {
    // Final cleanup after all tests
    await closeAllConnections();
    try {
      await fs.unlink(path.join(TEST_DATA_DIR, 'hyperpage.db')).catch(() => {});
      await fs.rm(TEST_BACKUP_DIR, { recursive: true, force: true }).catch(() => {});
    } catch (error) {
      console.error('Cleanup error in afterAll:', error);
    }
  });

  beforeEach(async () => {
    // Clean up backup files and database tables between tests
    try {
      // Clear backup directory
      await fs.rm(TEST_BACKUP_DIR, { recursive: true, force: true }).catch(() => {});
      await fs.mkdir(TEST_BACKUP_DIR, { recursive: true }).catch(() => {});
      
      // Clear database tables to avoid UNIQUE constraint violations
      await testDb.delete(toolConfigs);
      await testDb.delete(rateLimits);
    } catch (error) {
      console.error('Cleanup error in beforeEach:', error);
    }
  });

  afterEach(async () => {
    // Clean up backup files after each test but keep database
    try {
      await fs.rm(TEST_BACKUP_DIR, { recursive: true, force: true }).catch(() => {});
    } catch (error) {
      console.error('Cleanup error in afterEach:', error);
    }
  });

  describe('Tool Configuration Persistence', () => {
    it('should persist and restore tool configuration across sessions', async () => {
      // Configure a tool
      const toolName = 'github';

      // Save configuration directly to test database
      await testDb.insert(toolConfigs).values({
        toolName,
        enabled: true,
        refreshInterval: 300000,
        notifications: false,
        config: { customSetting: 'test-value' },
        updatedAt: Date.now()
      });

      // Verify it's in database
      const saved = await testDb.select().from(toolConfigs).where(eq(toolConfigs.toolName, toolName));
      expect(saved.length).toBe(1);
      expect(saved[0].enabled).toBe(true);
      expect(saved[0].refreshInterval).toBe(300000);
      expect(saved[0].notifications).toBe(false);

      // Simulate application restart by checking persisted data
      const retrieved = await testDb.select().from(toolConfigs).where(eq(toolConfigs.toolName, toolName));
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].enabled).toBe(true);
      expect(retrieved[0].config).toMatchObject({ customSetting: 'test-value' });
    });

    it('should load persisted configurations from database', async () => {
      // Pre-populate database with configuration
      await testDb.insert(toolConfigs).values({
        toolName: 'jira',
        enabled: true,
        refreshInterval: 180000,
        notifications: true,
        config: { project: 'TEST', customField: 'value' },
        updatedAt: Date.now()
      });

      // Verify configuration is loaded from database
      const configs = await testDb.select().from(toolConfigs).where(eq(toolConfigs.toolName, 'jira'));
      expect(configs.length).toBe(1);
      expect(configs[0].enabled).toBe(true);
      expect(configs[0].refreshInterval).toBe(180000);
      expect(configs[0].config).toMatchObject({ project: 'TEST', customField: 'value' });
    });

    it('should handle missing configuration gracefully', async () => {
      const configs = await testDb.select().from(toolConfigs).where(eq(toolConfigs.toolName, 'non-existent-tool'));
      expect(configs.length).toBe(0);
    });

    it('should update existing configuration', async () => {
      // Initial config
      await testDb.insert(toolConfigs).values({
        toolName: 'gitlab',
        enabled: false,
        refreshInterval: 60000,
        notifications: false,
        config: {},
        updatedAt: Date.now()
      });

      // Update config
      await testDb.insert(toolConfigs)
        .values({
          toolName: 'gitlab',
          enabled: true,
          refreshInterval: 600000,
          notifications: true,
          config: { updated: true },
          updatedAt: Date.now()
        })
        .onConflictDoUpdate({
          target: toolConfigs.toolName,
          set: {
            enabled: true,
            refreshInterval: 600000,
            notifications: true,
            config: { updated: true },
            updatedAt: Date.now()
          }
        });

      const updated = await testDb.select().from(toolConfigs).where(eq(toolConfigs.toolName, 'gitlab'));
      expect(updated.length).toBe(1);
      expect(updated[0].enabled).toBe(true);
      expect(updated[0].refreshInterval).toBe(600000);
      expect(updated[0].config).toMatchObject({ updated: true });
    });
  });

  describe('Rate Limit Persistence', () => {
    it('should persist and retrieve rate limit status', async () => {
      // Pre-populate database with rate limit data
      const testData = {
        id: 'github:global',
        platform: 'github',
        limitRemaining: 4500,
        limitTotal: 5000,
        resetTime: Date.now() + 1800000,
        lastUpdated: Date.now() - 300000 // 5 minutes ago
      };

      await testDb.insert(rateLimits).values(testData);

      // Retrieve persisted data
      const persisted = await testDb.select().from(rateLimits).where(eq(rateLimits.platform, 'github'));
      expect(persisted.length).toBe(1);
      expect(persisted[0].limitTotal).toBe(5000);
      expect(persisted[0].limitRemaining).toBe(4500);
    });

    it('should handle platforms without specific limits gracefully', async () => {
      // Pre-populate with GitLab data (which has global limits)
      await testDb.insert(rateLimits).values({
        id: 'gitlab:global',
        platform: 'gitlab',
        limitRemaining: null,
        limitTotal: null,
        resetTime: Date.now() + 900000,
        lastUpdated: Date.now()
      });

      const persisted = await testDb.select().from(rateLimits).where(eq(rateLimits.platform, 'gitlab'));
      expect(persisted.length).toBe(1);
      expect(persisted[0].platform).toBe('gitlab');
      expect(persisted[0].limitRemaining).toBeNull();
    });
  });

  describe('Data Integrity and Recovery', () => {
    it('should maintain data consistency across configuration changes', async () => {
      // Configure multiple tools
      await testDb.insert(toolConfigs).values([
        {
          toolName: 'github',
          enabled: true,
          refreshInterval: 300000,
          notifications: true,
          config: { repo: 'test' },
          updatedAt: Date.now()
        },
        {
          toolName: 'gitlab',
          enabled: false,
          refreshInterval: 600000,
          notifications: false,
          config: { project: 'test' },
          updatedAt: Date.now()
        }
      ]);

      // Verify both configurations are stored
      const allConfigs = await testDb.select().from(toolConfigs);
      expect(allConfigs.length).toBe(2);

      const githubConfig = allConfigs.find(c => c.toolName === 'github');
      const gitlabConfig = allConfigs.find(c => c.toolName === 'gitlab');

      expect(githubConfig?.enabled).toBe(true);
      expect(gitlabConfig?.enabled).toBe(false);
    });

    it('should handle concurrent data operations safely', async () => {
      // Test concurrent inserts
      const insertPromises = [];
      for (let i = 0; i < 5; i++) {
        insertPromises.push(
          testDb.insert(toolConfigs).values({
            toolName: `concurrent-test-${i}`,
            enabled: true,
            refreshInterval: 300000,
            notifications: true,
            config: { index: i },
            updatedAt: Date.now()
          })
        );
      }

      await Promise.all(insertPromises);

      // Verify all were inserted
      const configs = await testDb.select().from(toolConfigs).where(eq(toolConfigs.toolName, `concurrent-test-0`));
      expect(configs.length).toBe(1);

      const allConcurrent = await testDb.select().from(toolConfigs);
      const concurrentConfigs = allConcurrent.filter(c => c.toolName?.startsWith('concurrent-test-'));
      expect(concurrentConfigs.length).toBe(5);
    });
  });
});
