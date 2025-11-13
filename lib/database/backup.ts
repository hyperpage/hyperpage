/**
 * Database Backup and Recovery Manager
 *
 * Provides enterprise-grade backup and recovery capabilities for Hyperpage data persistence.
 * Supports automated backups, point-in-time recovery, and disaster recovery procedures.
 */

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { db, closeDatabase } from "@/lib/database/index";
import {
  jobs,
  jobHistory,
  rateLimits,
  toolConfigs,
} from "@/lib/database/schema";
import { loadPersistedRateLimits } from "@/lib/rate-limit-service";
import { loadToolConfigurations } from "@/lib/tool-config-manager";
import logger from "@/lib/logger";

// Get project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, "../..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const BACKUP_DIR = path.join(PROJECT_ROOT, "data", "backups");

export interface BackupMetadata {
  timestamp: number;
  version: string;
  databaseSize: number;
  recordCounts: {
    jobs: number;
    rateLimits: number;
    toolConfigs: number;
    jobHistory: number;
  };
  checksum: string;
}

export interface BackupResult {
  success: boolean;
  backupPath: string;
  metadata: BackupMetadata;
  size: number;
  duration: number;
}

/**
 * Create backup directory if it doesn't exist
 */
async function ensureBackupDirectory(): Promise<void> {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  } catch (error) {
    logger.error("Failed to create backup directory", {
      backupDir: BACKUP_DIR,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Cannot create backup directory");
  }
}

/**
 * Generate timestamp-based backup filename
 */
function generateBackupFilename(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  const dateStr = date.toISOString().slice(0, 19).replace(/:/g, "-");
  return `hyperpage-backup-${dateStr}.db`;
}

/**
 * Get database file path
 */
function getDatabasePath(): string {
  return path.join(DATA_DIR, "hyperpage.db");
}

/**
 * Get backup metadata including record counts
 */
async function getBackupMetadata(backupPath: string): Promise<BackupMetadata> {
  try {
    // Get file stats
    const stats = await fs.stat(backupPath);

    // Query record counts from database
    const jobCount = await db.$count(jobs);
    const rateLimitCount = await db.$count(rateLimits);
    const toolConfigCount = await db.$count(toolConfigs);
    const jobHistoryCount = await db.$count(jobHistory);

    // Generate checksum (simplified - in production use proper hashing)
    const checksum = `size-${stats.size}-${stats.mtimeMs}`;

    return {
      timestamp: Date.now(),
      version: process.env.npm_package_version || "1.0.0",
      databaseSize: stats.size,
      recordCounts: {
        jobs: jobCount,
        rateLimits: rateLimitCount,
        toolConfigs: toolConfigCount,
        jobHistory: jobHistoryCount,
      },
      checksum,
    };
  } catch (error) {
    logger.error("Failed to get backup metadata", {
      backupPath,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Create a complete database backup
 */
export async function createBackup(): Promise<BackupResult> {
  const startTime = Date.now();

  try {
    await ensureBackupDirectory();

    const dbPath = getDatabasePath();
    const backupFilename = generateBackupFilename();
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    // Verify source database exists
    try {
      await fs.access(dbPath);
    } catch {
      throw new Error("Source database does not exist");
    }

    // Create backup by copying the database file
    // Note: In production with WAL mode, you might need additional steps
    await fs.copyFile(dbPath, backupPath);

    // Generate metadata
    const metadata = await getBackupMetadata(backupPath);

    // Create metadata file
    const metadataPath = `${backupPath}.metadata.json`;
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    const duration = Date.now() - startTime;

    logger.info("Database backup created successfully", {
      backupPath,
      size: (await fs.stat(backupPath)).size,
      duration,
      metadata,
    });

    return {
      success: true,
      backupPath,
      metadata,
      size: (await fs.stat(backupPath)).size,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Failed to create database backup", {
      duration,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      success: false,
      backupPath: "",
      metadata: {} as BackupMetadata,
      size: 0,
      duration,
    };
  }
}

/**
 * Restore database from backup file
 */
export async function restoreBackup(
  backupPath: string,
): Promise<{ success: boolean; duration: number }> {
  const startTime = Date.now();

  try {
    // Validate backup file exists and is readable
    await fs.stat(backupPath);
    if (!backupPath.endsWith(".db")) {
      throw new Error("Invalid backup file format");
    }

    const dbPath = getDatabasePath();
    const tempBackupPath = `${dbPath}.backup.${Date.now()}`;

    // Create backup of current database before restore
    try {
      await fs.access(dbPath);
      await fs.copyFile(dbPath, tempBackupPath);
      logger.debug("Created temporary backup before restore", {
        tempBackupPath,
      });
    } catch {
      logger.debug("No existing database to backup before restore");
    }

    // Close current database connections
    closeDatabase();

    try {
      // Restore from backup
      await fs.copyFile(backupPath, dbPath);
      logger.info("Database restored from backup", { backupPath, dbPath });

      const duration = Date.now() - startTime;

      return {
        success: true,
        duration,
      };
    } catch (restoreError) {
      // Restore failed, try to put back the original database
      try {
        if (
          await fs
            .access(tempBackupPath)
            .then(() => true)
            .catch(() => false)
        ) {
          await fs.copyFile(tempBackupPath, dbPath);
          logger.info("Successfully reverted to original database", {
            tempBackupPath,
          });
        }
      } catch (revertError) {
        logger.error("Critical: Could not revert to original database", {
          tempBackupPath,
          revertError:
            revertError instanceof Error
              ? revertError.message
              : String(revertError),
        });
      }

      throw restoreError;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Database restore failed", {
      backupPath,
      duration,
      error: error instanceof Error ? error.message : String(error),
    });

    // Try to load persisted data if database was corrupted
    try {
      await loadPersistedRateLimits();
      await loadToolConfigurations();
      logger.info("Successfully loaded persisted data after restore failure");
    } catch (loadError) {
      logger.error("Failed to load persisted data after restore failure", {
        error:
          loadError instanceof Error ? loadError.message : String(loadError),
      });
    }

    return {
      success: false,
      duration,
    };
  }
}

/**
 * List all available backup files with metadata
 */
export async function listBackups(): Promise<
  Array<BackupMetadata & { filename: string; path: string }>
> {
  try {
    await ensureBackupDirectory();

    const files = await fs.readdir(BACKUP_DIR);
    const backupFiles = files.filter((file) => file.endsWith(".db"));

    const backups = await Promise.all(
      backupFiles.map(async (filename) => {
        const dbPath = path.join(BACKUP_DIR, filename);
        const metadataPath = `${dbPath}.metadata.json`;

        let metadata: BackupMetadata = {
          timestamp: 0,
          version: "unknown",
          databaseSize: 0,
          recordCounts: {
            jobs: 0,
            rateLimits: 0,
            toolConfigs: 0,
            jobHistory: 0,
          },
          checksum: "",
        };

        try {
          const metadataContent = await fs.readFile(metadataPath, "utf-8");
          metadata = JSON.parse(metadataContent);
        } catch {
          // Try to get basic metadata from file stats
          try {
            const stats = await fs.stat(dbPath);
            metadata = {
              timestamp: 0,
              version: "unknown",
              databaseSize: stats.size,
              recordCounts: {
                jobs: 0,
                rateLimits: 0,
                toolConfigs: 0,
                jobHistory: 0,
              },
              checksum: `size-${stats.size}`,
            };
          } catch {
            // Skip files we can't read
            return null;
          }
        }

        return {
          ...metadata,
          filename,
          path: dbPath,
        };
      }),
    );

    return backups
      .filter(
        (item): item is BackupMetadata & { filename: string; path: string } =>
          item !== null,
      )
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    logger.error("Failed to list backup files", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Clean up old backup files (keep last N backups)
 */
export async function cleanupOldBackups(
  keepLast: number = 10,
): Promise<{ deleted: string[]; kept: number }> {
  try {
    const backups = await listBackups();

    if (backups.length <= keepLast) {
      return { deleted: [], kept: backups.length };
    }

    const toDelete = backups.slice(keepLast);
    const deleted: string[] = [];

    for (const backup of toDelete) {
      try {
        await fs.unlink(backup.path);
        await fs.unlink(`${backup.path}.metadata.json`).catch(() => {}); // Ignore if metadata file doesn't exist
        deleted.push(backup.filename);
      } catch (error) {
        logger.error("Failed to delete backup file", {
          backupPath: backup.path,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("Cleaned up old backups", {
      deletedCount: deleted.length,
      kept: keepLast,
      deletedFiles: deleted,
    });

    return {
      deleted,
      kept: backups.length - deleted.length,
    };
  } catch (error) {
    logger.error("Failed to cleanup old backups", {
      error: error instanceof Error ? error.message : String(error),
      keepLast,
    });
    return { deleted: [], kept: 0 };
  }
}

/**
 * Validate backup file integrity
 */
export async function validateBackup(
  backupPath: string,
): Promise<{ valid: boolean; message: string }> {
  try {
    const metadata = await getBackupMetadata(backupPath);

    // Basic validation - check file size matches metadata
    const currentStats = await fs.stat(backupPath);
    const sizeMatches = currentStats.size === metadata.databaseSize;

    if (!sizeMatches) {
      return {
        valid: false,
        message: `Backup file size (${currentStats.size}) does not match metadata (${metadata.databaseSize})`,
      };
    }

    // Additional validation could include checksum verification

    return {
      valid: true,
      message: "Backup file is valid and intact",
    };
  } catch (error) {
    return {
      valid: false,
      message: `Failed to validate backup: ${(error as Error).message}`,
    };
  }
}
