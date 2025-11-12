# SQLite Removal Plan - Phase 5: Production Deployment Strategy

## Overview

Phase 5 executes the production deployment strategy to transition the application from SQLite to PostgreSQL in a production environment with minimal downtime and maximum safety through blue-green deployment techniques.

## Prerequisites from Phase 4

- [ ] All test suites pass with 95%+ success rate
- [ ] Performance meets all requirements
- [ ] Security validation completes successfully
- [ ] Load testing demonstrates stability under expected loads
- [ ] QA team approves deployment readiness

## Objectives

1. **Safe Production Deployment**: Execute production deployment with minimal risk and downtime
2. **Blue-Green Deployment**: Use blue-green strategy for zero-downtime migration
3. **Real-time Monitoring**: Monitor application performance during and after deployment
4. **Data Migration Execution**: Execute final data migration in production
5. **Validation and Rollback Planning**: Ensure immediate rollback capability if issues arise

## Phase 5 Tasks

### 5.1 Production Environment Preparation

**Task**: Prepare production environment for PostgreSQL deployment

**Actions**:
- [ ] Provision production PostgreSQL database instance
- [ ] Configure PostgreSQL security, backups, and monitoring
- [ ] Set up production database users and permissions
- [ ] Configure connection pooling for production load
- [ ] Test production PostgreSQL connectivity
- [ ] Prepare production environment variables

**Production PostgreSQL Setup**:
```bash
# Production PostgreSQL configuration
psql $PRODUCTION_DATABASE_URL << EOF
-- Create application user
CREATE USER hyperpage_app WITH PASSWORD '$APP_DB_PASSWORD';
CREATE DATABASE hyperpage_production OWNER hyperpage_app;
GRANT ALL PRIVILEGES ON DATABASE hyperpage_production TO hyperpage_app;

-- Configure connection limits
ALTER USER hyperpage_app CONNECTION LIMIT 100;

-- Enable required extensions
\c hyperpage_production
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
EOF
```

**Deliverables**:
- Production PostgreSQL instance configured
- Database security and access controls implemented
- Production monitoring and alerting configured

### 5.2 Blue-Green Deployment Infrastructure Setup

**Task**: Set up blue-green deployment infrastructure

**Actions**:
- [ ] Create "Blue" environment (current SQLite production)
- [ ] Create "Green" environment (new PostgreSQL production)
- [ ] Configure load balancer for traffic switching
- [ ] Set up health checks for both environments
- [ ] Prepare database migration scripts for production
- [ ] Configure monitoring for both environments

**Blue-Green Configuration**:
```yaml
# docker-compose.blue.yml (Current Production)
services:
  app:
    environment:
      - DB_ENGINE=sqlite
      - DATABASE_PATH=/data/hyperpage.db
    volumes:
      - ./data:/data

# docker-compose.green.yml (New Production)
services:
  app:
    environment:
      - DB_ENGINE=postgres
      - DATABASE_URL=postgresql://hyperpage_app:***@db:5432/hyperpage_production
    depends_on:
      - db
  
  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=hyperpage_production
      - POSTGRES_USER=hyperpage_app
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

**Deliverables**:
- Blue-green deployment infrastructure configured
- Traffic switching mechanism prepared
- Health check monitoring implemented

### 5.3 Production Data Migration

**Task**: Execute production data migration from SQLite to PostgreSQL

**Actions**:
- [ ] Perform final SQLite backup before migration
- [ ] Execute production data migration using validated scripts
- [ ] Monitor migration progress and performance
- [ ] Validate data integrity immediately after migration
- [ ] Test critical application functionality with migrated data
- [ ] Keep SQLite backup for emergency rollback

**Production Migration Commands**:
```bash
#!/bin/bash
# production-migration.sh

set -e  # Exit on any error

echo "Starting production migration at $(date)"

# 1. Final SQLite backup
echo "Creating final SQLite backup..."
cp /data/hyperpage.db /data/backup/hyperpage_backup_$(date +%Y%m%d_%H%M%S).db

# 2. Execute migration
echo "Starting data migration..."
npm run migrate-sqlite-to-postgresql --production --batch-size 500 --validate-data

# 3. Validate migration
echo "Validating migrated data..."
npm run validate-migration --production

# 4. Test critical functionality
echo "Testing critical application functions..."
npm run test:critical-paths --production

