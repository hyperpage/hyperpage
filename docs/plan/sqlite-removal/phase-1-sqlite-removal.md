# Phase 1: SQLite Removal & PostgreSQL Setup

## Overview

Phase 1 focuses on removing all SQLite dependencies from the codebase and establishing a PostgreSQL-only foundation. This phase is critical as it creates the foundation for all subsequent work.

## Prerequisites

- ✅ PostgreSQL deployment running and operational
- ✅ Development environment configured for PostgreSQL
- ✅ Team familiar with project structure and dependencies

## Phase 1 Tasks

### 1.1 Remove SQLite Dependencies

**Estimated Time**: 2-4 hours

#### 1.1.1 Remove Package Dependencies

**Action**: Remove SQLite packages from package.json

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

# Expected result: No matches found
```

#### 1.1.2 Update package.json Scripts

**Action**: Update npm scripts for PostgreSQL-only operations

**Updated package.json section**:
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
    "db:push": "drizzle-kit push:pg --config=drizzle.config.ts",
    "db:reset": "npm run db:migrate:reset && npm run db:push"
  }
}
```

**Dependencies after cleanup**:
```json
{
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

### 1.2 Clean Up SQLite Schema File

**Estimated Time**: 1-2 hours

#### 1.2.1 Archive SQLite Schema

**Action**: Move SQLite schema to legacy folder for reference

**Commands**:
```bash
# Create legacy directory
mkdir -p docs/plan/sqlite-removal/legacy

# Archive SQLite schema
mv lib/database/schema.ts docs/plan/sqlite-removal/legacy/sqlite-schema.ts

# Create archive note
echo "# SQLite Schema Archive

This file contains the original SQLite schema definitions.
Archived on: $(date)
Purpose: Reference for understanding original data structure.

## Key Tables:
- jobs: Job queue management
- tool_configs: Tool configuration storage
- rate_limits: API rate limiting
- oauth_tokens: OAuth authentication tokens
- users: User profile information
- app_state: Application state storage
" > docs/plan/sqlite-removal/legacy/README.md
```

#### 1.2.2 Update Import Statements

**Action**: Find and replace all SQLite schema imports

**Search and replace pattern**:
```bash
# Find all files importing SQLite schema
grep -r "import.*sqliteSchema\|from.*schema" . --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.next

# Replace with PostgreSQL schema imports
# OLD: import * as sqliteSchema from "./schema";
# NEW: import * as pgSchema from "./pg-schema";
```

**Files to update** (based on search results):
- Repository files: `lib/database/*-repository.ts`
- API routes: `app/api/*/route.ts`
- Service files: `lib/*/*.ts`

**Example import updates**:
```typescript
// lib/database/job-repository.ts
// OLD:
import * as sqliteSchema from "./schema";

// NEW:
import * as pgSchema from "./pg-schema";
```

### 1.3 Update Database Connection Layer

**Estimated Time**: 3-4 hours

#### 1.3.1 Backup Current Connection Layer

**Action**: Create backup of existing connection logic

**Commands**:
```bash
# Create backup
cp lib/database/connection.ts lib/database/connection.ts.backup

# Create backup documentation
cat > lib/database/connection-backup-notes.md << 'EOF'
# Connection Layer Backup Notes

## Backup created: $(date)
## Purpose: Reference for dual-engine implementation

## Key Functions (Archived):
- getAppDatabase(): Legacy SQLite connection
- getInternalDatabase(): Legacy SQLite internal connection
- getPostgresDrizzleDb(): PostgreSQL connection (CURRENT)
- getPrimaryDrizzleDb(): Dual-engine routing

## Migration Notes:
- PostgreSQL connection logic will be preserved
- SQLite connection logic will be removed
- Export compatibility will be maintained
EOF
```

#### 1.3.2 Simplify Connection Layer

**Action**: Replace `lib/database/connection.ts` with PostgreSQL-only implementation

**Implementation**:
```typescript
// lib/database/connection.ts - PostgreSQL Only
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

/**
 * Get database statistics (PostgreSQL-only)
 */
export function getDatabaseStats(): {
  connected: boolean;
  schema: string;
} {
  return {
    connected: _pgDrizzleDb !== null,
    schema: "PostgreSQL",
  };
}
```

#### 1.3.3 Validate Connection Layer

**Action**: Test PostgreSQL connectivity

**Create validation script**:
```typescript
// scripts/validate-postgresql-connection.ts
import { getPostgresDrizzleDb, checkDatabaseConnectivity } from "../lib/database/connection";

async function validateConnection() {
  try {
    console.log("🔍 Validating PostgreSQL connection...");
    
    // Test basic connectivity
    const health = await checkDatabaseConnectivity();
    console.log("Health check:", health);
    
    if (health.status !== "healthy") {
      throw new Error(`PostgreSQL health check failed: ${health.details.message}`);
    }
    
    // Test database query
    const db = getPostgresDrizzleDb();
    const result = await db.execute({ sql: "SELECT version()" });
    console.log("✅ PostgreSQL connection successful");
    console.log("Version:", result.rows[0]);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ PostgreSQL validation failed:", error);
    process.exit(1);
  }
}

