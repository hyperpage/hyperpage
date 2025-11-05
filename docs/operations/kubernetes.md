# Kubernetes Deployment Guide - Hyperpage

This guide provides instructions for deploying Hyperpage to a Kubernetes cluster with auto-scaling, security features, and monitoring capabilities.

## Deployment Status

The Hyperpage platform includes the following Kubernetes deployment features:

- **Horizontal Pod Auto-Scaling (HPA)** - Configurable auto-scaling with CPU/memory and custom metrics support
- **Security Features** - Non-root containers, RBAC, network policies, and security contexts
- **Observability** - Prometheus metrics integration, dashboards, and alerting rules
- **Rolling Deployments** - Deployment procedures with health checks and update strategies
- **Persistent Storage** - PVCs for data and logs with backup/recovery capabilities
- **TypeScript Support** - Database schema and typing support

## Implementation Features

**Infrastructure Components:**

- Multi-replica Deployment with anti-affinity for availability
- HorizontalPodAutoscaler configuration with resource-based scaling
- ServiceAccount with RBAC permissions
- SecurityContexts: non-root user execution, seccomp profiles
- NetworkPolicies for ingress/egress control
- ConfigMaps, Secrets, and PVCs for configuration and data persistence

**Deployment Capabilities:**

- Containerization with Kubernetes manifest deployment
- Pod startup validation and health checks
- Security context verification and RBAC functionality
- Auto-scaling behaviors and stabilization policies
- Rolling deployment procedures with update strategies

## Prerequisites

### Infrastructure Requirements

- Kubernetes cluster (v1.24+)
- kubectl configured for cluster access
- Metrics Server installed in the cluster for HPA
- (Optional) Prometheus Operator for full observability
- (Optional) cert-manager for TLS certificates
- NGINX Ingress Controller

### Cluster Setup Commands

```bash
# Install Metrics Server (required for HPA)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Install NGINX Ingress Controller (optional)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml

# Install Prometheus Operator (optional but recommended)
kubectl create namespace monitoring
kubectl apply -f https://raw.githubusercontent.com/prometheus-operator/prometheus-operator/main/bundle.yaml
```

## Deployment Files Structure

```
k8s/
├── deployment.yaml    # Main application deployment with probes and security
├── hpa.yaml         # Horizontal Pod Autoscaler configuration
├── service.yaml     # Service, RBAC, ConfigMaps, Secrets, PVCs
├── ingress.yaml     # Ingress with TLS and Network Policies
└── README.md        # Quick deployment instructions
```

## Quick Start Deployment

### 1. Clone and Prepare

```bash
git clone https://github.com/hyperpage/hyperpage.git
cd hyperpage

# Build and push Docker image
docker build -t your-registry/hyperpage:latest .
docker push your-registry/hyperpage:latest
```

### 2. Configure Environment

```bash
# Copy and configure environment secrets
kubectl create secret generic hyperpage-secrets \
  --from-literal=NEXTAUTH_SECRET="your-nextauth-secret" \
  --from-literal=NEXTAUTH_URL="https://your-domain.com" \
  --from-literal=GITHUB_TOKEN="ghp_..." \
  --dry-run=client -o yaml > k8s/hyperpage-secrets.yaml

# Update image reference in deployment.yaml
sed -i 's/hyperpage:latest/your-registry\/hyperpage:latest/g' k8s/deployment.yaml
```

### 3. Deploy to Kubernetes

```bash
# Create namespace (optional)
kubectl create namespace hyperpage

# Apply all configurations
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml

# Verify deployment
kubectl get pods -l app=hyperpage
kubectl get hpa hyperpage-hpa
kubectl get ingress hyperpage-ingress
```

## Detailed Configuration

### Environment Variables

Update `k8s/service.yaml` ConfigMap and Secret with your actual values:

```yaml
# ConfigMap: hyperpage-config
data:
  NODE_ENV: "production"
  PERFORMANCE_MONITORING_ENABLED: "true"
  CACHE_DEFAULT_TTL_SECONDS: "300"
  COMPRESSION_ENABLED: "true"

# Secret: hyperpage-secrets
stringData:
  DATABASE_URL: "file:./data/hyperpage.db"
  NEXTAUTH_SECRET: "your-secure-secret-here"
  NEXTAUTH_URL: "https://your-domain.com"
  GITHUB_TOKEN: "ghp_your_token_here"
  JIRA_API_TOKEN: "your-jira-token"
```

### Image Configuration

Update the deployment image reference:

```yaml
containers:
  - name: hyperpage
    image: your-registry/hyperpage:v1.0.0 # Update with your image
    imagePullPolicy: Always
```

### Ingress Configuration

Update `k8s/ingress.yaml` with your domain:

