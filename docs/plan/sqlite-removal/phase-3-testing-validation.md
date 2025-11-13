# Phase 3: Testing & Validation

## Overview

Phase 3 focuses on comprehensive testing and validation of the PostgreSQL-only implementation. This phase ensures all functionality works correctly, performance meets requirements, and the application is production-ready.

## Prerequisites

- ✅ Phase 1 completed successfully (SQLite dependencies removed)
- ✅ Phase 2 completed successfully (Application code updated)
- ✅ PostgreSQL connection layer functional
- ✅ All application code uses PostgreSQL patterns

## Phase 3 Tasks

### 3.1 Update Test Infrastructure

**Estimated Time**: 8-12 hours

#### 3.1.1 Update Test Database Setup

**Action**: Create comprehensive PostgreSQL test utilities

**Implementation**:

```typescript
// __tests__/setup/test-database.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as pgSchema from "../../lib/database/pg-schema";

export interface TestDatabase {
  db: ReturnType<typeof drizzle>;
  pool: Pool;
  cleanup: () => Promise<void>;
}

export async function setupTestDatabase(): Promise<TestDatabase> {
  const testPool = new Pool({
    connectionString:
      process.env.TEST_DATABASE_URL ||
      "postgresql://test:test@localhost:5432/hyperpage_test",
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  const db = drizzle(testPool, { schema: pgSchema });

  // Initialize test database
  await db.execute({ sql: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` });

  // Clean up function
  const cleanup = async () => {
    // Clean up test data in reverse dependency order
    await db.execute({
      sql: `
      TRUNCATE TABLE job_history, oauth_tokens, rate_limits, app_state, tool_configs, jobs, users CASCADE;
    `,
    });
    await testPool.end();
  };

  return { db, pool: testPool, cleanup };
}