validateConnection();
```

**Test connection**:
```bash
npm run db:validate
```

### 1.4 Update Environment Variables

**Estimated Time**: 1 hour

#### 1.4.1 Update .env.local.sample

**Action**: Clean up environment variables for PostgreSQL-only

**Updated .env.local.sample**:
```env
# Database Configuration (PostgreSQL Only)
DATABASE_URL=postgresql://user:password@localhost:5432/hyperpage
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=hyperpage
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# REMOVED SQLite variables:
# DATABASE_PATH=./data/hyperpage.db
# DB_ENGINE=postgres
```

#### 1.4.2 Update Docker Configuration

**Action**: Update docker-compose.yml for PostgreSQL-only

**Updated docker-compose.yml**:
```yaml
# docker-compose.yml - PostgreSQL Only
services:
  app:
    build: .
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/hyperpage
      - NODE_ENV=development
    depends_on:
      - db
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
  
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
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### 1.5 Update Drizzle Configuration

**Estimated Time**: 30 minutes

#### 1.5.1 Clean Up drizzle.config.ts

**Action**: Configure for PostgreSQL-only

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

### 1.6 Update Test Configurations

**Estimated Time**: 1 hour

#### 1.6.1 Update E2E Test Configuration

**Action**: Clean up E2E test environment variables

**Updated __tests__/e2e/.env.e2e**:
```env
# E2E Test Environment (PostgreSQL)
DATABASE_URL=postgresql://test:test@localhost:5432/hyperpage_e2e
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/hyperpage_test

# REMOVED SQLite variables:
# DATABASE_PATH=./data/hyperpage_e2e.db
```

#### 1.6.2 Update Test Database Setup

**Action**: Create PostgreSQL test database utilities

**Create __tests__/setup/test-database.ts**:
```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as pgSchema from "../../lib/database/pg-schema";

export interface TestDatabase {
  db: ReturnType<typeof drizzle>;
  cleanup: () => Promise<void>;
}

export async function setupTestDatabase(): Promise<TestDatabase> {
  const testPool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || 
      "postgresql://test:test@localhost:5432/hyperpage_test",
  });

  const db = drizzle(testPool, { schema: pgSchema });

  // Initialize test database
  await db.execute({ sql: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` });
  
  const cleanup = async () => {
    await db.execute({ sql: `
      TRUNCATE TABLE jobs, tool_configs, rate_limits, app_state, oauth_tokens, users CASCADE;
    `});
    await testPool.end();
  };

  return { db, cleanup };
}
```

### 1.7 Final Validation and Testing

**Estimated Time**: 1-2 hours

#### 1.7.1 Build Validation

**Action**: Ensure application builds successfully

**Commands**:
```bash
# Type check
npm run type-check

# Lint check
npm run lint

# Build test
npm run build
```

#### 1.7.2 Database Connectivity Test

**Action**: Test PostgreSQL connectivity in all environments

**Commands**:
```bash# Development environment
npm run dev &
sleep 10
curl -f http://localhost:3000/api/health

# Production build test
npm start &
sleep 15
curl -f http://localhost:3000/api/health

# Cleanup
pkill -f "next dev"
pkill -f "next start"
```

#### 1.7.3 Integration Test

**Action**: Run basic integration tests

**Commands**:
```bash
# Run unit tests
npm test

# Run integration tests (if available)
npm run test:integration
```

## Phase 1 Completion Checklist

### Dependencies Removed
- [ ] `better-sqlite3` and `@types/better-sqlite3` removed from package.json
- [ ] No SQLite import statements remain in codebase
- [ ] SQLite schema file archived to legacy folder
- [ ] All SQLite references found and replaced

### Configuration Updated
- [ ] Database connection simplified for PostgreSQL-only
- [ ] Environment variables cleaned up (.env.local.sample)
- [ ] Docker configuration updated (docker-compose.yml)
- [ ] Drizzle configuration updated for PostgreSQL
- [ ] Test configurations updated

### Code Cleaned
- [ ] `lib/database/connection.ts` simplified
- [ ] Dual-engine logic removed
- [ ] SQLite health checks removed
- [ ] Connection pooling updated for PostgreSQL
- [ ] All exports maintained for compatibility

### Validation Passed
- [ ] Application builds successfully
- [ ] PostgreSQL connectivity validated
- [ ] Basic tests pass
- [ ] No SQLite references in codebase
- [ ] Environment variables validated

## Estimated Duration and Resources

- **Total Duration**: 5-7 days
- **Team Size**: 1-2 developers
- **Critical Path**: Connection layer updates and environment configuration
- **Risk Level**: Low - Straightforward dependency removal

## Rollback Procedures

If issues arise during Phase 1:

1. **Immediate rollback**:
   ```bash
   # Restore SQLite schema
   cp docs/plan/sqlite-removal/legacy/sqlite-schema.ts lib/database/schema.ts
   
   # Restore connection layer
   cp lib/database/connection.ts.backup lib/database/connection.ts
   
   # Reinstall SQLite dependencies
   npm install better-sqlite3 @types/better-sqlite3
   
   # Restore environment variables
   git checkout HEAD -- .env.local.sample
   ```

2. **Validation**:
   - Verify application starts with SQLite
   - Run basic functionality tests
   - Confirm no PostgreSQL dependencies remain

## Success Criteria

Phase 1 is successfully completed when:
1. All SQLite dependencies are removed from the codebase
2. PostgreSQL connection layer is functional
3. Application builds and runs successfully with PostgreSQL
4. Basic functionality tests pass
5. No SQLite references remain in the codebase

## Next Steps Preview

Phase 2 will focus on **Application Code Updates**:
- Update repository classes for PostgreSQL
- Modify API endpoints for PostgreSQL patterns
- Clean up configuration management
- Optimize OAuth and job processing for PostgreSQL

---

**Phase 1 Status**: Ready for execution  
**Last Updated**: 2025-01-11  
**Phase Lead**: [To be assigned]
