# Phase 2: Application Code Updates

## Overview

Phase 2 focuses on updating all application code to use PostgreSQL exclusively. This phase involves modernizing repository classes, updating API endpoints, and optimizing all database interactions for PostgreSQL.

## Prerequisites

- ✅ Phase 1 completed successfully (SQLite dependencies removed)
- ✅ PostgreSQL connection layer functional
- ✅ Development environment updated for PostgreSQL

## Phase 2 Tasks

### 2.1 Update Repository Classes

**Estimated Time**: 8-12 hours

#### 2.1.1 Job Repository Updates

**Action**: Update `lib/database/job-repository.ts` for PostgreSQL

**Implementation**:
```typescript
// lib/database/job-repository.ts - PostgreSQL Version
import { getPostgresDrizzleDb } from "./connection";
import * as pgSchema from "./pg-schema";
import { eq, and, gt, lt, orderBy, limit, sql, desc } from "drizzle-orm";
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

  async updateResult(id: string, result: Record<string, unknown>): Promise<void> {
    await this.db
      .update(pgSchema.jobs)
      .set({ 
        result: JSON.stringify(result),
        updatedAt: new Date().toISOString()
      })
      .where(eq(pgSchema.jobs.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(pgSchema.jobs).where(eq(pgSchema.jobs.id, id));
  }

  async findByStatus(status: string, limit_count: number = 50): Promise<Job[]> {
    return await this.db
      .select()
      .from(pgSchema.jobs)
      .where(eq(pgSchema.jobs.status, status))
      .orderBy(desc(pgSchema.jobs.createdAt))
      .limit(limit_count);
  }

  async findByType(type: string, limit_count: number = 50): Promise<Job[]> {
    return await this.db
      .select()
      .from(pgSchema.jobs)
      .where(eq(pgSchema.jobs.type, type))
      .orderBy(desc(pgSchema.jobs.createdAt))
      .limit(limit_count);
  }

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

  async findFailedJobs(limit_count: number = 20): Promise<Job[]> {
    return await this.db
      .select()
      .from(pgSchema.jobs)
      .where(eq(pgSchema.jobs.status, 'failed'))
      .orderBy(desc(pgSchema.jobs.updatedAt))
      .limit(limit_count);
  }

  async getJobStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const stats = await this.db
      .select({
        status: pgSchema.jobs.status,
        count: () => sql`COUNT(*)`
      })
      .from(pgSchema.jobs)
      .groupBy(pgSchema.jobs.status);

    const result = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };

    stats.forEach(stat => {
      const count = Number(stat.count);
      result.total += count;
      switch (stat.status) {
        case 'pending': result.pending = count; break;
        case 'processing': result.processing = count; break;
        case 'completed': result.completed = count; break;
        case 'failed': result.failed = count; break;
      }
    });

    return result;
  }

  async deleteOldJobs(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = await this.db
      .delete(pgSchema.jobs)
      .where(
        and(
          eq(pgSchema.jobs.status, 'completed'),
          lt(pgSchema.jobs.updatedAt, cutoffDate.toISOString())
        )
      );
    
    return result.rowCount || 0;
  }

  async incrementRetryCount(id: string): Promise<void> {
    await this.db
      .update(pgSchema.jobs)
      .set({ 
        retryCount: sql`${pgSchema.jobs.retryCount} + 1`,
        updatedAt: new Date().toISOString()
      })
      .where(eq(pgSchema.jobs.id, id));
  }
}

export const jobRepository = new JobRepository();
```

#### 2.1.2 Tool Configuration Repository Updates

**Action**: Update `lib/database/tool-config-repository.ts` for PostgreSQL