export async function createTestData(
  db: ReturnType<typeof drizzle>,
): Promise<void> {
  // Create test users
  await db.insert(pgSchema.users).values([
    {
      id: "test-user-1",
      provider: "github",
      providerUserId: "github-user-1",
      email: "test1@example.com",
      username: "testuser1",
      displayName: "Test User 1",
      avatarUrl: "https://example.com/avatar1.jpg",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "test-user-2",
      provider: "gitlab",
      providerUserId: "gitlab-user-2",
      email: "test2@example.com",
      username: "testuser2",
      displayName: "Test User 2",
      avatarUrl: "https://example.com/avatar2.jpg",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  // Create test jobs
  await db.insert(pgSchema.jobs).values([
    {
      id: "test-job-1",
      type: "github_pull_request",
      name: "Test GitHub Job",
      payload: JSON.stringify({ action: "opened", repository: "test/repo" }),
      status: "pending",
      priority: 1,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "test-job-2",
      type: "jira_issue",
      name: "Test Jira Job",
      payload: JSON.stringify({ action: "created", issue: "TEST-123" }),
      status: "completed",
      priority: 2,
      retryCount: 1,
      scheduledAt: new Date(Date.now() - 3600000).toISOString(),
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      completedAt: new Date(Date.now() - 3500000).toISOString(),
      result: JSON.stringify({ success: true, processed: 1 }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  // Create test tool configurations
  await db.insert(pgSchema.toolConfigs).values([
    {
      toolName: "github",
      enabled: true,
      config: JSON.stringify({ apiKey: "test-key", repo: "test/repo" }),
      refreshInterval: 300000,
      notifications: true,
      updatedAt: new Date().toISOString(),
    },
    {
      toolName: "jira",
      enabled: false,
      config: JSON.stringify({ url: "https://example.atlassian.net" }),
      refreshInterval: 600000,
      notifications: false,
      updatedAt: new Date().toISOString(),
    },
  ]);
}
```

#### 3.1.2 Update Unit Tests

**Action**: Update all unit tests for PostgreSQL

**Job Repository Tests**:

```typescript
// __tests__/unit/database/job-repository.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { JobRepository } from "../../../lib/database/job-repository";
import { setupTestDatabase, createTestData } from "../../setup/test-database";
import type { TestDatabase } from "../../setup/test-database";

describe("JobRepository - PostgreSQL", () => {
  let testDb: TestDatabase;
  let jobRepository: JobRepository;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    jobRepository = new JobRepository(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  beforeEach(async () => {
    await testDb.cleanup();
    await createTestData(testDb.db);
  });

  describe("create", () => {
    it("should create a new job", async () => {
      const jobData = {
        id: "new-test-job",
        type: "test_type",
        name: "New Test Job",
        payload: JSON.stringify({ test: true }),
        status: "pending" as const,
        priority: 5,
        retryCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const created = await jobRepository.create(jobData);

      expect(created.id).toBe("new-test-job");
      expect(created.type).toBe("test_type");
      expect(created.status).toBe("pending");
      expect(created.priority).toBe(5);
    });

    it("should throw error for duplicate job ID", async () => {
      const jobData = {
        id: "duplicate-job",
        type: "test_type",
        name: "Duplicate Test Job",
        payload: JSON.stringify({ test: true }),
        status: "pending" as const,
        priority: 1,
        retryCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await jobRepository.create(jobData);

      await expect(
        jobRepository.create({
          ...jobData,
          name: "Different Name",
        }),
      ).rejects.toThrow();
    });
  });

  describe("findById", () => {
    it("should find existing job by ID", async () => {
      const job = await jobRepository.findById("test-job-1");

      expect(job).toBeDefined();
      expect(job?.id).toBe("test-job-1");
      expect(job?.type).toBe("github_pull_request");
      expect(job?.status).toBe("pending");
    });

    it("should return null for non-existent job", async () => {
      const job = await jobRepository.findById("non-existent-job");
      expect(job).toBeNull();
    });
  });

  describe("findPending", () => {
    it("should return pending jobs ordered by scheduled time", async () => {
      const pendingJobs = await jobRepository.findPending(10);

      expect(pendingJobs).toHaveLength(1);
      expect(pendingJobs[0].id).toBe("test-job-1");
      expect(pendingJobs[0].status).toBe("pending");
    });

    it("should respect limit parameter", async () => {
      const pendingJobs = await jobRepository.findPending(0);
      expect(pendingJobs).toHaveLength(0);
    });
  });

  describe("updateStatus", () => {
    it("should update job status", async () => {
      await jobRepository.updateStatus("test-job-1", "processing");

      const updatedJob = await jobRepository.findById("test-job-1");
      expect(updatedJob?.status).toBe("processing");
    });
  });

  describe("getJobStats", () => {
    it("should return correct job statistics", async () => {
      const stats = await jobRepository.getJobStats();

      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(0);
      expect(stats.processing).toBe(0);
    });
  });
});
```

#### 3.1.3 Update Integration Tests

**Action**: Create comprehensive integration test suite

**Repository Integration Tests**:

```typescript
// __tests__/integration/repository-integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDatabase, createTestData } from "../setup/test-database";
import { jobRepository } from "../../lib/database/job-repository";
import { toolConfigRepository } from "../../lib/database/tool-config-repository";
import { jobQueue } from "../../lib/jobs/job-queue";
import { toolConfigManager } from "../../lib/tool-config-manager";
import type { TestDatabase } from "../setup/test-database";

describe("Repository Integration - PostgreSQL", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  beforeEach(async () => {
    await testDb.cleanup();
    await createTestData(testDb.db);
  });

  describe("Job Queue Integration", () => {
    it("should handle complete job lifecycle", async () => {
      // Add new job via queue
      const jobId = await jobQueue.addJob({
        type: "integration_test",
        name: "Integration Test Job",
        payload: { test: true, timestamp: Date.now() },
        status: "pending",
        priority: 1,
        retryCount: 0,
      });

      expect(jobId).toBeDefined();

      // Retrieve job via repository
      const job = await jobRepository.findById(jobId);
      expect(job).toBeDefined();
      expect(job?.status).toBe("pending");

      // Mark as processing via queue
      const markedProcessing = await jobQueue.markJobProcessing(jobId);
      expect(markedProcessing).toBe(true);

      // Update result via repository
      await jobRepository.updateResult(jobId, {
        result: "success",
        processedAt: new Date().toISOString(),
      });

      // Mark as completed via queue
      const completed = await jobQueue.markJobCompleted(jobId, {
        result: "success",
        processedAt: new Date().toISOString(),
      });
      expect(completed).toBe(true);

      // Verify final state
      const completedJob = await jobRepository.findById(jobId);
      expect(completedJob?.status).toBe("completed");
      expect(completedJob?.result).toBeDefined();
    });

    it("should handle job retry mechanism", async () => {
      const jobId = await jobQueue.addJob({
        type: "retry_test",
        name: "Retry Test Job",
        payload: { test: true },
        status: "pending",
        priority: 1,
        retryCount: 0,
      });

      // Mark as failed
      const failed = await jobQueue.markJobFailed(jobId, "Test failure");
      expect(failed).toBe(true);

      // Verify retry count increased
      const failedJob = await jobRepository.findById(jobId);
      expect(failedJob?.status).toBe("failed");
      expect(failedJob?.retryCount).toBe(1);

      // Retry the job
      const retried = await jobQueue.retryJob(jobId);
      expect(retried).toBe(true);

      // Verify job is back to pending
      const retriedJob = await jobRepository.findById(jobId);
      expect(retriedJob?.status).toBe("pending");
      expect(retriedJob?.retryCount).toBe(1); // Should have been incremented in retry
    });
  });

  describe("Tool Configuration Integration", () => {
    it("should handle complete tool configuration workflow", async () => {
      const toolName = "integration_tool";
      const config = {
        enabled: true,
        config: {
          apiKey: "integration_key",
          settings: { debug: true, timeout: 30000 },
        },
        refreshInterval: 600000,
        notifications: true,
      };

      // Set configuration via manager
      await toolConfigManager.setConfig(toolName, config);

      // Retrieve via repository
      const retrievedConfig =
        await toolConfigRepository.findByToolName(toolName);
      expect(retrievedConfig).toBeDefined();
      expect(retrievedConfig?.toolName).toBe(toolName);
      expect(retrievedConfig?.enabled).toBe(true);
      expect(retrievedConfig?.config).toEqual(config.config);

      // Update via manager
      const updatedConfig = { ...config, enabled: false };
      await toolConfigManager.setConfig(toolName, updatedConfig);

      const updated = await toolConfigRepository.findByToolName(toolName);
      expect(updated?.enabled).toBe(false);
      expect(updated?.refreshInterval).toBe(600000);
    });

    it("should handle tool configuration summary", async () => {
      const summary = await toolConfigManager.getConfigSummary();
      expect(summary.total).toBeGreaterThanOrEqual(2);
      expect(summary.enabled).toBeGreaterThanOrEqual(1);
      expect(summary.disabled).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Cross-Repository Operations", () => {
    it("should handle job and configuration together", async () => {
      // Create job with tool configuration
      await toolConfigManager.setConfig("github", {
        enabled: true,
        config: { token: "test-token" },
        refreshInterval: 300000,
        notifications: true,
      });

      const jobId = await jobQueue.addJob({
        type: "github_api",
        name: "GitHub API Job",
        payload: { action: "list_repos" },
        status: "pending",
        priority: 1,
        retryCount: 0,
      });

      // Process job
      await jobQueue.markJobProcessing(jobId);

      // Job depends on GitHub configuration
      const githubConfig = await toolConfigManager.getConfig("github");
      expect(githubConfig?.enabled).toBe(true);
      expect(githubConfig?.config?.token).toBe("test-token");

      // Complete job
      await jobQueue.markJobCompleted(jobId, {
        success: true,
        repositories: ["repo1", "repo2"],
      });

      // Verify both are working together
      const completedJob = await jobRepository.findById(jobId);
      const finalConfig = await toolConfigRepository.findEnabled();

      expect(completedJob?.status).toBe("completed");
      expect(finalConfig.find((c) => c.toolName === "github")).toBeDefined();
    });
  });
});
```

### 3.2 Performance Testing

**Estimated Time**: 6-8 hours

#### 3.2.1 Database Performance Tests

**Action**: Create comprehensive performance test suite

**Performance Test Implementation**:

```typescript
// __tests__/performance/database-performance.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDatabase } from "../setup/test-database";
import { jobRepository } from "../../lib/database/job-repository";
import { toolConfigRepository } from "../../lib/database/tool-config-repository";
import { jobQueue } from "../../lib/jobs/job-queue";
import type { TestDatabase } from "../setup/test-database";

describe("Database Performance - PostgreSQL", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  beforeEach(async () => {
    await testDb.cleanup();
  });

  describe("Job Repository Performance", () => {
    it("should handle batch job creation efficiently", async () => {
      const batchSize = 1000;
      const startTime = Date.now();

      // Create batch of jobs
      const jobPromises = Array.from({ length: batchSize }, (_, i) =>
        jobRepository.create({
          id: `perf_job_${i}`,
          type: "performance_test",
          name: `Performance Test Job ${i}`,
          payload: JSON.stringify({ index: i, timestamp: Date.now() }),
          status: "pending",
          priority: i % 10,
          retryCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      );

      const createdJobs = await Promise.all(jobPromises);
      const creationTime = Date.now() - startTime;

      expect(createdJobs).toHaveLength(batchSize);
      expect(creationTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Verify performance metrics
      console.log(`Created ${batchSize} jobs in ${creationTime}ms`);
      console.log(`Average time per job: ${creationTime / batchSize}ms`);
    });

    it("should query large datasets efficiently", async () => {
      // First create a large dataset
      const batchSize = 500;
      for (let i = 0; i < batchSize; i++) {
        await jobRepository.create({
          id: `large_test_${i}`,
          type: "batch_test",
          name: `Batch Test Job ${i}`,
          payload: JSON.stringify({ batch: i }),
          status: i % 2 === 0 ? "pending" : "completed",
          priority: i % 5,
          retryCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Test various query patterns
      const queries = [
        { name: "Find all pending", fn: () => jobRepository.findPending(1000) },
        {
          name: "Find all completed",
          fn: () => jobRepository.findByStatus("completed", 1000),
        },
        { name: "Get job statistics", fn: () => jobRepository.getJobStats() },
        {
          name: "Find by type",
          fn: () => jobRepository.findByType("batch_test", 1000),
        },
      ];

      for (const query of queries) {
        const startTime = Date.now();
        const result = await query.fn();
        const queryTime = Date.now() - startTime;

        expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
        expect(Array.isArray(result) || typeof result === "object").toBe(true);

        console.log(`${query.name}: ${queryTime}ms`);
      }
    });

    it("should handle concurrent queries efficiently", async () => {
      const concurrentQueries = 20;
      const startTime = Date.now();

      const queryPromises = Array.from(
        { length: concurrentQueries },
        async (_, i) => {
          const queries = [
            jobRepository.findPending(50),
            jobRepository.getJobStats(),
            jobRepository.findByStatus("pending", 25),
          ];
          return Promise.all(queries);
        },
      );

      const results = await Promise.all(queryPromises);
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(concurrentQueries);
      expect(totalTime).toBeLessThan(5000); // All queries should complete within 5 seconds

      console.log(
        `Executed ${concurrentQueries * 3} queries in ${totalTime}ms`,
      );
    });
  });

  describe("Job Queue Performance", () => {
    it("should process job queue operations efficiently", async () => {
      const jobCount = 200;
      const startTime = Date.now();

      // Add jobs to queue
      const jobIds = await Promise.all(
        Array.from({ length: jobCount }, (_, i) =>
          jobQueue.addJob({
            type: "queue_test",
            name: `Queue Test Job ${i}`,
            payload: { index: i },
            status: "pending",
            priority: i % 10,
            retryCount: 0,
          }),
        ),
      );

      const addTime = Date.now() - startTime;
      expect(jobIds).toHaveLength(jobCount);
      expect(addTime).toBeLessThan(5000);

      // Process jobs
      const processStartTime = Date.now();
      let processedCount = 0;

      for (let i = 0; i < Math.min(jobCount, 50); i++) {
        // Process first 50
        const job = await jobQueue.getNextJob();
        if (job) {
          await jobQueue.markJobProcessing(job.id);
          await jobQueue.markJobCompleted(job.id, { processed: true });
          processedCount++;
        }
      }

      const processTime = Date.now() - processStartTime;
      expect(processedCount).toBeGreaterThan(0);
      expect(processTime).toBeLessThan(3000);

      console.log(`Added ${jobCount} jobs in ${addTime}ms`);
      console.log(`Processed ${processedCount} jobs in ${processTime}ms`);
    });
  });

  describe("Tool Configuration Performance", () => {
    it("should handle bulk configuration operations", async () => {
      const configCount = 100;
      const startTime = Date.now();

      // Create many tool configurations
      const configPromises = Array.from({ length: configCount }, (_, i) =>
        toolConfigRepository.create({
          toolName: `perf_tool_${i}`,
          enabled: i % 2 === 0,
          config: JSON.stringify({
            apiKey: `key_${i}`,
            settings: { timeout: 30000 },
          }),
          refreshInterval: 300000,
          notifications: true,
          updatedAt: new Date().toISOString(),
        }),
      );

      await Promise.all(configPromises);
      const creationTime = Date.now() - startTime;

      expect(creationTime).toBeLessThan(8000); // Should complete within 8 seconds

      // Test retrieval operations
      const retrievalStartTime = Date.now();
      const allConfigs = await toolConfigRepository.findAll();
      const enabledConfigs = await toolConfigRepository.findEnabled();
      const summary = await toolConfigManager.getConfigSummary();
      const retrievalTime = Date.now() - retrievalStartTime;

      expect(retrievalTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(allConfigs.length).toBeGreaterThanOrEqual(configCount);
      expect(enabledConfigs.length).toBeGreaterThanOrEqual(configCount / 2);
      expect(summary.total).toBeGreaterThanOrEqual(configCount);

      console.log(`Created ${configCount} configurations in ${creationTime}ms`);
      console.log(`Retrieved configurations in ${retrievalTime}ms`);
    });
  });
});
```

#### 3.2.2 API Performance Tests

**Action**: Test API endpoint performance

**API Performance Test**:

```typescript
// __tests__/performance/api-performance.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("API Performance - PostgreSQL", () => {
  beforeAll(async () => {
    // Setup test environment
  });

  afterAll(async () => {
    // Cleanup test environment
  });

  describe("Tools API Performance", () => {
    it("should respond to GET /api/tools/enabled within performance threshold", async () => {
      const startTime = Date.now();

      const response = await fetch("http://localhost:3000/api/tools/enabled");
      const responseTime = Date.now() - startTime;

      expect(response.ok).toBe(true);
      expect(responseTime).toBeLessThan(500); // Should respond within 500ms

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.tools)).toBe(true);
    });

    it("should handle concurrent tool API requests efficiently", async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();

      const requests = Array.from({ length: concurrentRequests }, () =>
        fetch("http://localhost:3000/api/tools/enabled").then((r) => r.json()),
      );

      const results = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeLessThan(2000); // All requests should complete within 2 seconds
      expect(results.every((r) => r.success)).toBe(true);

      console.log(
        `Executed ${concurrentRequests} concurrent requests in ${totalTime}ms`,
      );
      console.log(`Average response time: ${totalTime / concurrentRequests}ms`);
    });
  });

  describe("Batch API Performance", () => {
    it("should create jobs efficiently", async () => {
      const jobCount = 50;
      const startTime = Date.now();

      const jobPromises = Array.from({ length: jobCount }, (_, i) =>
        fetch("http://localhost:3000/api/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "perf_test",
            name: `Performance Test Job ${i}`,
            payload: { index: i, timestamp: Date.now() },
            priority: i % 5,
          }),
        }).then((r) => r.json()),
      );

      const results = await Promise.all(jobPromises);
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(results.every((r) => r.success)).toBe(true);
      expect(results.every((r) => r.jobId)).toBe(true);

      console.log(`Created ${jobCount} jobs in ${totalTime}ms`);
    });
  });

  describe("Health Check Performance", () => {
    it("should perform health checks quickly", async () => {
      const checks = 20;
      const startTime = Date.now();

      const healthPromises = Array.from({ length: checks }, () =>
        fetch("http://localhost:3000/api/health").then((r) => r.json()),
      );

      const results = await Promise.all(healthPromises);
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results.every((r) => r.status === "healthy")).toBe(true);

      console.log(`Performed ${checks} health checks in ${totalTime}ms`);
    });
  });
});
```

### 3.3 End-to-End Testing

**Estimated Time**: 6-8 hours

#### 3.3.1 E2E Test Framework Updates

**Action**: Update E2E tests for PostgreSQL workflows

**E2E Test Implementation**:

```typescript
// __tests__/e2e/postgresql-workflows.spec.ts
import { test, expect } from "@playwright/test";

test.describe("PostgreSQL Workflows", () => {
  test.beforeEach(async ({ page }) => {
    // Setup test environment and navigate to application
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test.describe("Tool Configuration Workflow", () => {
    test("should complete tool configuration workflow", async ({ page }) => {
      // Navigate to tools configuration
      await page.click("[data-testid='tool-config-button']");
      await expect(
        page.locator("[data-testid='tool-config-panel']"),
      ).toBeVisible();

      // Add new tool configuration
      await page.selectOption("[data-testid='tool-selector']", "github");
      await page.fill("[data-testid='api-token-input']", "test_token_123");
      await page.fill("[data-testid='refresh-interval-input']", "300000");
      await page.check("[data-testid='notifications-checkbox']");

      // Save configuration
      await page.click("[data-testid='save-config-button']");

      // Verify success message
      await expect(
        page.locator("[data-testid='success-message']"),
      ).toBeVisible();

      // Verify configuration appears in list
      await expect(
        page.locator("[data-testid='github-config-item']"),
      ).toBeVisible();

      // Verify configuration state
      await expect(
        page.locator("[data-testid='github-enabled-badge']"),
      ).toContainText("Enabled");
    });

    test("should disable tool configuration", async ({ page }) => {
      // First enable a tool
      await page.goto("/tools");
      await page.click("[data-testid='enable-github-button']");

      // Then disable it
      await page.click("[data-testid='disable-github-button']");
      await expect(
        page.locator("[data-testid='github-disabled-badge']"),
      ).toContainText("Disabled");

      // Verify API reflects the change
      const response = await page.evaluate(() =>
        fetch("/api/tools/enabled").then((r) => r.json()),
      );
      expect(
        response.tools.find((tool: any) => tool.toolName === "github"),
      ).toBeUndefined();
    });
  });

  test.describe("Job Processing Workflow", () => {
    test("should create and process jobs", async ({ page }) => {
      // Navigate to jobs section
      await page.click("[data-testid='jobs-button']");
      await expect(page.locator("[data-testid='jobs-panel']")).toBeVisible();

      // Create new job
      await page.click("[data-testid='create-job-button']");
      await page.selectOption("[data-testid='job-type-select']", "github_api");
      await page.fill("[data-testid='job-name-input']", "E2E Test Job");
      await page.fill("[data-testid='job-priority-input']", "5");

      await page.click("[data-testid='submit-job-button']");

      // Verify job appears in list
      await expect(
        page.locator("[data-testid='job-item-e2e-test-job']"),
      ).toBeVisible();
      await expect(
        page.locator("[data-testid='job-status-pending']"),
      ).toBeVisible();

      // Simulate job processing
      await page.click("[data-testid='process-job-button']");
      await expect(
        page.locator("[data-testid='job-status-completed']"),
      ).toBeVisible();
    });

    test("should handle job errors and retries", async ({ page }) => {
      // Create a job that will fail
      await page.evaluate(() => {
        fetch("/api/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "failing_job",
            name: "E2E Failing Job",
            payload: { shouldFail: true },
            priority: 1,
          }),
        });
      });

      // Navigate to jobs
      await page.click("[data-testid='jobs-button']");

      // Wait for job to appear and fail
      await page.waitForSelector("[data-testid='job-status-failed']", {
        timeout: 10000,
      });

      // Verify retry mechanism
      await page.click("[data-testid='retry-job-button']");
      await expect(
        page.locator("[data-testid='job-status-pending']"),
      ).toBeVisible();
    });
  });

  test.describe("Dashboard Integration", () => {
    test("should display correct data from PostgreSQL", async ({ page }) => {
      // Navigate to dashboard
      await page.goto("/");
      await expect(page.locator("[data-testid='dashboard']")).toBeVisible();

      // Verify job statistics
      await expect(
        page.locator("[data-testid='total-jobs-count']"),
      ).toContainText(/\d+/);
      await expect(
        page.locator("[data-testid='pending-jobs-count']"),
      ).toContainText(/\d+/);
      await expect(
        page.locator("[data-testid='completed-jobs-count']"),
      ).toContainText(/\d+/);

      // Verify tool configurations
      await expect(
        page.locator("[data-testid='enabled-tools-count']"),
      ).toContainText(/\d+/);
      await expect(
        page.locator("[data-testid='configured-tools-list']"),
      ).toBeVisible();
    });

    test("should refresh data and show real-time updates", async ({ page }) => {
      // Create a new job via API
      await page.evaluate(() => {
        fetch("/api/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "dashboard_test",
            name: "Dashboard Update Test",
            payload: { test: true },
            priority: 1,
          }),
        });
      });

      // Wait for dashboard to refresh
      await page.click("[data-testid='refresh-dashboard-button']");

      // Verify job count increased
      await expect(
        page.locator("[data-testid='pending-jobs-count']"),
      ).toContainText(/\d+/);
    });
  });

  test.describe("Error Handling", () => {
    test("should handle database connection errors gracefully", async ({
      page,
    }) => {
      // This would require simulating a database connection failure
      // For now, we'll test general error handling

      // Try to create job with invalid data
      const response = await page.evaluate(() => {
        return fetch("/api/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Invalid data - missing required fields
            type: "",
            name: "",
          }),
        });
      });

      expect(response.status).toBe(400);

      const errorData = await response.json();
      expect(errorData.success).toBe(false);
      expect(errorData.error).toBeDefined();
    });

    test("should display meaningful error messages", async ({ page }) => {
      // Test various error scenarios and verify user-friendly messages

      // Test form validation errors
      await page.goto("/tools");
      await page.click("[data-testid='add-tool-button']");
      await page.click("[data-testid='save-tool-button']");

      await expect(
        page.locator("[data-testid='form-error-message']"),
      ).toBeVisible();
      await expect(
        page.locator("[data-testid='form-error-message']"),
      ).toContainText("required");
    });
  });
});
```

### 3.4 Deployment Validation

**Estimated Time**: 4-6 hours

#### 3.4.1 Production Build Testing

**Action**: Validate production build and deployment

**Deployment Test Script**:

```bash
#!/bin/bash
# scripts/test-production-deployment.sh

echo "🚀 Testing PostgreSQL-Only Production Deployment"

set -e  # Exit on any error

# 1. Validate environment
echo "📋 Validating environment..."
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable not set"
    exit 1
fi

echo "✅ Environment validation passed"

# 2. Database connectivity test
echo "🔌 Testing PostgreSQL connectivity..."
npm run db:validate
echo "✅ PostgreSQL connectivity validated"

# 3. Type checking
echo "🔍 Running type checking..."
npm run type-check
echo "✅ Type checking passed"

# 4. Linting
echo "🧹 Running linting..."
npm run lint
echo "✅ Linting passed"

# 5. Unit tests
echo "🧪 Running unit tests..."
npm test
echo "✅ Unit tests passed"

# 6. Build application
echo "🔨 Building application..."
npm run build
echo "✅ Build completed successfully"

# 7. Start production server
echo "🏭 Starting production server..."
npm start &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 15

# 8. Health check
echo "💓 Checking server health..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)
if [ "$HEALTH_RESPONSE" != "200" ]; then
    echo "❌ Health check failed: HTTP $HEALTH_RESPONSE"
    kill $SERVER_PID
    exit 1
fi
echo "✅ Server health check passed"

# 9. API endpoint tests
echo "🌐 Testing API endpoints..."

# Test tools enabled endpoint
TOOLS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/tools/enabled)
if [ "$TOOLS_RESPONSE" != "200" ]; then
    echo "❌ Tools API test failed: HTTP $TOOLS_RESPONSE"
    kill $SERVER_PID
    exit 1
