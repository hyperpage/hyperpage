# SQLite Removal Plan - Phase 3: Application Code Migration & Path Updates

## Overview

Phase 3 updates the application codebase to use PostgreSQL as the primary database engine, removes SQLite-specific optimizations, and updates all configuration and connection patterns to support PostgreSQL exclusively.

## Prerequisites from Phase 2

- [ ] All data successfully migrated to PostgreSQL
- [ ] Data integrity validation passed 100%
- [ ] Application integration tests pass with PostgreSQL
- [ ] Performance meets or exceeds SQLite baseline
- [ ] Monitoring and backup systems are operational

## Objectives

1. **Primary Database Engine Switch**: Configure PostgreSQL as the default database engine
2. **Remove SQLite Dependencies**: Eliminate SQLite imports, optimizations, and fallback mechanisms
3. **Update Repository Patterns**: Modernize all repository classes for PostgreSQL-only operation
4. **Configuration Simplification**: Remove dual-engine configuration complexity
5. **Performance Optimization**: Apply PostgreSQL-specific optimizations throughout the application

## Phase 3 Tasks

### 3.1 Database Connection Layer Updates

**Task**: Update database connection layer to use PostgreSQL as primary engine

**Actions**:
- [ ] Modify `lib/database/connection.ts` to default to PostgreSQL
- [ ] Remove SQLite connection fallbacks and dual-engine logic
- [ ] Update `getPrimaryDrizzleDb()` to return PostgreSQL by default
- [ ] Remove `DB_ENGINE` environment variable complexity
- [ ] Clean up SQLite-specific connection pooling logic
- [ ] Update health checks to focus on PostgreSQL

**File Changes**:
```typescript
// lib/database/connection.ts
// OLD: Dual engine support
function getConfiguredDbEngine(): "sqlite" | "postgres" {
  const engine = (process.env.DB_ENGINE || "").toLowerCase();
  return engine === "postgres" ? "postgres" : "sqlite";
}

// NEW: PostgreSQL primary
function getConfiguredDbEngine(): "postgres" {
  return "postgres"; // Always PostgreSQL
}
```

**Deliverables**:
- Updated connection layer with PostgreSQL as default
- Removed dual-engine complexity
- Simplified health check endpoints

### 3.2 Repository Pattern Modernization

**Task**: Update all repository classes to use PostgreSQL schema and patterns

**Actions**:
- [ ] Update job repository to use PostgreSQL schema
- [ ] Modernize tool configuration repository
- [ ] Update rate limit repository for PostgreSQL
- [ ] Migrate OAuth token repository to PostgreSQL
- [ ] Update user session repository
- [ ] Remove SQLite-specific query optimizations
- [ ] Apply PostgreSQL-specific performance patterns

**Repository Updates**:
```typescript
// lib/database/job-repository.ts
// OLD: SQLite patterns
import * as sqliteSchema from "./schema";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";

// NEW: PostgreSQL patterns  
import * as pgSchema from "./pg-schema";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { getPostgresDrizzleDb } from "./connection";
```

**Deliverables**:
- Modernized repository classes
- PostgreSQL-optimized query patterns
- Improved error handling

### 3.3 API Endpoint Updates

**Task**: Update API endpoints to use PostgreSQL-optimized data access patterns

**Actions**:
- [ ] Update `/api/tools/enabled` endpoint for PostgreSQL
- [ ] Modify API routes to use PostgreSQL repositories
- [ ] Update batch processing endpoints
- [ ] Optimize API response patterns for PostgreSQL
- [ ] Remove SQLite-specific query optimizations
- [ ] Update authentication endpoints

**API Route Updates**:
```typescript
// app/api/tools/enabled/route.ts
// OLD: Dual database support
const db = getPrimaryDrizzleDb();

// NEW: PostgreSQL specific
const db = getPostgresDrizzleDb();
```

**Deliverables**:
- Updated API endpoints
- PostgreSQL-optimized data access
- Improved API performance

### 3.4 Configuration Management Updates

**Task**: Simplify configuration management for PostgreSQL-only operation

**Actions**:
- [ ] Remove `DB_ENGINE` environment variable
- [ ] Update `.env.local.sample` to remove SQLite paths
- [ ] Simplify Docker configuration for PostgreSQL
- [ ] Update Kubernetes deployment configurations
- [ ] Remove SQLite-specific environment variables
- [ ] Update development setup documentation

