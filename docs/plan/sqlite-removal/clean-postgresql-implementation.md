# Clean PostgreSQL Implementation Guide

## Overview

This document provides a comprehensive 3-phase implementation plan for cleanly removing SQLite from Hyperpage and establishing PostgreSQL as the exclusive database engine. This approach leverages existing PostgreSQL infrastructure while eliminating all migration complexity.

## Prerequisites

### Infrastructure Requirements
- ✅ PostgreSQL deployment running and operational
- ✅ Database connection configured and tested
- ✅ Development environment ready for PostgreSQL
- ✅ Team familiar with PostgreSQL operations

### Code Dependencies
- Existing `lib/database/pg-schema.ts` - PostgreSQL schema definitions
- Existing `lib/database/client.ts` - PostgreSQL connection pool
- Existing dual-engine support in `lib/database/connection.ts`

## Implementation Timeline: 2-3 Weeks

```mermaid
gantt
    title Clean PostgreSQL Implementation
    dateFormat  YYYY-MM-DD
    section Week 1
    SQLite Dependencies Removal :phase1, 2025-01-11, 5d
    section Week 2  
    Application Code Updates :phase2, after phase1, 5d
    section Week 3
    Testing & Validation :phase3, after phase2, 3d
```

---

# Phase 1: SQLite Removal & PostgreSQL Setup (Week 1)

## Objectives

1. **Remove all SQLite dependencies** from codebase and package.json
2. **Clean up SQLite schema and connection logic**
3. **Configure PostgreSQL-only database layer**
4. **Update environment variables and configuration**
5. **Remove dual-engine support complexity**

## Phase 1 Tasks

### 1.1 Remove SQLite Dependencies

**Actions**:
- [ ] Remove `better-sqlite3` package from dependencies
- [ ] Remove `@types/better-sqlite3` type definitions
- [ ] Remove `drizzle-orm/better-sqlite3` import statements
- [ ] Clean up any SQLite-related import statements

**Commands**:
```bash
# Remove SQLite dependencies
npm uninstall better-sqlite3 @types/better-sqlite3

# Verify removal
npm ls better-sqlite3
```

**Verification**:
```bash
# Check for remaining SQLite references
grep -r "better-sqlite3" . --exclude-dir=node_modules --exclude-dir=.next
```

### 1.2 Clean Up SQLite Schema File

**Actions**:
- [ ] Archive existing `lib/database/schema.ts` for reference
- [ ] Remove SQLite schema definitions from codebase
- [ ] Update any imports of SQLite schema
- [ ] Remove SQLite-specific type definitions

**Implementation**:
```bash
# Archive old schema file
mkdir -p docs/plan/sqlite-removal/legacy
mv lib/database/schema.ts docs/plan/sqlite-removal/legacy/sqlite-schema.ts
```

**Code Changes**:
```typescript
// Remove from all files:
import * as sqliteSchema from "./schema";

// Keep only:
import * as pgSchema from "./pg-schema";
```

### 1.3 Update Database Connection Layer

**Actions**:
- [ ] Simplify `lib/database/connection.ts` for PostgreSQL-only
- [ ] Remove SQLite connection logic and fallbacks
- [ ] Remove `DB_ENGINE` environment variable logic
- [ ] Remove SQLite-specific health checks
- [ ] Update connection pooling for PostgreSQL-only

**Updated Connection Layer**:
```typescript
// lib/database/connection.ts - Simplified PostgreSQL-only
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as pgSchema from "./pg-schema";
import { getPgPool } from "./client";
import logger from "@/lib/logger";

type PostgresDrizzleInstance = NodePgDatabase<typeof pgSchema>;

let _pgDrizzleDb: PostgresDrizzleInstance | null = null;

/**
 * Get the PostgreSQL database instance (PostgreSQL-only)
 */
export function getPostgresDrizzleDb(): PostgresDrizzleInstance {
  if (_pgDrizzleDb) {
    return _pgDrizzleDb;
  }

  const pool = getPgPool();
  _pgDrizzleDb = drizzlePostgres(pool, { schema: pgSchema });

  logger.info("PostgreSQL database connection established");

  return _pgDrizzleDb;
}

// Export for backward compatibility
export const getPrimaryDrizzleDb = getPostgresDrizzleDb;
export const getReadWriteDb = getPostgresDrizzleDb;

/**
 * Health check for PostgreSQL connectivity
 */
export async function checkDatabaseConnectivity(): Promise<{
  status: "healthy" | "unhealthy";
  details: Record<string, unknown>;
}> {
  try {
    const db = getPostgresDrizzleDb();
    await db.execute({ sql: "SELECT 1" });
    
    return {
      status: "healthy",
      details: {
        message: "PostgreSQL database connection successful",
      },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      details: {
        message: "PostgreSQL database connectivity check failed",
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Close database connections (PostgreSQL-only)
 */
export function closeAllConnections(): void {
  logger.info("Closing PostgreSQL database connections");
  _pgDrizzleDb = null;
  // Pool cleanup handled by client.ts
}
```

