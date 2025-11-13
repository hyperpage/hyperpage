import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PostgresJobQueue,
  getPostgresJobQueue,
} from "@/lib/jobs";
import {
  JobPriority,
  JobStatus,
  JobType,
  type IJob,
} from "@/lib/types/jobs";
import type { Tool } from "@/tools/tool-types";
import type {
  JobRepository,
  NormalizedJob,
} from "@/lib/database/job-repository";

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("PostgresJobQueue", () => {
  let repo: JobRepository;
  let queue: PostgresJobQueue;
  const mockTool: Omit<Tool, "handlers"> = {
    name: "GitHub",
    slug: "github",
    enabled: true,
    ui: {
      color: "bg-gray-500",
      icon: null,
    },
    widgets: [],
    apis: {},
  };

  beforeEach(() => {
    repo = {
      insert: vi.fn(),
      exists: vi.fn(),
      loadActiveJobs: vi.fn(),
      updateStatus: vi.fn(),
      cleanupCompletedBefore: vi.fn(),
    } as unknown as JobRepository;

    queue = new PostgresJobQueue(repo);
  });

  it("enqueues job with defaults and calls repository insert", async () => {
    const job: IJob = {
      id: "job-1",
      type: JobType.MAINTENANCE,
      name: "Test job",
      priority: JobPriority.MEDIUM,
      status: JobStatus.PENDING,
      tool: mockTool,
      endpoint: "/api/test",
      payload: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      executionHistory: [],
    };

    const insertMock = repo.insert as unknown as ReturnType<typeof vi.fn>;
    insertMock.mockResolvedValueOnce(undefined);

    const result = await queue.enqueue(job);

    expect(insertMock).toHaveBeenCalledTimes(1);
    const [normalized] = insertMock.mock.calls[0];

    expect(normalized.id).toBeDefined();
    expect(normalized.type).toBe("TEST");
    expect(normalized.name).toBe("TEST");
    expect(normalized.priority).toBe(JobPriority.MEDIUM);
    expect(normalized.status).toBe(JobStatus.PENDING);
    expect(normalized.payload).toEqual({});
    expect(normalized.retryCount).toBe(0);
    expect(normalized.executionHistory).toEqual([]);

    expect(result.id).toBe(normalized.id);
  });

  it("propagates a stable id when provided", async () => {
    const job: IJob = {
      id: "provided-id",
      type: JobType.MAINTENANCE,
      name: "Provided ID Job",
      priority: JobPriority.MEDIUM,
      status: JobStatus.PENDING,
      tool: mockTool,
      endpoint: "/api/test",
      payload: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      executionHistory: [],
    };

    const insertMock = repo.insert as unknown as ReturnType<typeof vi.fn>;
    insertMock.mockResolvedValueOnce(undefined);

    const result = await queue.enqueue(job);

    expect(insertMock).toHaveBeenCalledTimes(1);
    const [normalized] = insertMock.mock.calls[0];

    expect(normalized.id).toBe("provided-id");
    expect(result.id).toBe("provided-id");
  });

  it("throws when repository insert fails", async () => {
    const job: IJob = {
      id: "job-error",
      type: JobType.MAINTENANCE,
      name: "Error Job",
      priority: JobPriority.MEDIUM,
      status: JobStatus.PENDING,
      tool: mockTool,
      endpoint: "/api/test",
      payload: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      executionHistory: [],
    };

    (repo.insert as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("insert failed"),
    );

    await expect(queue.enqueue(job)).rejects.toThrow(
      "Failed to enqueue job",
    );
  });

  it("getActiveJobs returns repository results", async () => {
    const activeJobs: NormalizedJob[] = [
      {
        id: "1",
        type: JobType.MAINTENANCE,
        name: "Test",
        priority: JobPriority.MEDIUM,
        status: JobStatus.PENDING,
        createdAt: 1,
        updatedAt: 1,
        tool: mockTool,
        endpoint: "/api/test",
        payload: {},
        retryCount: 0,
        executionHistory: [],
      },
    ];

    const loadMock = repo.loadActiveJobs as unknown as ReturnType<typeof vi.fn>;
    loadMock.mockResolvedValueOnce(activeJobs);

    const result = await queue.getActiveJobs();
    expect(result).toEqual(activeJobs);
  });

  it("getActiveJobs returns [] when repository throws", async () => {
    const loadMock = repo.loadActiveJobs as unknown as ReturnType<typeof vi.fn>;
    loadMock.mockRejectedValueOnce(new Error("load failed"));

    const result = await queue.getActiveJobs();
    expect(result).toEqual([]);
  });

  it("updateStatus delegates to repository with normalized timestamps", async () => {
    const now = Date.now();
    await queue.updateStatus("job-1", {
      status: JobStatus.COMPLETED,
      completedAt: now,
    });

    expect(repo.updateStatus).toHaveBeenCalledTimes(1);
    expect(repo.updateStatus).toHaveBeenCalledWith("job-1", {
      status: JobStatus.COMPLETED,
      updatedAt: expect.any(Number),
      startedAt: undefined,
      completedAt: now,
      result: undefined,
    });
  });

  it("updateStatus throws when repository updateStatus fails", async () => {
    (repo.updateStatus as unknown as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("update failed"));

    await expect(
      queue.updateStatus("job-1", {
        status: JobStatus.FAILED,
      }),
    ).rejects.toThrow("Failed to update job status");
  });
});

describe("getPostgresJobQueue", () => {
  it("returns a singleton instance", () => {
    const q1 = getPostgresJobQueue();
    const q2 = getPostgresJobQueue();
    expect(q1).toBe(q2);
  });
});
