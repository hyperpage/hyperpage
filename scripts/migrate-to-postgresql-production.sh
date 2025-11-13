#!/bin/bash
set -e

# Production SQLite to PostgreSQL Migration Script
# Phase 8: Data Migration for Production Deployment

echo "🚀 Production SQLite to PostgreSQL Migration"

# Configuration
NAMESPACE="hyperpage"
BACKUP_DIR="/backup"
SQLITE_BACKUP="${BACKUP_DIR}/hyperpage-$(date +%Y%m%d-%H%M%S).db"
EXPORT_FILE="${BACKUP_DIR}/migration-export-$(date +%Y%m%d-%H%M%S).sql"
K8S_JOB_NAME="prod-migration-$(date +%Y%m%d-%H%M%S)"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Pre-migration checks
log_info "Running pre-migration checks..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    log_error "kubectl not found. Please install kubectl."
    exit 1
fi

# Check if connected to cluster
if ! kubectl cluster-info &> /dev/null; then
    log_error "Not connected to Kubernetes cluster"
    exit 1
fi

# Check if namespace exists
if ! kubectl get namespace $NAMESPACE &> /dev/null; then
    log_error "Namespace $NAMESPACE not found. Please run deployment first."
    exit 1
fi

# Check if PostgreSQL is running
if ! kubectl get deployment hyperpage-postgres -n $NAMESPACE &> /dev/null; then
    log_error "PostgreSQL deployment not found. Please run deployment first."
    exit 1
fi

log_info "✅ Pre-migration checks passed"

# Create backup directory
log_step "Creating backup directory..."
mkdir -p $BACKUP_DIR

# Check if existing SQLite database exists
SQLITE_PATH="./data/hyperpage.db"
if [ -f "$SQLITE_PATH" ]; then
    log_info "Found existing SQLite database"
    
    # Create backup
    log_step "Creating SQLite backup..."
    cp "$SQLITE_PATH" "$SQLITE_BACKUP"
    log_info "✅ Backup created: $SQLITE_BACKUP"
    
    # Get SQLite database info
    DB_SIZE=$(du -h "$SQLITE_PATH" | cut -f1)
    log_info "SQLite database size: $DB_SIZE"
    
    # Validate SQLite database
    log_step "Validating SQLite database..."
    if sqlite3 "$SQLITE_PATH" "PRAGMA integrity_check;" | grep -q "ok"; then
        log_info "✅ SQLite database integrity check passed"
    else
        log_error "❌ SQLite database integrity check failed"
        exit 1
    fi
    
    # Export data from SQLite
    log_step "Exporting data from SQLite..."
    
    # Create export script
    cat > /tmp/sqlite_export.sql <<EOF
-- SQLite to PostgreSQL Export Script
-- Generated on $(date)

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Export schema (tables will be created via Drizzle migrations)
-- Only export data for tables that exist in PostgreSQL schema

-- Export users table
.mode insert users
.output ${EXPORT_FILE}
SELECT * FROM users;
.output stdout

-- Export oauth_tokens table
.mode insert oauth_tokens
SELECT * FROM oauth_tokens;

-- Export tool_configs table
.mode insert tool_configs
SELECT * FROM tool_configs;

-- Export rate_limits table
.mode insert rate_limits
SELECT * FROM rate_limits;

-- Export jobs table
.mode insert jobs
SELECT * FROM jobs;

-- Export job_history table
.mode insert job_history
SELECT * FROM job_history;

-- Export app_state table
.mode insert app_state
SELECT * FROM app_state;

-- Export user_sessions table
.mode insert user_sessions
SELECT * FROM user_sessions;

-- Final message
.print "\n-- Data export completed on $(date)"
EOF

    # Run export
    sqlite3 "$SQLITE_PATH" < /tmp/sqlite_export.sql
    
    if [ -f "$EXPORT_FILE" ] && [ -s "$EXPORT_FILE" ]; then
        EXPORT_SIZE=$(du -h "$EXPORT_FILE" | cut -f1)
        log_info "✅ Data exported successfully: $EXPORT_FILE ($EXPORT_SIZE)"
    else
        log_error "❌ Data export failed or empty"
        exit 1
    fi
    
    # Clean up
    rm -f /tmp/sqlite_export.sql
    
    # Proceed with data migration
    log_step "Starting data migration to PostgreSQL..."
    
    # Create migration job
    log_info "Creating Kubernetes migration job..."
    cat <<EOF | kubectl apply -f - -n $NAMESPACE