### 1.4 Update Environment Variables

**Actions**:
- [ ] Remove SQLite-specific environment variables
- [ ] Clean up `.env.local.sample`
- [ ] Update Docker configurations
- [ ] Remove dual-engine configuration logic

**Updated .env.local.sample**:
```env
# Database Configuration (PostgreSQL Only)
DATABASE_URL=postgresql://user:password@localhost:5432/hyperpage
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=hyperpage
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# REMOVE these SQLite variables:
# DATABASE_PATH=./data/hyperpage.db
# DB_ENGINE=postgres
```

**Docker Compose Updates**:
```yaml
# docker-compose.yml - PostgreSQL Only
services:
  app:
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/hyperpage
    depends_on:
      - db
  
  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=hyperpage
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

### 1.5 Update Package.json Scripts

**Actions**:
- [ ] Remove SQLite-specific npm scripts
- [ ] Add PostgreSQL validation scripts
- [ ] Update migration scripts to reference PostgreSQL only

**Updated package.json**:
```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "type-check": "npx tsc --noEmit",
    "lint": "eslint .",
    "lint:sec": "npx eslint . --ext .ts,.tsx --config eslint.config.js --rule 'no-console: error' --rule 'no-debugger: error' --rule 'no-alert: error'",
    "prettier": "npx prettier --check .",
    "prettier:fix": "npx prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:all": "vitest run && test:e2e:docker",
    "test:e2e:docker": "docker-compose -f __tests__/e2e/docker-compose.e2e.yml --profile e2e up --abort-on-container-exit --build",
    "db:validate": "ts-node --esm scripts/validate-postgresql-connection.ts",
    "db:migrate": "drizzle-kit migrate:pg --config=drizzle.config.ts",
    "db:generate": "drizzle-kit generate:pg --config=drizzle.config.ts",
    "db:push": "drizzle-kit push:pg --config=drizzle.config.ts"
  },
  "dependencies": {
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-slot": "^1.2.3",
    "@tanstack/react-query": "^5.90.5",
    "@types/pg": "^8.15.6",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "drizzle-orm": "^0.44.7",
    "ioredis": "^5.8.2",
    "lucide-react": "^0.545.0",
    "next": "15.5.4",
    "pg": "^8.16.3",
    "pino": "^10.1.0",
    "pino-pretty": "^13.1.2",
    "prom-client": "^15.1.3",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "recharts": "^3.2.1",
    "tailwind-merge": "^3.3.1",
    "tailwindcss-animate": "^1.0.7",
    "undici": "^7.16.0",
    "zod": "^4.1.12"
  }
}
```

### 1.6 Update Drizzle Configuration

**Actions**:
- [ ] Clean up `drizzle.config.ts` for PostgreSQL-only
- [ ] Remove SQLite schema references
- [ ] Configure PostgreSQL migrations
- [ ] Update database connection settings

**Updated drizzle.config.ts**:
```typescript
import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export default {
  schema: "./lib/database/pg-schema.ts",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

## Phase 1 Completion Criteria

**Dependencies Removed**:
- [ ] `better-sqlite3` and `@types/better-sqlite3` removed from package.json
- [ ] No SQLite import statements remain in codebase
- [ ] SQLite schema file archived to legacy folder

**Configuration Updated**:
- [ ] Database connection simplified for PostgreSQL-only
- [ ] Environment variables cleaned up
- [ ] Docker configuration updated
- [ ] Drizzle configuration updated for PostgreSQL

**Code Cleaned**:
- [ ] `lib/database/connection.ts` simplified
- [ ] Dual-engine logic removed
- [ ] SQLite health checks removed
- [ ] Connection pooling updated for PostgreSQL

## Phase 1 Estimated Duration

- **Duration**: 5-7 days
- **Team Size**: 1-2 developers
- **Critical Path**: Connection layer updates and environment configuration
- **Risk Level**: Low - Straightforward dependency removal

---

# Phase 2: Application Code Updates (Week 2)

## Objectives

1. **Update repository classes** for PostgreSQL-only operation
2. **Clean up API endpoints** and remove SQLite fallbacks
3. **Remove configuration complexity** (DB_ENGINE, etc.)
4. **Update OAuth and job processing** patterns
5. **Optimize for PostgreSQL-specific features**

## Phase 2 Tasks

### 2.1 Update Repository Classes

**Actions**:
- [ ] Update all repository classes to use PostgreSQL schema
- [ ] Remove SQLite-specific query optimizations
- [ ] Update data types and field mappings
- [ ] Optimize queries for PostgreSQL features

**Repository Update Example**:
```typescript
// lib/database/job-repository.ts - Updated for PostgreSQL
import { getPostgresDrizzleDb } from "./connection";
import * as pgSchema from "./pg-schema";
import { eq, and, gt, orderBy, limit } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

export type Job = InferSelectModel<typeof pgSchema.jobs>;
export type NewJob = InferInsertModel<typeof pgSchema.jobs>;

export class JobRepository {
  constructor(private db = getPostgresDrizzleDb()) {}

  async create(job: NewJob): Promise<Job> {
    const [created] = await this.db.insert(pgSchema.jobs).values(job).returning();
    return created;
  }

  async findById(id: string): Promise<Job | null> {
    const [job] = await this.db
      .select()
      .from(pgSchema.jobs)
      .where(eq(pgSchema.jobs.id, id))
      .limit(1);
    return job || null;
  }

  async findPending(limit_count: number = 100): Promise<Job[]> {
    return await this.db
      .select()
      .from(pgSchema.jobs)
      .where(eq(pgSchema.jobs.status, 'pending'))
      .orderBy(pgSchema.jobs.scheduledAt)
      .limit(limit_count);
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db
      .update(pgSchema.jobs)
      .set({ 
        status,
        updatedAt: new Date().toISOString()
      })
      .where(eq(pgSchema.jobs.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(pgSchema.jobs).where(eq(pgSchema.jobs.id, id));
  }

  // PostgreSQL-specific optimizations
  async findExpiredJobs(now: Date = new Date()): Promise<Job[]> {
    return await this.db
      .select()
      .from(pgSchema.jobs)
      .where(
        and(
          eq(pgSchema.jobs.status, 'pending'),
          lt(pgSchema.jobs.scheduledAt, now.toISOString())
        )
      )
      .orderBy(pgSchema.jobs.scheduledAt);
  }

  async getJobStats(): Promise<{ total: number; pending: number; completed: number }> {
    const stats = await this.db
      .select({
        status: pgSchema.jobs.status,
        count: () => sql`COUNT(*)`
      })
      .from(pgSchema.jobs)
      .groupBy(pgSchema.jobs.status);

    const result = { total: 0, pending: 0, completed: 0 };
    stats.forEach(stat => {
      result.total += Number(stat.count);
      if (stat.status === 'pending') result.pending = Number(stat.count);
      if (stat.status === 'completed') result.completed = Number(stat.count);
    });
    return result;
  }
}

export const jobRepository = new JobRepository();
```

### 2.2 Update API Endpoints

**Actions**:
- [ ] Update `/api/tools/enabled` for PostgreSQL
- [ ] Remove SQLite health check fallbacks
- [ ] Update batch processing endpoints
- [ ] Remove dual-database routing logic
- [ ] Optimize API response patterns for PostgreSQL

**API Update Example**:
```typescript
// app/api/tools/enabled/route.ts - Updated
import { NextRequest, NextResponse } from "next/server";
import { getPostgresDrizzleDb } from "@/lib/database/connection";
import { toolConfigs } from "@/lib/database/pg-schema";

export async function GET(request: NextRequest) {
  try {
    const db = getPostgresDrizzleDb();
    
    const enabledTools = await db
      .select()
      .from(toolConfigs)
      .where(eq(toolConfigs.enabled, true));

    return NextResponse.json({
      success: true,
      tools: enabledTools,
      count: enabledTools.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching enabled tools:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch enabled tools",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
```

### 2.3 Update Configuration Management

**Actions**:
- [ ] Update `lib/tool-config-manager.ts` for PostgreSQL
- [ ] Remove SQLite-specific storage patterns
- [ ] Update configuration validation
- [ ] Optimize for PostgreSQL JSON storage

**Updated Configuration Manager**:
```typescript
// lib/tool-config-manager.ts - PostgreSQL Version
import { getPostgresDrizzleDb } from "@/lib/database/connection";
import { toolConfigs } from "@/lib/database/pg-schema";
import { eq, and } from "drizzle-orm";

export interface ToolConfig {
  toolName: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  refreshInterval?: number;
  notifications?: boolean;
  updatedAt?: Date;
}

export class ToolConfigManager {
  constructor(private db = getPostgresDrizzleDb()) {}

  async getConfig(toolName: string): Promise<ToolConfig | null> {
    const [config] = await this.db
      .select()
      .from(toolConfigs)
      .where(eq(toolConfigs.toolName, toolName))
      .limit(1);

    return config ? {
      toolName: config.toolName,
      enabled: config.enabled,
      config: config.config || {},
      refreshInterval: config.refreshInterval,
      notifications: config.notifications,
      updatedAt: config.updatedAt
    } : null;
  }

  async setConfig(toolName: string, config: Omit<ToolConfig, 'toolName'>): Promise<void> {
    await this.db
      .insert(toolConfigs)
      .values({
        toolName,
        enabled: config.enabled,
        config: config.config || {},
        refreshInterval: config.refreshInterval,
        notifications: config.notifications || true,
        updatedAt: new Date().toISOString()
      })
      .onConflictDoUpdate({
        target: toolConfigs.toolName,
        set: {
          enabled: config.enabled,
          config: config.config || {},
          refreshInterval: config.refreshInterval,
          notifications: config.notifications || true,
          updatedAt: new Date().toISOString()
        }
      });
  }

  async getAllConfigs(): Promise<ToolConfig[]> {
    const configs = await this.db
      .select()
      .from(toolConfigs);

    return configs.map(config => ({
      toolName: config.toolName,
      enabled: config.enabled,
      config: config.config || {},
      refreshInterval: config.refreshInterval,
      notifications: config.notifications,
      updatedAt: config.updatedAt
    }));
  }
}

export const toolConfigManager = new ToolConfigManager();
```

### 2.4 Update OAuth and Authentication

**Actions**:
- [ ] Update OAuth token storage for PostgreSQL
- [ ] Update user management for PostgreSQL
- [ ] Remove SQLite-specific authentication patterns
- [ ] Optimize for PostgreSQL security features

**Updated OAuth Storage**:
```typescript
// lib/oauth-token-store.ts - PostgreSQL Version
import { getPostgresDrizzleDb } from "@/lib/database/connection";
import { oauthTokens, users } from "@/lib/database/pg-schema";
import { eq } from "drizzle-orm";

export interface OAuthTokenData {
  userId: string;
  provider: string;
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: Date;
  refreshExpiresAt?: Date;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

export class PostgreSQLOAuthTokenStore {
  constructor(private db = getPostgresDrizzleDb()) {}

  async storeToken(tokenData: OAuthTokenData): Promise<void> {
    await this.db.insert(oauthTokens).values({
      userId: tokenData.userId,
      provider: tokenData.provider,
      accessToken: await this.encrypt(tokenData.accessToken),
      refreshToken: tokenData.refreshToken 
        ? await this.encrypt(tokenData.refreshToken) 
        : null,
      tokenType: tokenData.tokenType || 'Bearer',
      expiresAt: tokenData.expiresAt?.toISOString(),
      refreshExpiresAt: tokenData.refreshExpiresAt?.toISOString(),
      scopes: tokenData.scopes ? JSON.stringify(tokenData.scopes) : null,
      metadata: tokenData.metadata ? JSON.stringify(tokenData.metadata) : null,
      ivAccess: await this.generateIV(),
      ivRefresh: tokenData.refreshToken ? await this.generateIV() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async getToken(userId: string, provider: string): Promise<OAuthTokenData | null> {
    const [token] = await this.db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.userId, userId))
      .limit(1);

    if (!token) return null;

    return {
      userId: token.userId,
      provider: token.provider,
      accessToken: await this.decrypt(token.accessToken, token.ivAccess),
      refreshToken: token.refreshToken 
        ? await this.decrypt(token.refreshToken, token.ivAccess!) 
        : undefined,
      tokenType: token.tokenType,
      expiresAt: token.expiresAt ? new Date(token.expiresAt) : undefined,
      refreshExpiresAt: token.refreshExpiresAt ? new Date(token.refreshExpiresAt) : undefined,
      scopes: token.scopes ? JSON.parse(token.scopes) : undefined,
      metadata: token.metadata ? JSON.parse(token.metadata) : undefined,
    };
  }

  async deleteToken(userId: string, provider: string): Promise<void> {
    await this.db
      .delete(oauthTokens)
      .where(eq(oauthTokens.userId, userId));
  }

  // Helper methods for encryption/decryption
  private async encrypt(token: string): Promise<string> {
    // Implement encryption logic
    return `encrypted_${token}`;
  }

  private async decrypt(encryptedToken: string, iv: string): Promise<string> {
    // Implement decryption logic
    return encryptedToken.replace('encrypted_', '');
  }

  private async generateIV(): Promise<string> {
    return `iv_${Date.now()}`;
  }
}

export const oauthTokenStore = new PostgreSQLOAuthTokenStore();
```

### 2.5 Update Job Processing

**Actions**:
- [ ] Update job queue for PostgreSQL
- [ ] Remove SQLite timestamp handling
- [ ] Optimize for PostgreSQL JSON storage
- [ ] Update job scheduling patterns

**Updated Job Queue**:
```typescript
// lib/jobs/job-queue.ts - PostgreSQL Version
import { getPostgresDrizzleDb } from "@/lib/database/connection";
import { jobs } from "@/lib/database/pg-schema";
import { eq, and, lt, orderBy, limit } from "drizzle-orm";

export interface JobQueueItem {
  id: string;
  type: string;
  name: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class PostgreSQLJobQueue {
  constructor(private db = getPostgresDrizzleDb()) {}

  async addJob(job: Omit<JobQueueItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.db.insert(jobs).values({
      id: jobId,
      type: job.type,
      name: job.name,
      payload: JSON.stringify(job.payload),
      status: job.status,
      priority: job.priority,
      scheduledAt: job.scheduledAt?.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      retryCount: job.retryCount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return jobId;
  }

  async getNextJob(): Promise<JobQueueItem | null> {
    const [job] = await this.db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.status, 'pending'),
          lt(jobs.scheduledAt, new Date().toISOString())
        )
      )
      .orderBy(jobs.priority, jobs.createdAt)
      .limit(1);

    if (!job) return null;

    return {
      id: job.id,
      type: job.type,
      name: job.name,
      payload: job.payload ? JSON.parse(job.payload) : {},
      status: job.status,
      priority: job.priority,
      scheduledAt: job.scheduledAt ? new Date(job.scheduledAt) : undefined,
      startedAt: job.startedAt ? new Date(job.startedAt) : undefined,
      completedAt: job.completedAt ? new Date(job.completedAt) : undefined,
      retryCount: job.retryCount,
      createdAt: new Date(job.createdAt),
      updatedAt: new Date(job.updatedAt),
    };
  }

  async markJobProcessing(jobId: string): Promise<void> {
    await this.db
      .update(jobs)
      .set({
        status: 'processing',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(jobs.id, jobId));
  }

  async markJobCompleted(jobId: string, result?: Record<string, unknown>): Promise<void> {
    await this.db
      .update(jobs)
      .set({
        status: 'completed',
        completedAt: new Date().toISOString(),
        result: result ? JSON.stringify(result) : null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(jobs.id, jobId));
  }

  async markJobFailed(jobId: string, error: string): Promise<void> {
    await this.db
      .update(jobs)
      .set({
        status: 'failed',
        lastError: error,
        retryCount: jobs.retryCount + 1,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(jobs.id, jobId));
  }
}

export const jobQueue = new PostgreSQLJobQueue();
```

## Phase 2 Completion Criteria

**Repository Layer Updated**:
- [ ] All repository classes use PostgreSQL schema
- [ ] SQLite-specific optimizations removed
- [ ] PostgreSQL features leveraged (JSON, timestamps, etc.)

**API Endpoints Updated**:
- [ ] All API endpoints use PostgreSQL
- [ ] SQLite health check fallbacks removed
- [ ] Dual-database routing logic removed

**Application Logic Updated**:
- [ ] OAuth token storage optimized for PostgreSQL
- [ ] Job processing updated for PostgreSQL
- [ ] Configuration management cleaned up
- [ ] All modules use PostgreSQL patterns

## Phase 2 Estimated Duration

- **Duration**: 5-7 days
- **Team Size**: 2-3 developers
- **Critical Path**: Repository updates and API endpoint modifications
- **Risk Level**: Medium - Code changes across multiple modules

---

# Phase 3: Testing & Validation (Week 3)

## Objectives

1. **Update all test infrastructure** for PostgreSQL
2. **Validate performance and functionality**
3. **Test deployment and operational procedures**
4. **Final integration and acceptance testing**

## Phase 3 Tasks

### 3.1 Update Test Infrastructure

**Actions**:
- [ ] Update unit tests for PostgreSQL-only
- [ ] Remove SQLite test fixtures and utilities
- [ ] Update integration tests for PostgreSQL patterns
- [ ] Configure test database connections
- [ ] Update test data setup for PostgreSQL

**Updated Test Setup**:
```typescript
// __tests__/setup/test-database.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as pgSchema from "../../lib/database/pg-schema";
import { createTestPgDatabase } from "../../lib/database/test-utils";

export interface TestDatabase {
  db: ReturnType<typeof drizzle>;
  cleanup: () => Promise<void>;
}

export async function setupTestDatabase(): Promise<TestDatabase> {
  // Use test PostgreSQL database
  const testPool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || 
      "postgresql://test:test@localhost:5432/hyperpage_test",
  });

  const db = drizzle(testPool, { schema: pgSchema });

  // Run migrations for test database
  await db.execute({ sql: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` });
  
  // Clean up function
  const cleanup = async () => {
    // Clean up test data
    await db.execute({ sql: `
      TRUNCATE TABLE ${Object.keys(pgSchema).map(() => 'users').join(', ')} CASCADE;
    `});
    await testPool.end();
  };

  return { db, cleanup };
}