**Configuration Updates**:
```env
# REMOVE from .env.local.sample:
# DATABASE_PATH=./data/hyperpage.db
# DB_ENGINE=postgres

# KEEP for PostgreSQL:
# DATABASE_URL=postgresql://user:password@localhost:5432/hyperpage
# POSTGRES_HOST=localhost
# POSTGRES_PORT=5432
```

**Deliverables**:
- Simplified configuration files
- Updated environment variable documentation
- Cleaned deployment configurations

### 3.5 Application Logic Optimization

**Task**: Update application logic to leverage PostgreSQL capabilities

**Actions**:
- [ ] Optimize job queue processing for PostgreSQL
- [ ] Update configuration management patterns
- [ ] Enhance rate limiting with PostgreSQL features
- [ ] Optimize OAuth token storage and retrieval
- [ ] Apply PostgreSQL-specific indexing strategies
- [ ] Update data validation patterns

**Job Queue Optimization**:
```typescript
// lib/jobs/job-queue.ts
// OLD: SQLite integer timestamps
const scheduledAt = Math.floor(Date.now());

// NEW: PostgreSQL timestamp with time zone
const scheduledAt = new Date().toISOString();
```

**Deliverables**:
- PostgreSQL-optimized application logic
- Improved job queue performance
- Enhanced data validation

### 3.6 Performance Optimization Updates

**Task**: Apply PostgreSQL-specific performance optimizations throughout the application

**Actions**:
- [ ] Implement connection pooling optimizations
- [ ] Update query patterns for PostgreSQL performance
- [ ] Apply PostgreSQL-specific indexing strategies
- [ ] Optimize batch operations for PostgreSQL
- [ ] Update caching strategies for PostgreSQL
- [ ] Implement PostgreSQL-specific monitoring

**Performance Patterns**:
```typescript
// Use PostgreSQL-specific features
const result = await db
  .select()
  .from(pgSchema.jobs)
  .where(
    and(
      eq(pgSchema.jobs.status, 'pending'),
      gt(pgSchema.jobs.scheduledAt, new Date().toISOString())
    )
  )
  .orderBy(pgSchema.jobs.scheduledAt)
  .limit(100);
```

**Deliverables**:
- PostgreSQL-optimized performance patterns
- Enhanced connection pooling
- Improved query execution

### 3.7 Error Handling and Logging Updates

**Task**: Update error handling and logging for PostgreSQL-specific scenarios

**Actions**:
- [ ] Update error handling for PostgreSQL-specific errors
- [ ] Implement PostgreSQL connection error recovery
- [ ] Update logging patterns for PostgreSQL operations
- [ ] Add PostgreSQL-specific health metrics
- [ ] Implement graceful degradation for PostgreSQL issues
- [ ] Update monitoring alerts for PostgreSQL

**Error Handling**:
```typescript
// PostgreSQL-specific error handling
if (error instanceof pg.PostgresError) {
  if (error.code === 'ECONNREFUSED') {
    logger.error('PostgreSQL connection refused', { error });
    // Implement connection retry logic
  } else if (error.code === '23505') { // Unique violation
    logger.warn('Duplicate key constraint violation', { error });
    // Handle duplicate key scenarios
  }
}
```

**Deliverables**:
- PostgreSQL-specific error handling
- Enhanced logging and monitoring
- Improved error recovery

### 3.8 Documentation and Deployment Updates

**Task**: Update all documentation and deployment configurations for PostgreSQL-only operation

**Actions**:
- [ ] Update README.md to remove SQLite references
- [ ] Update deployment documentation for PostgreSQL
- [ ] Update monitoring documentation
- [ ] Modify development setup instructions
- [ ] Update API documentation for new patterns
- [ ] Update troubleshooting guides

**Documentation Updates**:
```markdown
# OLD: SQLite/PostgreSQL comparison
## Database Setup

The application supports both SQLite (development) and PostgreSQL (production):

- SQLite: Automatic setup, no configuration required
- PostgreSQL: Configure DATABASE_URL environment variable

# NEW: PostgreSQL only
## Database Setup

The application uses PostgreSQL as the primary database:

- Configure DATABASE_URL environment variable
- Default: postgresql://localhost:5432/hyperpage
- See deployment guides for production setup
```

**Deliverables**:
- Updated documentation
- Cleaned deployment guides
- Development setup instructions

### 3.9 Testing Infrastructure Updates

**Task**: Update testing infrastructure for PostgreSQL-only operation