**Implementation**:
```typescript
// lib/database/tool-config-repository.ts - PostgreSQL Version
import { getPostgresDrizzleDb } from "./connection";
import * as pgSchema from "./pg-schema";
import { eq, and, isNull } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

export type ToolConfig = InferSelectModel<typeof pgSchema.toolConfigs>;
export type NewToolConfig = InferInsertModel<typeof pgSchema.toolConfigs>;

export class ToolConfigRepository {
  constructor(private db = getPostgresDrizzleDb()) {}

  async create(config: NewToolConfig): Promise<ToolConfig> {
    const [created] = await this.db.insert(pgSchema.toolConfigs).values(config).returning();
    return created;
  }

  async findByToolName(toolName: string): Promise<ToolConfig | null> {
    const [config] = await this.db
      .select()
      .from(pgSchema.toolConfigs)
      .where(eq(pgSchema.toolConfigs.toolName, toolName))
      .limit(1);
    return config || null;
  }

  async update(toolName: string, updates: Partial<NewToolConfig>): Promise<ToolConfig | null> {
    const [updated] = await this.db
      .update(pgSchema.toolConfigs)
      .set({
        ...updates,
        updatedAt: new Date().toISOString()
      })
      .where(eq(pgSchema.toolConfigs.toolName, toolName))
      .returning();
    return updated || null;
  }

  async delete(toolName: string): Promise<boolean> {
    const result = await this.db
      .delete(pgSchema.toolConfigs)
      .where(eq(pgSchema.toolConfigs.toolName, toolName));
    return (result.rowCount || 0) > 0;
  }

  async findEnabled(): Promise<ToolConfig[]> {
    return await this.db
      .select()
      .from(pgSchema.toolConfigs)
      .where(eq(pgSchema.toolConfigs.enabled, true));
  }

  async findDisabled(): Promise<ToolConfig[]> {
    return await this.db
      .select()
      .from(pgSchema.toolConfigs)
      .where(eq(pgSchema.toolConfigs.enabled, false));
  }

  async findAll(): Promise<ToolConfig[]> {
    return await this.db
      .select()
      .from(pgSchema.toolConfigs)
      .orderBy(pgSchema.toolConfigs.toolName);
  }

  async updateRefreshInterval(toolName: string, interval: number): Promise<boolean> {
    const result = await this.db
      .update(pgSchema.toolConfigs)
      .set({
        refreshInterval: interval,
        updatedAt: new Date().toISOString()
      })
      .where(eq(pgSchema.toolConfigs.toolName, toolName));
    return (result.rowCount || 0) > 0;
  }

  async updateNotifications(toolName: string, enabled: boolean): Promise<boolean> {
    const result = await this.db
      .update(pgSchema.toolConfigs)
      .set({
        notifications: enabled,
        updatedAt: new Date().toISOString()
      })
      .where(eq(pgSchema.toolConfigs.toolName, toolName));
    return (result.rowCount || 0) > 0;
  }

  async getEnabledToolsCount(): Promise<number> {
    const result = await this.db
      .select({ count: () => sql`COUNT(*)` })
      .from(pgSchema.toolConfigs)
      .where(eq(pgSchema.toolConfigs.enabled, true));
    return Number(result[0].count) || 0;
  }
}

export const toolConfigRepository = new ToolConfigRepository();
```

#### 2.1.3 Rate Limit Repository Updates

**Action**: Update `lib/database/rate-limit-repository.ts` for PostgreSQL

**Implementation**:
```typescript
// lib/database/rate-limit-repository.ts - PostgreSQL Version
import { getPostgresDrizzleDb } from "./connection";
import * as pgSchema from "./pg-schema";
import { eq, and, lt, gt } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

export type RateLimit = InferSelectModel<typeof pgSchema.rateLimits>;
export type NewRateLimit = InferInsertModel<typeof pgSchema.rateLimits>;

export class RateLimitRepository {
  constructor(private db = getPostgresDrizzleDb()) {}

  async create(limit: NewRateLimit): Promise<RateLimit> {
    const [created] = await this.db.insert(pgSchema.rateLimits).values(limit).returning();
    return created;
  }

  async findById(id: string): Promise<RateLimit | null> {
    const [limit] = await this.db
      .select()
      .from(pgSchema.rateLimits)
      .where(eq(pgSchema.rateLimits.id, id))
      .limit(1);
    return limit || null;
  }

  async findByPlatform(platform: string): Promise<RateLimit | null> {
    const [limit] = await this.db
      .select()
      .from(pgSchema.rateLimits)
      .where(eq(pgSchema.rateLimits.platform, platform))
      .limit(1);
    return limit || null;
  }

  async update(id: string, updates: Partial<NewRateLimit>): Promise<RateLimit | null> {
    const [updated] = await this.db
      .update(pgSchema.rateLimits)
      .set({
        ...updates,
        createdAt: new Date().toISOString()
      })
      .where(eq(pgSchema.rateLimits.id, id))
      .returning();
    return updated || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(pgSchema.rateLimits)
      .where(eq(pgSchema.rateLimits.id, id));
    return (result.rowCount || 0) > 0;
  }

  async deleteExpired(now: Date = new Date()): Promise<number> {
    const result = await this.db
      .delete(pgSchema.rateLimits)
      .where(lt(pgSchema.rateLimits.resetTime, now.toISOString()));
    return result.rowCount || 0;
  }

  async getActiveLimits(): Promise<RateLimit[]> {
    return await this.db
      .select()
      .from(pgSchema.rateLimits)
      .where(gt(pgSchema.rateLimits.resetTime, new Date().toISOString()));
  }

  async decrementRemaining(id: string): Promise<RateLimit | null> {
    const [updated] = await this.db
      .update(pgSchema.rateLimits)
      .set({
        limitRemaining: pgSchema.rateLimits.limitRemaining - 1,
        createdAt: new Date().toISOString()
      })
      .where(eq(pgSchema.rateLimits.id, id))
      .returning();
    return updated || null;
  }
}

export const rateLimitRepository = new RateLimitRepository();
```

