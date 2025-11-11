# SQLite Removal Plan - Phase 2: Data Migration Execution & Validation

## Overview

Phase 2 executes the actual data migration from SQLite to PostgreSQL using the validated infrastructure from Phase 1. This phase includes data transfer, validation, and performance optimization to ensure complete and accurate data migration.

## Prerequisites from Phase 1

- [ ] Complete SQLite dependency audit completed
- [ ] Migration scripts tested and validated
- [ ] PostgreSQL infrastructure verified
- [ ] Rollback procedures documented and tested
- [ ] Stakeholder approval for migration execution

## Objectives

1. **Execute Controlled Data Migration**: Transfer all data from SQLite to PostgreSQL with minimal downtime
2. **Data Integrity Validation**: Ensure all data transferred correctly with full integrity
3. **Performance Optimization**: Optimize PostgreSQL queries and indexes for optimal performance
4. **Real-time Monitoring**: Monitor migration progress and catch issues immediately
5. **Backup and Recovery**: Maintain SQLite backups until migration completion verification

## Phase 2 Tasks

### 2.1 Pre-Migration Final Checks

**Task**: Execute final pre-migration validation and setup

**Actions**:
- [ ] Verify SQLite database integrity one final time
- [ ] Confirm PostgreSQL target database is ready and clean
- [ ] Create final SQLite backup before migration start
- [ ] Verify all migration scripts and dependencies
- [ ] Set up migration monitoring and logging
- [ ] Prepare communication channels for migration progress

**Deliverables**:
- Pre-migration checklist completion
- Final SQLite backup with verification
- Migration monitoring dashboard

**Commands**:
```bash
# Final SQLite integrity check
sqlite3 $SQLITE_PATH "PRAGMA integrity_check;"
sqlite3 $SQLITE_PATH ".backup backup_$(date +%Y%m%d_%H%M%S).db"

# PostgreSQL readiness check
psql $POSTGRES_URL -c "SELECT version();"
psql $POSTGRES_URL -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

### 2.2 Schema Migration (DDL)

**Task**: Create PostgreSQL schema structure matching SQLite data

**Actions**:
- [ ] Generate PostgreSQL DDL from existing schema definitions
- [ ] Create all tables, indexes, and constraints in PostgreSQL
- [ ] Verify schema compatibility and data type mapping
- [ ] Test schema with sample data insertions
- [ ] Create indexes for performance optimization
- [ ] Set up database roles and permissions

**Deliverables**:
- PostgreSQL schema created and verified
- Indexes and performance optimizations applied
- Database permissions and roles configured

**Commands**:
```bash
# Generate and apply DDL
npx drizzle-kit generate:pg --config=drizzle.config.ts
npx drizzle-kit push:pg --config=drizzle.config.ts

# Verify schema creation
psql $POSTGRES_URL -c "\dt"
psql $POSTGRES_URL -c "\di" # List indexes
```

### 2.3 Data Migration Execution

**Task**: Execute the actual data transfer from SQLite to PostgreSQL

**Actions**:
- [ ] Run migration script for each table in dependency order
- [ ] Monitor migration progress and performance
- [ ] Handle large tables with batch processing
- [ ] Manage migration of JSON and complex data types
- [ ] Validate timestamp and timezone conversions
- [ ] Handle foreign key relationships and constraints
- [ ] Process incremental updates if needed

**Migration Order**:
1. `users` (minimal dependencies)
2. `tool_configs` (depends on users)
3. `oauth_tokens` (depends on users)
4. `rate_limits` (independent)
5. `app_state` (independent)
6. `jobs` (large dataset - process last)
7. `job_history` (depends on jobs)

**Deliverables**:
- Complete data migration with progress tracking
- Migration performance metrics and logs
- Error handling and recovery procedures

**Commands**:
```bash
# Execute migration by table order
npm run migrate-sqlite-to-postgresql --tables users --batch-size 1000
npm run migrate-sqlite-to-postgresql --tables tool_configs --batch-size 500
npm run migrate-sqlite-to-postgresql --tables oauth_tokens --batch-size 500
npm run migrate-sqlite-to-postgresql --tables rate_limits --batch-size 1000
npm run migrate-sqlite-to-postgresql --tables app_state --batch-size 1000
npm run migrate-sqlite-to-postgresql --tables jobs --batch-size 500
npm run migrate-sqlite-to-postgresql --tables job_history --batch-size 1000

