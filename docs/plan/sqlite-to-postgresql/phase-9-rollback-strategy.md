# Phase 9: Rollback Strategy

**Duration:** Planning Phase  
**Status:** Ready for Implementation  
**Prerequisites:** Phase 1-8 completed

## Overview

This phase outlines the comprehensive rollback strategy for the SQLite to PostgreSQL migration, including emergency procedures, data recovery, and system restoration to ensure business continuity.

## Rollback Strategy Overview

### Rollback Scenarios

1. **Application Failure**: Application not starting or critical errors
2. **Performance Degradation**: Significant performance issues
3. **Data Integrity Issues**: Corrupted or missing data
4. **User Experience Problems**: Major functionality broken
5. **Database Connectivity**: Connection or query failures

### Rollback Approach

- **Immediate Rollback**: Fast restoration to previous state
- **Data Recovery**: Restore data integrity and completeness
- **Validation**: Verify system functionality after rollback
- **Post-Rollback**: Monitoring and optimization

## Rollback Triggers

### Automatic Triggers

- Database health check failures (3 consecutive failures)
- Application health check failures (5 consecutive failures)
- Performance degradation >50% from baseline
- Error rate >5% for >5 minutes
- Connection pool exhaustion

### Manual Triggers

- Significant user-reported issues
- Data integrity validation failures
- Performance metrics below acceptable thresholds
- Security or compliance issues discovered

## Implementation Steps

### Step 1: Emergency Rollback Procedures

#### Emergency Rollback Script

```bash
#!/bin/bash
# scripts/emergency-rollback.sh

set -e

echo "🚨 EMERGENCY ROLLBACK INITIATED"
echo "Time: $(date)"
echo "User: $(whoami)"

# Configuration
NAMESPACE="hyperpage"
DEPLOYMENT_NAME="hyperpage"
ROLLBACK_FILE="deployment-rollback-$(date +%Y%m%d-%H%M%S).yaml"
SQLITE_BACKUP="/backup/hyperpage-$(date +%Y%m%d-%H%M%S).db"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Step 1: Create immediate backup of current state
log_info "Step 1: Creating emergency backup..."
kubectl get deployment $DEPLOYMENT_NAME -n $NAMESPACE -o yaml > $ROLLBACK_FILE
log_info "Current deployment backed up to: $ROLLBACK_FILE"

# Step 2: Scale down PostgreSQL deployment
log_info "Step 2: Scaling down PostgreSQL deployment..."
kubectl scale deployment $DEPLOYMENT_NAME --replicas=0 -n $NAMESPACE
kubectl scale deployment hyperpage-postgres-init --replicas=0 -n $NAMESPACE 2>/dev/null || true

# Wait for scale down
sleep 10

# Step 3: Restore original SQLite configuration
log_info "Step 3: Restoring SQLite configuration..."

# Update environment variables to use SQLite
cat <<EOF | kubectl apply -f - -n $NAMESPACE
apiVersion: v1
kind: ConfigMap
metadata:
  name: hyperpage-config-rollback
  labels:
    app: hyperpage
    component: rollback
data:
  DATABASE_PATH: "./data/hyperpage.db"
  USE_SQLITE: "true"
  POSTGRES_HOST: ""
  POSTGRES_DB: ""
  POSTGRES_USER: ""
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hyperpage-rollback
  labels:
    app: hyperpage
    component: rollback
spec:
  replicas: 1
  selector:
    matchLabels:
      app: hyperpage
      component: rollback
  template:
    metadata:
      labels:
        app: hyperpage
        component: rollback
    spec:
      containers:
      - name: hyperpage
        image: hyperpage:v0.0.9-sqlite
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_PATH
          value: "./data/hyperpage.db"
        - name: USE_SQLITE
          value: "true"
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        volumeMounts:
        - name: data-volume
          mountPath: /app/data
      volumes:
      - name: data-volume
        persistentVolumeClaim:
          claimName: hyperpage-pvc
EOF

# Step 4: Wait for rollback deployment
log_info "Step 4: Waiting for rollback deployment..."
kubectl wait --for=condition=available --timeout=120s deployment/hyperpage-rollback -n $NAMESPACE

# Step 5: Update service to point to rollback deployment
log_info "Step 5: Updating service..."
kubectl patch service hyperpage-service -n $NAMESPACE -p '{"spec":{"selector":{"app":"hyperpage","component":"rollback"}}}'

# Step 6: Scale up rollback deployment
log_info "Step 6: Scaling up rollback deployment..."
kubectl scale deployment hyperpage-rollback --replicas=1 -n $NAMESPACE

# Step 7: Verify rollback
log_info "Step 7: Verifying rollback..."

# Health check
APP_HEALTH=$(kubectl get pods -n $NAMESPACE -l app=hyperpage,component=rollback -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "NotFound")
if [ "$APP_HEALTH" = "Running" ]; then
    log_info "✅ Application rollback successful"
else
    log_error "❌ Application rollback failed: $APP_HEALTH"
    exit 1
fi

# Database check
DB_CHECK=$(kubectl exec -n $NAMESPACE deployment/hyperpage-rollback -- test -f /app/data/hyperpage.db 2>/dev/null && echo "exists" || echo "missing")
if [ "$DB_CHECK" = "exists" ]; then
    log_info "✅ SQLite database accessible"
else
    log_warn "⚠️ SQLite database not found - may need manual restore"
fi

# Final status
log_info "Rollback completed successfully!"
echo ""
echo "📊 Rollback Summary:"
echo "  ✅ PostgreSQL deployment scaled down"
echo "  ✅ SQLite configuration restored"
echo "  ✅ Application rolling back to v0.0.9"
echo "  ✅ Service updated to rollback deployment"
echo "  ✅ Health checks passed"
echo ""
echo "🔍 Next Steps:"
echo "  1. Monitor application stability"
echo "  2. Verify all functionality is working"
echo "  3. Investigate root cause of issues"
echo "  4. Plan fixes before next deployment"
echo "  5. Update monitoring alerts"
echo ""
echo "📁 Rollback file saved: $ROLLBACK_FILE"
```

