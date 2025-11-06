/**
 * Memory Job Scheduler Tests
 *
 * Tests for the in-memory job scheduler focusing on:
 * - Scheduled job creation and execution
 * - Recurring job scheduling with intervals
 * - Due job identification and execution
 * - Job cancellation and management
 * - Scheduler lifecycle (start/stop)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryJobScheduler } from "../../../../lib/jobs/memory-job-scheduler";
import { JobStatus, JobPriority, JobType } from "../../../../lib/types/jobs";
import { generateJobId } from "../../../../lib/jobs/memory-job-queue";

describe("Memory Job Scheduler", () => {
  let scheduler: MemoryJobScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new MemoryJobScheduler("test-scheduler");
  });

  afterEach(async () => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
  });

  describe("Scheduler Initialization", () => {
    it("should create scheduler with specified ID", () => {
      const customScheduler = new MemoryJobScheduler("custom-id");
      expect(customScheduler.id).toBe("custom-id");
    });

    it("should create scheduler with default ID", () => {
      expect(scheduler.id).toBe("test-scheduler");
    });
  });

  describe("Job Scheduling", () => {
    it("should schedule immediate execution (past due time)", async () => {
      const jobSpec = {
        id: generateJobId("immediate"),
        type: JobType.DATA_REFRESH,
        name: "Immediate Job",
        priority: JobPriority.MEDIUM,
        schedule: {
          scheduledAt: Date.now() - 1000, // 1 second ago
        },
      };

      const job = await scheduler.schedule(jobSpec);
      expect(job).toBeDefined();
      expect(job.id).toBe(jobSpec.id);
      expect(job.status).toBe(JobStatus.PENDING);
      expect(job.schedule?.scheduledAt).toBe(jobSpec.schedule?.scheduledAt);
    });

    it("should schedule future execution", async () => {
      const futureTime = Date.now() + 5000; // 5 seconds from now
      const jobSpec = {
        id: generateJobId("future"),
        type: JobType.CACHE_WARM,
        name: "Future Job",
        priority: JobPriority.HIGH,
        schedule: {
          scheduledAt: futureTime,
        },
      };

      const job = await scheduler.schedule(jobSpec);
      expect(job).toBeDefined();
      expect(job.schedule?.scheduledAt).toBe(futureTime);
    });

    it("should reject duplicate job IDs", async () => {
      const jobSpec = {
        id: "duplicate-scheduled-job",
        type: JobType.DATA_REFRESH,
        name: "Test Job",
        priority: JobPriority.LOW,
        schedule: {
          scheduledAt: Date.now() + 1000,
        },
      };

      await scheduler.schedule(jobSpec);
      await expect(scheduler.schedule(jobSpec)).rejects.toThrow(
        "already exists",
      );
    });

    it("should validate scheduling configuration", async () => {
      const invalidJobSpec = {
        id: generateJobId("invalid"),
        type: JobType.MAINTENANCE,
        name: "Invalid Job",
        priority: JobPriority.MEDIUM,
        // No schedule configuration
      };

      await expect(scheduler.schedule(invalidJobSpec)).rejects.toThrow(
        "scheduling configuration",
      );
    });
  });

  describe("Recurring Jobs", () => {
    it("should schedule recurring jobs with interval", async () => {
      const jobSpec = {
        id: generateJobId("recurring"),
        type: JobType.RATE_LIMIT_UPDATE,
        name: "Recurring Rate Check",
        priority: JobPriority.LOW,
        schedule: {
          intervalMs: 60000, // Every minute
          maxRecurrences: 5,
        },
      };

      const job = await scheduler.schedule(jobSpec);
      expect(job.schedule?.intervalMs).toBe(60000);
      expect(job.schedule?.maxRecurrences).toBe(5);
    });

    it("should handle jobs with both immediate execution and recurring schedule", async () => {
      const jobSpec = {
        id: generateJobId("immediate-recurring"),
        type: JobType.CACHE_INVALIDATION,
        name: "Immediate + Recurring",
        priority: JobPriority.MEDIUM,
        schedule: {
          scheduledAt: Date.now() - 1000, // Immediate
          intervalMs: 30000, // Then every 30 seconds
        },
      };

      const job = await scheduler.schedule(jobSpec);
      expect(job.schedule?.scheduledAt).toBeLessThan(Date.now());
      expect(job.schedule?.intervalMs).toBe(30000);
    });
  });

  describe("Job Cancellation", () => {
    it("should cancel scheduled jobs", async () => {
      const jobSpec = {
        id: generateJobId("cancel-test"),
        type: JobType.DATA_REFRESH,
        name: "Cancel Test",
        priority: JobPriority.LOW,
        schedule: {
          scheduledAt: Date.now() + 1000,
        },
      };

      await scheduler.schedule(jobSpec);
      const cancelled = await scheduler.unschedule(jobSpec.id);
      expect(cancelled).toBe(true);
    });

    it("should return false for non-existent job ID", async () => {
      const cancelled = await scheduler.unschedule("non-existent");
      expect(cancelled).toBe(false);
    });
  });

  describe("Due Jobs", () => {
    it("should identify due jobs", async () => {
      const pastDueJob = await scheduler.schedule({
        id: generateJobId("past-due"),
        type: JobType.CACHE_WARM,
        name: "Past Due",
        priority: JobPriority.HIGH,
        schedule: {
          scheduledAt: Date.now() - 1000, // Already due
        },
      });

      await scheduler.schedule({
        id: generateJobId("future-job"),
        type: JobType.MAINTENANCE,
        name: "Future Job",
        priority: JobPriority.LOW,
        schedule: {
          scheduledAt: Date.now() + 5000, // Not due yet
        },
      });

      const dueJobs = await scheduler.getDueJobs();
      expect(dueJobs.length).toBe(1);
      expect(dueJobs[0].id).toBe(pastDueJob.id);
    });

    it("should return empty array when no jobs are due", async () => {
      await scheduler.schedule({
        id: generateJobId("future-only"),
        type: JobType.DATA_REFRESH,
        name: "Future Only",
        priority: JobPriority.MEDIUM,
        schedule: {
          scheduledAt: Date.now() + 10000,
        },
      });

      const dueJobs = await scheduler.getDueJobs();
      expect(dueJobs.length).toBe(0);
    });
  });

  describe("Scheduler Management", () => {
    it("should start and stop scheduler", async () => {
      const cleanup = scheduler.start();
      expect(cleanup).toBeInstanceOf(Function);

      await scheduler.stop();
      // Should not throw errors when stopped multiple times
      await scheduler.stop();
    });

    it("should track scheduled jobs", async () => {
      const job1 = await scheduler.schedule({
        id: generateJobId("tracked-1"),
        type: JobType.CACHE_INVALIDATION,
        name: "Tracked 1",
        priority: JobPriority.LOW,
        schedule: {
          scheduledAt: Date.now() + 2000,
        },
      });

      const job2 = await scheduler.schedule({
        id: generateJobId("tracked-2"),
        type: JobType.RATE_LIMIT_UPDATE,
        name: "Tracked 2",
        priority: JobPriority.MEDIUM,
        schedule: {
          scheduledAt: Date.now() + 3000,
        },
      });

      const scheduledJobs = await scheduler.getScheduledJobs();
      expect(scheduledJobs.length).toBe(2);
      const jobIds = scheduledJobs.map((job) => job.id).sort();
      expect(jobIds).toEqual([job1.id, job2.id].sort());
    });

    it("should handle multiple due jobs at same time", async () => {
      const dueTime = Date.now() + 2000;

      const job1 = await scheduler.schedule({
        id: generateJobId("due-1"),
        type: JobType.CACHE_WARM,
        name: "Due Job 1",
        priority: JobPriority.HIGH,
        schedule: { scheduledAt: dueTime },
      });

      const job2 = await scheduler.schedule({
        id: generateJobId("due-2"),
        type: JobType.DATA_REFRESH,
        name: "Due Job 2",
        priority: JobPriority.MEDIUM,
        schedule: { scheduledAt: dueTime },
      });

      const dueJobs = await scheduler.getDueJobs();
      expect(dueJobs).toHaveLength(0); // Not due yet

      // Advance to due time
      vi.advanceTimersByTime(3000);
      scheduler.start();

      const dueJobsAfter = await scheduler.getDueJobs();
      expect(dueJobsAfter).toHaveLength(2);
      const dueIds = dueJobsAfter.map((job) => job.id).sort();
      expect(dueIds).toEqual([job1.id, job2.id].sort());
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid scheduledAt values", async () => {
      const jobSpec = {
        id: generateJobId("invalid-time"),
        type: JobType.MAINTENANCE,
        name: "Invalid Time",
        priority: JobPriority.LOW,
        schedule: {
          scheduledAt: -1, // Invalid timestamp
        },
      };

      await expect(scheduler.schedule(jobSpec)).rejects.toThrow(
        "scheduledAt must be a valid positive timestamp",
      );
    });

    it("should handle invalid interval values", async () => {
      const jobSpec = {
        id: generateJobId("invalid-interval"),
        type: JobType.CACHE_INVALIDATION,
        name: "Invalid Interval",
        priority: JobPriority.LOW,
        schedule: {
          intervalMs: -1000, // Invalid negative interval
        },
      };

      await expect(scheduler.schedule(jobSpec)).rejects.toThrow(
        "positive number",
      );
    });
  });
});