# Full migration
npm run migrate-sqlite-to-postgresql --batch-size 1000 --validate-data
```

### 2.4 Data Integrity Validation

**Task**: Comprehensive validation of migrated data integrity and completeness

**Actions**:
- [ ] Compare record counts between SQLite and PostgreSQL
- [ ] Validate data content and format consistency
- [ ] Check referential integrity and foreign key relationships
- [ ] Verify JSON data integrity and parsing
- [ ] Validate timestamp and timezone conversions
- [ ] Test complex queries and data retrieval
- [ ] Validate business logic constraints
- [ ] Cross-reference data with sample records

**Validation Queries**:
```sql
-- Record count comparison
SELECT 'users' as table_name, COUNT(*) as pg_count FROM users
UNION ALL
SELECT 'tool_configs', COUNT(*) FROM tool_configs
UNION ALL
SELECT 'oauth_tokens', COUNT(*) FROM oauth_tokens
UNION ALL
SELECT 'rate_limits', COUNT(*) FROM rate_limits
UNION ALL
SELECT 'app_state', COUNT(*) FROM app_state
UNION ALL
SELECT 'jobs', COUNT(*) FROM jobs
UNION ALL
SELECT 'job_history', COUNT(*) FROM job_history;

-- Data integrity checks
SELECT * FROM users WHERE email IS NULL OR email = '';
SELECT * FROM jobs WHERE payload::text IS NULL OR payload::text = '{}';
SELECT * FROM tool_configs WHERE config::text IS NULL;

-- Foreign key validation
SELECT * FROM oauth_tokens ot 
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ot.user_id);
```

**Deliverables**:
- Data integrity validation report
- Record count verification results
- Data quality assessment

### 2.5 Performance Optimization

**Task**: Optimize PostgreSQL performance for migrated data

**Actions**:
- [ ] Analyze query performance with migrated data
- [ ] Create additional indexes for frequently queried columns
- [ ] Optimize query plans and execution strategies
- [ ] Update connection pooling configurations
- [ ] Validate concurrent access patterns
- [ ] Test application performance under load
- [ ] Configure PostgreSQL-specific optimizations

**Performance Tests**:
```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM jobs WHERE status = 'pending' ORDER BY scheduled_at;
EXPLAIN ANALYZE SELECT * FROM tool_configs WHERE enabled = true;
EXPLAIN ANALYZE SELECT * FROM rate_limits WHERE reset_at > NOW();

-- Index usage verification
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

**Deliverables**:
- Performance optimization report
- Optimized query execution plans
- PostgreSQL configuration tuning

### 2.6 Application Integration Testing

**Task**: Test application integration with PostgreSQL data

**Actions**:
- [ ] Run application test suite against PostgreSQL
- [ ] Test all API endpoints with migrated data
- [ ] Validate OAuth token functionality
- [ ] Test job queue processing with PostgreSQL
- [ ] Verify rate limiting functionality
- [ ] Test configuration management features
- [ ] Validate monitoring and health checks

**Integration Tests**:
```bash
# Run application tests
npm test -- --db-engine=postgres
npm run test:integration -- --database=postgresql

# API endpoint testing
curl -H "Content-Type: application/json" $API_URL/health
curl -H "Authorization: Bearer $TOKEN" $API_URL/api/tools/enabled

# Load testing
npm run test:load -- --target=postgresql
```

**Deliverables**:
- Integration test results
- API endpoint validation report
- Load testing performance metrics