echo "Production migration completed at $(date)"
```

**Deliverables**:
- Production data successfully migrated
- Data integrity validation completed
- Critical functionality tested and validated

### 5.4 Application Deployment to Green Environment

**Task**: Deploy updated application to Green environment

**Actions**:
- [ ] Deploy PostgreSQL-optimized application to Green environment
- [ ] Configure Green environment with production settings
- [ ] Test Green environment functionality
- [ ] Validate PostgreSQL connectivity and performance
- [ ] Configure Green environment monitoring
- [ ] Prepare Green environment for production traffic

**Green Environment Deployment**:
```bash
#!/bin/bash
# deploy-green.sh

echo "Deploying application to Green environment..."

# Build and deploy to Green
docker-compose -f docker-compose.green.yml up -d --build

# Wait for Green environment to be ready
echo "Waiting for Green environment to be ready..."
./scripts/wait-for-health-check.sh --url=https://green.hyperpage.com/health --timeout=300

# Run integration tests on Green
echo "Running integration tests on Green environment..."
npm run test:integration -- --base-url=https://green.hyperpage.com

echo "Green environment deployment completed"
```

**Deliverables**:
- Green environment fully deployed and operational
- Integration tests pass on Green environment
- Green environment monitoring configured

### 5.5 Traffic Switching and Validation

**Task**: Switch traffic from Blue to Green environment

**Actions**:
- [ ] Gradually shift traffic from Blue to Green (10%, 25%, 50%, 100%)
- [ ] Monitor application performance during traffic shift
- [ ] Validate user experience at each traffic level
- [ ] Monitor error rates and performance metrics
- [ ] Test critical user workflows
- [ ] Keep Blue environment ready for immediate rollback

**Traffic Switching Script**:
```bash
#!/bin/bash
# traffic-switch.sh

TRAFFIC_PERCENTAGES=(10 25 50 100)

for percentage in "${TRAFFIC_PERCENTAGES[@]}"; do
  echo "Switching ${percentage}% traffic to Green environment..."
  
  # Switch traffic percentage
  aws elbv1 modify-listener \
    --listener-arn $LISTENER_ARN \
    --default-actions Type=weighted,TargetGroupArn=$GREEN_TARGET_ARN,Weight=$percentage
  
  # Monitor for 10 minutes at each level
  echo "Monitoring for 10 minutes..."
  sleep 600
  
  # Run health checks
  ./scripts/health-check-validation.sh --percentage=$percentage
  
  # Check error rates
  error_rate=$(./scripts/check-error-rate.sh)
  if (( $(echo "$error_rate > 0.1" | bc -l) )); then
    echo "Error rate too high ($error_rate%). Rolling back..."
    ./scripts/emergency-rollback.sh
    exit 1
  fi
  
  echo "Traffic switch to ${percentage}% successful"
done

echo "All traffic successfully switched to Green environment"
```

**Deliverables**:
- Traffic successfully switched to Green environment
- Application performance validated at each traffic level
- User experience remains acceptable throughout switch

### 5.6 Post-Deployment Monitoring and Validation

**Task**: Comprehensive monitoring and validation after deployment

**Actions**:
- [ ] Monitor application performance for 24-48 hours
- [ ] Validate all critical business functions
- [ ] Monitor database performance and optimization
- [ ] Check for any integration issues
- [ ] Validate user feedback and experience
- [ ] Document deployment success and learnings

**Post-Deployment Monitoring**:
```bash
#!/bin/bash
# post-deployment-monitoring.sh

# Run for 48 hours with hourly checks
for i in {1..48}; do
  echo "Hour $i monitoring check at $(date)"
  
  # Application health check
  if ! curl -f https://app.hyperpage.com/health > /dev/null 2>&1; then
    echo "ERROR: Application health check failed"
    ./scripts/emergency-rollback.sh
    exit 1
  fi
  
  # Database performance check
  db_performance=$(./scripts/check-db-performance.sh)
  echo "Database performance: $db_performance"
  
  # Error rate check
  error_rate=$(./scripts/check-error-rate.sh)
  echo "Error rate: $error_rate%"
  
  # User functionality check
  ./scripts/test-critical-user-paths.sh
  
  # Sleep for 1 hour
  sleep 3600
done