// Unit test example
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { JobRepository } from "../../lib/database/job-repository";
import { setupTestDatabase } from "../setup/test-database";

describe("JobRepository", () => {
  let testDb: TestDatabase;
  let jobRepository: JobRepository;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    jobRepository = new JobRepository(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it("should create and retrieve job", async () => {
    const jobData = {
      type: "test",
      name: "Test Job",
      payload: { test: true },
      status: "pending" as const,
      priority: 1,
    };

    const createdJob = await jobRepository.create(jobData);
    expect(createdJob.id).toBeDefined();
    expect(createdJob.type).toBe("test");

    const retrievedJob = await jobRepository.findById(createdJob.id);
    expect(retrievedJob).toBeDefined();
    expect(retrievedJob?.type).toBe("test");
    expect(retrievedJob?.payload).toEqual(jobData.payload);
  });

  it("should find pending jobs", async () => {
    // Create test jobs
    await jobRepository.create({
      type: "test",
      name: "Pending Job 1",
      payload: { order: 1 },
      status: "pending",
      priority: 1,
    });

    await jobRepository.create({
      type: "test",
      name: "Processing Job",
      payload: { order: 2 },
      status: "processing",
      priority: 1,
    });

    await jobRepository.create({
      type: "test",
      name: "Pending Job 2",
      payload: { order: 3 },
      status: "pending",
      priority: 2,
    });

    const pendingJobs = await jobRepository.findPending(10);
    
    expect(pendingJobs).toHaveLength(2);
    expect(pendingJobs.every(job => job.status === "pending")).toBe(true);
    expect(pendingJobs[0].priority).toBeGreaterThanOrEqual(pendingJobs[1].priority);
  });
});
```

### 3.2 Integration Testing

**Actions**:
- [ ] Create integration test suite for PostgreSQL
- [ ] Test repository operations end-to-end
- [ ] Validate API endpoints with PostgreSQL
- [ ] Test OAuth flow with PostgreSQL
- [ ] Validate job processing with PostgreSQL

**Integration Test Example**:
```typescript
// __tests__/integration/postgresql-integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDatabase } from "../setup/test-database";
import { jobRepository } from "../../lib/database/job-repository";
import { toolConfigManager } from "../../lib/tool-config-manager";
import { jobQueue } from "../../lib/jobs/job-queue";

describe("PostgreSQL Integration Tests", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe("Job Queue Integration", () => {
    it("should handle complete job lifecycle", async () => {
      // Create job via queue
      const jobId = await jobQueue.addJob({
        type: "integration_test",
        name: "Integration Test Job",
        payload: { test: true, timestamp: Date.now() },
        status: "pending",
        priority: 1,
        scheduledAt: new Date(),
        retryCount: 0,
      });

      expect(jobId).toBeDefined();

      // Retrieve job
      const job = await jobRepository.findById(jobId);
      expect(job).toBeDefined();
      expect(job?.status).toBe("pending");

      // Mark as processing
      await jobQueue.markJobProcessing(jobId);

      // Mark as completed
      await jobQueue.markJobCompleted(jobId, { 
        result: "success", 
        processedAt: new Date().toISOString() 
      });

      // Verify completion
      const completedJob = await jobRepository.findById(jobId);
      expect(completedJob?.status).toBe("completed");
      expect(completedJob?.result).toBeDefined();
    });
  });

  describe("Configuration Management Integration", () => {
    it("should handle tool configuration workflow", async () => {
      const toolName = "test_tool";
      const config = {
        enabled: true,
        config: {
          apiKey: "test_key",
          settings: { debug: true }
        },
        refreshInterval: 300000,
        notifications: true,
      };

      // Set configuration
      await toolConfigManager.setConfig(toolName, config);

      // Retrieve configuration
      const retrievedConfig = await toolConfigManager.getConfig(toolName);
      expect(retrievedConfig).toBeDefined();
      expect(retrievedConfig?.enabled).toBe(true);
      expect(retrievedConfig?.config).toEqual(config.config);

      // Update configuration
      const updatedConfig = { ...config, enabled: false };
      await toolConfigManager.setConfig(toolName, updatedConfig);

      const updated = await toolConfigManager.getConfig(toolName);
      expect(updated?.enabled).toBe(false);
    });
  });
});
```

### 3.3 Performance Testing

**Actions**:
- [ ] Benchmark database query performance
- [ ] Test concurrent access patterns
- [ ] Validate job processing performance
- [ ] Test API response times
- [ ] Monitor memory usage and connection pooling

**Performance Test Example**:
```typescript
// __tests__/performance/postgresql-performance.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDatabase } from "../setup/test-database";
import { jobRepository } from "../../lib/database/job-repository";