#### 2.1.4 OAuth Token Repository Updates

**Action**: Update `lib/database/oauth-token-repository.ts` for PostgreSQL

**Implementation**:
```typescript
// lib/database/oauth-token-repository.ts - PostgreSQL Version
import { getPostgresDrizzleDb } from "./connection";
import * as pgSchema from "./pg-schema";
import { eq, and } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

export type OAuthToken = InferSelectModel<typeof pgSchema.oauthTokens>;
export type NewOAuthToken = InferInsertModel<typeof pgSchema.oauthTokens>;

export class OAuthTokenRepository {
  constructor(private db = getPostgresDrizzleDb()) {}

  async create(token: NewOAuthToken): Promise<OAuthToken> {
    const [created] = await this.db.insert(pgSchema.oauthTokens).values(token).returning();
    return created;
  }

  async findByUserIdAndProvider(userId: string, provider: string): Promise<OAuthToken | null> {
    const [token] = await this.db
      .select()
      .from(pgSchema.oauthTokens)
      .where(and(
        eq(pgSchema.oauthTokens.userId, userId),
        eq(pgSchema.oauthTokens.provider, provider)
      ))
      .limit(1);
    return token || null;
  }

  async findByUserId(userId: string): Promise<OAuthToken[]> {
    return await this.db
      .select()
      .from(pgSchema.oauthTokens)
      .where(eq(pgSchema.oauthTokens.userId, userId));
  }

  async findByProvider(provider: string): Promise<OAuthToken[]> {
    return await this.db
      .select()
      .from(pgSchema.oauthTokens)
      .where(eq(pgSchema.oauthTokens.provider, provider));
  }

  async update(id: string, updates: Partial<NewOAuthToken>): Promise<OAuthToken | null> {
    const [updated] = await this.db
      .update(pgSchema.oauthTokens)
      .set({
        ...updates,
        updatedAt: new Date().toISOString()
      })
      .where(eq(pgSchema.oauthTokens.id, id))
      .returning();
    return updated || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(pgSchema.oauthTokens)
      .where(eq(pgSchema.oauthTokens.id, id));
    return (result.rowCount || 0) > 0;
  }

  async deleteByUserIdAndProvider(userId: string, provider: string): Promise<boolean> {
    const result = await this.db
      .delete(pgSchema.oauthTokens)
      .where(and(
        eq(pgSchema.oauthTokens.userId, userId),
        eq(pgSchema.oauthTokens.provider, provider)
      ));
    return (result.rowCount || 0) > 0;
  }

  async findExpiredTokens(now: Date = new Date()): Promise<OAuthToken[]> {
    return await this.db
      .select()
      .from(pgSchema.oauthTokens)
      .where(lt(pgSchema.oauthTokens.expiresAt, now.toISOString()));
  }

  async cleanupExpiredTokens(now: Date = new Date()): Promise<number> {
    const result = await this.db
      .delete(pgSchema.oauthTokens)
      .where(lt(pgSchema.oauthTokens.expiresAt, now.toISOString()));
    return result.rowCount || 0;
  }
}

export const oauthTokenRepository = new OAuthTokenRepository();
```

### 2.2 Update API Endpoints

**Estimated Time**: 6-8 hours

#### 2.2.1 Update Tools API Endpoint

**Action**: Update `app/api/tools/enabled/route.ts`

**Implementation**:
```typescript
// app/api/tools/enabled/route.ts - PostgreSQL Version
import { NextRequest, NextResponse } from "next/server";
import { getPostgresDrizzleDb } from "@/lib/database/connection";
import { toolConfigs } from "@/lib/database/pg-schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const db = getPostgresDrizzleDb();
    
    const enabledTools = await db
      .select({
        toolName: toolConfigs.toolName,
        enabled: toolConfigs.enabled,
        config: toolConfigs.config,
        refreshInterval: toolConfigs.refreshInterval,
        notifications: toolConfigs.notifications,
        updatedAt: toolConfigs.updatedAt
      })
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

export async function POST(request: NextRequest) {
  try {
    const db = getPostgresDrizzleDb();
    const body = await request.json();
    
    const { toolName, enabled, config, refreshInterval, notifications } = body;
    
    if (!toolName) {
      return NextResponse.json(
        { success: false, error: "toolName is required" },
        { status: 400 }
      );
    }

    await db
      .insert(toolConfigs)
      .values({
        toolName,
        enabled: enabled !== false,
        config: config || {},
        refreshInterval: refreshInterval || 300000,
        notifications: notifications !== false,
        updatedAt: new Date().toISOString()
      })
      .onConflictDoUpdate({
        target: toolConfigs.toolName,
        set: {
          enabled: enabled !== false,
          config: config || {},
          refreshInterval: refreshInterval || 300000,
          notifications: notifications !== false,
          updatedAt: new Date().toISOString()
        }
      });

    return NextResponse.json({
      success: true,
      message: "Tool configuration updated",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating tool configuration:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to update tool configuration",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
```

