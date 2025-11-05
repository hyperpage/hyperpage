/**
 * Persistent job queue implementation for production deployments.
 *
 * Provides job queuing, prioritization, and execution tracking with SQLite persistence.
 * Jobs survive process restart and maintain state across deployments.
 * Uses priority queue (heap) for efficient job scheduling and database for persistence.
 */

import {
  IJobQueue,
  IJob,
  JobStatus,
  JobResult,
  JobPriority,
  JobType,
  JobError,
} from "../types/jobs";
import { db } from "../database";
import { jobs, Job, NewJob } from "../database/schema";
import { eq, and, inArray, lt } from "drizzle-orm";
import logger from "../logger";

/**
 * Priority queue implementation for job scheduling
 */
class PriorityQueue<T> {
  private heap: Array<{ item: T; priority: number }> = [];
  private priorities: Map<T, number> = new Map();

  /**
   * Add item to priority queue
   * @param item - Item to add
   * @param priority - Priority of the item (higher priority comes first)
   */
  enqueue(item: T, priority: number): void {
    this.heap.push({ item, priority });
    this.priorities.set(item, priority);
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * Remove and return highest priority item
   * @returns Highest priority item or undefined if empty
   */
  dequeue(): T | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) {
      const { item } = this.heap.pop()!;
      this.priorities.delete(item);
      return item;
    }

    const root = this.heap[0].item;
    const last = this.heap.pop()!;
    this.heap[0] = last;
    this.priorities.delete(root);
    this.sinkDown(0);
    return root;
  }

  /**
   * Look at highest priority item without removing it
   * @returns Highest priority item or undefined if empty
   */
  peek(): T | undefined {
    return this.heap.length > 0 ? this.heap[0].item : undefined;
  }

  /**
   * Remove specific item from queue
   * @param item - Item to remove
   * @returns true if item was found and removed
   */
  remove(item: T): boolean {
    const index = this.heap.findIndex((node) => node.item === item);
    if (index === -1) return false;

    this.swap(index, this.heap.length - 1);
    const removed = this.heap.pop()!;
    this.priorities.delete(removed.item);

    if (index < this.heap.length) {
      this.sinkDown(index);
      this.bubbleUp(index);
    }

    return true;
  }

  /**
   * Check if item exists in queue
   * @param item - Item to check
   * @returns true if item exists
   */
  has(item: T): boolean {
    return this.priorities.has(item);
  }

  /**
   * Get current size of queue
   */
  get size(): number {
    return this.heap.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * Clear all items from queue
   */
  clear(): void {
    this.heap.length = 0;
    this.priorities.clear();
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[parentIndex].priority >= this.heap[index].priority) break;
      this.swap(parentIndex, index);
      index = parentIndex;
    }
  }

  private sinkDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let largest = index;

      if (
        left < length &&
        this.heap[left].priority > this.heap[largest].priority
      ) {
        largest = left;
      }
      if (
        right < length &&
        this.heap[right].priority > this.heap[largest].priority
      ) {
        largest = right;
      }
      if (largest === index) break;

      this.swap(index, largest);
      index = largest;
    }
  }

  private swap(i: number, j: number): void {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }
}

/**
 * In-memory job queue implementation
 */
export class MemoryJobQueue implements IJobQueue {
  readonly id: string;
  readonly name: string;

  private jobs: Map<string, IJob> = new Map();
  private priorityQueue: PriorityQueue<IJob> = new PriorityQueue();
  private stats = {
    totalJobs: 0,
    pendingJobs: 0,
    runningJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    cancelledJobs: 0,
    avgExecutionTimeMs: 0,
  };
  private executionTimes: number[] = [];

  constructor(id: string = "memory-queue", name: string = "Memory Job Queue") {
    this.id = id;
    this.name = name;
  }