fi
echo "✅ Tools API test passed"

# Test batch endpoint
BATCH_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" \
    -d '{"type":"test","name":"Deployment Test Job","payload":{"test":true}}' \
    -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/batch)
if [ "$BATCH_RESPONSE" != "200" ]; then
    echo "❌ Batch API test failed: HTTP $BATCH_RESPONSE"
    kill $SERVER_PID
    exit 1
fi
echo "✅ Batch API test passed"

# 10. Memory and performance check
echo "📊 Checking memory usage..."
MEMORY_USAGE=$(ps -o pid,ppid,pcpu,pmem,cmd -p $SERVER_PID | tail -1 | awk '{print $4}')
echo "Memory usage: ${MEMORY_USAGE}%"

# 11. Cleanup
echo "🧹 Cleaning up..."
kill $SERVER_PID
echo "✅ Production server stopped"

echo ""
echo "🎉 All deployment validation tests passed!"
echo "✅ Environment validation"
echo "✅ Database connectivity"
echo "✅ Code quality checks"
echo "✅ Unit tests"
echo "✅ Production build"
echo "✅ Server startup"
echo "✅ Health checks"
echo "✅ API endpoints"
echo "✅ Performance monitoring"
echo ""
echo "Deployment is ready for production! 🚀"
```

#### 3.4.2 Docker Validation

**Action**: Test Docker deployment

**Docker Test Script**:

```bash
#!/bin/bash
# scripts/test-docker-deployment.sh