#### 2.2.2 Update Health Check Endpoint

**Action**: Update `app/api/health/route.ts`

**Implementation**:
```typescript
// app/api/health/route.ts - PostgreSQL Version
import { NextRequest, NextResponse } from "next/server";
import { checkDatabaseConnectivity } from "@/lib/database/connection";

export async function GET(request: NextRequest) {
  try {
    // Check database connectivity
    const dbHealth = await checkDatabaseConnectivity();
    
    // Overall health status
    const isHealthy = dbHealth.status === "healthy";
    
    const healthData = {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      database: {
        status: dbHealth.status,
        details: dbHealth.details
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    const statusCode = isHealthy ? 200 : 503;
    return NextResponse.json(healthData, { status: statusCode });
    
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 503 }
    );
  }
}
```

#### 2.2.3 Update Batch API Endpoint

**Action**: Update `app/api/batch/route.ts`

**Implementation**:
```typescript
// app/api/batch/route.ts - PostgreSQL Version
import { NextRequest, NextResponse } from "next/server";
import { getPostgresDrizzleDb } from "@/lib/database/connection";
import { jobs } from "@/lib/database/pg-schema";
import { z } from "zod";

const jobSchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  priority: z.number().int().min(0).max(10).default(1),
  scheduledAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const db = getPostgresDrizzleDb();
    const body = await request.json();
    
    // Validate input
    const validatedJob = jobSchema.parse(body);
    
    // Generate job ID
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create job
    const [createdJob] = await db.insert(jobs).values({
      id: jobId,
      type: validatedJob.type,
      name: validatedJob.name,
      payload: JSON.stringify(validatedJob.payload),
      status: 'pending',
      priority: validatedJob.priority,
      scheduledAt: validatedJob.scheduledAt || new Date().toISOString(),
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    return NextResponse.json({
      success: true,
      jobId: createdJob.id,
      message: "Job created successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error creating batch job:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid job data",
          details: error.errors,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create job",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const db = getPostgresDrizzleDb();
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = db.select().from(jobs);
    
    if (status) {
      query = query.where(eq(jobs.status, status));
    }
    
    if (type) {
      query = query.where(eq(jobs.type, type));
    }

    const jobList = await query
      .orderBy(jobs.createdAt)
      .limit(Math.min(limit, 100))
      .offset(offset);

    return NextResponse.json({
      success: true,
      jobs: jobList,
      count: jobList.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch jobs",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
```

### 2.3 Update Configuration Management

**Estimated Time**: 4-6 hours

#### 2.3.1 Update Tool Config Manager

**Action**: Update `lib/tool-config-manager.ts`