describe("PostgreSQL Performance Tests", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it("should handle batch job operations efficiently", async () => {
    const batchSize = 100;
    const startTime = Date.now();

    // Create batch of jobs
    const jobPromises = Array.from({ length: batchSize }, (_, i) => 
      jobRepository.create({
        type: "performance_test",
        name: `Performance Test Job ${i}`,
        payload: { index: i, timestamp: Date.now() },
        status: "pending",
        priority: i % 10,
      })
    );

    const createdJobs = await Promise.all(jobPromises);
    const creationTime = Date.now() - startTime;

    expect(createdJobs).toHaveLength(batchSize);
    expect(creationTime).toBeLessThan(5000); // Should complete within 5 seconds

    // Test batch retrieval
    const retrievalStartTime = Date.now();
    const pendingJobs = await jobRepository.findPending(1000);
    const retrievalTime = Date.now() - retrievalStartTime;

    expect(pendingJobs.length).toBeGreaterThanOrEqual(batchSize * 0.9); // Allow for some race conditions
    expect(retrievalTime).toBeLessThan(1000); // Should retrieve within 1 second
  });

  it("should handle concurrent queries efficiently", async () => {
    const concurrentQueries = 10;
    const startTime = Date.now();

    const queryPromises = Array.from({ length: concurrentQueries }, async () => {
      const jobs = await jobRepository.findPending(50);
      return jobs.length;
    });

    const results = await Promise.all(queryPromises);
    const totalTime = Date.now() - startTime;

    expect(results).toHaveLength(concurrentQueries);
    expect(totalTime).toBeLessThan(2000); // All queries should complete within 2 seconds
  });
});
```

### 3.4 End-to-End Testing

**Actions**:
- [ ] Update E2E tests for PostgreSQL
- [ ] Test complete user workflows
- [ ] Validate OAuth authentication flows
- [ ] Test tool configuration through UI
- [ ] Test job processing through API

**E2E Test Example**:
```typescript
// __tests__/e2e/postgresql-workflows.spec.ts
import { test, expect } from "@playwright/test";

