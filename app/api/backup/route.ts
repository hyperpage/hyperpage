/**
 * Database Backup and Recovery API
 *
 * Provides REST endpoints for enterprise-grade backup and recovery operations.
 * Supports automated backups, restore from backup, listing backups, and validation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createBackup, restoreBackup, listBackups, cleanupOldBackups, validateBackup } from '../../../lib/database/backup.js';

/**
 * GET /api/backup - List all available backups with metadata
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const backups = await listBackups();

    return NextResponse.json({
      success: true,
      backups: backups.map(backup => ({
        filename: backup.filename,
        path: backup.path,
        timestamp: backup.timestamp,
        version: backup.version,
        databaseSize: backup.databaseSize,
        recordCounts: backup.recordCounts,
        createdAt: new Date(backup.timestamp).toISOString()
      }))
    });

  } catch (error) {
    console.error('Error listing backups:', error);
    return NextResponse.json({ error: 'Failed to list backups' }, { status: 500 });
  }
}

/**
 * POST /api/backup - Create a new database backup
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Optional cleanup parameter to cleanup old backups after creating new one
    const url = new URL(request.url);
    const cleanupOld = url.searchParams.get('cleanup');

    const result = await createBackup();

    if (!result.success) {
      return NextResponse.json({
        error: 'Failed to create backup',
        details: result
      }, { status: 500 });
    }

    // Optionally cleanup old backups
    let cleanupResult = null;
    if (cleanupOld === 'true') {
      cleanupResult = await cleanupOldBackups(10); // Keep last 10 backups
    }

    return NextResponse.json({
      success: true,
      message: 'Backup created successfully',
      backup: {
        path: result.backupPath,
        size: result.size,
        duration: result.duration,
        timestamp: result.metadata.timestamp,
        recordCounts: result.metadata.recordCounts
      },
      cleanup: cleanupResult
    });

  } catch (error) {
    console.error('Error creating backup:', error);
    return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 });
  }
}

/**
 * PUT /api/backup?path=/path/to/backup.db - Restore from backup file
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const backupPath = url.searchParams.get('path');

    if (!backupPath) {
      return NextResponse.json({
        error: 'Backup path is required. Use ?path=/path/to/backup.db'
      }, { status: 400 });
    }

    // Security: Validate that the backup path is within the backups directory
    if (!backupPath.includes('/backups/') && !backupPath.includes('\\backups\\')) {
      return NextResponse.json({
        error: 'Backup path must be within the backups directory'
      }, { status: 403 });
    }

    // First, validate the backup
    const validation = await validateBackup(backupPath);
    if (!validation.valid) {
      return NextResponse.json({
        error: 'Backup validation failed',
        details: validation.message
      }, { status: 400 });
    }

    // Perform the restore
    const result = await restoreBackup(backupPath);

    if (!result.success) {
      return NextResponse.json({
        error: 'Failed to restore from backup',
        duration: result.duration
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Database restored successfully from backup',
      backupPath,
      duration: result.duration
    });

  } catch (error) {
    console.error('Error restoring backup:', error);
    return NextResponse.json({ error: 'Failed to restore backup' }, { status: 500 });
  }
}

/**
 * DELETE /api/backup?cleanup=true&keep=10 - Cleanup old backups
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const cleanup = url.searchParams.get('cleanup');
    const keepLast = parseInt(url.searchParams.get('keep') || '10', 10);

    if (cleanup !== 'true') {
      return NextResponse.json({
        error: 'Use ?cleanup=true to cleanup old backups'
      }, { status: 400 });
    }

    if (keepLast < 1 || keepLast > 100) {
      return NextResponse.json({
        error: 'keep parameter must be between 1 and 100'
      }, { status: 400 });
    }

    const result = await cleanupOldBackups(keepLast);

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.deleted.length} old backups. Kept ${result.kept} most recent backups.`,
      deleted: result.deleted,
      kept: result.kept
    });

  } catch (error) {
    console.error('Error cleaning up backups:', error);
    return NextResponse.json({ error: 'Failed to cleanup backups' }, { status: 500 });
  }
}