**Implementation**:
```typescript
// lib/tool-config-manager.ts - PostgreSQL Version
import { getPostgresDrizzleDb } from "@/lib/database/connection";
import { toolConfigs } from "@/lib/database/pg-schema";
import { eq } from "drizzle-orm";

export interface ToolConfig {
  toolName: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  refreshInterval?: number;
  notifications?: boolean;
  updatedAt?: string;
}

export class ToolConfigManager {
  constructor(private db = getPostgresDrizzleDb()) {}

  async getConfig(toolName: string): Promise<ToolConfig | null> {
    const [config] = await this.db
      .select({
        toolName: toolConfigs.toolName,
        enabled: toolConfigs.enabled,
        config: toolConfigs.config,
        refreshInterval: toolConfigs.refreshInterval,
        notifications: toolConfigs.notifications,
        updatedAt: toolConfigs.updatedAt
      })
      .from(toolConfigs)
      .where(eq(toolConfigs.toolName, toolName))
      .limit(1);

    return config || null;
  }

  async setConfig(toolName: string, config: Omit<ToolConfig, 'toolName'>): Promise<void> {
    await this.db
      .insert(toolConfigs)
      .values({
        toolName,
        enabled: config.enabled,
        config: config.config || {},
        refreshInterval: config.refreshInterval || 300000,
        notifications: config.notifications !== false,
        updatedAt: new Date().toISOString()
      })
      .onConflictDoUpdate({
        target: toolConfigs.toolName,
        set: {
          enabled: config.enabled,
          config: config.config || {},
          refreshInterval: config.refreshInterval || 300000,
          notifications: config.notifications !== false,
          updatedAt: new Date().toISOString()
        }
      });
  }

  async getAllConfigs(): Promise<ToolConfig[]> {
    const configs = await this.db
      .select({
        toolName: toolConfigs.toolName,
        enabled: toolConfigs.enabled,
        config: toolConfigs.config,
        refreshInterval: toolConfigs.refreshInterval,
        notifications: toolConfigs.notifications,
        updatedAt: toolConfigs.updatedAt
      })
      .from(toolConfigs)
      .orderBy(toolConfigs.toolName);

    return configs;
  }

  async getEnabledConfigs(): Promise<ToolConfig[]> {
    const configs = await this.db
      .select({
        toolName: toolConfigs.toolName,
        enabled: toolConfigs.enabled,
        config: toolConfigs.config,
        refreshInterval: toolConfigs.refreshInterval,
        notifications: toolConfigs.notifications,
        updatedAt: toolConfigs.updatedAt
      })
      .from(toolConfigs)
      .where(eq(toolConfigs.enabled, true))
      .orderBy(toolConfigs.toolName);

    return configs;
  }

  async deleteConfig(toolName: string): Promise<boolean> {
    const result = await this.db
      .delete(toolConfigs)
      .where(eq(toolConfigs.toolName, toolName));
    return (result.rowCount || 0) > 0;
  }

  async toggleEnabled(toolName: string, enabled: boolean): Promise<boolean> {
    const result = await this.db
      .update(toolConfigs)
      .set({
        enabled,
        updatedAt: new Date().toISOString()
      })
      .where(eq(toolConfigs.toolName, toolName));
    return (result.rowCount || 0) > 0;
  }

  async updateRefreshInterval(toolName: string, interval: number): Promise<boolean> {
    const result = await this.db
      .update(toolConfigs)
      .set({
        refreshInterval: interval,
        updatedAt: new Date().toISOString()
      })
      .where(eq(toolConfigs.toolName, toolName));
    return (result.rowCount || 0) > 0;
  }

  async getConfigSummary(): Promise<{
    total: number;
    enabled: number;
    disabled: number;
  }> {
    const allConfigs = await this.db
      .select({
        enabled: toolConfigs.enabled
      })
      .from(toolConfigs);

    const summary = {
      total: allConfigs.length,
      enabled: allConfigs.filter(c => c.enabled).length,
      disabled: allConfigs.filter(c => !c.enabled).length
    };

    return summary;
  }
}

export const toolConfigManager = new ToolConfigManager();
```

### 2.4 Update OAuth and Authentication

**Estimated Time**: 4-6 hours

#### 2.4.1 Update OAuth Token Store

**Action**: Update `lib/oauth-token-store.ts`