### 2.7 Migration Monitoring and Alerting

**Task**: Set up comprehensive monitoring for PostgreSQL operations

**Actions**:
- [ ] Configure PostgreSQL performance monitoring
- [ ] Set up alerts for database connection issues
- [ ] Monitor query performance and slow queries
- [ ] Track database growth and capacity
- [ ] Monitor application database interaction patterns
- [ ] Set up automated health checks

**Monitoring Setup**:
```bash
# Add to Grafana dashboard (if configured)
# Database connection monitoring
# Query performance tracking
# Storage utilization alerts
```

**Deliverables**:
- PostgreSQL monitoring dashboard
- Alert configuration and thresholds
- Monitoring integration test results

### 2.8 Backup Strategy Update

**Task**: Update backup procedures for PostgreSQL

**Actions**:
- [ ] Configure automated PostgreSQL backups
- [ ] Test backup and restore procedures
- [ ] Set up backup rotation and retention policies
- [ ] Document disaster recovery procedures
- [ ] Train operations team on new backup procedures
- [ ] Test point-in-time recovery capabilities

**Backup Commands**:
```bash
# PostgreSQL backup
pg_dump $POSTGRES_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Point-in-time recovery test
psql $POSTGRES_URL -c "SELECT pg_start_backup('migration_backup');"
# ... perform backup operations ...
psql $POSTGRES_URL -c "SELECT pg_stop_backup();"
```

**Deliverables**:
- Updated backup procedures documentation
- Backup and restore testing results
- Disaster recovery plan updates

## Phase 2 Completion Criteria

**Data Migration Success**:
- [ ] All tables migrated successfully with correct record counts
- [ ] Data integrity validation passed for all tables
- [ ] Performance benchmarks meet or exceed expectations
- [ ] Application integration tests pass completely

**Infrastructure Readiness**:
- [ ] PostgreSQL fully configured and optimized
- [ ] Monitoring and alerting operational
- [ ] Backup procedures tested and documented
- [ ] Performance optimizations applied

**Quality Assurance**:
- [ ] Comprehensive testing completed
- [ ] Load testing passed
- [ ] Security validation completed
- [ ] Documentation updated

## Phase 2 Estimated Duration

- **Duration**: 1-2 weeks
- **Team Size**: 2 developers + 1 DBA + 1 operations engineer
- **Critical Path**: Data migration execution and validation
- **Downtime Required**: Minimal (estimated 2-4 hours for migration execution)

## Phase 2 Exit Conditions

Phase 2 is complete when:
1. All data successfully migrated to PostgreSQL
2. Data integrity validation passes 100%
3. Application integration tests pass with PostgreSQL
4. Performance meets or exceeds SQLite baseline
5. Monitoring and backup systems are operational

## Rollback Triggers

Immediate rollback if:
- Data integrity validation fails
- Application tests fail consistently
- Performance degrades significantly
- Critical application functionality broken
- Monitoring shows database corruption

## Phase 2 Exit Procedures

If rollback is triggered:
1. Stop all application writes immediately
2. Restore SQLite from backup
3. Switch application back to SQLite
4. Document failure and lessons learned
5. Plan remediation before retry

## Next Phase Preview

Phase 3 will focus on **Application Code Migration & Path Updates**, including:
- Update application code to use PostgreSQL by default
- Remove SQLite-specific optimizations
- Update configuration management
- Finalize infrastructure cleanup

## Phase 2 Review and Approval

- [ ] **Data Validation**: All migrated data verified and validated
- [ ] **Performance Review**: PostgreSQL performance meets requirements
- [ ] **Integration Testing**: Application tests pass with PostgreSQL
- [ ] **Operations Review**: Backup and monitoring systems operational
- [ ] **Sign-off**: Migration lead and technical lead approval

---

**Phase 2 Status**: Ready to execute  
**Last Updated**: 2025-01-11  
**Migration Lead**: [To be assigned]  
**Review Date**: [To be scheduled]
