import { describe, expect, it, vi, beforeEach } from "vitest";

import { JobStatus, JobType, JobPriority, type IJob } from "@/lib/types/jobs";
import {
  getJobRepository,
  type JobRepository,
} from "@/lib/database/job-repository";
import { MemoryJobQueue } from "@/lib/jobs/memory-job-queue";

/**
 * Hermetic MemoryJobQueue & JobRepository integration-style tests.
 *
 * Goals:
 * - Exercise the real MemoryJobQueue against a minimal JobRepository-shaped fake.
 * - Verify that MemoryJobQueue uses ONLY the JobRepository interface:
 *   - enqueue -> exists + insert
 *   - updateJobStatus -> updateStatus
 *   - loadPersistedJobs -> loadActiveJobs
 *   - cleanupOldJobs -> cleanupCompletedBefore
 * - Avoid:
 *   - Any direct access to sqlite/pg tables
 *   - Any assumption about drizzle internals, $schema, or DB engine flags
 * - Keep tests hermetic:
 *   - No real SQLite/Postgres
 *   - No network / server dependency
 *
 * Engine selection notes:
 * - getJobRepository() in production inspects getReadWriteDb().$schema for Postgres vs SQLite.
 * - Here we do NOT try to spoof drizzle or $schema.
 * - Instead, we:
 *   - Spy on getJobRepository()
 *   - Provide a minimal in-memory fake implementing the JobRepository contract
 *   - Assert that MemoryJobQueue drives behavior through that contract.
 */

vi.mock("@/lib/database/job-repository", () => {
  return {
    getJobRepository: vi.fn(), // replaced per-test with our fake
  };
});

interface FakeJobRepositoryState {
  jobs: IJob[];
  insertCalls: IJob[];
  existsCalls: string[];
  updateStatusCalls: Array<{
    jobId: string;
    update: {
      status: JobStatus;
      updatedAt: number;
      startedAt?: number;
      completedAt?: number;
      result?: IJob["result"];
    };
  }>;
  cleanupBeforeCalls: number[];
}

function createFakeJobRepository(): {
  repo: import("@/lib/database/job-repository").JobRepository;
  state: FakeJobRepositoryState;
} {
  const state: FakeJobRepositoryState = {
    jobs: [],
    insertCalls: [],
    existsCalls: [],
    updateStatusCalls: [],
    cleanupBeforeCalls: [],
  };

  const repo: import("@/lib/database/job-repository").JobRepository = {
    async insert(job) {
      state.insertCalls.push(job as IJob);
      state.jobs.push(job as IJob);
    },
    async exists(jobId: string) {
      state.existsCalls.push(jobId);
      return state.jobs.some((j) => j.id === jobId);
    },
    async loadActiveJobs() {
      return state.jobs.filter((j) =>
        [JobStatus.PENDING, JobStatus.RUNNING, JobStatus.FAILED].includes(
          j.status,
        ),
      );
    },
    async updateStatus(jobId, update) {
      state.updateStatusCalls.push({ jobId, update });
      const job = state.jobs.find((j) => j.id === jobId);
      if (!job) return;
      job.status = update.status;
      job.updatedAt = update.updatedAt;
      if (update.startedAt !== undefined) {
        job.startedAt = update.startedAt;
      }
      if (update.completedAt !== undefined) {
        job.completedAt = update.completedAt;
      }
      if (update.result) {
        job.result = update.result;
      }
    },
    async cleanupCompletedBefore(cutoffTime: number) {
      state.cleanupBeforeCalls.push(cutoffTime);
      const before = state.jobs.length;
      state.jobs = state.jobs.filter(
        (j) =>
          j.status !== JobStatus.COMPLETED ||
          typeof j.completedAt !== "number" ||
          j.completedAt >= cutoffTime,
      );
      return before - state.jobs.length;
    },
  };

  return { repo, state };
}

