#!/bin/bash

# Hyperpage Kubernetes Deployment Script
# Phase 5: Complete Kubernetes Implementation
# This script deploys all Kubernetes components for enterprise-grade Hyperpage

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="default"
APP_NAME="hyperpage"
TIMEOUT="300s"

echo -e "${BLUE}🚀 Starting Hyperpage Kubernetes Deployment (Phase 5)${NC}"
echo "=================================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if kubectl is configured
check_kubectl() {
    if ! command_exists kubectl; then
        echo -e "${RED}❌ kubectl is not installed${NC}"
        exit 1
    fi
    
    if ! kubectl cluster-info >/dev/null 2>&1; then
        echo -e "${RED}❌ kubectl is not configured or cluster is not accessible${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ kubectl is configured and cluster is accessible${NC}"
}

# Function to create namespace if it doesn't exist
create_namespace() {
    echo -e "${BLUE}📁 Creating namespace if it doesn't exist...${NC}"
    
    if ! kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
        kubectl create namespace "$NAMESPACE"
        echo -e "${GREEN}✅ Namespace '$NAMESPACE' created${NC}"
    else
        echo -e "${GREEN}✅ Namespace '$NAMESPACE' already exists${NC}"
    fi
}

# Function to validate YAML files
validate_yaml() {
    echo -e "${BLUE}🔍 Validating Kubernetes YAML files...${NC}"
    
    local files=(
        "k8s/service.yaml"
        "k8s/deployment.yaml" 
        "k8s/hpa.yaml"
        "k8s/ingress.yaml"
        "k8s/postgres-config.yaml"
        "k8s/monitoring.yaml"
        "k8s/advanced-features.yaml"
    )
    
    for file in "${files[@]}"; do
        if [[ -f "$file" ]]; then
            if kubectl apply --dry-run=client -f "$file" >/dev/null 2>&1; then
                echo -e "${GREEN}✅ $file is valid${NC}"
            else
                echo -e "${RED}❌ $file has syntax errors${NC}"
                kubectl apply --dry-run=client -f "$file"
                exit 1
            fi
        else
            echo -e "${YELLOW}⚠️  $file not found, skipping${NC}"
        fi
    done
}

# Function to deploy core components
deploy_core_components() {
    echo -e "${BLUE}🏗️  Deploying core Kubernetes components...${NC}"
    
    # Deploy service definitions (ConfigMap, Secret, Service, ServiceAccount, RBAC, PVC)
    echo "Deploying service configuration..."
    kubectl apply -f k8s/service.yaml
    echo -e "${GREEN}✅ Service configuration deployed${NC}"
    
    # Wait for ConfigMap and Secret to be ready
    kubectl wait --for=condition=available --timeout=60s configmap/hyperpage-config
    kubectl wait --for=condition=available --timeout=60s secret/hyperpage-secrets
}

# Function to deploy PostgreSQL
deploy_postgresql() {
    echo -e "${BLUE}🗄️  Deploying PostgreSQL...${NC}"
    
    kubectl apply -f k8s/postgres-config.yaml
    echo -e "${GREEN}✅ PostgreSQL configuration deployed${NC}"
    
    # Wait for PostgreSQL deployment
    echo "Waiting for PostgreSQL to be ready..."
    kubectl wait --for=condition=available --timeout=120s deployment/hyperpage-postgres
    echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
}

# Function to deploy main application
deploy_application() {
    echo -e "${BLUE}🚀 Deploying main application...${NC}"
    
    kubectl apply -f k8s/deployment.yaml
    echo -e "${GREEN}✅ Application deployment created${NC}"
    
    # Wait for application to be ready
    echo "Waiting for application to be ready..."
    kubectl wait --for=condition=available --timeout=180s deployment/hyperpage
    echo -e "${GREEN}✅ Application is ready${NC}"
}

# Function to deploy HPA and monitoring
deploy_scaling_and_monitoring() {
    echo -e "${BLUE}📈 Deploying scaling and monitoring...${NC}"
    
    # Deploy HPA
    kubectl apply -f k8s/hpa.yaml
    echo -e "${GREEN}✅ Horizontal Pod Autoscaler deployed${NC}"
    
    # Deploy monitoring
    kubectl apply -f k8s/monitoring.yaml
    echo -e "${GREEN}✅ Monitoring configuration deployed${NC}"
    
    # Deploy advanced features
    kubectl apply -f k8s/advanced-features.yaml
    echo -e "${GREEN}✅ Advanced features deployed${NC}"
}

# Function to deploy ingress
deploy_ingress() {
    echo -e "${BLUE}🌐 Deploying ingress (optional)...${NC}"
    
    if [[ -f "k8s/ingress.yaml" ]]; then
        read -p "Do you want to deploy ingress? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kubectl apply -f k8s/ingress.yaml
            echo -e "${GREEN}✅ Ingress deployed${NC}"
        else
            echo -e "${YELLOW}⏭️  Skipping ingress deployment${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  ingress.yaml not found, skipping${NC}"
    fi
}

