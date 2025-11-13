import { NextRequest, NextResponse } from "next/server";
import {
  defaultBatchingMiddleware,
  isBatchRequest,
} from "@/lib/api/batching/batching-middleware";
import logger from "@/lib/logger";
import { getPostgresJobQueue } from "@/lib/jobs/postgres-job-queue";
import { JobPriority, JobStatus, JobType } from "@/lib/types/jobs";

/**
 * POST /api/batch - Handle bulk API operations
 *
 * Accepts a batch of requests and executes them efficiently.
 * Supports parallel/sequential execution, timeouts, and error handling.
 *
 * Request Body:
 * {
 *   "requests": [
 *     {
 *       "id": "req-1",
 *       "path": "/api/tools/github/pull-requests",
 *       "method": "GET",
 *       "headers": { "Authorization": "..." },
 *       "body": null,
 *       "timeout": 30000
 *     }
 *   ]
 * }
 *
 * Response:
 * {
 *   "responses": [...],
 *   "totalDuration": 150,
 *   "successCount": 3,
 *   "errorCount": 1,
 *   "hasErrors": true
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Check if this is a batch request
    if (!isBatchRequest(body.requests)) {
      return NextResponse.json(
        {
          error:
            "Invalid batch request format. Expected { requests: BatchRequest[] }",
          code: "INVALID_BATCH_FORMAT",
        },
        { status: 400 },
      );
    }

    const startedAt = Date.now();

    // Process the batch request synchronously (preserve existing behavior)
    const response = await defaultBatchingMiddleware.processBatch(
      body.requests,
      request,
    );

    // Best-effort persistence of batch execution metadata to Postgres.
    // This does not affect HTTP response semantics.
    try {
      const queue = getPostgresJobQueue();
      const jobId = `batch:${startedAt}:${Math.random().toString(36).slice(2, 10)}`;

      await queue.enqueue({
        id: jobId,
        type: JobType.MAINTENANCE,
        name: "HTTP Batch Execution",
        priority: JobPriority.LOW,
        status: JobStatus.COMPLETED,
        createdAt: startedAt,
        updatedAt: Date.now(),
        endpoint: "/api/batch",
        payload: {
          tags: ["batch", "sync"],
          data: {
            requestCount: Array.isArray(body.requests)
              ? body.requests.length
              : 0,
          },
        },
        result: {
          success: true,
        },
        retryCount: 0,
        executionHistory: [],
      });
    } catch (persistError) {
      logger.error("Failed to persist batch execution job", {
        error:
          persistError instanceof Error
            ? persistError.message
            : String(persistError),
      });
    }

    return response;
  } catch (error) {
    logger.error("Failed to process batch request", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      endpoint: "/api/batch",
      method: "POST",
    });

    return NextResponse.json(
      {
        error: "Failed to process batch request",
        code: "BATCH_ENDPOINT_ERROR",
      },
      {
        status: 500,
        headers: {
          "X-Batch-Error": "ENDPOINT_ERROR",
        },
      },
    );
  }
}

/**
 * GET /api/batch - Get batch processing capabilities and statistics
 */
export async function GET() {
  const stats = defaultBatchingMiddleware.getBatchStats();

  return NextResponse.json(
    {
      capabilities: {
        batching: stats.enabled,
        maxRequestsPerBatch: stats.maxRequests,
        defaultTimeoutMs: stats.defaultTimeout,
        maxExecutionTimeMs: stats.maxExecutionTime,
        parallelExecution: stats.parallelExecution,
        continueOnError: stats.continueOnError,
      },
      usage: {
        endpoint: "/api/batch",
        method: "POST",
        contentType: "application/json",
      },
      example: {
        requests: [
          {
            id: "github-prs",
            path: "/api/tools/github/pull-requests",
            method: "GET",
            headers: { "Cache-Control": "no-cache" },
          },
          {
            id: "jira-issues",
            path: "/api/tools/jira/issues",
            method: "GET",
            timeout: 15000,
          },
        ],
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300", // Cache capabilities for 5 minutes
      },
    },
  );
}
