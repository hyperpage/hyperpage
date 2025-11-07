# Phase 5: Kubernetes Configuration

**Duration:** 2-3 hours  
**Status:** Ready for Implementation  
**Prerequisites:** Phase 1-3 completed

## Overview

This phase updates the Kubernetes deployment configuration to include PostgreSQL as a sidecar container, along with proper environment variables, health checks, and security configurations.

## Kubernetes Sidecar Pattern

### Why Sidecar Pattern

- **Co-location**: Database and application in same pod
- **Shared lifecycle**: Scale together
- **Local communication**: Faster than network calls
- **Simplified networking**: No external dependencies
- **Data locality**: Reduced latency

## Implementation Steps

### Step 1: Update Deployment Configuration

#### Current: k8s/deployment.yaml (SQLite)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hyperpage
spec:
  replicas: 1
  selector:
    matchLabels:
      app: hyperpage
  template:
    metadata:
      labels:
        app: hyperpage
    spec:
      containers:
        - name: hyperpage
          image: hyperpage:v0.1.0
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_PATH
              value: "./data/hyperpage.db"
          volumeMounts:
            - name: data-volume
              mountPath: /app/data
      volumes:
        - name: data-volume
          persistentVolumeClaim:
            claimName: hyperpage-pvc
```

#### Target: k8s/deployment.yaml (PostgreSQL)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hyperpage
  labels:
    app: hyperpage
    version: v0.1.0
spec:
  replicas: 1
  selector:
    matchLabels:
      app: hyperpage
  template:
    metadata:
      labels:
        app: hyperpage
        version: v0.1.0
    spec:
      # Initialize container to wait for PostgreSQL
      initContainers:
        - name: wait-for-postgres
          image: postgres:15-alpine
          command:
            - sh
            - -c
            - |
              echo "Waiting for PostgreSQL to be ready..."
              until pg_isready -h localhost -p 5432 -U hyperpage; do
                echo "PostgreSQL is unavailable - sleeping"
                sleep 2
              done
              echo "PostgreSQL is up - starting application"
          env:
            - name: PGHOST
              value: "localhost"
            - name: PGPORT
              value: "5432"
            - name: PGUSER
              value: "hyperpage"
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: hyperpage-secrets
                  key: POSTGRES_PASSWORD
            - name: PGDATABASE
              value: "hyperpage"

      # PostgreSQL sidecar container
      - name: postgresql
        image: postgres:15-alpine
        imagePullPolicy: IfNotPresent

        # Security context
        securityContext:
          runAsUser: 70
          runAsGroup: 70
          fsGroup: 70
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: false
          capabilities:
            drop:
              - ALL
            add:
              - CHOWN
              - FOWNER
              - DAC_OVERRIDE
              - FSETID
              - SETGID
              - SETUID
              - SETPCAP
              - NET_BIND_SERVICE

        # Environment variables
        env:
          - name: POSTGRES_DB
            value: "hyperpage"
          - name: POSTGRES_USER
            value: "hyperpage"
          - name: POSTGRES_PASSWORD
            valueFrom:
              secretKeyRef:
                name: hyperpage-secrets
                key: POSTGRES_PASSWORD
          - name: PGDATA
            value: "/var/lib/postgresql/data/pgdata"
          - name: POSTGRES_INITDB_ARGS
            value: "--auth-host=scram-sha-256 --auth-local=scram-sha-256"
          - name: POSTGRES_HOST_AUTH_METHOD
            value: "scram-sha-256"
          - name: POSTGRES_INITDB_WALDIR
            value: "/var/lib/postgresql/data/pg_wal"

        # Ports
        ports:
          - containerPort: 5432
            name: postgresql
            protocol: TCP

        # Resource limits and requests
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
            ephemeral-storage: "1Gi"
          limits:
            memory: "512Mi"
            cpu: "500m"
            ephemeral-storage: "2Gi"

        # Liveness probe
        livenessProbe:
          exec:
            command:
              - pg_isready
              - -h
              - localhost
              - -U
              - hyperpage
              - -d
              - hyperpage
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
          successThreshold: 1

        # Readiness probe
        readinessProbe:
          exec:
            command:
              - pg_isready
              - -h
              - localhost
              - -U
              - hyperpage
              - -d
              - hyperpage
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
          successThreshold: 1

        # Volume mounts
        volumeMounts:
          - name: postgres-data
            mountPath: /var/lib/postgresql/data
          - name: postgres-wal
            mountPath: /var/lib/postgresql/data/pg_wal
            subPath: wal
          - name: postgres-config
            mountPath: /etc/postgresql
            readOnly: true

      # Main application container
      - name: hyperpage
        image: hyperpage:v0.1.0
        imagePullPolicy: IfNotPresent

        # Security context
        securityContext:
          runAsUser: 1000
          runAsGroup: 1000
          fsGroup: 1000
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
              - ALL

        # Environment variables
        env:
          # Database configuration
          - name: NODE_ENV
            value: "production"
          - name: POSTGRES_HOST
            value: "localhost"
          - name: POSTGRES_PORT
            value: "5432"
          - name: POSTGRES_DB
            value: "hyperpage"
          - name: POSTGRES_USER
            value: "hyperpage"
          - name: POSTGRES_PASSWORD
            valueFrom:
              secretKeyRef:
                name: hyperpage-secrets
                key: POSTGRES_PASSWORD
          - name: DATABASE_URL
            value: "postgresql://hyperpage:$(POSTGRES_PASSWORD)@localhost:5432/hyperpage"

          # Connection pool settings
          - name: DB_POOL_MAX
            value: "10"
          - name: DB_POOL_MIN
            value: "2"
          - name: DB_IDLE_TIMEOUT
            value: "30000"
          - name: DB_CONNECTION_TIMEOUT
            value: "5000"

          # Security
          - name: NEXTAUTH_SECRET
            valueFrom:
              secretKeyRef:
                name: hyperpage-secrets
                key: NEXTAUTH_SECRET
          - name: NEXTAUTH_URL
            value: "https://hyperpage.example.com"

        # Ports
        ports:
          - containerPort: 3000
            name: http
            protocol: TCP

        # Liveness probe
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
            scheme: HTTP
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
          successThreshold: 1

        # Readiness probe
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
            scheme: HTTP
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
          successThreshold: 1

        # Volume mounts
        volumeMounts:
          - name: tmp
            mountPath: /tmp
          - name: cache
            mountPath: /app/.next/cache
          - name: config
            mountPath: /app/config
            readOnly: true

      # Volumes
      volumes:
        - name: postgres-data
          persistentVolumeClaim:
            claimName: hyperpage-postgres-pvc
        - name: postgres-wal
          persistentVolumeClaim:
            claimName: hyperpage-wal-pvc
        - name: postgres-config
          configMap:
            name: postgres-config
        - name: tmp
          emptyDir: {}
        - name: cache
          emptyDir: {}
        - name: config
          configMap:
            name: hyperpage-config
```

