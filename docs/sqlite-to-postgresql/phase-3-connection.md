# Phase 3: Database Connection Overhaul

**Duration:** 2-3 hours  
**Status:** Ready for Implementation  
**Prerequisites:** Phase 1 & 2 completed

## Overview

This phase implements PostgreSQL connection pooling, health checks, error handling, and proper connection lifecycle management to replace the simple SQLite file-based connections.

## PostgreSQL Connection Architecture

This phase defines a simple, production-safe connection pattern using a shared Pool and Drizzle for node-postgres. It must work correctly in a Next.js/server environment (including serverless-style deployments) without relying on long-lived global timers or process-level hooks.

### Connection Pooling Benefits

- **Performance**: Reuse connections instead of creating new ones
- **Scalability**: Handle multiple concurrent requests
- **Resource Management**: Limit active connections
- **Error Handling**: Better connection error recovery

## Implementation Steps

### Step 1: Minimal, Reusable Pool + Drizzle

```typescript
// lib/database/connection.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://hyperpage:password@localhost:5432/hyperpage";

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX ?? 20),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT ?? 30_000),
  connectionTimeoutMillis: Number(
    process.env.DB_CONNECTION_TIMEOUT ?? 5_000,
  ),
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

const db = drizzle(pool, { schema });

export function getAppDatabase() {
  return { pool, drizzle: db };
}
```

// Environment variables
export const DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER || "hyperpage"}:${process.env.POSTGRES_PASSWORD || "password"}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DB || "hyperpage"}?sslmode=${process.env.NODE_ENV === "production" ? "require" : "disable"}`;

export const POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
export const POSTGRES_PORT = parseInt(process.env.POSTGRES_PORT || "5432");
export const POSTGRES_DB = process.env.POSTGRES_DB || "hyperpage";
export const POSTGRES_USER = process.env.POSTGRES_USER || "hyperpage";
export const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "password";

// Pool settings
export const DB_POOL_MAX = parseInt(process.env.DB_POOL_MAX || "20");
export const DB_POOL_MIN = parseInt(process.env.DB_POOL_MIN || "5");
export const DB_IDLE_TIMEOUT = parseInt(process.env.DB_IDLE_TIMEOUT || "30000");
export const DB_CONNECTION_TIMEOUT = parseInt(
  process.env.DB_CONNECTION_TIMEOUT || "5000",
);
```

### Step 2: Simple Health Check Utility

```typescript
// lib/database/health.ts
import { getAppDatabase } from "./connection";

export type DatabaseHealthStatus = "healthy" | "unhealthy";

export interface DatabaseHealth {
  status: DatabaseHealthStatus;
  responseTimeMs: number;
  error?: string;
}

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const start = Date.now();
  try {
    const { pool } = getAppDatabase();
    await pool.query("SELECT 1");
    return {
      status: "healthy",
      responseTimeMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      responseTimeMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

### Step 3: Usage Pattern

- All code should import from the shared connection:

```typescript
import { getAppDatabase } from "@/lib/database/connection";

const { drizzle } = getAppDatabase();

const jobs = await drizzle.select().from(schema.jobs);
```

- Health endpoint(s) should call `checkDatabaseHealth()` instead of building their own pools.
- Avoid process-level signal handling and long-running intervals inside library code; let the hosting platform manage process lifecycle.

### Step 4: Database Metrics and Monitoring

#### Connection Metrics

```typescript
// lib/database/metrics.ts
import { Pool } from "pg";

export interface DatabaseMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  poolUtilization: number;
  averageResponseTime: number;
  errorRate: number;
  lastActivity: Date;
}

export class DatabaseMetricsCollector {
  private pool: Pool;
  private metrics: DatabaseMetrics;
  private startTime: Date;

  constructor(pool: Pool) {
    this.pool = pool;
    this.startTime = new Date();
    this.metrics = this.getInitialMetrics();
  }

