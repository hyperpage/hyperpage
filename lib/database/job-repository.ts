import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import logger from "@/lib/logger";
import { IJob, JobStatus, JobPriority } from "@/lib/types/jobs";
import * as pgSchema from "@/lib/database/pg-schema";
import { getReadWriteDb } from "@/lib/database/connection";

/**
 * Normalized view of a job as used by the queue and services.
 * For now this is identical to IJob.
 */
export type NormalizedJob = IJob;

/**
 * Repository contract for job persistence.
 * Mirrors existing MemoryJobQueue semantics.
 *
 * NOTE:
 * - Implementations are engine-specific (SQLite/Postgres).
 * - Callers should depend only on this interface + getJobRepository().
 */
export interface JobRepository {
  insert(job: NormalizedJob): Promise<void>;
  exists(jobId: string): Promise<boolean>;
  loadActiveJobs(): Promise<NormalizedJob[]>;
  updateStatus(
    jobId: string,
    update: {
      status: JobStatus;
      updatedAt: number;
      startedAt?: number;
      completedAt?: number;
      result?: IJob["result"];
    },
  ): Promise<void>;
  cleanupCompletedBefore(cutoffTime: number): Promise<number>;
}

/**
 * PostgreSQL-backed JobRepository implementation.
 *
 * Uses pgSchema.jobs and pgSchema.jobHistory.
 * This is intentionally minimal and focused on parity with legacy semantics
 * for the JobRepository interface.
 *
 * Query shapes are constructed exclusively via QueryAdapter, so tests may
 * inject a fake adapter + FakePgDb without depending on drizzle internals.
 */

/**
 * Tagged query helpers used by PostgresJobRepository.
 *
 * In production we still build real drizzle query expressions.
 * In tests, we can replace these helpers with fakes that emit tagged objects
 * understood by a FakePgDb harness without parsing drizzle ASTs.
 */

type PgWhere =
  | ReturnType<typeof sql>
  | ReturnType<typeof and>
  | ReturnType<typeof eq>
  | ReturnType<typeof lt>
  | ReturnType<typeof inArray>;

/**
 * QueryAdapter defines the minimal hooks PostgresJobRepository uses to build
 * WHERE and JOIN conditions. The default adapter is implemented with drizzle's
 * helpers; tests can inject an alternative adapter that returns tagged objects.
 */
interface QueryAdapter {
  externalIdEquals(detailsJson: typeof pgSchema.jobHistory.details, externalId: string): PgWhere;
  hasExternalId(detailsJson: typeof pgSchema.jobHistory.details): PgWhere;
  activeStatuses(statusColumn: typeof pgSchema.jobs.status): PgWhere;
  jobIdEquals(idColumn: typeof pgSchema.jobs.id, jobPk: bigint): PgWhere;
  completedBefore(
    statusColumn: typeof pgSchema.jobs.status,
    completedAtColumn: typeof pgSchema.jobs.completedAt,
    cutoff: Date,
  ): PgWhere;
}

/**
 * Default adapter using real drizzle-orm helpers.
 */
const defaultQueryAdapter: QueryAdapter = {
  externalIdEquals(detailsJson, externalId) {
    return sql`(${detailsJson} ->> 'externalId') = ${externalId}`;
  },
  hasExternalId(detailsJson) {
    return sql`${detailsJson} ? 'externalId'`;
  },
  activeStatuses(statusColumn) {
    return inArray(statusColumn, [
      JobStatus.PENDING,
      JobStatus.RUNNING,
      JobStatus.FAILED,
    ]);
  },
  jobIdEquals(idColumn, jobPk) {
    return eq(idColumn, jobPk);
  },
  completedBefore(statusColumn, completedAtColumn, cutoff) {
    return and(
      eq(statusColumn, JobStatus.COMPLETED),
      lt(completedAtColumn, cutoff),
    );
  },
};