### Step 2: Create PostgreSQL Configuration

#### PostgreSQL ConfigMap

```yaml
# k8s/postgres-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-config
  labels:
    app: hyperpage
data:
  postgresql.conf: |
    # PostgreSQL Configuration for Hyperpage

    # Connection settings
    listen_addresses = 'localhost'
    port = 5432
    max_connections = 20
    shared_buffers = 128MB
    effective_cache_size = 512MB

    # Performance settings
    work_mem = 4MB
    maintenance_work_mem = 64MB
    random_page_cost = 1.1
    effective_io_concurrency = 200

    # Logging
    log_destination = 'stderr'
    logging_collector = on
    log_directory = 'pg_log'
    log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
    log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
    log_min_messages = warning
    log_min_error_statement = error
    log_min_duration_statement = 1000

    # Autovacuum settings
    autovacuum = on
    autovacuum_max_workers = 3
    autovacuum_naptime = 1min
    autovacuum_vacuum_threshold = 50
    autovacuum_analyze_threshold = 50
    autovacuum_vacuum_scale_factor = 0.2
    autovacuum_analyze_scale_factor = 0.1

    # WAL settings
    wal_level = replica
    max_wal_senders = 3
    checkpoint_completion_target = 0.9
    wal_buffers = 16MB
    checkpoint_timeout = 10min
    max_wal_size = 1GB
    min_wal_size = 80MB

    # Security
    ssl = off
    password_encryption = scram-sha-256

  pg_hba.conf: |
    # PostgreSQL Client Authentication Configuration File
    # TYPE  DATABASE        USER            ADDRESS                 METHOD

    # "local" is for Unix domain socket connections only
    local   all             all                                     scram-sha-256
    # IPv4 local connections:
    host    all             all             127.0.0.1/32            scram-sha-256
    # IPv6 local connections:
    host    all             all             ::1/128                 scram-sha-256
    # Allow replication connections from localhost, by a user with the replication privilege.
    local   replication     all                                     scram-sha-256
    host    replication     all             127.0.0.1/32            scram-sha-256
    host    replication     all             ::1/128                 scram-sha-256
```

