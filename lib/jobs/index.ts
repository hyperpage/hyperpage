/**
 * Background Job Infrastructure
 *
 * Exports all job-related components for easy access throughout the application.
 */

// Core types
export * from "../types/jobs";

/**
 * Core implementations
 *
 * - MemoryJobQueue and MemoryJobScheduler remain in-memory execution utilities.
 * - PostgresJobQueue is the canonical durable persistence layer for jobs.
 */
export {
  MemoryJobQueue,
  defaultMemoryQueue,
  generateJobId,
} from "./memory-job-queue";
export {
  MemoryJobScheduler,
  defaultMemoryScheduler,
} from "./memory-job-scheduler";
export { JobFactory, defaultJobFactory } from "./job-factory";
export { PostgresJobQueue, getPostgresJobQueue } from "./postgres-job-queue";

// Re-export interfaces
export type {
  IJob,
  IJobQueue,
  IJobScheduler,
  IJobFactory,
  JobResult,
  JobExecutionContext,
} from "../types/jobs";

/**
 * Job Infrastructure Overview
 *
 * ## Usage Examples
 *
 * ### Basic Job Creation
 * ```typescript
 * import { defaultJobFactory, defaultMemoryQueue } from '@/lib/jobs';
 *
 * // Create a cache warming job
 * const jobSpec = defaultJobFactory.createCacheWarmJob(tool, ['pull-requests']);
 *
 * // Enqueue for immediate execution
 * const job = await defaultMemoryQueue.enqueue(jobSpec);
 * ```
 *
 * ### Scheduled Jobs
 * ```typescript
 * import { defaultMemoryScheduler } from '@/lib/jobs';
 *
 * // Create recurring cache refresh job
 * const scheduledJob = await defaultMemoryScheduler.schedule({
 *   id: 'cache-refresh-daily',
 *   type: JobType.DATA_REFRESH,
 *   name: 'Daily Cache Refresh',
 *   priority: JobPriority.LOW,
 *   schedule: {
 *     intervalMs: 24 * 60 * 60 * 1000, // 24 hours
 *   },
 * });
 *
 * // Start scheduler
 * const cleanup = defaultMemoryScheduler.start();
 * ```
 *
 * ### Job Execution Context
 * ```typescript
 * // In job processors
 * const processor = (context: JobExecutionContext) => {
 *   const { job, resources } = context;
 *   const { cache, logger } = resources;
 *
 *   // Execute job logic using shared resources
 *   return await performJobLogic(job, cache, logger);
 * };
 * ```
 */