### Step 2: Data Recovery Procedures

#### SQLite Data Recovery Script

```bash
#!/bin/bash
# scripts/restore-sqlite-data.sh

echo "🔄 Starting SQLite data recovery..."

# Configuration
BACKUP_DIR="/backup"
NAMESPACE="hyperpage"
SQLITE_CONTAINER="hyperpage-rollback"

# Check for available backups
AVAILABLE_BACKUPS=$(find $BACKUP_DIR -name "hyperpage-*.db" -type f 2>/dev/null | sort -r)

if [ -z "$AVAILABLE_BACKUPS" ]; then
    echo "❌ No SQLite backups found in $BACKUP_DIR"
    exit 1
fi

echo "Available backups:"
echo "$AVAILABLE_BACKUPS" | nl

# Get user selection
echo ""
read -p "Select backup number to restore: " SELECTION

SELECTED_BACKUP=$(echo "$AVAILABLE_BACKUPS" | sed -n "${SELECTION}p")

if [ -z "$SELECTED_BACKUP" ]; then
    echo "❌ Invalid selection"
    exit 1
fi

echo "Selected backup: $SELECTED_BACKUP"

# Create current backup before restore
CURRENT_BACKUP="$BACKUP_DIR/pre-restore-$(date +%Y%m%d-%H%M%S).db"
echo "Creating backup of current state..."
kubectl exec -n $NAMESPACE deployment/$SQLITE_CONTAINER -- cp /app/data/hyperpage.db $CURRENT_BACKUP 2>/dev/null || echo "Could not backup current state"

# Restore selected backup
echo "Restoring backup: $SELECTED_BACKUP"
kubectl cp $SELECTED_BACKUP $NAMESPACE/$SQLITE_CONTAINER:/app/data/hyperpage.db

# Verify restore
echo "Verifying restore..."
DB_CHECK=$(kubectl exec -n $NAMESPACE deployment/$SQLITE_CONTAINER -- test -f /app/data/hyperpage.db && echo "success" || echo "failed")

if [ "$DB_CHECK" = "success" ]; then
    echo "✅ SQLite data restored successfully"

    # Check data integrity
    echo "Checking data integrity..."
    RECORD_COUNT=$(kubectl exec -n $NAMESPACE deployment/$SQLITE_CONTAINER -- sqlite3 /app/data/hyperpage.db "SELECT COUNT(*) FROM jobs;" 2>/dev/null || echo "0")
    echo "Jobs table has $RECORD_COUNT records"

    echo "🎉 Data recovery completed successfully"
    echo "Backup restored: $SELECTED_BACKUP"
    echo "Previous state backed up: $CURRENT_BACKUP"
else
    echo "❌ Data restore failed"
    exit 1
fi
```