class PostgresJobRepository implements JobRepository {
  constructor(
    private readonly db: NodePgDatabase<typeof pgSchema>,
    private readonly adapter: QueryAdapter = defaultQueryAdapter,
  ) {}

  async insert(job: NormalizedJob): Promise<void> {
    // Insert core job row; use bigint id as internal identifier.
    const [inserted] = await this.db
      .insert(pgSchema.jobs)
      .values({
        type: job.type,
        payload: job.payload ?? {},
        status: job.status,
        scheduledAt: new Date(job.createdAt),
        startedAt: job.startedAt ? new Date(job.startedAt) : null,
        completedAt: job.completedAt ? new Date(job.completedAt) : null,
        attempts: job.retryCount,
        lastError:
          job.result && job.result.error
            ? (job.result.error.message ?? null)
            : null,
        createdAt: new Date(job.createdAt),
        updatedAt: new Date(job.updatedAt),
      } as typeof pgSchema.jobs.$inferInsert)
      .returning({ id: pgSchema.jobs.id });

    const jobPk = inserted?.id;
    if (!jobPk) {
      logger.error("PostgresJobRepository.insert: missing inserted job id", {
        externalId: job.id,
      });
      return;
    }

    // Persist mapping and metadata into job_history:
    // - externalId: original string job.id
    // - name/priority/tool/endpoint for recovery and semantics
    await this.db.insert(pgSchema.jobHistory).values({
      jobId: jobPk,
      status: job.status,
      details: {
        externalId: job.id,
        name: job.name,
        priority: job.priority,
        tool: job.tool ?? null,
        endpoint: job.endpoint ?? null,
      },
      createdAt: new Date(job.createdAt),
    } as typeof pgSchema.jobHistory.$inferInsert);
  }

  async exists(jobId: string): Promise<boolean> {
    // Look up via job_history.details.externalId to avoid brittle bigint heuristics.
    const rows = await this.db
      .select({ id: pgSchema.jobHistory.id })
      .from(pgSchema.jobHistory)
      .where(
        this.adapter.externalIdEquals(pgSchema.jobHistory.details, jobId),
      )
      .limit(1);

    return rows.length > 0;
  }