**Implementation**:
```typescript
// lib/oauth-token-store.ts - PostgreSQL Version
import { getPostgresDrizzleDb } from "@/lib/database/connection";
import { oauthTokens, users } from "@/lib/database/pg-schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

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
  private db = getPostgresDrizzleDb();

  async storeToken(tokenData: OAuthTokenData): Promise<void> {
    const encryptedAccessToken = await this.encrypt(tokenData.accessToken);
    const encryptedRefreshToken = tokenData.refreshToken 
      ? await this.encrypt(tokenData.refreshToken) 
      : null;

    await this.db.insert(oauthTokens).values({
      userId: tokenData.userId,
      provider: tokenData.provider,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenType: tokenData.tokenType || 'Bearer',
      expiresAt: tokenData.expiresAt?.toISOString(),
      refreshExpiresAt: tokenData.refreshExpiresAt?.toISOString(),
      scopes: tokenData.scopes ? JSON.stringify(tokenData.scopes) : null,
      metadata: tokenData.metadata ? JSON.stringify(tokenData.metadata) : null,
      ivAccess: await this.generateIV(),
      ivRefresh: encryptedRefreshToken ? await this.generateIV() : null,
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
        ? await this.decrypt(token.refreshToken, token.ivRefresh!) 
        : undefined,
      tokenType: token.tokenType,
      expiresAt: token.expiresAt ? new Date(token.expiresAt) : undefined,
      refreshExpiresAt: token.refreshExpiresAt ? new Date(token.refreshExpiresAt) : undefined,
      scopes: token.scopes ? JSON.parse(token.scopes) : undefined,
      metadata: token.metadata ? JSON.parse(token.metadata) : undefined,
    };
  }

  async getTokensByUserId(userId: string): Promise<OAuthTokenData[]> {
    const tokens = await this.db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.userId, userId));

    return tokens.map(token => ({
      userId: token.userId,
      provider: token.provider,
      accessToken: "encrypted", // Don't decrypt for listing
      refreshToken: token.refreshToken ? "encrypted" : undefined,
      tokenType: token.tokenType,
      expiresAt: token.expiresAt ? new Date(token.expiresAt) : undefined,
      refreshExpiresAt: token.refreshExpiresAt ? new Date(token.refreshExpiresAt) : undefined,
      scopes: token.scopes ? JSON.parse(token.scopes) : undefined,
      metadata: token.metadata ? JSON.parse(token.metadata) : undefined,
    }));
  }

  async updateToken(userId: string, provider: string, updates: Partial<OAuthTokenData>): Promise<void> {
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    if (updates.accessToken) {
      updateData.accessToken = await this.encrypt(updates.accessToken);
      updateData.ivAccess = await this.generateIV();
    }

    if (updates.refreshToken) {
      updateData.refreshToken = await this.encrypt(updates.refreshToken);
      updateData.ivRefresh = await this.generateIV();
    }

    if (updates.expiresAt) {
      updateData.expiresAt = updates.expiresAt.toISOString();
    }

    if (updates.refreshExpiresAt) {
      updateData.refreshExpiresAt = updates.refreshExpiresAt.toISOString();
    }

    if (updates.scopes) {
      updateData.scopes = JSON.stringify(updates.scopes);
    }

    if (updates.metadata) {
      updateData.metadata = JSON.stringify(updates.metadata);
    }

    await this.db
      .update(oauthTokens)
      .set(updateData)
      .where(eq(oauthTokens.userId, userId));
  }

  async deleteToken(userId: string, provider: string): Promise<boolean> {
    const result = await this.db
      .delete(oauthTokens)
      .where(eq(oauthTokens.userId, userId));
    return (result.rowCount || 0) > 0;
  }

  async deleteTokensByUserId(userId: string): Promise<number> {
    const result = await this.db
      .delete(oauthTokens)
      .where(eq(oauthTokens.userId, userId));
    return result.rowCount || 0;
  }

  async isTokenExpired(userId: string, provider: string): Promise<boolean> {
    const token = await this.getToken(userId, provider);
    if (!token.expiresAt) return false;
    return token.expiresAt <= new Date();
  }

  async cleanupExpiredTokens(): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.db
      .delete(oauthTokens)
      .where(lt(oauthTokens.expiresAt, now));
    return result.rowCount || 0;
  }

  // Helper methods for encryption/decryption
  private async encrypt(token: string): Promise<string> {
    // Simple encryption for demo - use proper encryption in production
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.OAUTH_ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    cipher.setAutoPadding(true);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  private async decrypt(encryptedToken: string, iv: string): Promise<string> {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.OAUTH_ENCRYPTION_KEY || 'default-key', 'salt', 32);
    
    const [ivHex, encrypted] = encryptedToken.split(':');
    const ivBuffer = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAutoPadding(true);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private async generateIV(): Promise<string> {
    return crypto.randomBytes(16).toString('hex');
  }
}

export const oauthTokenStore = new PostgreSQLOAuthTokenStore();
```

### 2.5 Update Job Processing

**Estimated Time**: 4-6 hours

#### 2.5.1 Update Job Queue

**Action**: Update `lib/jobs/job-queue.ts`

