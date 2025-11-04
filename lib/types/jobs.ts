/**
 * Background Job Infrastructure Types
 *
 * Provides interfaces and types for background job scheduling,
 * execution, and management. Supports both immediate and scheduled jobs
 * with priority-based queuing and execution tracking.
 */

import { Tool } from "../../tools/tool-types";

/**
 * Job priority levels for scheduling and execution
 */
export enum JobPriority {
  LOW = 1, // Background data refresh, cache warming
  MEDIUM = 2, // Standard data updates, maintenance tasks
  HIGH = 3, // User-initiated refreshes, rate limit management
  CRITICAL = 4, // Emergency operations, immediate responses
}

/**
 * Job status enumeration for execution tracking
 */
export enum JobStatus {
  PENDING = "pending", // Job queued, waiting for execution
  RUNNING = "running", // Job currently executing
  COMPLETED = "completed", // Job finished successfully
  FAILED = "failed", // Job failed during execution
  CANCELLED = "cancelled", // Job was cancelled before completion
  TIMEOUT = "timeout", // Job exceeded time limit
}

/**
 * Job type enumeration for different job categories
 */
export enum JobType {
  CACHE_WARM = "cache_warm", // Pre-populate cache with hot data
  DATA_REFRESH = "data_refresh", // Refresh tool data from APIs
  CACHE_INVALIDATION = "cache_invalidation", // Clean stale cache entries
  RATE_LIMIT_UPDATE = "rate_limit_update", // Update rate limit status
  MAINTENANCE = "maintenance", // System maintenance tasks
  USER_OPERATION = "user_operation", // User-triggered operations
}

/**
 * Result of job execution
 */
export interface JobResult<T = unknown> {
  /** Whether the job execution was successful */
  success: boolean;
  /** Result data from successful execution */
  data?: T;
  /** Error information if execution failed */
  error?: Error;
  /** Execution metadata */
  metadata?: {
    /** Execution time in milliseconds */
    executionTimeMs?: number;
    /** Number of items processed */
    itemsProcessed?: number;
    /** API calls made during execution */
    apiCalls?: number;
    /** Cache operations performed */
    cacheOperations?: number;
  };
}

/**
 * Job specification and configuration
 */
export interface IJob<T = unknown> {
  /** Unique job identifier */
  id: string;
  /** Job category type */
  type: JobType;
  /** Human-readable job name */
  name: string;
  /** Priority level for scheduling */
  priority: JobPriority;
  /** Tool this job operates on (optional) */
  tool?: Omit<Tool, "handlers">;
  /** Specific endpoint this job targets (optional) */
  endpoint?: string;

  /** Job execution payload and configuration */
  payload?: {
    /** Job-specific data */
    data?: T;
    /** Execution timeout in milliseconds */
    timeoutMs?: number;
    /** Maximum retry attempts */
    maxRetries?: number;
    /** Dependencies that must complete before this job */
    dependencies?: string[];
    /** Tags for job filtering and grouping */
    tags?: string[];
  };

  /** Scheduling configuration */
  schedule?: {
    /** Scheduled execution time (timestamp) */
    scheduledAt?: number;
    /** Recurring interval in milliseconds */
    intervalMs?: number;
    /** Maximum number of recurrences */
    maxRecurrences?: number;
  };

  /** Execution tracking */
  status: JobStatus;
  /** Timestamp when job was created */
  createdAt: number;
  /** Timestamp when job was last updated */
  updatedAt: number;
  /** Timestamp when job started execution */
  startedAt?: number;
  /** Timestamp when job completed */
  completedAt?: number;

  /** Execution results and errors */
  result?: JobResult<T>;
  /** Number of retry attempts made */
  retryCount: number;
  /** Previous execution results for debugging */
  executionHistory?: Array<{
    attempt: number;
    status: JobStatus;
    error?: string;
    timestamp: number;
  }>;
}

/**
 * Job queue management interface
 */
export interface IJobQueue {
  /** Queue identifier */
  id: string;
  /** Human-readable queue name */
  name: string;

  /**
   * Add a job to the queue for execution
   * @param job - Job specification
   * @returns Promise resolving to the queued job
   */
  enqueue(
    job: Omit<
      IJob<unknown>,
      "status" | "createdAt" | "updatedAt" | "retryCount"
    >,
  ): Promise<IJob<unknown>>;
  enqueue(
    job: Omit<IJob, "status" | "createdAt" | "updatedAt" | "retryCount">,
  ): Promise<IJob>;

  /**
   * Remove and return the next job to execute based on priority
   * @returns Promise resolving to the next job or undefined if queue empty
   */
  dequeue(): Promise<IJob | undefined>;

  /**
   * Peek at the next job without removing it from queue
   * @returns Promise resolving to the next job or undefined if queue empty
   */
  peek(): Promise<IJob | undefined>;

  /**
   * Cancel a job by ID
   * @param jobId - Job identifier
   * @returns Promise resolving to success status
   */
  cancel(jobId: string): Promise<boolean>;