echo "48-hour post-deployment monitoring completed successfully"
```

**Deliverables**:
- 48-hour post-deployment monitoring report
- Performance validation results
- User experience validation completed

### 5.7 Blue Environment Decommissioning Preparation

**Task**: Prepare Blue environment for decommissioning after validation period

**Actions**:
- [ ] Confirm Green environment stability for 48+ hours
- [ ] Archive Blue environment data and configurations
- [ ] Prepare Blue environment cleanup procedures
- [ ] Document Blue environment decommissioning process
- [ ] Schedule Blue environment shutdown
- [ ] Update infrastructure documentation

**Blue Environment Archive**:
```bash
#!/bin/bash
# archive-blue-environment.sh

echo "Archiving Blue environment..."

# Archive Blue environment configuration
tar -czf blue_environment_archive_$(date +%Y%m%d).tar.gz \
  docker-compose.blue.yml \
  .env.production.blue \
  blue_deployment_log.txt

# Archive final SQLite backup
cp /data/hyperpage.db /data/backup/final_blue_backup_$(date +%Y%m%d_%H%M%S).db
gzip /data/backup/final_blue_backup_*.db

# Store archive in long-term storage
aws s3 cp blue_environment_archive_*.tar.gz s3://hyperpage-archives/

echo "Blue environment archived successfully"
```

**Deliverables**:
- Blue environment archived and documented
- Final SQLite backup preserved
- Decommissioning procedures documented

### 5.8 Rollback Procedures and Emergency Response

**Task**: Maintain rollback capability and emergency response procedures

**Actions**:
- [ ] Keep Blue environment ready for immediate rollback
- [ ] Maintain automated rollback scripts
- [ ] Test rollback procedures regularly
- [ ] Train operations team on rollback procedures
- [ ] Document emergency response procedures
- [ ] Prepare incident communication plan

**Rollback Procedures**:
```bash
#!/bin/bash
# emergency-rollback.sh

echo "EMERGENCY ROLLBACK INITIATED at $(date)"

# 1. Immediate traffic switch to Blue
echo "Switching all traffic back to Blue environment..."
aws elbv1 modify-listener \
  --listener-arn $LISTENER_ARN \
  --default-actions Type=target,TargetGroupArn=$BLUE_TARGET_ARN,Weight=100

# 2. Stop Green environment
echo "Stopping Green environment..."
docker-compose -f docker-compose.green.yml down

# 3. Validate Blue environment
echo "Validating Blue environment health..."
if curl -f https://blue.hyperpage.com/health > /dev/null 2>&1; then
  echo "Blue environment is healthy"
else
  echo "WARNING: Blue environment health check failed"
fi

# 4. Notify operations team
./scripts/notify-incident-team.sh "Emergency rollback completed"

echo "Emergency rollback completed at $(date)"
```

**Deliverables**:
- Emergency rollback procedures tested and validated
- Operations team trained on rollback procedures
- Incident response plan documented

### 5.9 Production Performance Optimization

**Task**: Optimize PostgreSQL performance in production environment

**Actions**:
- [ ] Monitor production database performance
- [ ] Optimize queries based on real production patterns
- [ ] Adjust connection pooling for production load
- [ ] Implement database indexes based on usage patterns
- [ ] Configure PostgreSQL-specific optimizations
- [ ] Set up automated performance monitoring

**Production Optimization**:
```sql
-- Production PostgreSQL optimizations
-- Based on actual usage patterns

-- Optimize job queries (most frequent)
CREATE INDEX CONCURRENTLY idx_jobs_status_scheduled 
ON jobs(status, scheduled_at) 
WHERE status IN ('pending', 'processing');

-- Optimize tool configuration queries
CREATE INDEX CONCURRENTLY idx_tool_configs_enabled_key 
ON tool_configs(enabled, key) 
WHERE enabled = true;

-- Optimize rate limiting queries
CREATE INDEX CONCURRENTLY idx_rate_limits_key_reset 
ON rate_limits(key, reset_at) 
WHERE reset_at > NOW();
```

**Deliverables**:
- Production performance optimized
- Database indexes created based on real usage
- Connection pooling configured for production load

### 5.10 Deployment Documentation and Lessons Learned

**Task**: Document deployment process and capture lessons learned

**Actions**:
- [ ] Document complete deployment process
- [ ] Capture lessons learned and improvements
- [ ] Update deployment runbooks
- [ ] Document any issues encountered and resolutions
- [ ] Create post-deployment review report
- [ ] Update disaster recovery procedures

**Deployment Documentation Template**:
```markdown
# Production Deployment Report - PostgreSQL Migration