**Implementation**:
```typescript
// lib/jobs/job-queue.ts - PostgreSQL Version
import { getPostgresDrizzleDb } from "@/lib/database/connection";
import { jobs } from "@/lib/database/pg-schema";
import { eq, and, lt, gt, orderBy, limit, desc } from "drizzle-orm";

export interface JobQueueItem {
  id: string;
  type: string;
  name: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  retryCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export class PostgreSQLJobQueue {
  private db = getPostgresDrizzleDb();

  async addJob(job: Omit<JobQueueItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.db.insert(jobs).values({
      id: jobId,
      type: job.type,
      name: job.name,
      payload: JSON.stringify(job.payload),
      status: job.status,
      priority: job.priority,
      scheduledAt: job.scheduledAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      retryCount: job.retryCount,
      lastError: job.lastError,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return jobId;
  }

  async getNextJob(maxPriority: number = 10): Promise<JobQueueItem | null> {
    const now = new Date().toISOString();
    const [job] = await this.db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.status, 'pending'),
          lt(jobs.scheduledAt, now),
          lte(jobs.priority, maxPriority)
        )
      )
      .orderBy(desc(jobs.priority), jobs.createdAt)
      .limit(1);

    if (!job) return null;

    return this.mapJobFromDatabase(job);
  }

  async getNextJobForType(type: string, maxPriority: number = 10): Promise<JobQueueItem | null> {
    const now = new Date().toISOString();
    const [job] = await this.db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.status, 'pending'),
          eq(jobs.type, type),
          lt(jobs.scheduledAt, now),
          lte(jobs.priority, maxPriority)
        )
      )
      .orderBy(desc(jobs.priority), jobs.createdAt)
      .limit(1);

    if (!job) return null;

    return this.mapJobFromDatabase(job);
  }

  async getJobById(jobId: string): Promise<JobQueueItem | null> {
    const [job] = await this.db
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    return job ? this.mapJobFromDatabase(job) : null;
  }

  async markJobProcessing(jobId: string): Promise<boolean> {
    const result = await this.db
      .update(jobs)
      .set({
        status: 'processing',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(jobs.id, jobId));

    return (result.rowCount || 0) > 0;
  }

  async markJobCompleted(jobId: string, result?: Record<string, unknown>): Promise<boolean> {
    const result_data = result ? JSON.stringify(result) : null;
    const dbResult = await this.db
      .update(jobs)
      .set({
        status: 'completed',
        completedAt: new Date().toISOString(),
        result: result_data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(jobs.id, jobId));

    return (dbResult.rowCount || 0) > 0;
  }

  async markJobFailed(jobId: string, error: string): Promise<boolean> {
    const dbResult = await this.db
      .update(jobs)
      .set({
        status: 'failed',
        lastError: error,
        retryCount: jobs.retryCount + 1,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(jobs.id, jobId));

    return (dbResult.rowCount || 0) > 0;
  }

  async retryJob(jobId: string): Promise<boolean> {
    const dbResult = await this.db
      .update(jobs)
      .set({
        status: 'pending',
        startedAt: null,
        completedAt: null,
        lastError: null,
        retryCount: jobs.retryCount + 1,
        scheduledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(jobs.id, jobId));

    return (dbResult.rowCount || 0) > 0;
  }

  async deleteJob(jobId: string): Promise<boolean> {
    const result = await this.db
      .delete(jobs)
      .where(eq(jobs.id, jobId));
    return (result.rowCount || 0) > 0;
  }

  async getJobsByStatus(status: string, limit_count: number = 50): Promise<JobQueueItem[]> {
    const jobList = await this.db
      .select()
      .from(jobs)
      .where(eq(jobs.status, status))
      .orderBy(desc(jobs.createdAt))
      .limit(limit_count);

    return jobList.map(job => this.mapJobFromDatabase(job));
  }

  async getJobsByType(type: string, limit_count: number = 50): Promise<JobQueueItem[]> {
    const jobList = await this.db
      .select()
      .from(jobs)
      .where(eq(jobs.type, type))
      .orderBy(desc(jobs.createdAt))
      .limit(limit_count);

    return jobList.map(job => this.mapJobFromDatabase(job));
  }

  async getFailedJobs(limit_count: number = 20): Promise<JobQueueItem[]> {
    const jobList = await this.db
      .select()
      .from(jobs)
      .where(eq(jobs.status, 'failed'))
      .orderBy(desc(jobs.updatedAt))
      .limit(limit_count);

    return jobList.map(job => this.mapJobFromDatabase(job));
  }

  async getJobStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const stats = await this.db
      .select({
        status: jobs.status,
        count: () => sql`COUNT(*)`
      })
      .from(jobs)
      .groupBy(jobs.status);

    const result = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };

    stats.forEach(stat => {
      const count = Number(stat.count);
      result.total += count;
      switch (stat.status) {
        case 'pending': result.pending = count; break;
        case 'processing': result.processing = count; break;
        case 'completed': result.completed = count; break;
        case 'failed': result.failed = count; break;
      }
    });

    return result;
  }

  async cleanupCompletedJobs(olderThanHours: number = 24): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);
    
    const result = await this.db
      .delete(jobs)
      .where(
        and(
          eq(jobs.status, 'completed'),
          lt(jobs.updatedAt, cutoffDate.toISOString())
        )
      );
    
    return result.rowCount || 0;
  }

  private mapJobFromDatabase(job: any): JobQueueItem {
    return {
      id: job.id,
      type: job.type,
      name: job.name,
      payload: job.payload ? JSON.parse(job.payload) : {},
      status: job.status,
      priority: job.priority,
      scheduledAt: job.scheduledAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      retryCount: job.retryCount,
      lastError: job.lastError,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}

export const jobQueue = new PostgreSQLJobQueue();
```

## Phase 2 Completion Checklist

### Repository Layer Updated
- [ ] Job repository updated for PostgreSQL schema
- [ ] Tool configuration repository updated
- [ ] Rate limit repository updated
- [ ] OAuth token repository updated
- [ ] All repositories use PostgreSQL features (JSON, timestamps)

### API Endpoints Updated
- [ ] Tools enabled endpoint uses PostgreSQL
- [ ] Health check endpoint validates PostgreSQL
- [ ] Batch API endpoint creates jobs in PostgreSQL
- [ ] All SQLite health check fallbacks removed

