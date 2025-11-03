# Hyperpage - Kubernetes Deployment Quick Start

This directory contains all the Kubernetes manifests for a production-ready Hyperpage deployment with horizontal pod autoscaling, security hardening, and enterprise-grade observability.

## 🚀 Quick Deployment

### Prerequisites

- Kubernetes cluster (v1.24+)
- `kubectl` configured for cluster access
- Metrics Server installed
- Docker registry access (with your Hyperpage images)

### 1. Update Configuration

Edit `service.yaml` to configure:

- Your Docker registry image path
- Environment variables (secrets, database URL, API tokens)

**Example updates in `service.yaml`:**

```yaml
# Update image references
containers:
  - name: hyperpage
    image: your-registry/hyperpage:latest # ← Update this

# Add your secrets (replace placeholder values)
stringData:
  GITHUB_TOKEN: "ghp_your_real_github_token"
  DATABASE_URL: "file:./data/hyperpage.db"
  NEXTAUTH_SECRET: "your-production-nextauth-secret"
```

### 2. Deploy to Kubernetes

```bash
# Deploy all components
kubectl apply -f service.yaml
kubectl apply -f deployment.yaml
kubectl apply -f hpa.yaml

# For external access (optional)
kubectl apply -f ingress.yaml
```

### 3. Verify Deployment

```bash
# Check pod status
kubectl get pods -l app=hyperpage

# Monitor HPA
kubectl get hpa hyperpage-hpa -w

# View logs
kubectl logs -l app=hyperpage

# Check health endpoint
kubectl port-forward svc/hyperpage-service 3000:3000
curl http://localhost:3000/api/health
```

## 📊 Architecture Overview

### Core Components

- **Deployment**: 3 replica pods with anti-affinity scheduling
- **HPA**: Scales 3-50 pods based on 70% CPU / 80% memory targets
- **Service**: Load balancing and inter-pod communication
- **Security**: Non-root containers, RBAC, network policies
- **Storage**: PVC-backed data persistence

### Enterprise Features

- ✅ **Auto-Scaling**: Intelligent scaling based on resource utilization
- ✅ **Zero-Downtime**: Rolling updates with health probes
- ✅ **Security Hardened**: Non-root execution, minimized attack surface
- ✅ **Observability**: Prometheus metrics, comprehensive logging
- ✅ **Backup Ready**: Database backup/recovery endpoints included

## 🔧 Configuration Files

### `deployment.yaml`

- Main application deployment
- Health/liveness probes configuration
- Security contexts (non-root, seccomp)
- Rolling update strategy (25% max unavailable)

### `hpa.yaml`

- HorizontalPodAutoscaler configuration
- CPU/memory-based scaling (70%/80% thresholds)
- 3-50 replica range with stabilization policies

### `service.yaml`

- ServiceAccount, ClusterRole, ClusterRoleBinding (RBAC)
- ConfigMap (environment variables)
- Secret (sensitive data like API tokens)
- PersistentVolumeClaims (PVCs)

### `ingress.yaml`

- NGINX ingress with TLS termination
- External access routing
- Rate limiting and security headers

## 📈 Monitoring & Scaling

### Check Scaling Behavior

```bash
# Generate load to test HPA
kubectl run load-test --image=busybox -- /bin/sh -c "while true; do echo test; done"

# Watch scaling events
kubectl get events --field-selector involvedObject.kind=HorizontalPodAutoscaler
```

### Performance Metrics

```bash
# CPU/Memory utilization
kubectl top pods -l app=hyperpage

# HPA metrics
kubectl describe hpa hyperpage-hpa
```

## 🔒 Security Overview

- **Pod Security**: Non-root user (UID 1001), read-only root, seccomp profiles
- **RBAC**: Minimal permissions service account
- **Network**: Namespaced policies preventing cross-namespace access
- **Secrets**: All credentials managed via Kubernetes secrets
- **Scanning**: Ready for container vulnerability scanning

## 🚨 Production Considerations

### Before Going Live

- [ ] Update all image references with production registry
- [ ] Configure real database URL and credentials
- [ ] Set production-ready secrets (API tokens, keys)
- [ ] Configure domain-specific TLS certificates
- [ ] Adjust PVC storage sizes based on data requirements
- [ ] Enable external monitoring (Prometheus/Grafana)

### Scaling Recommendations

- Start with smaller storage and scale up as needed
- Monitor actual resource usage for 1-2 weeks post-deployment
- Adjust HPA thresholds based on application load patterns
- Consider enabling custom metrics for more intelligent scaling

## 🆘 Troubleshooting

### Pods Not Starting

```bash
kubectl describe pod <pod-name>
kubectl logs <pod-name> --previous
```

### HPA Not Scaling

- Ensure Metrics Server is running: `kubectl get deployment metrics-server -n kube-system`
- Check resource utilization: `kubectl top nodes`

### Service Unavailable

- Verify service selectors: `kubectl describe svc hyperpage-service`
- Check endpoint connectivity: `kubectl get endpoints`

## 📚 Full Documentation

For comprehensive setup instructions, see:

- **[Hyperpage K8s Guide](../docs/kubernetes.md)**

## 💝 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review full deployment guide in `docs/kubernetes.md`
3. Verify cluster requirements and prerequisites
4. Consider opening an issue in the main repository

Happy deploying! 🎉
