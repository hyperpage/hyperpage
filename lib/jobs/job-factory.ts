/**
 * Job factory for creating common job specifications.
 *
 * Provides utilities for creating standard job types like cache warming,
 * data refresh, and rate limit updates with sensible defaults.
 */

import { IJobFactory, IJob, JobType, JobPriority } from "../types/jobs";
import { generateJobId } from "./memory-job-queue";
import { Tool } from "../../tools/tool-types";

/**
 * Job factory implementation
 */
export class JobFactory implements IJobFactory {
  /**
   * Create a cache warming job for a tool
   */
  createCacheWarmJob(
    tool: Omit<Tool, "handlers">,
    endpoints?: string[],
  ): Omit<IJob, "status" | "createdAt" | "updatedAt" | "retryCount"> {
    return {
      id: generateJobId("cache-warm"),
      type: JobType.CACHE_WARM,
      name: `Cache warming for ${tool.name}`,
      priority: JobPriority.LOW,
      tool,
      payload: {
        timeoutMs: 180000, // 3 minutes
        maxRetries: 3,
        data: { endpoints: endpoints || [] },
        tags: ["cache", "warming", "maintenance"],
      },
    };
  }

  /**
   * Create a data refresh job for a tool
   */
  createDataRefreshJob(
    tool: Omit<Tool, "handlers">,
    endpoints?: string[],
  ): Omit<IJob, "status" | "createdAt" | "updatedAt" | "retryCount"> {
    return {
      id: generateJobId("data-refresh"),
      type: JobType.DATA_REFRESH,
      name: `Data refresh for ${tool.name}`,
      priority: JobPriority.MEDIUM,
      tool,
      endpoint: endpoints?.[0], // Primary endpoint if multiple
      payload: {
        timeoutMs: 60000, // 1 minute
        maxRetries: 3,
        data: { endpoints: endpoints || [], userInitiated: false },
        tags: ["data", "refresh", "sync"],
      },
    };
  }

  /**
   * Create a rate limit update job
   */
  createRateLimitUpdateJob(
    platforms?: string[],
  ): Omit<IJob, "status" | "createdAt" | "updatedAt" | "retryCount"> {
    return {
      id: generateJobId("rate-limit-update"),
      type: JobType.RATE_LIMIT_UPDATE,
      name: `Rate limit update for ${platforms ? platforms.join(", ") : "all platforms"}`,
      priority: JobPriority.HIGH,
      payload: {
        timeoutMs: 15000, // 15 seconds
        maxRetries: 0, // Don't retry rate limit checks
        data: { platforms: platforms || [] },
        tags: ["rate-limit", "monitoring", "api-limits"],
      },
    };
  }
}

/**
 * Default job factory instance
 */
export const defaultJobFactory = new JobFactory();
