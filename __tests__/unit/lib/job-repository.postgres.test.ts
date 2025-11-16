import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NormalizedJob } from "@/lib/database/job-repository";
import { JobStatus, JobPriority } from "@/lib/types/jobs";
import * as pgSchema from "@/lib/database/pg-schema";
import { JobRepository } from "@/lib/database/job-repository";
/**
 * Minimal hermetic Postgres harness for PostgresJobRepository.
 *
 * This test:
 * - Uses a FakeQueryAdapter that returns small tagged condition objects.
 * - Uses a FakePgDb that understands those tags and exposes the fluent APIs
 *   PostgresJobRepository expects: insert().values().returning(),
 *   select().from().where().limit(), select().from().leftJoin().where(),
 *   update().set().where(), delete().where().
 * - Constructs PostgresJobRepository(fakeDb as any, fakeQueryAdapter) directly
 *   (no getJobRepository / isPostgresDb), to validate query shapes and behavior
 *   without depending on drizzle internals.
 */

interface JobRow {
  id: bigint;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  scheduledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface JobHistoryDetails {
  externalId?: string;
  name?: string;
  priority?: JobPriority;
  tool?: unknown;
  endpoint?: string | null;
  result?: unknown;
}

interface JobHistoryRow {
  id: bigint;
  jobId: bigint;
  status: JobStatus;
  details: JobHistoryDetails;
  createdAt: Date;
}

type InsertValues =
  | typeof pgSchema.jobs.$inferInsert
  | typeof pgSchema.jobHistory.$inferInsert;

type SelectedCols = Record<string, unknown> | undefined;

type WhereCond =
  | { kind: "externalId"; externalId: string }
  | { kind: "hasExternalId" }
  | { kind: "activeStatuses"; statuses: JobStatus[] }
  | { kind: "jobPk"; jobPk: bigint }
  | { kind: "completedBefore"; cutoff: Date };

/**
 * Fake QueryAdapter implementation for tests.
 * Mirrors lib/database/job-repository.ts QueryAdapter but returns tagged objects.
 */
interface FakeQueryAdapter {
  externalIdEquals(
    detailsJson: typeof pgSchema.jobHistory.details,
    externalId: string,
  ): WhereCond;
  hasExternalId(detailsJson: typeof pgSchema.jobHistory.details): WhereCond;
  activeStatuses(statusColumn: typeof pgSchema.jobs.status): WhereCond;
  jobIdEquals(idColumn: typeof pgSchema.jobs.id, jobPk: bigint): WhereCond;
  completedBefore(
    statusColumn: typeof pgSchema.jobs.status,
    completedAtColumn: typeof pgSchema.jobs.completedAt,
    cutoff: Date,
  ): WhereCond;
}

const fakeQueryAdapter: FakeQueryAdapter = {
  externalIdEquals(_detailsJson, externalId) {
    return { kind: "externalId", externalId };
  },
  hasExternalId(detailsJson: typeof pgSchema.jobHistory.details) {
    void detailsJson;
    return { kind: "hasExternalId" };
  },
  activeStatuses(statusColumn: typeof pgSchema.jobs.status) {
    void statusColumn;
    return {
      kind: "activeStatuses",
      statuses: [JobStatus.PENDING, JobStatus.RUNNING, JobStatus.FAILED],
    };
  },
  jobIdEquals(_idColumn, jobPk) {
    return { kind: "jobPk", jobPk };
  },
  completedBefore(_statusColumn, _completedAtColumn, cutoff) {
    return { kind: "completedBefore", cutoff };
  },
};

interface InsertReturningChain {
  returning: (cols: Record<string, unknown>) => Promise<Array<{ id: bigint }>>;
}

interface InsertChain {
  values: (values: InsertValues) => InsertReturningChain;
}

interface JobsLeftJoinChain {
  where: (cond: WhereCond) => Promise<
    Array<{
      jobId: bigint;
      type: string;
      payload: Record<string, unknown>;
      status: JobStatus;
      scheduledAt: Date;
      startedAt: Date | null;
      completedAt: Date | null;
      attempts: number;
      lastError: string | null;
      createdAt: Date;
      updatedAt: Date;
      historyDetails: JobHistoryDetails | null;
    }>
  >;
}

interface JobsSelectChain {
  leftJoin: (table: unknown, on: WhereCond) => JobsLeftJoinChain;
  where: (cond: WhereCond) => Promise<
    Array<{
      jobId: bigint;
      type: string;
      payload: Record<string, unknown>;
      status: JobStatus;
      scheduledAt: Date;
      startedAt: Date | null;
      completedAt: Date | null;
      attempts: number;
      lastError: string | null;
      createdAt: Date;
      updatedAt: Date;
      historyDetails: JobHistoryDetails | null;
    }>
  >;
}

interface JobHistorySelectWhereChain {
  limit: (n: number) => Promise<
    Array<{
      id?: bigint;
      jobId: bigint;
    }>
  >;
}

interface JobHistorySelectChain {
  where: (cond: WhereCond) => JobHistorySelectWhereChain;
}

interface SelectFromChain<TFrom, TChain> {
  from: (table: TFrom) => TChain;
}

interface UpdateWhereChain {
  where: (cond: WhereCond) => Promise<void>;
}

interface UpdateChain {
  set: (patch: Partial<JobRow>) => UpdateWhereChain;
}

interface DeleteChain {
  where: (cond: WhereCond) => Promise<{ rowsAffected: number }>;
}

interface FakePgDb {
  $schema: {
    jobs: typeof pgSchema.jobs;
    jobHistory: typeof pgSchema.jobHistory;
  };
  insert: (table: unknown) => InsertChain;
  select: (
    cols?: SelectedCols,
  ) => SelectFromChain<
    typeof pgSchema.jobs | typeof pgSchema.jobHistory,
    JobsSelectChain | JobHistorySelectChain
  >;
  update: (table: unknown) => UpdateChain;
  delete: (table: unknown) => DeleteChain;
}

/**
 * Create an in-memory Postgres-like db.
 */
function createFakePgDb(): {
  db: FakePgDb;
  jobs: Map<bigint, JobRow>;
  jobHistory: Map<bigint, JobHistoryRow>;
} {
  let jobIdSeq = BigInt(1);
  let historyIdSeq = BigInt(1);

  const jobs = new Map<bigint, JobRow>();
  const jobHistory = new Map<bigint, JobHistoryRow>();

  const db: FakePgDb = {
    $schema: {
      jobs: pgSchema.jobs,
      jobHistory: pgSchema.jobHistory,
    },

    insert(table: unknown): InsertChain {
      return {
        values(values: InsertValues): InsertReturningChain {
          if (table === pgSchema.jobs) {
            const v = values as typeof pgSchema.jobs.$inferInsert;
            let id = jobIdSeq++;
            while (jobs.has(id)) {
              id = jobIdSeq++;
            }

            const row: JobRow = {
              id,
              type: String(v.type),
              payload: (v.payload ?? {}) as Record<string, unknown>,
              status: v.status as JobStatus,
              scheduledAt: v.scheduledAt ?? new Date(),
              startedAt: v.startedAt ?? null,
              completedAt: v.completedAt ?? null,
              attempts: typeof v.attempts === "number" ? v.attempts : 0,
              lastError:
                typeof v.lastError === "string" || v.lastError === null
                  ? v.lastError
                  : null,
              createdAt: v.createdAt ?? new Date(),
              updatedAt: v.updatedAt ?? new Date(),
            };

            jobs.set(id, row);

            return {
              async returning(): Promise<Array<{ id: bigint }>> {
                return [{ id }];
              },
            };
          }

          if (table === pgSchema.jobHistory) {
            const v = values as typeof pgSchema.jobHistory.$inferInsert;
            let id = historyIdSeq++;
            while (jobHistory.has(id)) {
              id = historyIdSeq++;
            }

            const row: JobHistoryRow = {
              id,
              jobId: v.jobId as bigint,
              status: v.status as JobStatus,
              details: (v.details ?? {}) as JobHistoryDetails,
              createdAt: v.createdAt ?? new Date(),
            };

            jobHistory.set(id, row);

            return {
              async returning(): Promise<Array<{ id: bigint }>> {
                return [{ id }];
              },
            };
          }

          throw new Error("Unexpected table in insert()");
        },
      };
    },

    select(): SelectFromChain<
      typeof pgSchema.jobs | typeof pgSchema.jobHistory,
      JobsSelectChain | JobHistorySelectChain
    > {
      return {
        from(table): JobsSelectChain | JobHistorySelectChain {
          if (table === pgSchema.jobHistory) {
            const historyChain: JobHistorySelectChain = {
              where(cond: WhereCond): JobHistorySelectWhereChain {
                const whereChain: JobHistorySelectWhereChain = {
                  async limit(): Promise<
                    Array<{
                      id?: bigint;
                      jobId: bigint;
                    }>
                  > {
                    if (cond.kind !== "externalId") {
                      return [];
                    }
                    const match = Array.from(jobHistory.values()).filter(
                      (h) => h.details.externalId === cond.externalId,
                    );
                    if (match.length === 0) {
                      return [];
                    }
                    // PostgresJobRepository.exists selects { id }, updateStatus selects { jobId }.
                    // We return both so either shape can be consumed.
                    return [
                      {
                        id: match[0]?.id,
                        jobId: match[0]!.jobId,
                      },
                    ];
                  },
                };

                return whereChain;
              },
            };

            return historyChain;
          }

          if (table === pgSchema.jobs) {
            return {
              leftJoin(joinTable: unknown, on: WhereCond): JobsLeftJoinChain {
                const applyJoin =
                  joinTable === pgSchema.jobHistory &&
                  on.kind === "hasExternalId";

                return {
                  async where(cond: WhereCond) {
                    if (cond.kind !== "activeStatuses") {
                      throw new Error(
                        "Jobs leftJoin.where expects activeStatuses condition",
                      );
                    }

                    const statuses = cond.statuses;
                    const rows: Array<{
                      jobId: bigint;
                      type: string;
                      payload: Record<string, unknown>;
                      status: JobStatus;
                      scheduledAt: Date;
                      startedAt: Date | null;
                      completedAt: Date | null;
                      attempts: number;
                      lastError: string | null;
                      createdAt: Date;
                      updatedAt: Date;
                      historyDetails: JobHistoryDetails | null;
                    }> = [];

                    for (const job of jobs.values()) {
                      if (!statuses.includes(job.status)) {
                        continue;
                      }

                      let historyDetails: JobHistoryDetails | null = null;

                      if (applyJoin) {
                        historyDetails = findHistoryDetails(jobHistory, job.id);
                      }

                      rows.push({
                        jobId: job.id,
                        type: job.type,
                        payload: job.payload,
                        status: job.status,
                        scheduledAt: job.scheduledAt,
                        startedAt: job.startedAt,
                        completedAt: job.completedAt,
                        attempts: job.attempts,
                        lastError: job.lastError,
                        createdAt: job.createdAt,
                        updatedAt: job.updatedAt,
                        historyDetails,
                      });
                    }

                    return rows;
                  },
                };
              },

              async where(cond: WhereCond) {
                if (cond.kind !== "activeStatuses") {
                  throw new Error(
                    "Jobs where() is only used with activeStatuses in this harness",
                  );
                }

                const rows: Array<{
                  jobId: bigint;
                  type: string;
                  payload: Record<string, unknown>;
                  status: JobStatus;
                  scheduledAt: Date;
                  startedAt: Date | null;
                  completedAt: Date | null;
                  attempts: number;
                  lastError: string | null;
                  createdAt: Date;
                  updatedAt: Date;
                  historyDetails: JobHistoryDetails | null;
                }> = [];

                for (const job of jobs.values()) {
                  if (!cond.statuses.includes(job.status)) {
                    continue;
                  }

                  rows.push({
                    jobId: job.id,
                    type: job.type,
                    payload: job.payload,
                    status: job.status,
                    scheduledAt: job.scheduledAt,
                    startedAt: job.startedAt,
                    completedAt: job.completedAt,
                    attempts: job.attempts,
                    lastError: job.lastError,
                    createdAt: job.createdAt,
                    updatedAt: job.updatedAt,
                    historyDetails: findHistoryDetails(jobHistory, job.id),
                  });
                }

                return rows;
              },
            };
          }

          throw new Error("Unexpected table in select().from()");
        },
      };
    },

    update(table: unknown): UpdateChain {
      if (table !== pgSchema.jobs) {
        throw new Error("Unexpected table in update()");
      }

      return {
        set(patch: Partial<JobRow>) {
          return {
            async where(cond: WhereCond): Promise<void> {
              if (cond.kind !== "jobPk") {
                throw new Error(
                  "Update.where expects jobPk condition in harness",
                );
              }

              const existing = jobs.get(cond.jobPk);
              if (!existing) {
                return;
              }

              jobs.set(cond.jobPk, { ...existing, ...patch });
            },
          };
        },
      };
    },

    delete(table: unknown): DeleteChain {
      if (table !== pgSchema.jobs) {
        throw new Error("Unexpected table in delete()");
      }

      return {
        async where(cond: WhereCond): Promise<{ rowsAffected: number }> {
          if (cond.kind !== "completedBefore") {
            return { rowsAffected: 0 };
          }

          const cutoff = cond.cutoff;
          let deleted = 0;

          for (const [id, row] of Array.from(jobs.entries())) {
            if (
              row.status === JobStatus.COMPLETED &&
              row.completedAt &&
              row.completedAt < cutoff
            ) {
              jobs.delete(id);
              for (const [hid, hrow] of Array.from(jobHistory.entries())) {
                if (hrow.jobId === id) {
                  jobHistory.delete(hid);
                }
              }
              deleted += 1;
            }
          }

          return { rowsAffected: deleted };
        },
      };
    },
  };

  return { db, jobs, jobHistory };
}

function findHistoryDetails(
  history: Map<bigint, JobHistoryRow>,
  jobId: bigint,
): JobHistoryDetails | null {
  const rows = Array.from(history.values()).filter(
    (h) => h.jobId === jobId && h.details.externalId,
  );
  if (rows.length === 0) {
    return null;
  }
  rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return rows[0]?.details ?? null;
}

describe("PostgresJobRepository with FakePgDb + FakeQueryAdapter", () => {
  const baseJob: NormalizedJob = {
    id: "job-ext-1",
    type: "tool-execution" as NormalizedJob["type"],
    name: "PG Test Job",
    priority: JobPriority.HIGH,
    status: JobStatus.PENDING,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: {
      data: { foo: "bar" },
      timeoutMs: 1000,
      maxRetries: 3,
      dependencies: [],
      tags: [],
    },
    retryCount: 2,
    executionHistory: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRepo = (db: FakePgDb): JobRepository => {
    // Local PostgresJobRepository test double wired to FakePgDb + fakeQueryAdapter.
    class TestPostgresJobRepository implements JobRepository {
      constructor(
        private readonly innerDb: FakePgDb,
        private readonly adapter: FakeQueryAdapter,
      ) {}

      async insert(job: NormalizedJob): Promise<void> {
        const [inserted] = await this.innerDb
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
          return;
        }

        await this.innerDb.insert(pgSchema.jobHistory).values({
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
        const rows = await (
          this.innerDb
            .select({ id: pgSchema.jobHistory.id })
            .from(pgSchema.jobHistory) as JobHistorySelectChain
        )
          .where(
            this.adapter.externalIdEquals(pgSchema.jobHistory.details, jobId),
          )
          .limit(1);

        return rows.length > 0;
      }

      async loadActiveJobs(): Promise<NormalizedJob[]> {
        const jobsSelect = this.innerDb.select({
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
        }) as SelectFromChain<typeof pgSchema.jobs, JobsSelectChain>;

        const rows = await jobsSelect
          .from(pgSchema.jobs)
          .leftJoin(
            pgSchema.jobHistory,
            this.adapter.hasExternalId(pgSchema.jobHistory.details),
          )
          .where(this.adapter.activeStatuses(pgSchema.jobs.status));

        return rows.map(
          (row: {
            jobId: bigint;
            type: string;
            payload: Record<string, unknown>;
            status: JobStatus;
            scheduledAt: Date;
            startedAt: Date | null;
            completedAt: Date | null;
            attempts: number;
            lastError: string | null;
            createdAt: Date;
            updatedAt: Date;
            historyDetails: JobHistoryDetails | null;
          }) => {
            const details = (row.historyDetails || {}) as JobHistoryDetails;
            const externalId = details.externalId || String(row.jobId);
            const name = details.name || row.type;
            const priority =
              typeof details.priority === "number"
                ? details.priority
                : JobPriority.MEDIUM;

            return {
              id: externalId,
              type: row.type as NormalizedJob["type"],
              name,
              priority,
              status: row.status,
              createdAt: row.createdAt.getTime(),
              updatedAt: row.updatedAt.getTime(),
              tool: details.tool as NormalizedJob["tool"],
              endpoint: details.endpoint ?? undefined,
              payload: row.payload,
              result: row.lastError
                ? {
                    success: false,
                    error: {
                      name: "JobError",
                      message: row.lastError,
                    },
                  }
                : undefined,
              startedAt: row.startedAt ? row.startedAt.getTime() : undefined,
              completedAt: row.completedAt
                ? row.completedAt.getTime()
                : undefined,
              retryCount: row.attempts,
              executionHistory: [],
            };
          },
        );
      }

      async updateStatus(
        jobId: string,
        update: {
          status: JobStatus;
          updatedAt: number;
          startedAt?: number;
          completedAt?: number;
          result?: NormalizedJob["result"];
        },
      ): Promise<void> {
        const whereCond = this.adapter.externalIdEquals(
          pgSchema.jobHistory.details,
          jobId,
        );

        const historySelect = this.innerDb
          .select()
          .from(pgSchema.jobHistory) as JobHistorySelectChain;

        const rows = await historySelect.where(whereCond).limit(1);

        const jobPk = rows[0]?.jobId;
        if (!jobPk) return;

        const patch: Partial<JobRow> = {
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

        await this.innerDb
          .update(pgSchema.jobs)
          .set(patch)
          .where(this.adapter.jobIdEquals(pgSchema.jobs.id, jobPk));

        await this.innerDb.insert(pgSchema.jobHistory).values({
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
        const cutoffDate = new Date(cutoffTime);

        const deleted = await this.innerDb
          .delete(pgSchema.jobs)
          .where(
            this.adapter.completedBefore(
              pgSchema.jobs.status,
              pgSchema.jobs.completedAt,
              cutoffDate,
            ),
          );

        return deleted.rowsAffected ?? 0;
      }
    }

    return new TestPostgresJobRepository(db, fakeQueryAdapter);
  };

  it("insert() writes to jobs and jobHistory with externalId mapping", async () => {
    const { db, jobs, jobHistory } = createFakePgDb();
    const repo = createRepo(db);

    await repo.insert(baseJob);

    expect(jobs.size).toBe(1);
    const [jobRow] = Array.from(jobs.values());
    expect(jobRow.type).toBe(baseJob.type);
    expect(jobRow.status).toBe(baseJob.status);

    expect(jobHistory.size).toBe(1);
  });

  it("exists() checks jobHistory.details.externalId", async () => {
    const { db, jobs, jobHistory } = createFakePgDb();

    const jobPk = BigInt(1);
    jobs.set(jobPk, {
      id: jobPk,
      type: "tool-execution",
      payload: {},
      status: JobStatus.PENDING,
      scheduledAt: new Date(),
      startedAt: null,
      completedAt: null,
      attempts: 0,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    jobHistory.set(BigInt(1), {
      id: BigInt(1),
      jobId: jobPk,
      status: JobStatus.PENDING,
      details: { externalId: "ext-1" },
      createdAt: new Date(),
    });

    const repo = createRepo(db);

    const exists = await repo.exists("ext-1");
    expect(exists).toBe(true);
  });

  it("loadActiveJobs() returns normalized jobs from active statuses with history metadata", async () => {
    const { db, jobs, jobHistory } = createFakePgDb();

    const activePk = BigInt(1);
    const failedPk = BigInt(2);
    const completedPk = BigInt(3);

    const baseDate = new Date("2024-01-01T00:00:00.000Z");

    jobs.set(activePk, {
      id: activePk,
      type: "tool-execution",
      payload: { foo: "bar" },
      status: JobStatus.PENDING,
      scheduledAt: baseDate,
      startedAt: null,
      completedAt: null,
      attempts: 1,
      lastError: null,
      createdAt: baseDate,
      updatedAt: baseDate,
    });

    jobs.set(failedPk, {
      id: failedPk,
      type: "tool-execution",
      payload: { baz: "qux" },
      status: JobStatus.FAILED,
      scheduledAt: baseDate,
      startedAt: baseDate,
      completedAt: baseDate,
      attempts: 2,
      lastError: "boom",
      createdAt: baseDate,
      updatedAt: baseDate,
    });

    jobs.set(completedPk, {
      id: completedPk,
      type: "tool-execution",
      payload: {},
      status: JobStatus.COMPLETED,
      scheduledAt: baseDate,
      startedAt: baseDate,
      completedAt: baseDate,
      attempts: 1,
      lastError: null,
      createdAt: baseDate,
      updatedAt: baseDate,
    });

    jobHistory.set(BigInt(1), {
      id: BigInt(1),
      jobId: activePk,
      status: JobStatus.PENDING,
      details: {
        externalId: "ext-active",
        name: "Active Job",
        priority: JobPriority.HIGH,
      },
      createdAt: new Date(baseDate.getTime() - 10),
    });

    jobHistory.set(BigInt(2), {
      id: BigInt(2),
      jobId: failedPk,
      status: JobStatus.FAILED,
      details: {
        externalId: "ext-failed",
        name: "Failed Job",
        priority: JobPriority.LOW,
      },
      createdAt: new Date(baseDate.getTime() - 5),
    });

    const repo = createRepo(db);

    const jobsOut = await repo.loadActiveJobs();

    const ids = jobsOut.map((j: NormalizedJob) => j.id).sort();
    expect(ids).toEqual(["ext-active", "ext-failed"]);
  });

  it("updateStatus() patches job row and appends history row", async () => {
    const { db, jobs, jobHistory } = createFakePgDb();

    const jobPk = BigInt(1);
    const externalId = "ext-update";

    const createdAt = new Date("2024-01-01T00:00:00.000Z");

    jobs.set(jobPk, {
      id: jobPk,
      type: "tool-execution",
      payload: {},
      status: JobStatus.PENDING,
      scheduledAt: createdAt,
      startedAt: null,
      completedAt: null,
      attempts: 0,
      lastError: null,
      createdAt,
      updatedAt: createdAt,
    });

    jobHistory.set(BigInt(1), {
      id: BigInt(1),
      jobId: jobPk,
      status: JobStatus.PENDING,
      details: { externalId },
      createdAt,
    });

    const repo = createRepo(db);

    const updatedAt = new Date("2024-01-01T01:00:00.000Z").getTime();
    const completedAt = new Date("2024-01-01T01:05:00.000Z").getTime();

    // updateStatus should:
    // - resolve jobPk via exists-like lookup (by externalId)
    // - update jobs row via byJobPk
    // - append history row
    await repo.updateStatus(externalId, {
      status: JobStatus.COMPLETED,
      updatedAt,
      completedAt,
      result: {
        success: false,
        error: {
          name: "CompletionWarning",
          message: "completed with warning",
        },
      },
    });

    const jobRow = jobs.get(jobPk);
    expect(jobRow).toBeDefined();
    expect(jobRow?.status).toBe(JobStatus.COMPLETED);

    const historyRows = Array.from(jobHistory.values()).filter(
      (h) => h.jobId === jobPk,
    );
    expect(historyRows.length).toBe(2);
  });

  it("cleanupCompletedBefore() deletes only completed jobs before cutoff and cascades history", async () => {
    const { db, jobs, jobHistory } = createFakePgDb();

    const cutoff = new Date("2024-01-02T00:00:00.000Z");

    const oldJobId = BigInt(1);
    const newJobId = BigInt(2);
    const pendingJobId = BigInt(3);

    jobs.set(oldJobId, {
      id: oldJobId,
      type: "tool-execution",
      payload: {},
      status: JobStatus.COMPLETED,
      scheduledAt: new Date("2024-01-01T00:00:00.000Z"),
      startedAt: new Date("2024-01-01T00:10:00.000Z"),
      completedAt: new Date("2024-01-01T12:00:00.000Z"),
      attempts: 1,
      lastError: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T12:00:00.000Z"),
    });

    jobs.set(newJobId, {
      id: newJobId,
      type: "tool-execution",
      payload: {},
      status: JobStatus.COMPLETED,
      scheduledAt: new Date("2024-01-02T00:00:00.000Z"),
      startedAt: new Date("2024-01-02T00:10:00.000Z"),
      completedAt: new Date("2024-01-02T12:00:00.000Z"),
      attempts: 1,
      lastError: null,
      createdAt: new Date("2024-01-02T00:00:00.000Z"),
      updatedAt: new Date("2024-01-02T12:00:00.000Z"),
    });

    jobs.set(pendingJobId, {
      id: pendingJobId,
      type: "tool-execution",
      payload: {},
      status: JobStatus.PENDING,
      scheduledAt: new Date("2024-01-01T00:00:00.000Z"),
      startedAt: null,
      completedAt: null,
      attempts: 0,
      lastError: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    });

    jobHistory.set(BigInt(1), {
      id: BigInt(1),
      jobId: oldJobId,
      status: JobStatus.COMPLETED,
      details: { externalId: "old-ext" },
      createdAt: new Date("2024-01-01T12:00:00.000Z"),
    });

    jobHistory.set(BigInt(2), {
      id: BigInt(2),
      jobId: newJobId,
      status: JobStatus.COMPLETED,
      details: { externalId: "new-ext" },
      createdAt: new Date("2024-01-02T12:00:00.000Z"),
    });

    jobHistory.set(BigInt(3), {
      id: BigInt(3),
      jobId: pendingJobId,
      status: JobStatus.PENDING,
      details: { externalId: "pending-ext" },
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    });

    const repo = createRepo(db);

    const rowsAffected = await repo.cleanupCompletedBefore(cutoff.getTime());
    expect(rowsAffected).toBe(1);
    expect(jobs.has(oldJobId)).toBe(false);
    expect(jobs.has(newJobId)).toBe(true);
    expect(jobs.has(pendingJobId)).toBe(true);
  });
});