## Deployment Summary
- **Date**: [Deployment Date]
- **Duration**: [Total Deployment Time]
- **Traffic Switch**: [Traffic Switch Method and Duration]
- **Downtime**: [Total Downtime Duration]
- **Status**: [SUCCESS/ROLLBACK]

## Pre-Deployment
- Blue environment prepared: [Status]
- Green environment prepared: [Status]
- Data migration completed: [Status and Duration]
- Integration tests passed: [Results]

## Deployment Execution
- Traffic switching progression: [10% → 25% → 50% → 100%]
- Monitoring results: [Performance metrics]
- Issues encountered: [List any issues]
- Resolutions: [How issues were resolved]

## Post-Deployment
- 24-hour monitoring: [Results]
- Performance validation: [Metrics]
- User feedback: [Summary]
- Database optimization: [Changes made]

## Lessons Learned
- What went well: [Successes]
- What could be improved: [Improvements]
- Future recommendations: [Next steps]

## Rollback Capability
- Rollback procedures tested: [Status]
- Time to rollback: [Duration]
- Data preservation: [Status]
```

**Deliverables**:
- Complete deployment documentation
- Lessons learned report
- Updated deployment procedures
- Performance optimization report

## Phase 5 Completion Criteria

**Deployment Success**:
- [ ] Production data successfully migrated to PostgreSQL
- [ ] Blue-green deployment executed without issues
- [ ] Traffic successfully switched to PostgreSQL environment
- [ ] Application performance meets or exceeds requirements
- [ ] All critical business functions operational

**Quality Assurance**:
- [ ] 48-hour post-deployment monitoring completed
- [ ] Performance optimization implemented
- [ ] Security validation completed in production
- [ ] User experience validated and acceptable
- [ ] Database performance optimized for production load

**Operational Readiness**:
- [ ] Blue environment archived and documented
- [ ] Rollback procedures tested and validated
- [ ] Operations team trained and prepared
- [ ] Monitoring and alerting operational
- [ ] Documentation updated and complete

## Phase 5 Estimated Duration

- **Duration**: 1-2 weeks
- **Team Size**: 2-3 developers + 1 DBA + 2 operations engineers
- **Critical Path**: Production data migration and traffic switching
- **Downtime Required**: Minimal (target: <15 minutes total)

## Phase 5 Exit Conditions

Phase 5 is complete when:
1. Production deployment successfully executed
2. All traffic switched to PostgreSQL environment
3. 48-hour monitoring period completed successfully
4. Performance meets or exceeds production requirements
5. Operations team trained and rollback procedures validated

## Emergency Procedures

**Immediate Rollback Triggers**:
- Application becomes unavailable for >5 minutes
- Error rate exceeds 5% for >10 minutes
- Database performance degrades significantly
- Critical business functions fail
- User experience severely impacted

**Rollback Execution**:
1. Execute emergency rollback script
2. Switch all traffic back to Blue environment
3. Stop Green environment to prevent data divergence
4. Notify incident response team
5. Investigate and document issues

## Quality Gates

**Before Proceeding to Phase 6**:
1. **Production Validation**: All production functionality validated
2. **Performance Review**: Production performance meets requirements
3. **Operations Review**: Operations team approves transition
4. **Stakeholder Review**: Management approval for cleanup phase
5. **Documentation Review**: Deployment documentation complete

## Next Phase Preview

Phase 6 will focus on **Cleanup & Finalization**, including:
- Blue environment decommissioning
- SQLite cleanup and removal
- Final documentation updates
- Post-migration optimization
- Migration success validation

## Phase 5 Review and Approval

- [ ] **Production Review**: Deployment executed successfully
- [ ] **Performance Review**: Production performance validated
- [ ] **Operations Review**: Operations team readiness confirmed
- [ ] **Security Review**: Production security validated
- [ ] **Sign-off**: Technical lead, operations lead, and project manager approval

---

**Phase 5 Status**: Ready to execute  
**Last Updated**: 2025-01-11  
**Deployment Lead**: [To be assigned]  
**Review Date**: [To be scheduled]