### Application Logic Updated
- [ ] Tool config manager optimized for PostgreSQL
- [ ] OAuth token storage uses PostgreSQL encryption
- [ ] Job queue optimized for PostgreSQL patterns
- [ ] All modules use PostgreSQL-specific features

### Performance Optimizations
- [ ] Queries optimized for PostgreSQL
- [ ] JSON fields used appropriately
- [ ] Timestamp handling optimized
- [ ] Connection pooling efficient

## Estimated Duration and Resources

- **Total Duration**: 5-7 days
- **Team Size**: 2-3 developers
- **Critical Path**: Repository updates and API endpoint modifications
- **Risk Level**: Medium - Code changes across multiple modules

## Validation and Testing

### 2.6.1 Unit Tests
**Action**: Update unit tests for all updated repository classes

**Test Example**:
```typescript
// __tests__/unit/database/job-repository.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { JobRepository } from "../../../lib/database/job-repository";
import { setupTestDatabase } from "../../setup/test-database";

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

  it("should create and retrieve job", async () => {
    const jobData = {
      id: "test_job_123",
      type: "test",
      name: "Test Job",
      payload: { test: true },
      status: "pending" as const,
      priority: 1,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const createdJob = await jobRepository.create(jobData);
    expect(createdJob.id).toBe("test_job_123");
    expect(createdJob.type).toBe("test");

    const retrievedJob = await jobRepository.findById("test_job_123");
    expect(retrievedJob).toBeDefined();
    expect(retrievedJob?.type).toBe("test");
  });

  it("should find pending jobs", async () => {
    // Test implementation...
  });
});
```

### 2.6.2 Integration Tests
**Action**: Test end-to-end functionality with PostgreSQL

**Test Example**:
```typescript
// __tests__/integration/repository-integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDatabase } from "../setup/test-database";
import { jobRepository } from "../../lib/database/job-repository";
import { jobQueue } from "../../lib/jobs/job-queue";

describe("Repository Integration - PostgreSQL", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it("should handle complete job lifecycle", async () => {
    // Create job via queue
    const jobId = await jobQueue.addJob({
      type: "integration_test",
      name: "Integration Test Job",
      payload: { test: true, timestamp: Date.now() },
      status: "pending",
      priority: 1,
      retryCount: 0,
    });

    expect(jobId).toBeDefined();

    // Retrieve job
    const job = await jobRepository.findById(jobId);
    expect(job).toBeDefined();
    expect(job?.status).toBe("pending");

    // Mark as processing
    const marked = await jobQueue.markJobProcessing(jobId);
    expect(marked).toBe(true);

    // Mark as completed
    const completed = await jobQueue.markJobCompleted(jobId, { 
      result: "success", 
      processedAt: new Date().toISOString() 
    });
    expect(completed).toBe(true);

    // Verify completion
    const completedJob = await jobRepository.findById(jobId);
    expect(completedJob?.status).toBe("completed");
    expect(completedJob?.result).toBeDefined();
  });
});
```

### 2.6.3 Performance Tests
**Action**: Validate PostgreSQL performance improvements

**Test Example**:
```typescript
// __tests__/performance/repository-performance.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDatabase } from "../setup/test-database";
import { jobRepository } from "../../lib/database/job-repository";

describe("Repository Performance - PostgreSQL", () => {
  let testDb: TestDatabase;
  let jobRepository: JobRepository;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    jobRepository = new JobRepository(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it("should handle batch operations efficiently", async () => {
    const batchSize = 100;
    const startTime = Date.now();

    // Create batch of jobs
    const jobPromises = Array.from({ length: batchSize }, (_, i) => 
      jobRepository.create({
        id: `perf_job_${i}`,
        type: "performance_test",
        name: `Performance Test Job ${i}`,
        payload: { index: i, timestamp: Date.now() },
        status: "pending",
        priority: i % 10,
        retryCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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

    expect(pendingJobs.length).toBeGreaterThanOrEqual(batchSize * 0.9);
    expect(retrievalTime).toBeLessThan(1000); // Should retrieve within 1 second
  });
});
```

## Success Criteria

Phase 2 is successfully completed when:
1. All repository classes use PostgreSQL schema
2. All API endpoints work with PostgreSQL
3. Application logic optimized for PostgreSQL features
4. All tests pass with PostgreSQL-only configuration
5. Performance meets or exceeds baseline requirements

## Next Steps Preview

Phase 3 will focus on **Testing & Validation**:
- Update test infrastructure for PostgreSQL-only
- Run comprehensive integration tests
- Validate performance and functionality
- Test deployment and operational procedures

---

**Phase 2 Status**: Ready for execution  
**Last Updated**: 2025-01-11  
**Phase Lead**: [To be assigned]