### Step 3: Create Secrets

#### PostgreSQL Secrets

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: hyperpage-secrets
  labels:
    app: hyperpage
type: Opaque
stringData:
  POSTGRES_PASSWORD: "your-secure-password-here"
  NEXTAUTH_SECRET: "your-nextauth-secret-here"
  NEXTAUTH_URL: "https://hyperpage.example.com"
  # Add other application secrets
  # GITHUB_TOKEN: "your-github-token"
  # JIRA_API_TOKEN: "your-jira-token"
```

### Step 4: Create Persistent Volume Claims

#### PostgreSQL Data Storage

```yaml
# k8s/postgres-storage.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: hyperpage-postgres-pvc
  labels:
    app: hyperpage
    component: postgresql
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  resources:
    requests:
      storage: 10Gi
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: hyperpage-wal-pvc
  labels:
    app: hyperpage
    component: postgresql-wal
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  resources:
    requests:
      storage: 2Gi
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: hyperpage-pvc
  labels:
    app: hyperpage
    component: application
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  resources:
    requests:
      storage: 1Gi
```

### Step 5: Service Configuration

#### Updated Service

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: hyperpage-service
  labels:
    app: hyperpage
spec:
  type: ClusterIP
  selector:
    app: hyperpage
  ports:
    - name: http
      port: 80
      targetPort: 3000
      protocol: TCP
    - name: postgresql
      port: 5432
      targetPort: 5432
      protocol: TCP
```

### Step 6: Horizontal Pod Autoscaler

#### Optional: HPA for scaling

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: hyperpage-hpa
  labels:
    app: hyperpage
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: hyperpage
  minReplicas: 1
  maxReplicas: 3
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 60
```

### Step 7: Deployment Scripts

#### Update Script: scripts/deploy-k8s.sh

```bash
#!/bin/bash
set -e

echo "🚀 Deploying Hyperpage to Kubernetes with PostgreSQL..."

# Create namespace if it doesn't exist
kubectl create namespace hyperpage --dry-run=client -o yaml | kubectl apply -f -

# Apply secrets
echo "📦 Creating secrets..."
kubectl apply -f k8s/secrets.yaml

# Apply ConfigMaps
echo "⚙️ Creating ConfigMaps..."
kubectl apply -f k8s/postgres-config.yaml

# Apply PersistentVolumeClaims
echo "💾 Creating PersistentVolumeClaims..."
kubectl apply -f k8s/postgres-storage.yaml

# Wait for PVCs to be bound
echo "⏳ Waiting for PVCs to be bound..."
kubectl wait --for=condition=bound pvc/hyperpage-postgres-pvc --timeout=300s -n hyperpage
kubectl wait --for=condition=bound pvc/hyperpage-wal-pvc --timeout=300s -n hyperpage
kubectl wait --for=condition=bound pvc/hyperpage-pvc --timeout=300s -n hyperpage

# Apply the deployment
echo "🚀 Applying deployment..."
kubectl apply -f k8s/deployment.yaml

# Apply the service
echo "🌐 Applying service..."
kubectl apply -f k8s/service.yaml

# Apply HPA (if enabled)
if [ "$ENABLE_HPA" = "true" ]; then
  echo "📈 Applying HorizontalPodAutoscaler..."
  kubectl apply -f k8s/hpa.yaml
fi

# Wait for deployment to be ready
echo "⏳ Waiting for deployment to be ready..."
kubectl wait --for=condition=available --timeout=600s deployment/hyperpage -n hyperpage