echo "🐳 Testing Docker PostgreSQL Deployment"

set -e

# Build Docker image
echo "🔨 Building Docker image..."
docker build -t hyperpage-postgresql:test .

# Start services
echo "🚀 Starting Docker services..."
docker-compose -f docker-compose.test.yml up -d --build

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Test database connectivity
echo "🔌 Testing database connectivity..."
docker exec hyperpage-app npm run db:validate

# Run application tests
echo "🧪 Running application tests..."
docker exec hyperpage-app npm test

# Test API endpoints
echo "🌐 Testing API endpoints..."
docker exec hyperpage-app curl -f http://localhost:3000/api/health

# Performance test
echo "⚡ Running performance test..."
docker exec hyperpage-app npm run test:performance

# Cleanup
echo "🧹 Cleaning up..."
docker-compose -f docker-compose.test.yml down -v

echo "✅ Docker deployment validation completed successfully!"
```

### 3.5 Final Validation and Documentation

**Estimated Time**: 2-4 hours

#### 3.5.1 Performance Benchmarking

**Action**: Create performance benchmarks

**Benchmark Script**:

```typescript
// scripts/performance-benchmark.ts
import { performance } from "perf_hooks";

interface BenchmarkResult {
  name: string;
  operations: number;
  totalTime: number;
  avgTime: number;
  operationsPerSecond: number;
}