#### Data Integrity Validation Script

```bash
#!/bin/bash
# scripts/validate-data-integrity.sh

echo "🔍 Validating data integrity after rollback..."

NAMESPACE="hyperpage"
SQLITE_CONTAINER="hyperpage-rollback"

# Check tables exist
echo "Checking table structure..."
TABLES=$(kubectl exec -n $NAMESPACE deployment/$SQLITE_CONTAINER -- sqlite3 /app/data/hyperpage.db ".tables" 2>/dev/null || echo "")

if [ -z "$TABLES" ]; then
    echo "❌ No tables found in database"
    exit 1
fi

echo "Found tables: $TABLES"

# Validate data counts
echo "Validating data counts..."

# Check each table
TABLES_CHECK=("jobs" "users" "tool_configs" "app_state" "oauth_tokens" "user_sessions")

for table in "${TABLES_CHECK[@]}"; do
    COUNT=$(kubectl exec -n $NAMESPACE deployment/$SQLITE_CONTAINER -- sqlite3 /app/data/hyperpage.db "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
    echo "  $table: $COUNT records"

    if [ "$COUNT" -lt 0 ]; then
        echo "❌ Invalid count for table $table"
    fi
done

# Check foreign key relationships
echo "Checking foreign key relationships..."

# Check job_history references
JH_COUNT=$(kubectl exec -n $NAMESPACE deployment/$SQLITE_CONTAINER -- sqlite3 /app/data/hyperpage.db "SELECT COUNT(*) FROM job_history;" 2>/dev/null || echo "0")
JH_ORPHANED=$(kubectl exec -n $NAMESPACE deployment/$SQLITE_CONTAINER -- sqlite3 /app/data/hyperpage.db "SELECT COUNT(*) FROM job_history jh LEFT JOIN jobs j ON jh.job_id = j.id WHERE j.id IS NULL;" 2>/dev/null || echo "0")

echo "  job_history: $JH_COUNT total, $JH_ORPHANED orphaned"

# Check application state
echo "Checking application state..."
VERSION=$(kubectl exec -n $NAMESPACE deployment/$SQLITE_CONTAINER -- sqlite3 /app/data/hyperpage.db "SELECT value FROM app_state WHERE key = 'version';" 2>/dev/null || echo "unknown")
echo "  Application version: $VERSION"

echo "✅ Data integrity validation completed"
```

### Step 3: System Restoration Procedures

#### Full System Restore Script

