# Phase 1: Dependencies & Code Migration

**Duration:** 2-3 hours  
**Status:** Ready for Implementation  
**Prerequisites:** None

## Overview

This phase replaces SQLite dependencies with PostgreSQL and updates the database connection code to use PostgreSQL features.

## Current Dependencies

### SQLite Dependencies to Remove

```json
{
  "better-sqlite3": "^11.10.0",
  "@types/better-sqlite3": "^7.6.13"
}
```

### PostgreSQL Dependencies to Add

```json
{
  "pg": "^8.11.3",
  "@types/pg": "^8.10.9"
}
```

## Implementation Steps

### Step 1: Package Updates

#### Remove SQLite Dependencies

```bash
npm uninstall better-sqlite3 @types/better-sqlite3
```

#### Add PostgreSQL Dependencies

```bash
npm install pg @types/pg
```

#### Update package.json

```json
{
  "dependencies": {
    "pg": "^8.11.3",
    "@types/pg": "^8.10.9",
    "drizzle-orm": "^0.44.7" // Already supports PostgreSQL
  },
  "devDependencies": {
    // Remove any SQLite-related dev dependencies
  }
}
```

### Step 2: Database Connection Code Updates

#### Current: lib/database/connection.ts (SQLite)

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

// Environment variables
export const DATABASE_PATH = process.env.DATABASE_PATH || "./data/hyperpage.db";

export function getAppDatabase() {
  const db = new Database(DATABASE_PATH);
  return drizzle(db, { schema });
}

export function closeAppDatabase() {
  // No explicit close needed for SQLite in most cases
}
```

#### Target: lib/database/connection.ts (PostgreSQL)

```typescript
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Database configuration
export const DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER || "hyperpage"}:${process.env.POSTGRES_PASSWORD || "password"}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DB || "hyperpage"}`;

export const POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
export const POSTGRES_PORT = parseInt(process.env.POSTGRES_PORT || "5432");
export const POSTGRES_DB = process.env.POSTGRES_DB || "hyperpage";
export const POSTGRES_USER = process.env.POSTGRES_USER || "hyperpage";
export const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "password";

// Connection pool configuration
const poolConfig = {
  connectionString: DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || "20"),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000"),
  connectionTimeoutMillis: parseInt(
    process.env.DB_CONNECTION_TIMEOUT || "2000",
  ),
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
};

// Application database connection
let _appPool: Pool | null = null;
let _appDrizzleDb: ReturnType<typeof drizzle> | null = null;

export function getAppDatabase(): {
  pool: Pool;
  drizzle: ReturnType<typeof drizzle>;
} {
  if (!_appPool || !_appDrizzleDb) {
    _appPool = new Pool(poolConfig);
    _appDrizzleDb = drizzle(_appPool, { schema });
  }
  return { pool: _appPool, drizzle: _appDrizzleDb };
}

export function closeAllConnections(): void {
  if (_appPool) {
    _appPool.end();
    _appPool = null;
    _appDrizzleDb = null;
  }
}

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const { pool } = getAppDatabase();
    await pool.query("SELECT 1");
    return true;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}
```

### Step 3: Environment Variables Update

#### Update .env.sample

```env
# Database Configuration
# Migration from SQLite to PostgreSQL
DATABASE_URL=postgresql://hyperpage:password@localhost:5432/hyperpage
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=hyperpage
POSTGRES_USER=hyperpage
POSTGRES_PASSWORD=password

# Database Connection Pool Settings
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
```

#### Update .gitignore

```gitignore
# Remove SQLite database files
# data/hyperpage.db
# data/*.db

# Keep PostgreSQL environment variables safe
.env.dev
```

### Step 4: TypeScript Type Updates

#### Current Schema Import (SQLite)

```typescript
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
```

#### Target Schema Import (PostgreSQL)

```typescript
import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
```

### Step 5: Code Usage Updates

#### Current: Database Usage Pattern

```typescript
import { getAppDatabase } from "@/lib/database/connection";

const { drizzle } = getAppDatabase();

// Example query
const jobs = await drizzle.select().from(schema.jobs);
```

#### Target: Database Usage Pattern

```typescript
import { getAppDatabase, closeAllConnections } from "@/lib/database/connection";

const { pool, drizzle } = getAppDatabase();

// Example query
const jobs = await drizzle.select().from(schema.jobs);

// Clean shutdown
process.on("SIGTERM", () => {
  closeAllConnections();
});
```

## Files to Modify

### Core Files

1. **`package.json`** - Update dependencies
2. **`lib/database/connection.ts`** - Complete rewrite for PostgreSQL
3. **`.env.sample`** - Add PostgreSQL environment variables
4. **`.gitignore`** - Remove SQLite database files

### Import Statements to Update

Search and replace across codebase:

```bash
# Find files importing SQLite-specific modules
grep -r "better-sqlite3" --include="*.ts" --include="*.tsx" .
grep -r "drizzle-orm/better-sqlite3" --include="*.ts" --include="*.tsx" .
```

## Testing Phase 1

### Unit Tests

```typescript
// Test database connection
describe("PostgreSQL Connection", () => {
  test("should create connection pool", () => {
    const { pool, drizzle } = getAppDatabase();
    expect(pool).toBeDefined();
    expect(drizzle).toBeDefined();
  });

  test("should handle connection errors", async () => {
    const health = await checkDatabaseHealth();
    expect(health).toBe(true);
  });
});
```

### Integration Tests

```typescript
// Test basic database operations
describe("Database Operations", () => {
  test("should perform basic queries", async () => {
    const { drizzle } = getAppDatabase();
    const result = await drizzle.execute("SELECT 1 as test");
    expect(result).toBeDefined();
  });
});
```

## Validation Checklist

### Code Changes

- [ ] SQLite dependencies removed from package.json
- [ ] PostgreSQL dependencies added to package.json
- [ ] Database connection code updated for PostgreSQL
- [ ] Connection pooling implemented
- [ ] Health check function added
- [ ] Environment variables updated
- [ ] Import statements updated across codebase

### Environment Setup

- [ ] .env.sample updated with PostgreSQL variables
- [ ] .gitignore updated to exclude SQLite files
- [ ] Database URL configuration working

### Testing

- [ ] Connection pool creates successfully
- [ ] Health check function works
- [ ] Basic queries execute successfully
- [ ] Error handling tested

## Common Issues & Solutions

### Connection Issues

**Problem**: "ECONNREFUSED" errors
**Solution**: Ensure PostgreSQL is running and connection string is correct

**Problem**: "Authentication failed" errors
**Solution**: Verify username, password, and database name in connection string

### Import Issues

**Problem**: Drizzle ORM import errors
**Solution**: Update to use `drizzle-orm/node-postgres` for PostgreSQL

### Type Issues

**Problem**: TypeScript type errors
**Solution**: Update all Drizzle imports to use PostgreSQL-specific types

## Success Criteria

✅ **All SQLite dependencies successfully removed**  
✅ **PostgreSQL dependencies installed and working**  
✅ **Database connection code updated and functional**  
✅ **Connection pooling working properly**  
✅ **Health check endpoint responding**  
✅ **Environment variables configured**  
✅ **All tests passing**

## Next Phase Prerequisites

- PostgreSQL dependencies installed
- Database connection working
- Basic queries executing successfully
- Environment variables configured
- Tests passing

---

**Phase 1 Status**: Ready for Implementation  
**Next**: [Phase 2: Schema Conversion](phase-2-schema.md)