  private getInitialMetrics(): DatabaseMetrics {
    return {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingConnections: 0,
      poolUtilization: 0,
      averageResponseTime: 0,
      errorRate: 0,
      lastActivity: new Date(),
    };
  }

  updateMetrics(): DatabaseMetrics {
    const total = this.pool.totalCount;
    const idle = this.pool.idleCount;
    const waiting = this.pool.waitingCount;
    const active = total - idle;

    this.metrics = {
      totalConnections: total,
      activeConnections: active,
      idleConnections: idle,
      waitingConnections: waiting,
      poolUtilization: (active / (this.pool.options?.max || 20)) * 100,
      averageResponseTime: 0, // Would be calculated from health checks
      errorRate: 0, // Would be calculated from error tracking
      lastActivity: new Date(),
    };

    return this.metrics;
  }

  getMetrics(): DatabaseMetrics {
    return { ...this.metrics };
  }

  getPoolStatus(): {
    healthy: boolean;
    utilization: "low" | "medium" | "high" | "critical";
    recommendations: string[];
  } {
    const metrics = this.updateMetrics();
    const utilization = metrics.poolUtilization;

    let status: "low" | "medium" | "high" | "critical" = "low";
    if (utilization > 80) status = "critical";
    else if (utilization > 60) status = "high";
    else if (utilization > 40) status = "medium";

    const recommendations: string[] = [];
    if (metrics.waitingConnections > 0) {
      recommendations.push("Consider increasing pool size");
    }
    if (utilization > 80) {
      recommendations.push("Pool utilization is critically high");
    }

    return {
      healthy: metrics.errorRate < 5, // Less than 5% error rate
      utilization: status,
      recommendations,
    };
  }
}
```

### Step 5: Error Handling and Recovery

#### Connection Error Recovery

```typescript
// lib/database/recovery.ts
import { Pool, PoolClient } from "pg";

export class DatabaseRecovery {
  private pool: Pool;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async executeWithRetry<T>(
    operation: (client: PoolClient) => Promise<T>,
    context: string = "database operation",
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const client = await this.pool.connect();

        try {
          const result = await operation(client);
          return result;
        } finally {
          client.release();
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");

        if (attempt === this.maxRetries) {
          break;
        }

        console.warn(
          `Database ${context} attempt ${attempt} failed:`,
          lastError.message,
        );

        // Exponential backoff
        await this.sleep(this.retryDelay * Math.pow(2, attempt - 1));
      }
    }

    throw new Error(
      `Database ${context} failed after ${this.maxRetries} attempts: ${lastError?.message}`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.executeWithRetry(async (client) => {
        const result = await client.query("SELECT 1");
        return result.rows[0]._1 === 1;
      }, "connection test");
      return true;
    } catch (error) {
      console.error("Connection test failed:", error);
      return false;
    }
  }
}
```

## Environment Configuration

### Updated .env.local.sample

```env
# Database Connection Configuration
DATABASE_URL=postgresql://hyperpage:password@localhost:5432/hyperpage
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=hyperpage
POSTGRES_USER=hyperpage
POSTGRES_PASSWORD=password

# Connection Pool Settings
DB_POOL_MAX=20
DB_POOL_MIN=5
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=5000

# Query Settings
DB_STATEMENT_TIMEOUT=30000
DB_QUERY_TIMEOUT=30000

# SSL Configuration (Production)
# SSL_MODE=require
# SSL_CERT_PATH=/path/to/client-cert.pem
# SSL_KEY_PATH=/path/to/client-key.pem
# SSL_CA_PATH=/path/to/ca-cert.pem
```

## API Endpoints

### Database Health Endpoint

```typescript
// app/api/health/database/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getHealth } from "@/lib/database/connection";

