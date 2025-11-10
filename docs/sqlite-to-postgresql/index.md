# SQLite to PostgreSQL Migration

**Document Version:** 1.0  
**Date:** 2025-01-11  
**Author:** Hyperpage Development Team  
**Status:** Draft Plan - Requires Alignment and Updates Before Implementation

## Migration Overview

This migration transforms Hyperpage from SQLite to PostgreSQL, providing production-ready scalability, connection pooling, and enterprise-grade database capabilities.

## Architecture

### Before: SQLite (File-Based)

```
┌─────────────────────────────┐
│     Hyperpage Application   │
│                            │
│ • Next.js App              │
│ • Better-SQLite3           │
│ • File-based storage       │
│ • Single connection        │
└─────────────────────────────┘
           │
           ▼
    ./data/hyperpage.db
```

### After: PostgreSQL (Sidecar Pattern)

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Pod                           │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   Hyperpage App     │    │    PostgreSQL Sidecar      │ │
│  │   (Main Container)  │◄──►│    (Database Container)    │ │
│  │                     │    │                             │ │
│  │ • Next.js App      │    │ • PostgreSQL 15+           │ │
│  │ • Drizzle ORM      │    │ • Data persistence         │ │
│  │ • Connection Pool  │    │ • Health checks            │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
│           │                                 │                │
│           └─────────┬─────────────┬─────────┘                │
│                     │             │                          │
│              ┌──────▼──────┐ ┌───▼─────────────┐            │
│              │ ConfigMap   │ │ Secret         │            │
│              │ Env Vars    │ │ Database Creds │            │
│              └─────────────┘ └────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## Migration Phases

### Phase 1: Dependencies & Code Migration

**Duration:** 2-3 hours  
**File:** [`phase-1-dependencies.md`](phase-1-dependencies.md)

- Replace `better-sqlite3` with `pg`
- Update package dependencies
- Modify database connection code
- Update TypeScript types

### Phase 2: Schema Conversion

**Duration:** 3-4 hours  
**File:** [`phase-2-schema.md`](phase-2-schema.md)

- Convert SQLite tables to PostgreSQL
- Update auto-increment fields to SERIAL
- Convert JSON text to JSONB
- Update timestamp handling
- Add proper indexes

### Phase 3: Database Connection Overhaul

**Duration:** 2-3 hours  
**File:** [`phase-3-connection.md`](phase-3-connection.md)

- Implement connection pooling
- Update connection management
- Add health checks
- Configure timeout settings

### Phase 4: Migration System Updates

**Duration:** 1-2 hours  
**File:** [`phase-4-migration-system.md`](phase-4-migration-system.md)

- Introduce a PostgreSQL migration system using Drizzle ORM for node-postgres
- Use the official Drizzle migrator for node-postgres (not postgres-js)
- Keep migration table/schema consistent with Drizzle defaults
- Add scripts for local/test/production migration runs

### Phase 5: Kubernetes / Deployment Configuration

**Duration:** 2-3 hours  
**File:** [`phase-5-kubernetes.md`](phase-5-kubernetes.md)

- Define how Hyperpage connects to PostgreSQL in each environment
- Prefer managed PostgreSQL or a dedicated StatefulSet + Service
- Treat sidecar PostgreSQL only as a non-production/example option
- Ensure env vars and connection strings match the chosen topology

### Phase 6: Testing & Validation

**Duration:** 3-4 hours  
**File:** [`phase-7-testing.md`](phase-7-testing.md)

- Update test suite to target PostgreSQL
- Run integration tests on the new schema
- Validate all functionality against a clean PostgreSQL database
- Performance testing and baseline
### Phase 7: Production Deployment

**Duration:** 2-3 hours  
**File:** [`phase-8-production-deployment.md`](phase-8-production-deployment.md)

- Deploy the PostgreSQL-backed version
- Monitor performance and stability
- Validate functionality against clean Postgres schema
- Gradual rollout with the ability to rollback to the previous release

### Phase 8: Rollback Strategy

**Duration:** Planning Phase  
**File:** [`phase-9-rollback-strategy.md`](phase-9-rollback-strategy.md)

- Rollback procedures (to previous app + SQLite stack)
- Clear separation: no partial data merges between PostgreSQL and legacy SQLite
- Emergency protocols and monitoring

### Phase 9: SQLite Cleanup

**Duration:** 0.5-1 hour  
**File:** (inline in this document)

- Remove better-sqlite3 and related types from dependencies
- Delete SQLite-specific schema and connection code no longer in use
- Remove `data/hyperpage.db` and other SQLite files from repo and deployment manifests
- Verify no remaining imports of drizzle-orm/sqlite-core or SQLite migrations
- Ensure CI/CD, k8s manifests, and docs reference PostgreSQL only

## Current Database Schema

The existing SQLite database contains 8 main tables:

1. **`jobs`** - Background job persistence and state management
2. **`job_history`** - Job execution audit trail
3. **`rate_limits`** - API rate limiting state persistence
4. **`tool_configs`** - User-configurable tool settings
5. **`app_state`** - Global application configuration
6. **`users`** - OAuth-authenticated user profiles
7. **`oauth_tokens`** - Encrypted OAuth tokens (AES-256-GCM)
8. **`user_sessions`** - User session management

## Benefits of Migration

### Performance Improvements

- **Connection Pooling**: 80% reduction in connection overhead
- **Concurrent Access**: Better handling of multiple users
- **Query Optimization**: PostgreSQL query planner improvements
- **JSONB Operations**: Native JSONB support for faster queries

### Scalability Enhancements

- **Concurrent Users**: 100+ users vs 10-20 with SQLite
- **Data Volume**: 100x larger datasets supported
- **Write Performance**: Better concurrency and locking
- **Backup & Recovery**: Enterprise-grade point-in-time recovery

### Production Readiness

- **ACID Compliance**: Full transactional support
- **Advanced Features**: Full-text search, complex queries
- **Ecosystem Support**: Better tooling and monitoring
- **Future-Proof**: Active development and support

## Timeline & Resources

### Total Duration: 12-18 hours

- **Development**: 8-10 hours
- **Testing**: 3-4 hours
- **Deployment**: 2-3 hours
- **Validation**: 1-2 hours

### Resource Requirements

- **PostgreSQL 15+** instance
- **Storage**: 20GB+ for data volume
- **Memory**: Additional 512MB for PostgreSQL container
- **CPU**: Additional 100m CPU for PostgreSQL container

### Success Criteria

- ✅ All functionality works with PostgreSQL
- ✅ Data integrity validated via automated checks
- ✅ Performance equal or better than SQLite for expected workloads
- ✅ Deployment with minimal disruption and documented rollback
- ✅ Drizzle migrations and schema fully aligned with the running database
- ✅ All tests (unit, integration, migration) pass against PostgreSQL

## Risk Assessment

| Risk Level | Area           | Description                     | Mitigation                   |
| ---------- | -------------- | ------------------------------- | ---------------------------- |
| **Low**    | Code Migration | Well-tested migration patterns  | Comprehensive testing        |
| **Medium** | Data Migration | Potential data integrity issues | Extensive validation         |
| **Low**    | Kubernetes     | Standard sidecar pattern        | Existing deployment patterns |
| **Medium** | Performance    | Unknown workload impact         | Performance monitoring       |

## Next Steps

1. **Review this plan** and get team approval
2. **Start with Phase 1** dependencies migration
3. **Proceed sequentially** through each phase
4. **Test thoroughly** after each phase
5. **Monitor performance** during production deployment

---

**Document Status**: Planning Complete  
**Ready for**: Implementation  
**Review Required**: Development team approval