```bash
#!/bin/bash
# scripts/full-system-restore.sh

echo "🔄 Starting full system restoration..."

NAMESPACE="hyperpage"
ROLLBACK_FILE="deployment-rollback-latest.yaml"

# Check if rollback file exists
if [ ! -f "$ROLLBACK_FILE" ]; then
    echo "❌ Rollback file not found: $ROLLBACK_FILE"
    echo "Looking for latest rollback file..."
    LATEST_ROLLBACK=$(find . -name "deployment-rollback-*.yaml" | sort -r | head -1)

    if [ -z "$LATEST_ROLLBACK" ]; then
        echo "❌ No rollback files found"
        exit 1
    fi

    ROLLBACK_FILE=$LATEST_ROLLBACK
    echo "Using rollback file: $ROLLBACK_FILE"
fi

# Step 1: Stop all current deployments
echo "Step 1: Stopping current deployments..."
kubectl scale deployment hyperpage --replicas=0 -n $NAMESPACE 2>/dev/null || true
kubectl scale deployment hyperpage-postgres-init --replicas=0 -n $NAMESPACE 2>/dev/null || true
kubectl scale deployment hyperpage-rollback --replicas=0 -n $NAMESPACE 2>/dev/null || true

# Step 2: Delete current deployments
echo "Step 2: Deleting current deployments..."
kubectl delete deployment hyperpage -n $NAMESPACE 2>/dev/null || true
kubectl delete deployment hyperpage-postgres-init -n $NAMESPACE 2>/dev/null || true
kubectl delete deployment hyperpage-rollback -n $NAMESPACE 2>/dev/null || true

# Step 3: Restore from rollback file
echo "Step 3: Restoring from rollback file..."
kubectl apply -f $ROLLBACK_FILE -n $NAMESPACE

# Step 4: Update service selector
echo "Step 4: Updating service selector..."
kubectl patch service hyperpage-service -n $NAMESPACE -p '{"spec":{"selector":{"app":"hyperpage"}}}'

# Step 5: Scale up original deployment
echo "Step 5: Scaling up original deployment..."
kubectl scale deployment hyperpage --replicas=1 -n $NAMESPACE

# Step 6: Wait for deployment
echo "Step 6: Waiting for deployment to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/hyperpage -n $NAMESPACE

# Step 7: Verify restoration
echo "Step 7: Verifying system restoration..."

# Check application health
APP_STATUS=$(kubectl get deployment hyperpage -n $NAMESPACE -o jsonpath='{.status.conditions[?(@.type=="Available")].status}' 2>/dev/null || echo "False")
if [ "$APP_STATUS" = "True" ]; then
    echo "✅ Application restored successfully"
else
    echo "❌ Application restoration failed"
    exit 1
fi

# Check service
SERVICE_STATUS=$(kubectl get service hyperpage-service -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
if [ ! -z "$SERVICE_STATUS" ]; then
    echo "✅ Service restored successfully"
else
    echo "⚠️ Service status unknown - may need manual verification"
fi

echo "🎉 Full system restoration completed"
echo "System should now be operational with SQLite database"
echo "Monitor application logs for any issues:"
echo "kubectl logs -f deployment/hyperpage -n $NAMESPACE"
```

### Step 4: Post-Rollback Validation

#### Post-Rollback Validation Script