```yaml
spec:
  tls:
    - hosts:
        - your-domain.com
      secretName: hyperpage-tls
  rules:
    - host: your-domain.com
```

### Storage Configuration

Adjust PersistentVolumeClaim sizes and storage classes:

```yaml
spec:
  resources:
    requests:
      storage: 50Gi # Adjust based on data requirements
  storageClassName: "fast-ssd" # Use appropriate storage class
```

## Auto-Scaling Configuration

### HPA Behavior

The HPA is configured with scaling policies:

- **Scale Up**: Fast scaling policies for rapid pod increases
- **Scale Down**: Conservative scaling for pod reductions
- **Resource Targets**:
  - CPU utilization targets
  - Memory utilization targets
- **Replica Bounds**: Minimum and maximum pod counts

### Custom Metrics Integration

To enable custom performance-based scaling, deploy the Prometheus Adapter:

```bash
# Install Prometheus Adapter
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus-adapter prometheus-community/prometheus-adapter

# The HPA configuration includes ServiceMonitor for metrics collection
# Uncomment custom metrics in hpa.yaml after adapter installation
```

## Security Features

### Pod Security Context

- Non-root user execution (UID 1001)
- Read-only root filesystem
- No privilege escalation allowed
- Seccomp profile: RuntimeDefault

### Network Security

- Network policies restrict ingress/egress
- Service mesh integration ready
- RBAC with minimal required permissions

### Secret Management

- Use external secret managers (Vault, AWS Secrets Manager)
- Rotate secrets regularly
- Avoid plain text secrets in manifests

## Monitoring and Observability

### Built-in Metrics

- Real-time dashboard at `/api/dashboard`
- Prometheus metrics at `/api/metrics`
- Health checks configured for Kubernetes

### External Monitoring Setup

```bash
# Grafana dashboard import
kubectl create configmap hyperpage-grafana-dashboard \
  --from-file=hyperpage-dashboard.json=grafana/hyperpage-rate-limiting-dashboard.json
```

### Alerting Rules

The included PrometheusRule provides:

- Auto-scaling rate alerts
- High resource usage warnings
- Custom performance thresholds

## Production Considerations

### Backup and Recovery

- Database persistence via PVC
- Log persistence via separate PVC
- Backup procedures available via API endpoints
- Disaster recovery procedures documented

### High Availability

- Multi-zone deployment support
- Pod disruption budgets for maintenance windows
- Anti-affinity rules to distribute across nodes

### Performance Optimization

- Resource limits configurable for workload
- Horizontal scaling policies based on metrics
- CDN integration for static assets

## Troubleshooting

### Common Issues

**Pods Not Starting**

```bash
kubectl describe pod <pod-name>
kubectl logs <pod-name>
# Check security context, resource limits, image pull errors
```

**HPA Not Scaling**

```bash
kubectl get hpa hyperpage-hpa
kubectl describe hpa hyperpage-hpa
# Verify Metrics Server is running, check resource utilization
```

**Ingress Issues**

```bash
kubectl get ingress hyperpage-ingress
kubectl describe ingress hyperpage-ingress
# Check ingress controller logs, certificate status
```

### Performance Tuning

**Resource Optimization**

```bash
# Monitor actual resource usage
kubectl top pods -l app=hyperpage
kubectl top nodes

# Adjust requests/limits based on metrics
kubectl edit deployment hyperpage
```

**Scaling Policies**

```bash
# Fine-tune HPA parameters
kubectl edit hpa hyperpage-hpa

# Monitor scaling decisions
kubectl get events --field-selector involvedObject.kind=HorizontalPodAutoscaler
```

## Operations

### Daily Operations

- Monitor auto-scaling events
- Review performance dashboards
- Check pod health and resource utilization
- Update images for security patches

### Maintenance Windows

1. Scale deployment to increased replicas
2. Perform rolling updates
3. Verify all pods healthy
4. Scale back to normal levels

### Emergency Procedures

- **Pod Failures**: HPA automatically scales
- **Node Issues**: Affinity rules distribute load
- **Full Cluster**: Follow disaster recovery procedures

## Migration from Previous Versions

If upgrading from local deployment:

1. **Backup existing data**
2. **Export configuration**
3. **Deploy new version with PVC mounting existing data**
4. **Migrate environment variables to ConfigMap/Secret**
5. **Update ingress and DNS records**

## Performance Monitoring

Monitor these metrics post-deployment:

- **Availability**: Uptime measurement
- **Performance**: Response time monitoring
- **Scalability**: Auto-scaling behavior under load
- **Efficiency**: Resource utilization patterns

This deployment provides Kubernetes-based deployment capabilities for the Hyperpage platform.