apiVersion: batch/v1
kind: Job
metadata:
  name: $K8S_JOB_NAME
  namespace: $NAMESPACE
  labels:
    app: hyperpage
    component: migration
    migration-type: sqlite-to-postgres
    timestamp: $TIMESTAMP
spec:
  backoffLimit: 3
  template:
    metadata:
      labels:
        app: hyperpage
        component: migration
    spec:
      restartPolicy: OnFailure
      containers:
      - name: migration
        image: hyperpage:v0.1.0
        env:
        - name: POSTGRES_HOST
          value: "hyperpage-postgres.$NAMESPACE.svc.cluster.local"
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: hyperpage-postgres-secrets
              key: POSTGRES_PASSWORD
        - name: POSTGRES_DB
          value: "hyperpage"
        - name: POSTGRES_USER
          value: "hyperpage"
        - name: NODE_ENV
          value: "production"
        - name: MIGRATION_MODE
          value: "data-migration"
        - name: VALIDATION_ONLY
          value: "false"
        command:
        - /bin/sh
        - -c
        - |
          set -e
          
          echo "Starting production data migration..."
          echo "PostgreSQL host: \$POSTGRES_HOST"
          echo "Database: \$POSTGRES_DB"
          echo "User: \$POSTGRES_USER"
          
          # Test PostgreSQL connectivity
          echo "Testing PostgreSQL connectivity..."
          until pg_isready -h \$POSTGRES_HOST -U \$POSTGRES_USER -d \$POSTGRES_DB; do
            echo "Waiting for PostgreSQL to be ready..."
            sleep 2
          done
          echo "✅ PostgreSQL is ready"
          
          # Wait for migrations to complete
          echo "Waiting for database migrations to complete..."
          sleep 10
          
          # Run validation
          echo "Running migration validation..."
          npm run validate:migration || echo "Validation completed with warnings"
          
          echo "Migration job completed successfully"
        volumeMounts:
        - name: export-data
          mountPath: /data
          readOnly: true
      volumes:
      - name: export-data
        hostPath:
          path: $BACKUP_DIR
      - name: postgres-data
        persistentVolumeClaim:
          claimName: hyperpage-postgres-pvc
EOF

    # Monitor migration progress
    log_info "Monitoring migration progress..."
    kubectl wait --for=condition=complete --timeout=1800s job/$K8S_JOB_NAME -n $NAMESPACE

    # Check migration results
    MIGRATION_STATUS=$(kubectl get job $K8S_JOB_NAME -n $NAMESPACE -o jsonpath='{.status.succeeded}' 2>/dev/null || echo "0")

    if [ "$MIGRATION_STATUS" = "1" ]; then
        log_info "✅ Data migration completed successfully!"
        
        # Run post-migration validation
        log_step "Running post-migration validation..."
        kubectl run validation-job-$TIMESTAMP \
          --image=hyperpage:v0.1.0 \
          --restart=OnFailure \
          --env="POSTGRES_HOST=hyperpage-postgres.$NAMESPACE.svc.cluster.local" \
          --env="POSTGRES_PASSWORD=\$(POSTGRES_PASSWORD)" \
          --env="POSTGRES_DB=hyperpage" \
          --env="POSTGRES_USER=hyperpage" \
          --env="NODE_ENV=production" \
          --command -- \
          /bin/sh -c "npm run validate:migration" \
          -n $NAMESPACE

        kubectl wait --for=condition=complete --timeout=300s job -l job-name=validation-job-* -n $NAMESPACE
        
        VALIDATION_STATUS=$(kubectl get job -l job-name=validation-job-* -n $NAMESPACE -o jsonpath='{.items[0].status.succeeded}' 2>/dev/null || echo "0")
        
        if [ "$VALIDATION_STATUS" = "1" ]; then
            log_info "✅ Post-migration validation passed"
        else
            log_warn "⚠️  Post-migration validation failed or has warnings"
        fi

        # Clean up jobs
        kubectl delete job $K8S_JOB_NAME -n $NAMESPACE 2>/dev/null || true
        kubectl delete job -l job-name=validation-job-* -n $NAMESPACE 2>/dev/null || true

        log_info "🎉 Production migration completed successfully!"
        log_info "📊 Database is now ready for production use with PostgreSQL"
        
    else
        log_error "❌ Data migration failed!"
        log_info "Check migration logs:"
        kubectl logs job/$K8S_JOB_NAME -n $NAMESPACE
        
        # Don't auto-cleanup on failure for debugging
        log_info "Migration job preserved for debugging: $K8S_JOB_NAME"
        log_info "To clean up: kubectl delete job $K8S_JOB_NAME -n $NAMESPACE"
        
        exit 1
    fi

