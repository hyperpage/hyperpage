# Phase 3: Database Connection Overhaul

**Duration:** 2-3 hours  
**Status:** Ready for Implementation  
**Prerequisites:** Phase 1 & 2 completed

## Overview

This phase implements PostgreSQL connection pooling, health checks, error handling, and proper connection lifecycle management to replace the simple SQLite file-based connections.

## PostgreSQL Connection Architecture

### Connection Pooling Benefits

- **Performance**: Reuse connections instead of creating new ones
- **Scalability**: Handle multiple concurrent requests
- **Resource Management**: Limit active connections
- **Error Handling**: Better connection error recovery

## Implementation Steps

### Step 1: Enhanced Connection Pool Configuration

#### Advanced Pool Configuration

```typescript
// lib/database/connection.ts - Enhanced configuration
const poolConfig = {
  // Core connection settings
  connectionString: DATABASE_URL,

  // Pool size management
  max: parseInt(process.env.DB_POOL_MAX || "20"),
  min: parseInt(process.env.DB_POOL_MIN || "5"),

  // Timeout settings
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000"),
  connectionTimeoutMillis: parseInt(
    process.env.DB_CONNECTION_TIMEOUT || "5000",
  ),

  // Health check settings
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || "30000"),
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || "30000"),

  // SSL configuration
  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false,
          minVersion: "TLSv1.2",
        }
      : false,

  // Connection validation
  application_name: "hyperpage",

  // Connection lifecycle
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

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

### Step 2: Connection Health Monitoring

#### Health Check Implementation

```typescript
// lib/database/health.ts
import { Pool } from "pg";

export interface DatabaseHealth {
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  connectionCount: number;
  error?: string;
  lastCheck: Date;
}

export class DatabaseHealthMonitor {
  private pool: Pool;
  private healthHistory: DatabaseHealth[] = [];
  private maxHistorySize = 10;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async checkHealth(): Promise<DatabaseHealth> {
    const startTime = Date.now();

    try {
      // Test basic connectivity
      const result = await this.pool.query(
        "SELECT 1 as health_check, NOW() as timestamp",
      );
      const responseTime = Date.now() - startTime;

      // Get connection pool statistics
      const totalCount = this.pool.totalCount;
      const idleCount = this.pool.idleCount;
      const waitingCount = this.pool.waitingCount;

      const health: DatabaseHealth = {
        status: responseTime < 1000 ? "healthy" : "degraded",
        responseTime,
        connectionCount: totalCount,
        lastCheck: new Date(),
      };

      this.addToHistory(health);
      return health;
    } catch (error) {
      const health: DatabaseHealth = {
        status: "unhealthy",
        responseTime: Date.now() - startTime,
        connectionCount: this.pool.totalCount,
        error: error instanceof Error ? error.message : "Unknown error",
        lastCheck: new Date(),
      };

      this.addToHistory(health);
      return health;
    }
  }

  private addToHistory(health: DatabaseHealth): void {
    this.healthHistory.push(health);
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory.shift();
    }
  }

  getHealthHistory(): DatabaseHealth[] {
    return [...this.healthHistory];
  }

  isHealthy(): boolean {
    const recent = this.healthHistory.slice(-3);
    return recent.length > 0 && recent.every((h) => h.status === "healthy");
  }
}
```

### Step 3: Enhanced Connection Manager

#### Connection Lifecycle Management

```typescript
// lib/database/connection.ts - Enhanced manager
import { Pool, PoolClient, PoolConfig } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { DatabaseHealthMonitor } from "./health";

type DrizzleInstance = ReturnType<typeof drizzle<typeof schema>>;

interface ConnectionState {
  pool: Pool;
  drizzle: DrizzleInstance;
  healthMonitor: DatabaseHealthMonitor;
  isInitialized: boolean;
  lastHealthCheck: Date;
}

class DatabaseConnectionManager {
  private state: ConnectionState | null = null;
  private initializing = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<ConnectionState> {
    if (this.state?.isInitialized) {
      return this.state;
    }

    if (this.initializing) {
      // Wait for initialization to complete
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.state?.isInitialized) {
            clearInterval(checkInterval);
            resolve(this.state);
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error("Database initialization timeout"));
        }, 30000);
      });
    }

    this.initializing = true;

    try {
      const pool = new Pool(poolConfig);
      const drizzle = drizzle(pool, { schema });
      const healthMonitor = new DatabaseHealthMonitor(pool);

      // Test initial connection
      await healthMonitor.checkHealth();

      this.state = {
        pool,
        drizzle,
        healthMonitor,
        isInitialized: true,
        lastHealthCheck: new Date(),
      };

      // Start periodic health checks
      this.startHealthChecks();

      // Handle process shutdown
      this.setupShutdownHandlers();

      this.initializing = false;
      return this.state;
    } catch (error) {
      this.initializing = false;
      throw new Error(`Failed to initialize database: ${error}`);
    }
  }

  private startHealthChecks(): void {
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      if (this.state?.healthMonitor) {
        try {
          const health = await this.state.healthMonitor.checkHealth();
          this.state.lastHealthCheck = health.lastCheck;

          if (health.status === "unhealthy") {
            console.error("Database health check failed:", health.error);
            // Could trigger alerts here
          }
        } catch (error) {
          console.error("Health check error:", error);
        }
      }
    }, 30000);
  }

  private setupShutdownHandlers(): void {
    const gracefulShutdown = async (signal: string) => {
      console.log(`Received ${signal}, shutting down gracefully...`);

      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      if (this.state?.pool) {
        await this.state.pool.end();
        console.log("Database connections closed");
      }

      process.exit(0);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  }

  getConnection(): ConnectionState {
    if (!this.state?.isInitialized) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.state;
  }

  async getHealth(): Promise<ReturnType<DatabaseHealthMonitor["checkHealth"]>> {
    const state = this.getConnection();
    return await state.healthMonitor.checkHealth();
  }

  async getClient(): Promise<PoolClient> {
    const state = this.getConnection();
    return await state.pool.connect();
  }

  async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.state?.pool) {
      await this.state.pool.end();
      this.state = null;
    }
  }
}

// Export singleton instance
export const dbManager = new DatabaseConnectionManager();
export const getAppDatabase = () => dbManager.getConnection();
export const getHealth = () => dbManager.getHealth();
export const getClient = () => dbManager.getClient();
export const closeAllConnections = () => dbManager.close();
```

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
