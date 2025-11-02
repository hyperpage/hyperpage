/**
 * Persistence Recovery Integration Tests
 *
 * Comprehensive tests to ensure data persistence and recovery works correctly
 * across application restarts, crashes, and backup/restore scenarios.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, closeDatabase, db } from '../../../lib/database/index.js';
import { toolRegistry } from '../../../tools/registry.js';
import { toolConfigManager, saveToolConfiguration, getToolConfiguration } from '../../../lib/tool-config-manager.js';
import { getRateLimitStatus } from '../../../lib/rate-limit-monitor.js';
import { createBackup, restoreBackup, listBackups, validateBackup } from '../../../lib/database/backup.js';
import { rateLimits, toolConfigs, jobs } from '../../../lib/database/schema.js';
import { eq } from 'drizzle-orm';

// Test data setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DATA_DIR = path.join(__dirname, '../../../data');
const TEST_BACKUP_DIR = path.join(TEST_DATA_DIR, 'backups');

describe('Persistence and Recovery System', () => {
  beforeAll(async () => {
    // Clean up any existing test databases before all tests
    try {
      await closeDatabase(); // Ensure any existing connections are closed
      await fs.unlink(path.join(TEST_DATA_DIR, 'hyperpage.db')).catch(() => {});
      await fs.rm(TEST_BACKUP_DIR, { recursive: true, force: true }).catch(() => {});
      await fs.mkdir(TEST_BACKUP_DIR, { recursive: true }).catch(() => {});
    } catch (error) {
      // Ignore cleanup errors
    }

    // Initialize database fresh for all tests
    await initializeDatabase();
  });

  afterAll(async () => {
    // Final cleanup after all tests
    await closeDatabase();
    try {
      await fs.unlink(path.join(TEST_DATA_DIR, 'hyperpage.db')).catch(() => {});
      await fs.rm(TEST_BACKUP_DIR, { recursive: true, force: true }).catch(() => {});
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Clean up any remaining backup files between tests
    try {
      await fs.rm(TEST_BACKUP_DIR, { recursive: true, force: true }).catch(() => {});
      await fs.mkdir(TEST_BACKUP_DIR, { recursive: true }).catch(() => {});
    } catch (error) {
      // Ignore cleanup errors
    }

    // Reset tool config manager cache between tests
    (toolConfigManager as any).configCache.clear();
  });

  afterEach(async () => {
    // Clean up backup files after each test but keep database
    try {
      await fs.rm(TEST_BACKUP_DIR, { recursive: true, force: true }).catch(() => {});
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Tool Configuration Persistence', () => {
    it('should persist and restore tool configuration across sessions', async () => {
      // Configure a tool
      const toolName = 'github';
      const config = {
        enabled: true,
        refreshInterval: 300000,
        notifications: false,
        config: { customSetting: 'test-value' }
      };

      // Save configuration
      await saveToolConfiguration(toolName, config);

      // Verify it's in database
      const saved = await db.select().from(toolConfigs).where(eq(toolConfigs.toolName, toolName));
      expect(saved.length).toBe(1);
      expect(saved[0].enabled).toBe(1);
      expect(saved[0].refreshInterval).toBe(300000);
      expect(saved[0].notifications).toBe(0);

      // Simulate application restart by creating new instance
      const retrieved = await getToolConfiguration(toolName);
      expect(retrieved).toMatchObject({
        enabled: true,
        refreshInterval: 300000,
        notifications: false,
        config: { customSetting: 'test-value' }
      });
    });

    it('should load persisted configurations on startup', async () => {
      // Pre-populate database with configuration
      await db.insert(toolConfigs).values({
        toolName: 'jira',
        enabled: true,
        refreshInterval: 180000,
        notifications: true,
        config: { project: 'TEST', customField: 'value' },
        updatedAt: Date.now()
      });

      // Shutdown and restart database
      await closeDatabase();
      await initializeDatabase();

      // Reset cache to force database load
      (toolConfigManager as any).configCache.clear();

      // Verify configuration is loaded
      const config = await getToolConfiguration('jira');
      expect(config).toMatchObject({
        enabled: true,
        refreshInterval: 180000,
        notifications: true,
        config: { project: 'TEST', customField: 'value' }
      });
    });

    it('should handle missing configuration gracefully', async () => {
      const config = await getToolConfiguration('non-existent-tool');
      expect(config).toBeNull();
    });

    it('should update existing configuration', async () => {
      // Initial config
      await saveToolConfiguration('gitlab', { enabled: false });

      // Update config
      await saveToolConfiguration('gitlab', {
        enabled: true,
        refreshInterval: 600000
      });

      const updated = await getToolConfiguration('gitlab');
      expect(updated).toMatchObject({
        enabled: true,
        refreshInterval: 600000,
        notifications: true // default value
      });
    });
  });

  describe('Rate Limit Persistence', () => {
    it('should persist rate limit status to database', async () => {
      // Mock the rate limit API response
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            platform: 'github',
            lastUpdated: Date.now(),
            dataFresh: true,
            status: 'normal',
            limits: {
              github: {
                core: {
                  limit: 5000,
                  remaining: 4999,
                  used: 1,
                  usagePercent: 0.02,
                  resetTime: Date.now() + 3600000,
                  retryAfter: null
                }
              }
            }
          })
        } as Response)
      );

      // Fetch rate limit status (this triggers persistence)
      const status = await getRateLimitStatus('github');

      // Verify status was returned
      expect(status).toBeDefined();
      expect(status?.status).toBe('normal');

      // Verify it was persisted to database
      const persisted = await db.select().from(rateLimits).where(eq(rateLimits.platform, 'github'));
      expect(persisted.length).toBe(1);
      expect(persisted[0].limitTotal).toBe(5000);
      expect(persisted[0].limitRemaining).toBe(4999);
    });

    it('should load persisted rate limits on startup', async () => {
      // Pre-populate database with rate limit data
      const testData = {
        id: 'github:global',
        platform: 'github',
        limitRemaining: 4500,
        limitTotal: 5000,
        resetTime: Date.now() + 1800000,
        lastUpdated: Date.now() - 300000 // 5 minutes ago
      };

      await db.insert(rateLimits).values(testData);

      // Mock failed API call to force loading persisted data
      global.fetch = vi.fn(() => Promise.reject(new Error('API unavailable')));

      // Try to get rate limit status (should return persisted data)
      const status = await getRateLimitStatus('github');

      // Should return persisted data since API failed
      expect(status).toBeDefined();
      expect(status?.limits.github?.core.remaining).toBe(4500);
      expect(status?.limits.github?.core.limit).toBe(5000);
      expect(status?.dataFresh).toBeFalsy(); // Data from persistence isn't fresh
    });

    it('should handle platforms without specific limits gracefully', async () => {
      // Pre-populate with GitLab data (which has global limits)
      await db.insert(rateLimits).values({
        id: 'gitlab:global',
        platform: 'gitlab',
        limitRemaining: null,
        limitTotal: null,
        resetTime: Date.now() + 900000,
        lastUpdated: Date.now()
      });

      // Mock failed API call
      global.fetch = vi.fn(() => Promise.reject(new Error('API unavailable')));

      const status = await getRateLimitStatus('gitlab');
      expect(status).toBeDefined();
      expect(status?.platform).toBe('gitlab');
    });
  });

  describe('Database Backup and Recovery', () => {
    it('should create and list backups successfully', async () => {
      // Pre-populate database with some test data
      await db.insert(toolConfigs).values({
        toolName: 'test-tool',
        enabled: true,
        config: { test: true },
        updatedAt: Date.now()
      });

      // Create backup
      const backupResult = await createBackup();
      expect(backupResult.success).toBe(true);
      expect(backupResult.backupPath).toContain('hyperpage-backup-');
      expect(backupResult.size).toBeGreaterThan(0);

      // List backups
      const backups = await listBackups();
      expect(backups.length).toBe(1);
      expect(backups[0].filename).toBe(path.basename(backupResult.backupPath));
      expect(backups[0].recordCounts.toolConfigs).toBe(1);
    });

    it('should validate backup file integrity', async () => {
      // Create test backup
      const backupResult = await createBackup();

      // Validate backup
      const validation = await validateBackup(backupResult.backupPath);
      expect(validation.valid).toBe(true);
      expect(validation.message).toContain('valid and intact');
    });

    it('should restore from backup successfully', async () => {
      // Pre-populate with some data
      await db.insert(jobs).values({
        id: 'test-job-1',
        type: 'test',
        name: 'Test Job',
        priority: 1,
        status: 'completed',
        payload: '{"test": true}',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        startedAt: Date.now(),
        completedAt: Date.now(),
        persistedAt: Date.now()
      });

      // Create backup
      const backupResult = await createBackup();
      expect(backupResult.success).toBe(true);

      // Modify current database
      await db.delete(jobs);
      const jobCountBeforeRestore = await db.$count(jobs);
      expect(jobCountBeforeRestore).toBe(0);

      // Restore from backup
      const restoreResult = await restoreBackup(backupResult.backupPath);
      expect(restoreResult.success).toBe(true);

      // Reconnect to database and verify data is restored
      await initializeDatabase();
      const jobCountAfterRestore = await db.$count(jobs);
      expect(jobCountAfterRestore).toBe(1);
    });

    it('should handle backup creation errors gracefully', async () => {
      // Mock fs error
      const originalCopy = fs.copyFile;
      fs.copyFile = vi.fn(() => Promise.reject(new Error('Disk full')));

      const result = await createBackup();
      expect(result.success).toBe(false);
      expect(result.backupPath).toBe('');
      expect(result.size).toBe(0);

      // Restore original function
      fs.copyFile = originalCopy;
    });
  });

  describe('Cross-System Integration', () => {
    it('should maintain data consistency across configuration and cache systems', async () => {
      // Configure multiple tools
      await saveToolConfiguration('github', {
        enabled: true,
        refreshInterval: 300000
      });
      await saveToolConfiguration('gitlab', {
        enabled: false,
        refreshInterval: 600000,
        notifications: false
      });

      // Create backup
      const backupResult = await createBackup();

      // Clear current state
      await db.delete(toolConfigs);
      const configCount = await db.$count(toolConfigs);
      expect(configCount).toBe(0);

      // Restore from backup
      await restoreBackup(backupResult.backupPath);

      // Reinitialize and verify configurations are restored
      await initializeDatabase();

      const githubConfig = await getToolConfiguration('github');
      const gitlabConfig = await getToolConfiguration('gitlab');

      expect(githubConfig).toMatchObject({
        enabled: true,
        refreshInterval: 300000,
        notifications: true
      });
      expect(gitlabConfig).toMatchObject({
        enabled: false,
        refreshInterval: 600000,
        notifications: false
      });
    });

    it('should handle startup sequence correctly', async () => {
      // Simulate application startup sequence
      await closeDatabase();

      // Pre-populate backup database
      await initializeDatabase();
      await saveToolConfiguration('startup-test', {
        enabled: true,
        refreshInterval: 150000,
        notifications: false
      });

      // Create backup during "running" state
      const backupResult = await createBackup();

      // Simulate application crash/shutdown
      await closeDatabase();

      // Simulate application startup and restore
      await restoreBackup(backupResult.backupPath);
      await initializeDatabase();

      // Verify system is in correct state after restore
      const config = await getToolConfiguration('startup-test');
      expect(config).toMatchObject({
        enabled: true,
        refreshInterval: 150000,
        notifications: false
      });

      // Verify tool registry integration works
      const tool = toolRegistry['startup-test'];
      expect(tool?.enabled).toBe(true);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle database corruption during restore', async () => {
      // Create valid backup
      const backupResult = await createBackup();

      // Corrupt the backup file
      const corruptedData = Buffer.from('corrupted data');
      await fs.writeFile(backupResult.backupPath, corruptedData);

      // Attempt restore (should fail gracefully)
      const restoreResult = await restoreBackup(backupResult.backupPath);
      expect(restoreResult.success).toBe(false);
    });

    it('should fallback to previous state when restore fails', async () => {
      // Create initial database state
      await db.insert(toolConfigs).values({
        toolName: 'fallback-test',
        enabled: true,
        updatedAt: Date.now()
      });

      // Attempt restore with invalid backup path
      const restoreResult = await restoreBackup('/invalid/path');
      expect(restoreResult.success).toBe(false);

      // Verify original data is still accessible
      const configs = await db.select().from(toolConfigs);
      expect(configs.length).toBe(1);
      expect(configs[0].toolName).toBe('fallback-test');
    });

    it('should handle concurrent backup operations', async () => {
      // Create multiple concurrent backup operations
      const backupPromises = Array(3).fill(null).map(() => createBackup());

      const results = await Promise.allSettled(backupPromises);

      // At least one backup should succeed
      const successfulBackups = results.filter(result =>
        result.status === 'fulfilled' && result.value.success
      );
      expect(successfulBackups.length).toBeGreaterThan(0);

      // Verify backups are properly isolated
      const backups = await listBackups();
      expect(backups.length).toBeGreaterThanOrEqual(1);
    });
  });
});