# Function to run validation tests
run_validation() {
    echo -e "${BLUE}🧪 Running deployment validation...${NC}"
    
    # Test health endpoint
    echo "Testing health endpoint..."
    kubectl port-forward svc/hyperpage-service 8080:3000 &
    PORT_FORWARD_PID=$!
    sleep 10
    
    if curl -f -s http://localhost:8080/api/health >/dev/null; then
        echo -e "${GREEN}✅ Health check passed${NC}"
    else
        echo -e "${RED}❌ Health check failed${NC}"
        kill $PORT_FORWARD_PID 2>/dev/null || true
        exit 1
    fi
    
    # Test HPA
    echo "Testing HPA configuration..."
    if kubectl get hpa hyperpage-hpa >/dev/null 2>&1; then
        echo -e "${GREEN}✅ HPA is configured${NC}"
        kubectl get hpa hyperpage-hpa
    else
        echo -e "${YELLOW}⚠️  HPA not found${NC}"
    fi
    
    # Test monitoring
    echo "Testing monitoring configuration..."
    if kubectl get servicemonitor hyperpage-monitor >/dev/null 2>&1; then
        echo -e "${GREEN}✅ ServiceMonitor is configured${NC}"
    else
        echo -e "${YELLOW}⚠️  ServiceMonitor not found${NC}"
    fi
    
    # Test PostgreSQL
    echo "Testing PostgreSQL connectivity..."
    if kubectl get deployment hyperpage-postgres >/dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL deployment exists${NC}"
        kubectl get pods -l app=hyperpage,component=postgres
    else
        echo -e "${YELLOW}⚠️  PostgreSQL deployment not found${NC}"
    fi
    
    # Cleanup
    kill $PORT_FORWARD_PID 2>/dev/null || true
    echo -e "${GREEN}🎉 All validation tests completed!${NC}"
}

# Function to display deployment status
show_status() {
    echo -e "${BLUE}📊 Deployment Status Summary${NC}"
    echo "=================================================="
    
    echo -e "${YELLOW}Deployments:${NC}"
    kubectl get deployments -l app=hyperpage
    
    echo -e "\n${YELLOW}Pods:${NC}"
    kubectl get pods -l app=hyperpage
    
    echo -e "\n${YELLOW}Services:${NC}"
    kubectl get services -l app=hyperpage
    
    echo -e "\n${YELLOW}Horizontal Pod Autoscaler:${NC}"
    kubectl get hpa 2>/dev/null || echo "No HPA configured"
    
    echo -e "\n${YELLOW}Persistent Volume Claims:${NC}"
    kubectl get pvc -l app=hyperpage
    
    echo -e "\n${YELLOW}Storage Classes:${NC}"
    kubectl get storageclass
}

# Function to show next steps
show_next_steps() {
    echo -e "${GREEN}🎉 Hyperpage Kubernetes deployment completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 Next Steps:${NC}"
    echo "1. Monitor application logs:"
    echo "   kubectl logs -l app=hyperpage -f"
    echo ""
    echo "2. Test the application:"
    echo "   kubectl port-forward svc/hyperpage-service 8080:3000"
    echo "   # Then visit http://localhost:8080"
    echo ""
    echo "3. Check HPA scaling:"
    echo "   kubectl get hpa -w"
    echo ""
    echo "4. Monitor metrics (if Prometheus is configured):"
    echo "   kubectl get servicemonitor"
    echo ""
    echo "5. Backup database (if backup CronJob is configured):"
    echo "   kubectl get cronjobs"
    echo ""
    echo -e "${YELLOW}⚠️  Important Notes:${NC}"
    echo "- Update image references in deployment.yaml with your actual images"
    echo "- Configure production secrets in the hyperpage-secrets secret"
    echo "- Set up proper ingress controller and TLS certificates"
    echo "- Configure monitoring and alerting systems"
    echo "- Review and adjust resource limits based on your workload"
    echo ""
    echo -e "${BLUE}📚 Documentation:${NC}"
    echo "- Phase 5 Implementation: docs/sqlite-to-postgresql/phase-5-k8s-implementation.md"
    echo "- Kubernetes README: k8s/README.md"
    echo "- Production Guide: docs/sqlite-to-postgresql/phase-8-deployment-guide.md"
}

# Function to cleanup on error
cleanup() {
    if [[ $? -ne 0 ]]; then
        echo -e "${RED}❌ Deployment failed! Cleaning up...${NC}"
        echo "To debug, run:"
        echo "  kubectl get events --sort-by=.metadata.creationTimestamp"
        echo "  kubectl describe pods -l app=hyperpage"
        echo "  kubectl logs -l app=hyperpage --previous"
    fi
}

# Set up error handling
trap cleanup EXIT

# Main deployment flow
main() {
    echo -e "${BLUE}Starting Phase 5: Kubernetes Implementation${NC}"
    echo "Target: $NAMESPACE namespace"
    echo "App: $APP_NAME"
    echo ""
    
    # Pre-deployment checks
    check_kubectl
    create_namespace
    validate_yaml
    
    # Core deployment
    deploy_core_components
    deploy_postgresql
    deploy_application
    
    # Advanced features
    deploy_scaling_and_monitoring
    deploy_ingress
    
    # Validation
    run_validation
    
    # Summary
    show_status
    show_next_steps
    
    echo -e "${GREEN}✅ Phase 5: Kubernetes Implementation completed successfully!${NC}"
}

# Run main function
main "$@"