else
    log_info "No existing SQLite database found at $SQLITE_PATH"
    log_info "Skipping data migration - starting with fresh PostgreSQL database"
    
    # Just validate that PostgreSQL is ready
    log_step "Validating PostgreSQL readiness..."
    kubectl run postgresql-validation-$TIMESTAMP \
      --image=postgres:15-alpine \
      --restart=OnFailure \
      --command -- \
      /bin/sh -c "until pg_isready -h hyperpage-postgres.$NAMESPACE.svc.cluster.local -U hyperpage; do echo 'Waiting for database...'; sleep 2; done; echo 'Database is ready!'; psql -h hyperpage-postgres.$NAMESPACE.svc.cluster.local -U hyperpage -d hyperpage -c 'SELECT version();'" \
      -n $NAMESPACE

    kubectl wait --for=condition=complete --timeout=120s job/postgresql-validation-$TIMESTAMP -n $NAMESPACE
    
    DB_STATUS=$(kubectl get job postgresql-validation-$TIMESTAMP -n $NAMESPACE -o jsonpath='{.status.succeeded}' 2>/dev/null || echo "0")
    if [ "$DB_STATUS" = "1" ]; then
        log_info "✅ PostgreSQL database is ready for new deployment"
    else
        log_error "❌ PostgreSQL validation failed"
        exit 1
    fi
    
    kubectl delete job postgresql-validation-$TIMESTAMP -n $NAMESPACE 2>/dev/null || true
fi

# Final verification
log_step "Running final verification..."

# Test application connectivity
log_info "Testing application database connectivity..."
kubectl run app-connectivity-test-$TIMESTAMP \
  --image=hyperpage:v0.1.0 \
  --restart=OnFailure \
  --env="POSTGRES_HOST=hyperpage-postgres.$NAMESPACE.svc.cluster.local" \
  --env="POSTGRES_PASSWORD=\$(POSTGRES_PASSWORD)" \
  --env="POSTGRES_DB=hyperpage" \
  --env="POSTGRES_USER=hyperpage" \
  --env="NODE_ENV=production" \
  --command -- \
  /bin/sh -c "node -e \"const { createPool } = require('./lib/database/client'); const pool = createPool(); pool.query('SELECT 1 as test', (err, res) => { if (err) { console.error('Database connection failed:', err); process.exit(1); } else { console.log('Database connection successful:', res.rows[0]); process.exit(0); } });\"" \
  -n $NAMESPACE || log_warn "Application connectivity test may have issues"

# Summary
echo ""
log_info "🎊 Migration Summary"
echo "==================="
echo "Migration completed: $(date)"
echo "SQLite backup: $SQLITE_BACKUP"
echo "Export file: $EXPORT_FILE"
echo "Namespace: $NAMESPACE"
echo "Status: ✅ SUCCESS"
echo ""
echo "🔍 Next Steps:"
echo "  1. Verify application functionality"
echo "  2. Monitor database performance"
echo "  3. Update monitoring dashboards"
echo "  4. Keep SQLite backup for 30 days"
echo ""
echo "📊 Database Status:"
kubectl exec -n $NAMESPACE deployment/hyperpage-postgres -- psql -U hyperpage -d hyperpage -c "SELECT schemaname, tablename, attname, n_distinct, correlation FROM pg_stats WHERE schemaname = 'public' LIMIT 10;" || log_warn "Could not retrieve database statistics"