  async loadActiveJobs(): Promise<NormalizedJob[]> {
    // Join jobs with the earliest history row that contains externalId metadata.
    const rows = await this.db
      .select({
        jobId: pgSchema.jobs.id,
        type: pgSchema.jobs.type,
        payload: pgSchema.jobs.payload,
        status: pgSchema.jobs.status,
        scheduledAt: pgSchema.jobs.scheduledAt,
        startedAt: pgSchema.jobs.startedAt,
        completedAt: pgSchema.jobs.completedAt,
        attempts: pgSchema.jobs.attempts,
        lastError: pgSchema.jobs.lastError,
        createdAt: pgSchema.jobs.createdAt,
        updatedAt: pgSchema.jobs.updatedAt,
        historyDetails: pgSchema.jobHistory.details,
      })
      .from(pgSchema.jobs)
      .leftJoin(
        pgSchema.jobHistory,
        and(
          eq(pgSchema.jobHistory.jobId, pgSchema.jobs.id),
          this.adapter.hasExternalId(pgSchema.jobHistory.details),
        ),
      )
      .where(this.adapter.activeStatuses(pgSchema.jobs.status));

    const normalized: NormalizedJob[] = [];

    for (const row of rows) {
      try {
        if (!row.jobId || !row.type) {
          logger.warn("Skipping Postgres job with missing required fields", {
            jobId: row.jobId,
            jobType: row.type,
          });
          continue;
        }

        const details = (row.historyDetails || {}) as {
          externalId?: string;
          name?: string;
          priority?: JobPriority;
          tool?: unknown;
          endpoint?: string | null;
        };

        const externalId = details.externalId || String(row.jobId);
        const name = details.name || row.type;
        const priority =
          typeof details.priority === "number"
            ? details.priority
            : JobPriority.MEDIUM;

        normalized.push({
          id: externalId,
          type: row.type as NormalizedJob["type"],
          name,
          priority,
          status: row.status as JobStatus,
          createdAt: row.createdAt
            ? new Date(row.createdAt as Date).getTime()
            : Date.now(),
          updatedAt: row.updatedAt
            ? new Date(row.updatedAt as Date).getTime()
            : Date.now(),
          tool: details.tool as NormalizedJob["tool"],
          endpoint: details.endpoint ?? undefined,
          payload: (row.payload || {}) as Record<string, unknown>,
          result: row.lastError
            ? ({
                error: { message: row.lastError },
              } as IJob["result"])
            : undefined,
          startedAt: row.startedAt
            ? new Date(row.startedAt as Date).getTime()
            : undefined,
          completedAt: row.completedAt
            ? new Date(row.completedAt as Date).getTime()
            : undefined,
          retryCount: typeof row.attempts === "number" ? row.attempts : 0,
          executionHistory: [],
        });
      } catch (error) {
        logger.error("Failed to process Postgres job row during recovery", {
          jobId: row.jobId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return normalized;
  }

  async updateStatus(
    jobId: string,
    update: {
      status: JobStatus;
      updatedAt: number;
      startedAt?: number;
      completedAt?: number;
      result?: IJob["result"];
    },
  ): Promise<void> {
    const patch: Partial<typeof pgSchema.jobs.$inferInsert> = {
      status: update.status,
      updatedAt: new Date(update.updatedAt),
    };

    if (update.startedAt !== undefined) {
      patch.startedAt = new Date(update.startedAt);
    }

    if (update.completedAt !== undefined) {
      patch.completedAt = new Date(update.completedAt);
    }

    if (
      update.result &&
      (update.status === JobStatus.COMPLETED ||
        update.status === JobStatus.FAILED)
    ) {
      patch.lastError = update.result.error?.message ?? null;
    }

    // Resolve internal job PK via job_history externalId mapping.
    const rows = await this.db
      .select({ jobId: pgSchema.jobHistory.jobId })
      .from(pgSchema.jobHistory)
      .where(
        this.adapter.externalIdEquals(pgSchema.jobHistory.details, jobId),
      )
      .limit(1);

    const jobPk = rows[0]?.jobId;
    if (!jobPk) {
      logger.warn(
        "Skipping Postgres job status update; no job_history mapping for externalId",
        { jobId },
      );
      return;
    }

    await this.db
      .update(pgSchema.jobs)
      .set(patch)
      .where(this.adapter.jobIdEquals(pgSchema.jobs.id, jobPk));

    // Append history entry for this status change.
    await this.db.insert(pgSchema.jobHistory).values({
      jobId: jobPk,
      status: update.status,
      details: {
        externalId: jobId,
        result: update.result ?? null,
      },
      createdAt: new Date(update.updatedAt),
    } as typeof pgSchema.jobHistory.$inferInsert);
  }

  async cleanupCompletedBefore(cutoffTime: number): Promise<number> {
    try {
      const cutoffDate = new Date(cutoffTime);

      const deleted = await this.db
        .delete(pgSchema.jobs)
        .where(
          this.adapter.completedBefore(
            pgSchema.jobs.status,
            pgSchema.jobs.completedAt,
            cutoffDate,
          ),
        );

      const maybe = deleted as { rowsAffected?: number } | undefined;
      return typeof maybe?.rowsAffected === "number" ? maybe.rowsAffected : 0;
    } catch (error) {
      logger.error("Failed to cleanup old jobs from Postgres database", {
        cutoffTime,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }
}

let _jobRepository: JobRepository | null = null;

/**
 * Returns a singleton PostgreSQL-backed JobRepository.
 */
export function getJobRepository(): JobRepository {
  if (_jobRepository) {
    return _jobRepository;
  }

  const db = getReadWriteDb() as NodePgDatabase<typeof pgSchema>;
  _jobRepository = new PostgresJobRepository(db);

  return _jobRepository;
}