**Actions**:
- [ ] Update unit tests to use PostgreSQL test database
- [ ] Modify integration tests for PostgreSQL patterns
- [ ] Update e2e test configurations
- [ ] Remove SQLite test fixtures and utilities
- [ ] Update test data setup for PostgreSQL
- [ ] Optimize test execution for PostgreSQL

**Test Updates**:
```typescript
// __tests__/setup/test-database.ts
// OLD: SQLite test database
export function createTestDatabase(): Database.Database {
  return new Database(":memory:");
}

// NEW: PostgreSQL test database
export async function createTestDatabase(): Promise<NodePgDatabase> {
  const testPool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
  });
  return drizzle(testPool, { schema: pgSchema });
}
```

**Deliverables**:
- Updated test infrastructure
- PostgreSQL-optimized test patterns
- Improved test performance

### 3.10 Security Updates

**Task**: Update security configurations for PostgreSQL-only operation

**Actions**:
- [ ] Update authentication patterns for PostgreSQL
- [ ] Optimize OAuth token security for PostgreSQL
- [ ] Update session management for PostgreSQL
- [ ] Remove SQLite-specific security considerations
- [ ] Apply PostgreSQL-specific security best practices
- [ ] Update audit logging patterns

**Security Optimization**:
```typescript
// Enhanced OAuth token security with PostgreSQL
export class PostgresOAuthTokenStore implements OAuthTokenStore {
  async storeToken(tokenData: OAuthTokenData): Promise<void> {
    const db = getPostgresDrizzleDb();
    
    // Use PostgreSQL-specific encryption and validation
    await db.insert(pgSchema.oauthTokens).values({
      userId: tokenData.userId,
      provider: tokenData.provider,
      accessToken: await this.encrypt(tokenData.accessToken),
      // ... other fields with PostgreSQL optimizations
    });
  }
}
```

**Deliverables**:
- Enhanced security patterns
- PostgreSQL-optimized token management
- Improved audit logging

## Phase 3 Completion Criteria

**Code Migration Success**:
- [ ] All repository classes updated for PostgreSQL
- [ ] API endpoints optimized for PostgreSQL
- [ ] Application logic leveraging PostgreSQL features
- [ ] Performance optimizations applied

**Configuration Simplification**:
- [ ] Dual-engine configuration removed
- [ ] Environment variables simplified
- [ ] Deployment configurations updated
- [ ] Documentation updated

**Testing and Quality**:
- [ ] All tests passing with PostgreSQL
- [ ] Performance benchmarks improved
- [ ] Security patterns enhanced
- [ ] Error handling improved

## Phase 3 Estimated Duration

- **Duration**: 2-3 weeks
- **Team Size**: 3-4 developers + 1 QA engineer
- **Critical Path**: Repository pattern modernization and API updates
- **Testing Required**: Extensive regression testing

## Phase 3 Exit Conditions

Phase 3 is complete when:
1. All application code uses PostgreSQL as primary database
2. SQLite imports and dependencies completely removed
3. Performance meets or exceeds Phase 2 benchmarks
4. All tests pass with PostgreSQL-only configuration
5. Documentation updated for PostgreSQL-only operation

## Rollback Triggers

Immediate rollback to Phase 2 if:
- Critical functionality breaks after code changes
- Performance significantly degrades
- Tests fail consistently
- Database connection issues arise
- Application becomes unstable

## Phase 3 Quality Gates

**Before Proceeding to Phase 4**:
1. **Code Review**: All changes reviewed and approved
2. **Performance Testing**: Benchmarks meet requirements
3. **Security Audit**: Security patterns validated
4. **Integration Testing**: Full application testing completed
5. **Documentation Review**: All documentation updated

## Next Phase Preview

Phase 4 will focus on **Testing Infrastructure Updates & Verification**, including:
- Comprehensive testing with PostgreSQL-only configuration
- Performance benchmarking and optimization
- Load testing with migrated data
- Final validation before production deployment

## Phase 3 Review and Approval

- [ ] **Code Review**: All repository and API changes reviewed
- [ ] **Performance Review**: Application performance validated
- [ ] **Security Review**: Security patterns audited
- [ ] **QA Review**: Testing infrastructure validated
- [ ] **Sign-off**: Technical lead and migration lead approval

---

**Phase 3 Status**: Ready to execute  
**Last Updated**: 2025-01-11  
**Migration Lead**: [To be assigned]  
**Review Date**: [To be scheduled]