# Get status
echo "✅ Deployment completed!"
kubectl get pods -n hyperpage
kubectl get services -n hyperpage
kubectl get pvc -n hyperpage

echo "🎉 Hyperpage is now running with PostgreSQL!"
```

## Environment Variables

### Complete Environment Setup

#### Production Environment Variables

```env
# Database Configuration
DATABASE_URL=postgresql://hyperpage:password@localhost:5432/hyperpage
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=hyperpage
POSTGRES_USER=hyperpage
POSTGRES_PASSWORD=secure-password

# Connection Pool
DB_POOL_MAX=10
DB_POOL_MIN=2
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=5000

# Application
NODE_ENV=production
NEXTAUTH_SECRET=secure-nextauth-secret
NEXTAUTH_URL=https://hyperpage.example.com

# Tool Configurations
ENABLE_GITHUB=true
ENABLE_JIRA=true
ENABLE_GITLAB=true
```

## Monitoring and Logging

### Database Monitoring

#### PostgreSQL Exporter (Optional)

```yaml
# Add to deployment for monitoring
- name: postgres-exporter
  image: prometheuscommunity/postgres-exporter:latest
  env:
    - name: DATA_SOURCE_NAME
      value: "postgresql://hyperpage:password@localhost:5432/hyperpage?sslmode=disable"
  ports:
    - containerPort: 9187
```

### Log Configuration

#### Structured Logging

```yaml
# Add to environment
- name: LOG_LEVEL
  value: "info"
- name: LOG_FORMAT
  value: "json"
```

## Security Considerations

### Network Policies

```yaml
# k8s/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: hyperpage-network-policy
  namespace: hyperpage
spec:
  podSelector:
    matchLabels:
      app: hyperpage
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - protocol: TCP
          port: 3000
  egress:
    - to:
        - podSelector: {}
      ports:
        - protocol: TCP
          port: 5432 # PostgreSQL
```

## Rollback Strategy

### Rollback Commands

```bash
# Rollback to previous version
kubectl rollout undo deployment/hyperpage -n hyperpage

# Check rollback status
kubectl rollout status deployment/hyperpage -n hyperpage

# Rollback to specific revision
kubectl rollout undo deployment/hyperpage --to-revision=1 -n hyperpage
```

## Testing Deployment

### Health Check Endpoints

```bash
# Check application health
kubectl exec -n hyperpage deployment/hyperpage -- curl -f http://localhost:3000/api/health

# Check PostgreSQL health
kubectl exec -n hyperpage deployment/hyperpage -- pg_isready -h localhost -U hyperpage

# Check database connectivity
kubectl exec -n hyperpage deployment/hyperpage -- psql -h localhost -U hyperpage -d hyperpage -c "SELECT 1;"
```

## Validation Checklist

### Kubernetes Resources

- [ ] Deployment configured with PostgreSQL sidecar
- [ ] Init containers waiting for PostgreSQL ready
- [ ] ConfigMaps created for PostgreSQL configuration
- [ ] Secrets created for sensitive data
- [ ] PersistentVolumeClaims for data storage
- [ ] Service exposing application and database
- [ ] Health checks configured for both containers
- [ ] Resource limits and requests set
- [ ] Security contexts configured
- [ ] Network policies applied

### Environment Configuration

- [ ] All required environment variables set
- [ ] Database connection working
- [ ] Health check endpoints responding
- [ ] Logging configured
- [ ] Monitoring enabled (if applicable)

### Data Persistence

- [ ] PostgreSQL data persisted in PVC
- [ ] WAL logs persisted separately
- [ ] Application data persisted
- [ ] Backup strategy implemented

## Success Criteria

✅ **PostgreSQL sidecar container running**  
✅ **Application connecting to PostgreSQL successfully**  
✅ **Data persistence working**  
✅ **Health checks passing**  
✅ **Resource limits respected**  
✅ **Security contexts applied**  
✅ **Deployment scaling working**  
✅ **Monitoring functional**

## Next Phase Prerequisites

- Kubernetes deployment with PostgreSQL running
- Database connectivity working
- Health checks passing
- Data persistence functional
- Security configurations applied

---

**Phase 5 Status**: Ready for Implementation  
**Next**: [Phase 6: Data Migration](phase-6-data-migration.md)