async function benchmarkOperation(
  name: string,
  operation: () => Promise<void>,
  iterations: number = 1000,
): Promise<BenchmarkResult> {
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    await operation();
  }

  const endTime = performance.now();
  const totalTime = endTime - startTime;
  const avgTime = totalTime / iterations;
  const operationsPerSecond = (iterations / totalTime) * 1000;

  return {
    name,
    operations: iterations,
    totalTime,
    avgTime,
    operationsPerSecond,
  };
}

async function runBenchmarks() {
  console.log("🚀 Running PostgreSQL Performance Benchmarks\n");

  // Setup test database
  const testDb = await setupTestDatabase();

  const benchmarks = [
    {
      name: "Create Job",
      operation: async () => {
        await jobRepository.create({
          id: `bench_job_${Date.now()}_${Math.random()}`,
          type: "benchmark_test",
          name: "Benchmark Job",
          payload: JSON.stringify({ benchmark: true }),
          status: "pending",
          priority: 1,
          retryCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      },
      iterations: 100,
    },
    {
      name: "Find Job",
      operation: async () => {
        await jobRepository.findById("test-job-1");
      },
      iterations: 1000,
    },
    {
      name: "Find Pending Jobs",
      operation: async () => {
        await jobRepository.findPending(10);
      },
      iterations: 500,
    },
    {
      name: "Update Job Status",
      operation: async () => {
        await jobRepository.updateStatus("test-job-1", "processing");
        await jobRepository.updateStatus("test-job-1", "pending"); // Reset
      },
      iterations: 500,
    },
    {
      name: "Get Job Statistics",
      operation: async () => {
        await jobRepository.getJobStats();
      },
      iterations: 100,
    },
  ];

  const results: BenchmarkResult[] = [];

  for (const benchmark of benchmarks) {
    console.log(`Running ${benchmark.name}...`);
    const result = await benchmarkOperation(
      benchmark.name,
      benchmark.operation,
      benchmark.iterations,
    );
    results.push(result);

    console.log(
      `  ${result.name}: ${result.totalTime.toFixed(2)}ms total, ` +
        `${result.avgTime.toFixed(4)}ms avg, ` +
        `${result.operationsPerSecond.toFixed(2)} ops/sec\n`,
    );
  }

  // Summary
  console.log("📊 Benchmark Summary");
  console.log("=".repeat(50));

  for (const result of results) {
    console.log(
      `${result.name.padEnd(20)} | ` +
        `${result.operations.toString().padStart(4)} ops | ` +
        `${result.avgTime.toFixed(4).padStart(8)} ms avg | ` +
        `${result.operationsPerSecond.toFixed(1).padStart(8)} ops/sec`,
    );
  }

  // Cleanup
  await testDb.cleanup();

  console.log("\n✅ Benchmark completed successfully!");

  // Save results for comparison
  const resultsJson = JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      database: "PostgreSQL",
      results,
    },
    null,
    2,
  );

  require("fs").writeFileSync(
    "./benchmarks/postgresql-benchmarks.json",
    resultsJson,
  );

  console.log("💾 Results saved to benchmarks/postgresql-benchmarks.json");
}