  /**
   * Add a job to the queue for execution
   */
  async enqueue(
    jobSpec: Omit<IJob, "status" | "createdAt" | "updatedAt" | "retryCount">,
  ): Promise<IJob> {
    const now = Date.now();
    const job: IJob = {
      ...jobSpec,
      status: JobStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
      payload: jobSpec.payload || {},
    };

    // Validate job has required fields
    this.validateJob(job);

    // Check for duplicate job ID (both in memory and database)
    if (this.jobs.has(job.id)) {
      throw new JobError(
        `Job with ID ${job.id} already exists`,
        "DUPLICATE_JOB_ID",
        job.id,
        false,
      );
    }

    // Check for duplicate job ID in database
    const existingJob = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, job.id))
      .limit(1);
    if (existingJob.length > 0) {
      throw new JobError(
        `Job with ID ${job.id} already exists in database`,
        "DUPLICATE_JOB_ID",
        job.id,
        false,
      );
    }

    // Persist job to database
    const dbJob: NewJob = {
      id: job.id,
      type: job.type,
      name: job.name,
      priority: job.priority,
      status: job.status,
      tool: job.tool ? JSON.stringify(job.tool) : undefined,
      endpoint: job.endpoint,
      payload: JSON.stringify(job.payload),
      result: job.result ? JSON.stringify(job.result) : undefined,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      startedAt: undefined,
      completedAt: undefined,
      retryCount: job.retryCount,
      persistedAt: Date.now(),
      recoveryAttempts: 0,
    };

    await db.insert(jobs).values(dbJob);

    // Add to in-memory structures
    this.jobs.set(job.id, job);
    this.priorityQueue.enqueue(job, job.priority);
    this.stats.totalJobs++;
    this.stats.pendingJobs++;

    return job;
  }

  /**
   * Remove and return the next job to execute based on priority
   */
  async dequeue(): Promise<IJob | undefined> {
    const job = this.priorityQueue.dequeue();
    if (!job) return undefined;

    // Update job status
    job.status = JobStatus.RUNNING;
    job.startedAt = Date.now();
    job.updatedAt = Date.now();
    this.jobs.set(job.id, job);

    // Update stats
    this.stats.pendingJobs--;
    this.stats.runningJobs++;

    return job;
  }

  /**
   * Peek at the next job without removing it from queue
   */
  async peek(): Promise<IJob | undefined> {
    // Find the highest priority pending job
    const nextJob = this.priorityQueue.peek();
    return nextJob;
  }

  /**
   * Cancel a job by ID
   */
  async cancel(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === JobStatus.PENDING) {
      this.priorityQueue.remove(job);
      this.stats.pendingJobs--;
    } else if (job.status === JobStatus.RUNNING) {
      this.stats.runningJobs--;
    }

    job.status = JobStatus.CANCELLED;
    job.updatedAt = Date.now();
    this.jobs.set(jobId, job);
    this.stats.cancelledJobs++;

    return true;
  }

  /**
   * Get job status by ID
   */
  async getJob(jobId: string): Promise<IJob | undefined> {
    return this.jobs.get(jobId);
  }

  /**
   * Update job status and result
   */
  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    result?: JobResult,
  ): Promise<IJob | undefined> {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    const oldStatus = job.status;
    const now = Date.now();
    job.status = status;
    job.updatedAt = now;

    if (result) {
      job.result = result;
    }

    // Persist status update to database
    const updateData: Partial<Job> = {
      status,
      updatedAt: now,
    };

    // Track completion timestamp and execution time for completed jobs
    if (status === JobStatus.COMPLETED) {
      job.completedAt = now;
      updateData.completedAt = now;

      // Track execution time if job was actually started
      if (job.startedAt) {
        const executionTime = now - job.startedAt;
        this.executionTimes.push(executionTime);
        this.stats.avgExecutionTimeMs =
          this.executionTimes.reduce((a, b) => a + b, 0) /
          this.executionTimes.length;
      }
    }

    // Persist result for completed/failed jobs
    if (
      result &&
      (status === JobStatus.COMPLETED || status === JobStatus.FAILED)
    ) {
      updateData.result = JSON.stringify(result);
    }

    // Update database with new status and result
    await db.update(jobs).set(updateData).where(eq(jobs.id, jobId));

    // Record job execution history (simplified for now - will be enhanced later)
    // TODO: Implement full job history tracking

    // Update stats based on status change
    this.updateJobStats(oldStatus, status);

    // Add to in-memory execution history
    if (!job.executionHistory) {
      job.executionHistory = [];
    }

    job.executionHistory.push({
      attempt: job.retryCount,
      status,
      error: result?.error?.message,
      timestamp: now,
    });

    return job;
  }

  /**
   * Load persisted jobs from database during application startup
   */
  async loadPersistedJobs(): Promise<number> {
    try {
      // Load all non-completed jobs from database
      const persistedJobs = await db
        .select()
        .from(jobs)
        .where(
          inArray(jobs.status, [
            JobStatus.PENDING,
            JobStatus.RUNNING,
            JobStatus.FAILED,
          ]),
        );

      let recoveredCount = 0;

      for (const dbJob of persistedJobs) {
        try {
          // Skip jobs with invalid data
          if (!dbJob.id || !dbJob.name) {
            logger.warn("Skipping job with missing required fields", {
              jobId: dbJob.id,
              jobName: dbJob.name,
              requiredFields: ["id", "name"],
            });
            continue;
          }

          // Convert database format to IJob interface with type assertions
          const job: IJob = {
            id: dbJob.id,
            type: dbJob.type as JobType,
            name: dbJob.name,
            priority: dbJob.priority as JobPriority,
            status: dbJob.status as JobStatus,
            createdAt: Number(dbJob.createdAt),
            updatedAt: Number(dbJob.updatedAt),
            tool: dbJob.tool ? JSON.parse(dbJob.tool) : undefined,
            endpoint: dbJob.endpoint || undefined,
            payload: JSON.parse(dbJob.payload) as Record<string, unknown>,
            result: dbJob.result
              ? (JSON.parse(dbJob.result) as JobResult)
              : undefined,
            startedAt: dbJob.startedAt ? Number(dbJob.startedAt) : undefined,
            completedAt: dbJob.completedAt
              ? Number(dbJob.completedAt)
              : undefined,
            retryCount: dbJob.retryCount,
            executionHistory: [],
          };

          // Add to in-memory structures
          this.jobs.set(job.id, job);

          // Re-queue pending jobs
          if (job.status === JobStatus.PENDING) {
            this.priorityQueue.enqueue(job, job.priority);
          }

          // Update recovery stats
          this.stats.totalJobs++;
          switch (job.status) {
            case JobStatus.PENDING:
              this.stats.pendingJobs++;
              break;
            case JobStatus.RUNNING:
              this.stats.runningJobs++;
              break;
            case JobStatus.FAILED:
              this.stats.failedJobs++;
              break;
          }

          recoveredCount++;
        } catch (error) {
          logger.error("Failed to process individual job during recovery", {
            jobId: dbJob.id,
            jobName: dbJob.name,
            error: error instanceof Error ? error.message : String(error),
          });
          continue;
        }
      }

      logger.info("Successfully recovered jobs from database", {
        recoveredCount,
        totalJobs: this.stats.totalJobs,
        pendingJobs: this.stats.pendingJobs,
        runningJobs: this.stats.runningJobs,
        failedJobs: this.stats.failedJobs,
      });
      return recoveredCount;
    } catch (error) {
      logger.error("Failed to load persisted jobs from database", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Cleanup old completed jobs from database to prevent unbounded growth
   */
  async cleanupOldJobs(retentionDays: number = 30): Promise<number> {
    try {
      const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

      // Count jobs to be deleted first
      const countToDelete = await db.$count(
        jobs,
        and(
          eq(jobs.status, JobStatus.COMPLETED),
          lt(jobs.completedAt, cutoffTime),
        ),
      );

      // Delete completed jobs older than retention period
      await db
        .delete(jobs)
        .where(
          and(
            eq(jobs.status, JobStatus.COMPLETED),
            lt(jobs.completedAt, cutoffTime),
          ),
        );

      logger.info("Successfully cleaned up old jobs from database", {
        countDeleted: countToDelete,
        retentionDays,
        cutoffTime,
      });
      return countToDelete;
    } catch (error) {
      logger.error("Failed to cleanup old jobs from database", {
        retentionDays,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    totalJobs: number;
    pendingJobs: number;
    runningJobs: number;
    completedJobs: number;
    failedJobs: number;
    avgExecutionTimeMs?: number;
  }> {
    return { ...this.stats };
  }

  /**
   * Clear all jobs from the queue
   */
  async clear(): Promise<number> {
    const jobCount = this.jobs.size;
    this.jobs.clear();
    this.priorityQueue.clear();

    // Reset stats but keep execution time tracking
    this.stats = {
      totalJobs: 0,
      pendingJobs: 0,
      runningJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      cancelledJobs: 0,
      avgExecutionTimeMs: this.stats.avgExecutionTimeMs,
    };

    return jobCount;
  }

  /**
   * Validate job has required fields
   */
  private validateJob(job: IJob): void {
    if (!job.id || typeof job.id !== "string") {
      throw new JobError(
        "Job must have a valid string ID",
        "INVALID_JOB_ID",
        job.id || "unknown",
        false,
      );
    }

    if (!job.name || typeof job.name !== "string") {
      throw new JobError(
        "Job must have a valid string name",
        "INVALID_JOB_NAME",
        job.id,
        false,
      );
    }

    if (!Object.values(JobPriority).includes(job.priority)) {
      throw new JobError(
        "Job must have a valid priority",
        "INVALID_PRIORITY",
        job.id,
        false,
      );
    }

    if (!Object.values(JobType).includes(job.type)) {
      throw new JobError(
        "Job must have a valid type",
        "INVALID_JOB_TYPE",
        job.id,
        false,
      );
    }
  }

  /**
   * Update queue stats based on job status change
   */
  private updateJobStats(oldStatus: JobStatus, newStatus: JobStatus): void {
    // Count transition from old status
    switch (oldStatus) {
      case JobStatus.PENDING:
        this.stats.pendingJobs--;
        break;
      case JobStatus.RUNNING:
        this.stats.runningJobs--;
        break;
    }

    // Count transition to new status
    switch (newStatus) {
      case JobStatus.PENDING:
        this.stats.pendingJobs++;
        break;
      case JobStatus.RUNNING:
        this.stats.runningJobs++;
        break;
      case JobStatus.COMPLETED:
        this.stats.completedJobs++;
        break;
      case JobStatus.FAILED:
        this.stats.failedJobs++;
        break;
      case JobStatus.CANCELLED:
        this.stats.cancelledJobs++;
        break;
    }
  }
}

/**
 * Default memory job queue instance
 */
export const defaultMemoryQueue = new MemoryJobQueue();

/**
 * Generate a unique job ID
 */
export function generateJobId(prefix?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix || "job"}-${timestamp}-${random}`;
}
