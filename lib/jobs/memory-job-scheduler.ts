/**
 * In-memory job scheduler implementation for development and small-scale deployments.
 *
 * Provides scheduled job execution with recurring intervals and due-time handling.
 * Uses setTimeout/setInterval for scheduling (not persisted across restarts).
 */

import {
  IJobScheduler,
  IJob,
  JobPriority,
  JobStatus,
  JobType,
} from '../types/jobs';

interface ScheduledJob {
  job: IJob;
  timerId?: NodeJS.Timeout;
  intervalId?: NodeJS.Timeout;
}

/**
 * In-memory job scheduler implementation
 */
export class MemoryJobScheduler implements IJobScheduler {
  readonly id: string;

  private jobs: Map<string, ScheduledJob> = new Map();
  private running: boolean = false;
  private checkInterval?: NodeJS.Timeout;

  constructor(id: string = 'memory-scheduler') {
    this.id = id;
  }

  /**
   * Schedule a job for future execution
   */
  async schedule(jobSpec: Omit<IJob, 'status' | 'createdAt' | 'updatedAt' | 'retryCount'>): Promise<IJob> {
    const now = Date.now();
    const job: IJob = {
      ...jobSpec,
      status: JobStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
    };

    // Validate job has scheduling configuration
    this.validateScheduledJob(job);

    // Check for duplicate job ID
    if (this.jobs.has(job.id)) {
      throw new Error(`Scheduled job with ID ${job.id} already exists`);
    }

    const scheduledJob: ScheduledJob = {
      job,
    };

    // Schedule immediate execution if due time is in the past
    if (job.schedule?.scheduledAt && job.schedule.scheduledAt <= now) {
      scheduledJob.timerId = setTimeout(() => this.executeImmediate(job), 0) as NodeJS.Timeout;
    } else if (job.schedule?.scheduledAt) {
      // Schedule for future execution
      const delay = job.schedule.scheduledAt - now;
      if (delay > 0) {
        scheduledJob.timerId = setTimeout(() => this.executeImmediate(job), delay) as NodeJS.Timeout;
      }
    }

    // Set up recurring execution if interval is specified
    if (job.schedule?.intervalMs) {
      scheduledJob.intervalId = setInterval(() => {
        const updatedJob = { ...job };
        updatedJob.id = `${job.id}-${Date.now()}`; // Unique ID for recurrence
        this.executeImmediate(updatedJob);
      }, job.schedule.intervalMs) as NodeJS.Timeout;

      // Clear the interval after max recurrences if specified
      if (job.schedule.maxRecurrences) {
        let executionCount = 0;
        const originalInterval = scheduledJob.intervalId;

        // Replace interval with one that tracks recurrences
        scheduledJob.intervalId = setInterval(() => {
          executionCount++;
          const updatedJob = { ...job };
          updatedJob.id = `${job.id}-${Date.now()}`;
          this.executeImmediate(updatedJob);

          // Clear after max recurrences
          if (executionCount >= job.schedule!.maxRecurrences!) {
            clearInterval(originalInterval!);
            clearInterval(scheduledJob.intervalId!);
            this.jobs.delete(job.id);
          }
        }, job.schedule.intervalMs) as NodeJS.Timeout;
      }
    }

    this.jobs.set(job.id, scheduledJob);
    return job;
  }

  /**
   * Cancel a scheduled job
   */
  async unschedule(jobId: string): Promise<boolean> {
    const scheduledJob = this.jobs.get(jobId);
    if (!scheduledJob) return false;

    // Clear timers
    if (scheduledJob.timerId) {
      clearTimeout(scheduledJob.timerId as NodeJS.Timeout);
    }
    if (scheduledJob.intervalId) {
      clearInterval(scheduledJob.intervalId as NodeJS.Timeout);
    }

    this.jobs.delete(jobId);
    return true;
  }

  /**
   * Get jobs that are due for execution immediately
   */
  async getDueJobs(): Promise<IJob[]> {
    const now = Date.now();
    const dueJobs: IJob[] = [];

    for (const [, scheduledJob] of this.jobs.entries()) {
      const job = scheduledJob.job;

      // Check if job is scheduled and due
      if (job.schedule?.scheduledAt && job.schedule.scheduledAt <= now) {
        dueJobs.push(job);
      }

      // For recurring jobs, check if they're due based on interval
      // (recurring jobs are handled by setInterval, so we don't need to track them here)
    }

    return dueJobs;
  }

  /**
   * Get all scheduled jobs
   */
  async getScheduledJobs(): Promise<IJob[]> {
    return Array.from(this.jobs.values()).map(scheduledJob => scheduledJob.job);
  }

