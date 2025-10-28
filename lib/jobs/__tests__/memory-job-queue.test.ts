/**
 * Memory Job Queue Tests
 *
 * Tests for the in-memory job queue implementation focusing on:
 * - Job enqueue/dequeue operations
 * - Priority-based scheduling
 * - Job status management
 * - Queue statistics and monitoring
 * - Error handling and validation
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { MemoryJobQueue } from '../memory-job-queue';
import { JobStatus, JobPriority, JobType } from '../../types/jobs';
import { generateJobId } from '../memory-job-queue';
import { initializeDatabase, closeDatabase } from '../../database';

describe('Memory Job Queue', () => {
  let queue: MemoryJobQueue;

  beforeAll(async () => {
    // Initialize database before tests
    await initializeDatabase();
  });

  afterAll(() => {
    // Close database after tests
    closeDatabase();
  });

  beforeEach(() => {
    queue = new MemoryJobQueue('test-queue', 'Test Job Queue');
  });

  afterEach(async () => {
    await queue.clear();
  });

  describe('Queue Initialization', () => {
    it('should create a queue with specified ID and name', () => {
      const customQueue = new MemoryJobQueue('custom-id', 'Custom Name');
      expect(customQueue.id).toBe('custom-id');
      expect(customQueue.name).toBe('Custom Name');
    });

    it('should create a queue with default values', () => {
      expect(queue.id).toBe('test-queue');
      expect(queue.name).toBe('Test Job Queue');
    });
  });

  describe('Job Enqueue', () => {
    it('should enqueue a valid job', async () => {
      const jobSpec = {
        id: generateJobId('test'),
        type: JobType.DATA_REFRESH,
        name: 'Test Data Refresh',
        priority: JobPriority.MEDIUM
      };

      const job = await queue.enqueue(jobSpec);

      expect(job).toBeDefined();
      expect(job.id).toBe(jobSpec.id);
      expect(job.type).toBe(JobType.DATA_REFRESH);
      expect(job.status).toBe(JobStatus.PENDING);
    });

    it('should validate job fields', async () => {
      const invalidJobSpec = {
        id: '',
        type: JobType.DATA_REFRESH,
        name: 'Invalid Job',
        priority: JobPriority.LOW
      };

      await expect(queue.enqueue(invalidJobSpec)).rejects.toThrow();
    });

    it('should reject duplicate job IDs', async () => {
      const jobSpec = {
        id: 'duplicate-job',
        type: JobType.CACHE_WARM,
        name: 'Cache Warming Job',
        priority: JobPriority.LOW
      };

      await queue.enqueue(jobSpec);
      await expect(queue.enqueue(jobSpec)).rejects.toThrow('already exists');
    });
  });

  describe('Job Dequeue', () => {
    it('should dequeue jobs by priority (highest first)', async () => {
      const lowJob = await queue.enqueue({
        id: generateJobId('low'),
        type: JobType.MAINTENANCE,
        name: 'Low Priority Job',
        priority: JobPriority.LOW
      });

      const highJob = await queue.enqueue({
        id: generateJobId('high'),
        type: JobType.RATE_LIMIT_UPDATE,
        name: 'High Priority Job',
        priority: JobPriority.HIGH
      });

      const criticalJob = await queue.enqueue({
        id: generateJobId('critical'),
        type: JobType.USER_OPERATION,
        name: 'Critical Job',
        priority: JobPriority.CRITICAL
      });

      // Dequeue should return highest priority first
      const firstDequeued = await queue.dequeue();
      expect(firstDequeued?.id).toBe(criticalJob.id);

      const secondDequeued = await queue.dequeue();
      expect(secondDequeued?.id).toBe(highJob.id);

      const thirdDequeued = await queue.dequeue();
      expect(thirdDequeued?.id).toBe(lowJob.id);
    });

    it('should update job status when dequeued', async () => {
      const jobSpec = {
        id: generateJobId('status-test'),
        type: JobType.CACHE_INVALIDATION,
        name: 'Status Test Job',
        priority: JobPriority.MEDIUM
      };

      await queue.enqueue(jobSpec);

      const dequeued = await queue.dequeue();
      expect(dequeued?.status).toBe(JobStatus.RUNNING);
      expect(dequeued?.startedAt).toBeDefined();
    });

    it('should return undefined when queue is empty', async () => {
      const result = await queue.dequeue();
      expect(result).toBeUndefined();
    });
  });

  describe('Job Peek', () => {
    it('should peek at the next job without removing it', async () => {
      const job = await queue.enqueue({
        id: generateJobId('peek-test'),
        type: JobType.CACHE_WARM,
        name: 'Peek Test',
        priority: JobPriority.MEDIUM
      });

      const peeked = await queue.peek();
      expect(peeked?.id).toBe(job.id);

      // Job should still be in queue
      expect(await queue.peek()).toBeDefined();
    });

    it('should return undefined when queue is empty', async () => {
      const result = await queue.peek();
      expect(result).toBeUndefined();
    });
  });

  describe('Job Cancellation', () => {
    it('should cancel a pending job', async () => {
      const job = await queue.enqueue({
        id: generateJobId('cancel-test'),
        type: JobType.DATA_REFRESH,
        name: 'Cancel Test',
        priority: JobPriority.MEDIUM
      });

      const cancelled = await queue.cancel(job.id);
      expect(cancelled).toBe(true);

      const jobInfo = await queue.getJob(job.id);
      expect(jobInfo?.status).toBe(JobStatus.CANCELLED);
    });

    it('should return false for non-existent job ID', async () => {
      const result = await queue.cancel('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Job Status Updates', () => {
    it('should update job status and result', async () => {
      const job = await queue.enqueue({
        id: generateJobId('status-update'),
        type: JobType.CACHE_WARM,
        name: 'Status Update Test',
        priority: JobPriority.MEDIUM
      });

      const result = {
        success: true,
        metadata: { itemsProcessed: 42 }
      };

      const updatedJob = await queue.updateJobStatus(job.id, JobStatus.COMPLETED, result);

      expect(updatedJob?.status).toBe(JobStatus.COMPLETED);
      expect(updatedJob?.result).toEqual(result);
      expect(updatedJob?.completedAt).toBeDefined();
      expect(updatedJob?.updatedAt).toBeDefined();
    });
  });

  describe('Queue Statistics', () => {
    it('should track job counts correctly', async () => {
      expect((await queue.getStats()).totalJobs).toBe(0);

      await queue.enqueue({
        id: generateJobId('stat-test-1'),
        type: JobType.DATA_REFRESH,
        name: 'Stat Test 1',
        priority: JobPriority.LOW
      });

      await queue.enqueue({
        id: generateJobId('stat-test-2'),
        type: JobType.CACHE_WARM,
        name: 'Stat Test 2',
        priority: JobPriority.MEDIUM
      });

      expect((await queue.getStats()).totalJobs).toBe(2);
      expect((await queue.getStats()).pendingJobs).toBe(2);

      await queue.dequeue();
      expect((await queue.getStats()).pendingJobs).toBe(1);
      expect((await queue.getStats()).runningJobs).toBe(1);

      await queue.clear();
      expect((await queue.getStats()).totalJobs).toBe(0);
    });
  });

  describe('Queue Operations', () => {
    it('should clear all jobs from queue', async () => {
      await queue.enqueue({
        id: generateJobId('clear-test-1'),
        type: JobType.DATA_REFRESH,
        name: 'Clear Test 1',
        priority: JobPriority.LOW
      });

      await queue.enqueue({
        id: generateJobId('clear-test-2'),
        type: JobType.CACHE_WARM,
        name: 'Clear Test 2',
        priority: JobPriority.LOW
      });

      const clearedCount = await queue.clear();
      expect(clearedCount).toBe(2);

      const stats = await queue.getStats();
      expect(stats.totalJobs).toBe(0);
    });

    it('should handle concurrent enqueue operations', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(queue.enqueue({
          id: generateJobId(`concurrent-${i}`),
          type: JobType.MAINTENANCE,
          name: `Concurrent Job ${i}`,
          priority: JobPriority.MEDIUM
        }));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);

      const stats = await queue.getStats();
      expect(stats.totalJobs).toBe(10);
    });
  });
});