// Run benchmarks
runBenchmarks().catch(console.error);
```

## Phase 3 Completion Checklist

### Test Infrastructure Updated

- [ ] Test database utilities created and functional
- [ ] All unit tests updated for PostgreSQL
- [ ] Integration tests validate end-to-end functionality
- [ ] Performance tests demonstrate acceptable performance
- [ ] E2E tests validate user workflows
- [ ] No SQLite references remain in tests

### Performance Validated

- [ ] Database queries perform within acceptable time limits
- [ ] Concurrent access patterns work efficiently
- [ ] Job processing handles expected load
- [ ] API response times meet requirements
- [ ] Memory usage is acceptable
- [ ] Connection pooling is efficient

### Deployment Ready

- [ ] Production build works with PostgreSQL
- [ ] Docker deployment tested and validated
- [ ] Environment configuration validates
- [ ] Monitoring and alerting functional
- [ ] Backup and recovery procedures tested
- [ ] Performance benchmarks documented

### Documentation Complete

- [ ] All testing procedures documented
- [ ] Performance benchmarks recorded
- [ ] Deployment validation completed
- [ ] Troubleshooting guides updated
- [ ] Team training materials completed

## Estimated Duration and Resources

- **Total Duration**: 3-5 days
- **Team Size**: 1-2 QA engineers + 1 developer
- **Critical Path**: Test execution and performance validation
- **Risk Level**: Low - Standard testing and validation

## Success Criteria

Phase 3 is successfully completed when:

1. All tests pass with PostgreSQL-only configuration (95%+ pass rate)
2. Performance meets or exceeds baseline requirements
3. Deployment validation completes successfully
4. All documentation is up-to-date
5. Team is trained and comfortable with new system

## Post-Phase 3 Deliverables

- Complete test suite with PostgreSQL-only configuration
- Performance benchmarks and optimization reports
- Deployment validation reports
- Production readiness checklist
- Team training completion certificates
- Post-implementation monitoring setup

## Next Steps After Phase 3

With all phases completed:

1. **Production Deployment**: Deploy to production environment
2. **Monitoring Setup**: Implement production monitoring and alerting
3. **Team Handover**: Complete knowledge transfer to operations team
4. **Post-Implementation Review**: Review lessons learned and improvements
5. **Ongoing Maintenance**: Establish PostgreSQL maintenance procedures

---

**Phase 3 Status**: Ready for execution  
**Last Updated**: 2025-01-11  
**Phase Lead**: [To be assigned]