  /**
   * Start the scheduler - begin processing scheduled jobs
   */
  start(): () => void {
    if (this.running) {
      throw new Error('Scheduler is already running');
    }

    this.running = true;

    // Check for due jobs every second
    this.checkInterval = setInterval(() => {
      this.checkAndExecuteDueJobs();
    }, 1000);

    // Cleanup function
    return () => {
      this.stop();
    };
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;

    // Clear all scheduled jobs
    for (const [, scheduledJob] of this.jobs.entries()) {
      if (scheduledJob.timerId) {
        clearTimeout(scheduledJob.timerId);
      }
      if (scheduledJob.intervalId) {
        clearInterval(scheduledJob.intervalId);
      }
    }

    // Clear check interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }

    this.jobs.clear();
  }

  /**
   * Execute a job immediately (for due jobs)
   */
  private async executeImmediate(job: IJob): Promise<void> {
    try {
      // Update job status to running
      job.status = JobStatus.RUNNING;
      job.startedAt = Date.now();
      job.updatedAt = Date.now();

      // Here would be the job execution logic
      // In a real implementation, this would delegate to a job processor
      console.log(`Executing scheduled job: ${job.name} (${job.id})`);

      // Simulate job execution (in real implementation, this would call a job processor)
      await this.executeJob(job);

    } catch (error) {
      console.error(`Failed to execute scheduled job ${job.id}:`, error);

      // Mark job as failed
      job.status = JobStatus.FAILED;
      job.updatedAt = Date.now();
      job.executionHistory = job.executionHistory || [];
      job.executionHistory.push({
        attempt: job.retryCount,
        status: JobStatus.FAILED,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Check for and execute due jobs
   */
  private async checkAndExecuteDueJobs(): Promise<void> {
    if (!this.running) return;

    const dueJobs = await this.getDueJobs();

    for (const job of dueJobs) {
      // Remove from scheduled jobs (one-time execution)
      if (job.schedule?.intervalMs) {
        // Recurring jobs are handled by their intervals, so skip here
        continue;
      }

      this.jobs.delete(job.id);
      this.executeImmediate(job);
    }
  }

  /**
   * Placeholder for job execution logic
   * In a real implementation, this would delegate to registered job processors
   */
  private async executeJob(job: IJob): Promise<void> {
    // Simulate job execution time
    const executionTime = Math.random() * 1000 + 500; // 500-1500ms
    await new Promise(resolve => setTimeout(resolve, executionTime));

    // Mark as completed
    job.status = JobStatus.COMPLETED;
    job.completedAt = Date.now();
    job.updatedAt = Date.now();
    job.result = {
      success: true,
      metadata: {
        executionTimeMs: executionTime,
      },
    };

    job.executionHistory = job.executionHistory || [];
    job.executionHistory.push({
      attempt: job.retryCount,
      status: JobStatus.COMPLETED,
      timestamp: Date.now(),
    });

    console.log(`Completed scheduled job: ${job.name} (${job.id}) in ${executionTime.toFixed(0)}ms`);
  }

  /**
   * Validate scheduled job has required scheduling configuration
   */
  private validateScheduledJob(job: IJob): void {
    if (!job.id || typeof job.id !== 'string') {
      throw new Error('Scheduled job must have a valid string ID');
    }

    if (!job.name || typeof job.name !== 'string') {
      throw new Error('Scheduled job must have a valid string name');
    }

    if (!Object.values(JobPriority).includes(job.priority)) {
      throw new Error('Scheduled job must have a valid priority');
    }

    if (!Object.values(JobType).includes(job.type)) {
      throw new Error('Scheduled job must have a valid type');
    }

    // Check scheduling configuration
    const schedule = job.schedule;
    if (!schedule) {
      throw new Error('Job must have scheduling configuration to be scheduled');
    }

    // Must have either a scheduledAt time or intervalMs for recurring jobs
    if (!schedule.scheduledAt && !schedule.intervalMs) {
      throw new Error('Job must have either scheduledAt or intervalMs in schedule configuration');
    }

    if (schedule.scheduledAt && (typeof schedule.scheduledAt !== 'number' || schedule.scheduledAt < 0)) {
      throw new Error('scheduledAt must be a valid positive timestamp');
    }

    if (schedule.intervalMs && (typeof schedule.intervalMs !== 'number' || schedule.intervalMs <= 0)) {
      throw new Error('intervalMs must be a positive number');
    }

    if (schedule.maxRecurrences && (typeof schedule.maxRecurrences !== 'number' || schedule.maxRecurrences <= 0)) {
      throw new Error('maxRecurrences must be a positive number');
    }
  }
}

/**
 * Default memory job scheduler instance
 */
export const defaultMemoryScheduler = new MemoryJobScheduler();