test.describe("PostgreSQL Workflows", () => {
  test.beforeEach(async ({ page }) => {
    // Setup test database and authentication
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("complete tool configuration workflow", async ({ page }) => {
    // Navigate to tools configuration
    await page.click("[data-testid='tool-config-button']");
    await expect(page.locator("[data-testid='tool-config-panel']")).toBeVisible();

    // Configure a tool
    await page.selectOption("[data-testid='tool-selector']", "github");
    await page.fill("[data-testid='api-token-input']", "test_token");
    await page.click("[data-testid='save-config-button']");

    // Verify configuration saved
    await expect(page.locator("[data-testid='success-message']")).toBeVisible();

    // Verify tool appears in enabled tools list
    await page.goto("/api/tools/enabled");
    const response = await page.evaluate(() => fetch("/api/tools/enabled").then(r => r.json()));
    expect(response.tools.some((tool: any) => tool.toolName === "github")).toBe(true);
  });

  test("job processing workflow", async ({ page }) => {
    // Create a job through API
    const jobResponse = await page.evaluate(async () => {
      return fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "test_job",
          name: "E2E Test Job",
          payload: { test: true }
        })
      }).then(r => r.json());
    });

    expect(jobResponse.success).toBe(true);
    expect(jobResponse.jobId).toBeDefined();

    // Verify job is processed
    await page.waitForTimeout(2000);

    // Check job status
    const statusResponse = await page.evaluate(async (jobId: string) => {
      return fetch(`/api/jobs/${jobId}`).then(r => r.json());
    }, jobResponse.jobId);

    expect(["completed", "processing"]).toContain(statusResponse.job.status);
  });
});
```

### 3.5 Deployment Validation

**Actions**:
- [ ] Test deployment with PostgreSQL-only configuration
- [ ] Validate production environment setup
- [ ] Test backup and recovery procedures
- [ ] Validate monitoring and alerting
- [ ] Test performance under production load

**Deployment Test Script**:
```bash
#!/bin/bash
# test-deployment.sh