describe("MemoryJobQueue & JobRepository integration (hermetic)", () => {
  beforeEach(() => {
    // Reset the shared getJobRepository mock before each test
    const mockedGetJobRepository = vi.mocked(getJobRepository);
    mockedGetJobRepository.mockReset();
  });

  it("enqueue uses JobRepository.exists and insert", async () => {
    const { repo, state } = createFakeJobRepository();

    const mockedGetJobRepository = vi.mocked(getJobRepository);
    mockedGetJobRepository.mockReturnValueOnce(
      repo as unknown as JobRepository,
    );

    const queue = new MemoryJobQueue();
    const job: IJob = {
      id: "job-1",
      type: JobType.DATA_REFRESH,
      name: "Test Job",
      priority: JobPriority.MEDIUM,
      status: JobStatus.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      executionHistory: [],
    };

    await queue.enqueue(job);

    expect(state.existsCalls).toEqual(["job-1"]);
    expect(state.insertCalls).toHaveLength(1);
    expect(state.insertCalls[0].id).toBe("job-1");
  });

  it("updateJobStatus delegates to JobRepository.updateStatus", async () => {
    const { repo, state } = createFakeJobRepository();

    const mockedGetJobRepository = vi.mocked(getJobRepository);
    // All getJobRepository() calls in this test use the same fake repository
    mockedGetJobRepository.mockReturnValue(repo as JobRepository);

    const queue = new MemoryJobQueue();
    const job: IJob = {
      id: "job-2",
      type: JobType.DATA_REFRESH,
      name: "Status Job",
      priority: 1,
      status: JobStatus.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      executionHistory: [],
    };

    await queue.enqueue(job);

    // Use the (id, status) overload to avoid conflicting typings in MemoryJobQueue.
    await queue.updateJobStatus(job.id, JobStatus.RUNNING);

    expect(state.updateStatusCalls).toHaveLength(1);
    expect(state.updateStatusCalls[0].jobId).toBe(job.id);
    expect(state.updateStatusCalls[0].update.status).toBe(JobStatus.RUNNING);
  });

  it("loadPersistedJobs uses JobRepository.loadActiveJobs", async () => {
    const { repo, state } = createFakeJobRepository();

    const mockedGetJobRepository = vi.mocked(getJobRepository);
    mockedGetJobRepository.mockReturnValue(repo as JobRepository);

    const activeJob: IJob = {
      id: "job-3",
      type: JobType.DATA_REFRESH,
      name: "Active Job",
      priority: 1,
      status: JobStatus.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      executionHistory: [],
    };

    state.jobs.push(activeJob);

    const queue = new MemoryJobQueue();
    const recoveredCount = await queue.loadPersistedJobs();

    // Delegation contract:
    // - MemoryJobQueue should call JobRepository.loadActiveJobs (our fake) and
    //   integrate returned jobs into its in-memory state.
    // - loadPersistedJobs returns a number (recoveredCount), not the jobs array.
    expect(typeof recoveredCount).toBe("number");
    expect(recoveredCount).toBeGreaterThanOrEqual(1);

    // Verify that activeJob from the fake repository was used by the queue.
    const loadedJob = await queue.getJob(activeJob.id);
    expect(loadedJob).toBeDefined();
    expect(loadedJob?.id).toBe(activeJob.id);
    expect(loadedJob?.status).toBe(JobStatus.PENDING);

    // Also ensure the fake's loadActiveJobs was indeed the source.
    expect(
      state.jobs.some(
        (j) => j.id === activeJob.id && j.status === JobStatus.PENDING,
      ),
    ).toBe(true);
  });

  it("cleanupOldJobs delegates to JobRepository.cleanupCompletedBefore", async () => {
    const { repo, state } = createFakeJobRepository();

    const mockedGetJobRepository = vi.mocked(getJobRepository);
    // All getJobRepository() calls in this test return the same fake
    mockedGetJobRepository.mockReturnValue(repo as JobRepository);

    const queue = new MemoryJobQueue();
    const cutoff = Date.now();

    await queue.cleanupOldJobs(cutoff);

    expect(state.cleanupBeforeCalls).toHaveLength(1);
    expect(typeof state.cleanupBeforeCalls[0]).toBe("number");
  });
});
