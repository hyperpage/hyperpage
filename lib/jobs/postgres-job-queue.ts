import { randomUUID } from "crypto";

import logger from "@/lib/logger";
import {
  getJobRepository,
  type JobRepository,
  type NormalizedJob,
} from "@/lib/database/job-repository";
import {
  JobPriority,
  JobStatus,
  type IJob,
} from "@/lib/types/jobs";

/**
 * Postgres-backed Job Queue facade.
 *
 * - Uses PostgresJobRepository as the canonical store.
 * - Provides a minimal enqueue/getActiveJobs/updateStatus API for durable tracking.
 * - Execution of jobs is still handled in-process by existing workers/schedulers;
 *   this facade is focused on persistence + ID semantics.
 */

export class PostgresJobQueue {
  private readonly repo: JobRepository;

  constructor(repo?: JobRepository) {
    this.repo = repo ?? getJobRepository();
  }

  /**
   * Enqueue a job:
   * - Assigns a durable external id if not provided.
   * - Persists to Postgres via JobRepository.
   * - Returns the normalized job (no execution is performed here).
   */
  async enqueue(job: IJob): Promise<NormalizedJob> {
    const now = Date.now();
    const id = job.id || randomUUID();

    const normalized: NormalizedJob = {
      id,
      type: job.type,
      name: job.name ?? job.type,
      priority: job.priority ?? JobPriority.MEDIUM,
      status: job.status ?? JobStatus.PENDING,
      createdAt: job.createdAt ?? now,
      updatedAt: job.updatedAt ?? now,
      tool: job.tool,
      endpoint: job.endpoint,
      payload: job.payload ?? {},
      result: job.result,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      retryCount: job.retryCount ?? 0,
      executionHistory: job.executionHistory ?? [],
    };

    try {
      await this.repo.insert(normalized);

      logger.info("PostgresJobQueue: enqueued job", {
        id: normalized.id,
        type: normalized.type,
        name: normalized.name,
      });

      return normalized;
    } catch (error) {
      logger.error("PostgresJobQueue: failed to enqueue job", {
        error: error instanceof Error ? error.message : String(error),
        jobType: job.type,
      });
      throw new Error("Failed to enqueue job");
    }
  }

  /**
   * Load active jobs from Postgres.
   */
  async getActiveJobs(): Promise<NormalizedJob[]> {
    try {
      return await this.repo.loadActiveJobs();
    } catch (error) {
      logger.error("PostgresJobQueue: failed to load active jobs", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Update job status in Postgres.
   */
  async updateStatus(
    jobId: string,
    patch: {
      status: JobStatus;
      updatedAt?: number;
      startedAt?: number;
      completedAt?: number;
      result?: IJob["result"];
    },
  ): Promise<void> {
    const updatedAt = patch.updatedAt ?? Date.now();

    try {
      await this.repo.updateStatus(jobId, {
        status: patch.status,
        updatedAt,
        startedAt: patch.startedAt,
        completedAt: patch.completedAt,
        result: patch.result,
      });

      logger.debug("PostgresJobQueue: updated job status", {
        jobId,
        status: patch.status,
      });
    } catch (error) {
      logger.error("PostgresJobQueue: failed to update job status", {
        error: error instanceof Error ? error.message : String(error),
        jobId,
      });
      throw new Error("Failed to update job status");
    }
  }
}

/**
 * Default singleton instance used by API routes and services.
 */
let _defaultPostgresJobQueue: PostgresJobQueue | null = null;

export function getPostgresJobQueue(): PostgresJobQueue {
  if (_defaultPostgresJobQueue) {
    return _defaultPostgresJobQueue;
  }
  _defaultPostgresJobQueue = new PostgresJobQueue();
  return _defaultPostgresJobQueue;
}