echo "🚀 Testing PostgreSQL-Only Deployment"

# 1. Validate PostgreSQL connectivity
echo "📋 Testing PostgreSQL connectivity..."
npm run db:validate

# 2. Run all tests
echo "🧪 Running test suite..."
npm test

# 3. Build application
echo "🔨 Building application..."
npm run build

# 4. Test production build
echo "🏭 Testing production build..."
npm start &
SERVER_PID=$!

# Wait for server to start
sleep 10

# Test API endpoints
curl -f http://localhost:3000/api/health
curl -f http://localhost:3000/api/tools/enabled

# Kill test server
kill $SERVER_PID

echo "✅ Deployment validation completed successfully!"
```

## Phase 3 Completion Criteria

**Test Infrastructure Updated**:
- [ ] All unit tests pass with PostgreSQL
- [ ] Integration tests validate end-to-end functionality
- [ ] Performance tests demonstrate acceptable performance
- [ ] E2E tests validate user workflows
- [ ] No SQLite references remain in tests

**Performance Validated**:
- [ ] Database queries perform within acceptable time limits
- [ ] Concurrent access patterns work efficiently
- [ ] Job processing handles expected load
- [ ] API response times meet requirements

**Deployment Ready**:
- [ ] Production build works with PostgreSQL
- [ ] Environment configuration validates
- [ ] Monitoring and alerting functional
- [ ] Backup and recovery procedures tested

## Phase 3 Estimated Duration

- **Duration**: 3-5 days
- **Team Size**: 1-2 QA engineers + 1 developer
- **Critical Path**: Test execution and performance validation
- **Risk Level**: Low - Standard testing and validation

---

# Success Metrics

## Implementation Success Indicators

### Technical Metrics
- **SQLite Removal**: 100% of SQLite code removed from codebase
- **Test Coverage**: >95% test pass rate across all test suites
- **Performance**: Database queries perform within acceptable limits
- **Functionality**: All features work as expected with PostgreSQL

### Timeline Metrics
- **Phase 1 Completion**: 5-7 days as planned
- **Phase 2 Completion**: 5-7 days as planned
- **Phase 3 Completion**: 3-5 days as planned
- **Total Timeline**: 2-3 weeks as planned

### Quality Metrics
- **Code Quality**: All linting and type checking passes
- **Integration**: All components work together seamlessly
- **Documentation**: Complete and accurate documentation
- **Team Readiness**: Team comfortable with new architecture

## Post-Implementation Benefits

### Immediate Benefits
- **Simplified Architecture**: Single database engine
- **Better Performance**: PostgreSQL optimizations
- **Cleaner Codebase**: No dual-engine complexity
- **Modern Standards**: Current best practices

### Long-term Benefits
- **Scalability**: Better support for concurrent users
- **Reliability**: PostgreSQL's robust features
- **Maintainability**: Simpler codebase to maintain
- **Future-Proof**: Modern database foundation

---

This clean PostgreSQL implementation provides a fast, low-risk path to removing SQLite while establishing a modern, performant database architecture for the Hyperpage project.