export async function GET(request: NextRequest) {
  try {
    const health = await getHealth();

    const response: {
      status: "healthy" | "degraded" | "unhealthy";
      data: {
        responseTime: number;
        connectionCount: number;
        lastCheck: string;
        error?: string;
      };
    } = {
      status: health.status,
      data: {
        responseTime: health.responseTime,
        connectionCount: health.connectionCount,
        lastCheck: health.lastCheck.toISOString(),
        error: health.error,
      },
    };

    return NextResponse.json(response, {
      status:
        health.status === "healthy"
          ? 200
          : health.status === "degraded"
            ? 200
            : 503,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        data: {
          error: "Database health check failed",
        },
      },
      { status: 503 },
    );
  }
}
```

### Database Metrics Endpoint

```typescript
// app/api/metrics/database/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAppDatabase } from "@/lib/database/connection";
import { DatabaseMetricsCollector } from "@/lib/database/metrics";

let metricsCollector: DatabaseMetricsCollector | null = null;

export async function GET(request: NextRequest) {
  try {
    const { pool } = getAppDatabase();

    if (!metricsCollector) {
      metricsCollector = new DatabaseMetricsCollector(pool);
    }

    const metrics = metricsCollector.getMetrics();
    const status = metricsCollector.getPoolStatus();

    return NextResponse.json({
      metrics,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to collect database metrics",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
```

## Testing Connection Management

### Unit Tests

```typescript
// __tests__/lib/database/connection.test.ts
import { dbManager } from "@/lib/database/connection";

describe("Database Connection Manager", () => {
  beforeAll(async () => {
    await dbManager.initialize();
  });

  afterAll(async () => {
    await dbManager.close();
  });

  test("should initialize connection pool", async () => {
    const state = await dbManager.initialize();
    expect(state.isInitialized).toBe(true);
    expect(state.pool).toBeDefined();
    expect(state.drizzle).toBeDefined();
  });

  test("should perform health check", async () => {
    const health = await dbManager.getHealth();
    expect(health).toBeDefined();
    expect(health.status).toBeDefined();
    expect(health.responseTime).toBeGreaterThan(0);
  });

  test("should get client connection", async () => {
    const client = await dbManager.getClient();
    expect(client).toBeDefined();
    client.release();
  });
});
```

## Performance Testing

### Load Testing

```typescript
// Performance test for connection pooling
async function testConnectionPoolPerformance() {
  const { pool } = getAppDatabase();

  console.log("Starting connection pool performance test...");

  const concurrentQueries = Array.from({ length: 50 }, async (_, i) => {
    const start = Date.now();
    await pool.query("SELECT $1 as test, NOW() as timestamp", [i]);
    return Date.now() - start;
  });

  const results = await Promise.all(concurrentQueries);
  const average = results.reduce((a, b) => a + b, 0) / results.length;

  console.log(`Average query time: ${average}ms`);
  console.log(`Min: ${Math.min(...results)}ms, Max: ${Math.max(...results)}ms`);

  return {
    average,
    min: Math.min(...results),
    max: Math.max(...results),
    totalQueries: results.length,
  };
}
```

## Validation Checklist

### Connection Management

- [ ] Connection pool initializes successfully
- [ ] Health checks work and return accurate status
- [ ] Connection lifecycle management handles shutdown properly
- [ ] Error recovery mechanisms function correctly
- [ ] Metrics collection provides useful insights

### Performance

- [ ] Connection pooling improves performance
- [ ] Concurrent requests handled efficiently
- [ ] Resource usage optimized
- [ ] Timeout configurations working

### Monitoring

- [ ] Health check endpoints responding
- [ ] Metrics collection working
- [ ] Error tracking functioning
- [ ] Logging provides useful information

## Success Criteria

✅ **Connection pooling working efficiently**  
✅ **Health checks providing accurate status**  
✅ **Error recovery handling connection failures**  
✅ **Metrics collection functional**  
✅ **API endpoints responding correctly**  
✅ **Performance improvements measurable**  
✅ **Resource management optimized**

## Next Phase Prerequisites

- Connection pooling fully functional
- Health monitoring working
- Error handling robust
- Performance baseline established
- API endpoints ready for use

---

**Phase 3 Status**: Ready for Implementation  
**Next**: [Phase 4: Migration System Updates](phase-4-migration-system.md)