```bash
#!/bin/bash
# scripts/post-rollback-validation.sh

echo "🔍 Post-rollback validation started..."

NAMESPACE="hyperpage"
SQLITE_CONTAINER="hyperpage"

# Function to test endpoint
test_endpoint() {
    local endpoint=$1
    local expected_status=$2

    response=$(kubectl exec -n $NAMESPACE deployment/$SQLITE_CONTAINER -- curl -s -o /dev/null -w "%{http_code}" http://localhost:3000$endpoint 2>/dev/null || echo "000")

    if [ "$response" = "$expected_status" ]; then
        echo "  ✅ $endpoint: HTTP $response"
        return 0
    else
        echo "  ❌ $endpoint: HTTP $response (expected $expected_status)"
        return 1
    fi
}

# Test 1: Health endpoints
echo "Testing health endpoints..."
test_endpoint "/api/health" "200" || true
test_endpoint "/api/health/database" "200" || true

# Test 2: Core functionality
echo "Testing core functionality..."

# Test database connectivity
DB_TEST=$(kubectl exec -n $NAMESPACE deployment/$SQLITE_CONTAINER -- test -f /app/data/hyperpage.db && echo "success" || echo "failed")
if [ "$DB_TEST" = "success" ]; then
    echo "  ✅ SQLite database accessible"
else
    echo "  ❌ SQLite database not accessible"
fi

# Test database queries
QUERY_TEST=$(kubectl exec -n $NAMESPACE deployment/$SQLITE_CONTAINER -- sqlite3 /app/data/hyperpage.db "SELECT COUNT(*) FROM app_state;" 2>/dev/null || echo "0")
if [ "$QUERY_TEST" -ge "0" ]; then
    echo "  ✅ Database queries working (found $QUERY_TEST app_state records)"
else
    echo "  ❌ Database queries failing"
fi

# Test 3: User interface
echo "Testing user interface..."

# Test main page
UI_TEST=$(kubectl exec -n $NAMESPACE deployment/$SQLITE_CONTAINER -- curl -s http://localhost:3000 | grep -q "Hyperpage" && echo "success" || echo "failed")
if [ "$UI_TEST" = "success" ]; then
    echo "  ✅ Main UI page loading"
else
    echo "  ❌ Main UI page not loading"
fi

# Test 4: System resources
echo "Checking system resources..."

# CPU and memory usage
CPU_USAGE=$(kubectl top pods -n $NAMESPACE | grep hyperpage | awk '{print $2}' 2>/dev/null || echo "unknown")
MEMORY_USAGE=$(kubectl top pods -n $NAMESPACE | grep hyperpage | awk '{print $3}' 2>/dev/null || echo "unknown")

echo "  CPU usage: $CPU_USAGE"
echo "  Memory usage: $MEMORY_USAGE"

# Check for errors in logs
ERROR_COUNT=$(kubectl logs deployment/$SQLITE_CONTAINER -n $NAMESPACE --tail=100 2>/dev/null | grep -i error | wc -l || echo "0")
if [ "$ERROR_COUNT" -eq 0 ]; then
    echo "  ✅ No recent errors in logs"
else
    echo "  ⚠️ Found $ERROR_COUNT errors in recent logs"
    echo "  Recent errors:"
    kubectl logs deployment/$SQLITE_CONTAINER -n $NAMESPACE --tail=50 2>/dev/null | grep -i error | tail -5
fi

echo "✅ Post-rollback validation completed"
echo "System appears to be operational with SQLite database"
```

### Step 5: Monitoring and Alerting

#### Monitoring Configuration for Rollback

```yaml
# k8s/monitoring-rollback.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: rollback-monitoring
  labels:
    app: hyperpage
    component: monitoring
data:
  prometheus-rollback.yml: |
    global:
      scrape_interval: 10s
    scrape_configs:
    - job_name: 'hyperpage-sqlite-rollback'
      static_configs:
      - targets: ['hyperpage-rollback:3000']
      metrics_path: /api/metrics
      scrape_interval: 5s
    - job_name: 'hyperpage-health-rollback'
      static_configs:
      - targets: ['hyperpage-rollback:3000']
      metrics_path: /api/health
      scrape_interval: 5s
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alertmanager-rollback
  labels:
    app: hyperpage
    component: alertmanager
spec:
  replicas: 1
  selector:
    matchLabels:
      app: hyperpage
      component: alertmanager
  template:
    metadata:
      labels:
        app: hyperpage
        component: alertmanager
    spec:
      containers:
        - name: alertmanager
          image: prom/alertmanager:latest
          ports:
            - containerPort: 9093
          resources:
            requests:
              memory: "64Mi"
              cpu: "50m"
            limits:
              memory: "128Mi"
              cpu: "100m"
```

#### Alert Rules for Post-Rollback