  /**
   * Get job status by ID
   * @param jobId - Job identifier
   * @returns Promise resolving to job or undefined if not found
   */
  getJob(jobId: string): Promise<IJob | undefined>;

  /**
   * Update job status and result
   * @param jobId - Job identifier
   * @param status - New job status
   * @param result - Optional execution result
   * @returns Promise resolving to updated job
   */
  updateJobStatus(
    jobId: string,
    status: JobStatus,
    result?: JobResult<unknown>,
  ): Promise<IJob | undefined>;

  /**
   * Get queue statistics
   * @returns Promise resolving to queue metrics
   */
  getStats(): Promise<{
    totalJobs: number;
    pendingJobs: number;
    runningJobs: number;
    completedJobs: number;
    failedJobs: number;
    avgExecutionTimeMs?: number;
  }>;

  /**
   * Clear all jobs from the queue
   * @returns Promise resolving to number of jobs removed
   */
  clear(): Promise<number>;
}

/**
 * Job scheduler interface for scheduled and recurring jobs
 */
export interface IJobScheduler {
  /** Scheduler identifier */
  id: string;

  /**
   * Schedule a job for future execution
   * @param job - Job specification with schedule configuration
   * @returns Promise resolving to scheduled job
   */
  schedule(
    job: Omit<
      IJob<unknown>,
      "status" | "createdAt" | "updatedAt" | "retryCount"
    >,
  ): Promise<IJob<unknown>>;

  /**
   * Cancel a scheduled job
   * @param jobId - Job identifier
   * @returns Promise resolving to success status
   */
  unschedule(jobId: string): Promise<boolean>;

  /**
   * Get due jobs that should be executed immediately
   * @returns Promise resolving to array of jobs ready for execution
   */
  getDueJobs(): Promise<IJob[]>;

  /**
   * Get scheduled jobs information
   * @returns Promise resolving to scheduled job details
   */
  getScheduledJobs(): Promise<IJob[]>;

  /**
   * Start the scheduler (begin processing scheduled jobs)
   * @returns Cleanup function
   */
  start(): () => void;

  /**
   * Stop the scheduler
   */
  stop(): Promise<void>;
}

/**
 * Job execution environment context
 */
export interface JobExecutionContext {
  /** Job being executed */
  job: IJob;
  /** Shared resources and utilities */
  resources: {
    /** Cache instance for data storage */
    cache?: unknown;
    /** Logger for job execution tracking */
    logger?: unknown;
    /** Rate limit monitor for API compliance */
    rateLimitMonitor?: unknown;
  };
  /** Execution timeout handle */
  timeout?: NodeJS.Timeout;
}

/**
 * Job processor function signature
 */
export type JobProcessor<T = unknown> = (
  context: JobExecutionContext,
) => Promise<JobResult<T>>;

/**
 * Job factory for creating job specifications
 */
export interface IJobFactory {
  /**
   * Create a cache warming job for a tool
   * @param tool - Target tool
   * @param endpoints - Specific endpoints to warm
   * @returns Job specification
   */
  createCacheWarmJob(
    tool: Omit<Tool, "handlers">,
    endpoints?: string[],
  ): Omit<IJob<unknown>, "status" | "createdAt" | "updatedAt" | "retryCount">;

  /**
   * Create a data refresh job for a tool
   * @param tool - Target tool
   * @param endpoints - Specific endpoints to refresh
   * @returns Job specification
   */
  createDataRefreshJob(
    tool: Omit<Tool, "handlers">,
    endpoints?: string[],
  ): Omit<IJob<unknown>, "status" | "createdAt" | "updatedAt" | "retryCount">;

  /**
   * Create a rate limit update job
   * @param platforms - Platforms to update
   * @returns Job specification
   */
  createRateLimitUpdateJob(
    platforms?: string[],
  ): Omit<IJob<unknown>, "status" | "createdAt" | "updatedAt" | "retryCount">;
}

/**
 * Job error wrapper for job execution failures
 */
export class JobError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly jobId: string,
    public readonly retryable: boolean = true,
  ) {
    super(message);
    this.name = "JobError";
  }
}

/**
 * Common job execution timeouts
 */
export const JOB_TIMEOUTS = {
  /** Quick operations (< 30 seconds) */
  QUICK: 30 * 1000,
  /** Standard operations (< 2 minutes) */
  STANDARD: 2 * 60 * 1000,
  /** Long operations (< 10 minutes) */
  LONG: 10 * 60 * 1000,
  /** Very long operations (< 30 minutes) */
  VERY_LONG: 30 * 60 * 1000,
} as const;

/**
 * Common job retry configurations
 */
export const JOB_RETRIES = {
  /** No retries for quick, reliable operations */
  NONE: { maxRetries: 0 },
  /** Limited retries for standard operations */
  LIMITED: { maxRetries: 3, delayMs: 1000 },
  /** Full retries for critical operations */
  FULL: { maxRetries: 5, delayMs: 2000 },
} as const;