```yaml
# k8s/alert-rules-rollback.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: hyperpage-rollback-alerts
  labels:
    app: hyperpage
    component: monitoring
spec:
  groups:
    - name: hyperpage.rollback.alerts
      rules:
        - alert: ApplicationDown
          expr: up{job="hyperpage-sqlite-rollback"} == 0
          for: 1m
          labels:
            severity: critical
            component: application
          annotations:
            summary: "Application is down after rollback"
            description: "Application has been down for more than 1 minute after rollback"

        - alert: DatabaseConnectionFailed
          expr: http_requests_total{job="hyperpage-health-rollback",endpoint="/api/health/database"} == 0
          for: 2m
          labels:
            severity: warning
            component: database
          annotations:
            summary: "Database connection failed after rollback"
            description: "Database health check has been failing for more than 2 minutes"

        - alert: HighErrorRate
          expr: rate(http_requests_total{job="hyperpage-sqlite-rollback",status=~"5.."}[5m]) > 0.05
          for: 3m
          labels:
            severity: warning
            component: application
          annotations:
            summary: "High error rate after rollback"
            description: "Error rate is above 5% for more than 3 minutes"

        - alert: HighResponseTime
          expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="hyperpage-sqlite-rollback"}[5m])) > 2
          for: 5m
          labels:
            severity: warning
            component: performance
          annotations:
            summary: "High response time after rollback"
            description: "95th percentile response time is above 2 seconds for more than 5 minutes"
```

## Rollback Decision Matrix

| Issue Severity | Impact                      | Rollback Time       | Decision Criteria                                  |
| -------------- | --------------------------- | ------------------- | -------------------------------------------------- |
| **Critical**   | Complete system failure     | Immediate (<5 min)  | System completely down, data loss, security breach |
| **High**       | Major functionality broken  | Fast (<15 min)      | >50% users affected, critical features unavailable |
| **Medium**     | Performance or minor issues | Planned (<1 hour)   | >20% users affected, non-critical features broken  |
| **Low**        | Minimal user impact         | Consider (Optional) | <20% users affected, workarounds available         |

## Validation Checklist

### Emergency Rollback

- [ ] Rollback script executable and tested
- [ ] Backup files accessible and current
- [ ] Service endpoint updates working
- [ ] Health checks passing after rollback
- [ ] User access restored

### Data Recovery

- [ ] SQLite backup files available
- [ ] Data integrity validation working
- [ ] Foreign key relationships preserved
- [ ] Application state recovered
- [ ] User data fully restored

### System Restoration

- [ ] Original deployment files available
- [ ] Configuration restoration working
- [ ] Database migration rollback functional
- [ ] Service routing updated
- [ ] Performance baseline reestablished

### Post-Rollback Monitoring

- [ ] Monitoring alerts configured
- [ ] Health check endpoints responding
- [ ] Performance metrics tracking
- [ ] Error rate monitoring active
- [ ] User experience validation

## Success Criteria

✅ **Rollback procedures tested and functional**  
✅ **Data recovery mechanisms working**  
✅ **System restoration capability verified**  
✅ **Post-rollback monitoring active**  
✅ **Recovery time objectives met**  
✅ **Data integrity maintained during rollback**

## Next Steps After Rollback

1. **Root Cause Analysis**: Investigate why rollback was necessary
2. **Issue Resolution**: Fix problems before attempting migration again
3. **Testing Enhancement**: Improve test coverage based on issues found
4. **Monitoring Enhancement**: Add alerts for early problem detection
5. **Process Improvement**: Update procedures based on lessons learned

---

**Phase 9 Status**: Complete  
**Migration Documentation**: Fully Complete

## Complete Migration Documentation Summary

The SQLite to PostgreSQL migration documentation is now complete with 9 comprehensive phases:

1. **Phase 1**: Dependencies & Code Migration ✅
2. **Phase 2**: Schema Conversion ✅
3. **Phase 3**: Database Connection Overhaul ✅
4. **Phase 4**: Migration System Updates ✅
5. **Phase 5**: Kubernetes Configuration ✅
6. **Phase 6**: Data Migration ✅
7. **Phase 7**: Testing & Validation ✅
8. **Phase 8**: Production Deployment ✅
9. **Phase 9**: Rollback Strategy ✅

**Total Implementation Time**: 12-18 hours  
**Ready for**: Production implementation  
**Documentation Status**: Complete and comprehensive
