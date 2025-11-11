#!/bin/bash

# Terraform Deployment Script for Hyperpage Infrastructure
# Phase 5: Complete Terraform Infrastructure as Code Deployment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TERRAFORM_DIR="terraform"
ENVIRONMENT="${1:-production}"
AWS_REGION="${2:-us-west-2}"
PROJECT_NAME="${3:-hyperpage}"

echo -e "${BLUE}🏗️  Starting Terraform Infrastructure Deployment${NC}"
echo "============================================================"
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo "Project: $PROJECT_NAME"
echo "Directory: $TERRAFORM_DIR"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to validate prerequisites
check_prerequisites() {
    echo -e "${BLUE}🔍 Checking prerequisites...${NC}"
    
    # Check Terraform
    if ! command_exists terraform; then
        echo -e "${RED}❌ Terraform is not installed${NC}"
        echo "Please install Terraform: https://www.terraform.io/downloads.html"
        exit 1
    fi
    echo -e "${GREEN}✅ Terraform is installed${NC}"
    
    # Check AWS CLI
    if ! command_exists aws; then
        echo -e "${RED}❌ AWS CLI is not installed${NC}"
        echo "Please install AWS CLI: https://aws.amazon.com/cli/"
        exit 1
    fi
    echo -e "${GREEN}✅ AWS CLI is installed${NC}"
    
    # Check kubectl
    if ! command_exists kubectl; then
        echo -e "${YELLOW}⚠️  kubectl is not installed (optional but recommended)${NC}"
    else
        echo -e "${GREEN}✅ kubectl is installed${NC}"
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        echo -e "${RED}❌ AWS credentials not configured${NC}"
        echo "Please configure AWS credentials: aws configure"
        exit 1
    fi
    echo -e "${GREEN}✅ AWS credentials configured${NC}"
}

# Function to create Terraform backend bucket
create_backend_bucket() {
    echo -e "${BLUE}📦 Setting up Terraform state backend...${NC}"
    
    local bucket_name="${PROJECT_NAME}-${ENVIRONMENT}-terraform-state"
    local region="${AWS_REGION}"
    
    # Check if bucket exists
    if aws s3api head-bucket --bucket "$bucket_name" 2>/dev/null; then
        echo -e "${GREEN}✅ Terraform state bucket already exists${NC}"
    else
        echo "Creating Terraform state bucket: $bucket_name"
        aws s3api create-bucket \
            --bucket "$bucket_name" \
            --region "$region" \
            --create-bucket-configuration LocationConstraint="$region"
        
        # Enable versioning
        aws s3api put-bucket-versioning \
            --bucket "$bucket_name" \
            --versioning-configuration Status=Enabled
        
        # Enable encryption
        aws s3api put-bucket-encryption \
            --bucket "$bucket_name" \
            --server-side-encryption-configuration Rules=ApplyServerSideEncryptionByDefault,ServerSideEncryptionAlgorithm=AES256
        
        echo -e "${GREEN}✅ Terraform state bucket created${NC}"
    fi
    
    # Create DynamoDB table for state locking
    local table_name="${PROJECT_NAME}-${ENVIRONMENT}-terraform-locks"
    if aws dynamodb describe-table --table-name "$table_name" 2>/dev/null >/dev/null; then
        echo -e "${GREEN}✅ Terraform state locking table already exists${NC}"
    else
        echo "Creating Terraform state locking table: $table_name"
        aws dynamodb create-table \
            --table-name "$table_name" \
            --attribute-definitions AttributeName=LockID,AttributeType=S \
            --key-schema AttributeName=LockID,KeyType=HASH \
            --billing-mode PAY_PER_REQUEST \
            --region "$region"
        echo -e "${GREEN}✅ Terraform state locking table created${NC}"
    fi
}

# Function to validate Terraform configuration
validate_terraform() {
    echo -e "${BLUE}🔍 Validating Terraform configuration...${NC}"
    
    cd "$TERRAFORM_DIR"
    
    # Format Terraform files
    terraform fmt -recursive
    echo -e "${GREEN}✅ Terraform files formatted${NC}"
    
    # Initialize Terraform
    terraform init
    echo -e "${GREEN}✅ Terraform initialized${NC}"
    
    # Validate configuration
    terraform validate
    echo -e "${GREEN}✅ Terraform configuration valid${NC}"
    
    # Plan deployment
    echo "Creating Terraform plan..."
    terraform plan \
        -var="environment=$ENVIRONMENT" \
        -var="aws_region=$AWS_REGION" \
        -var="project_name=$PROJECT_NAME" \
        -out=tfplan
    
    echo -e "${GREEN}✅ Terraform plan created${NC}"
}

# Function to deploy infrastructure
deploy_infrastructure() {
    echo -e "${BLUE}🚀 Deploying infrastructure...${NC}"
    
    # Apply Terraform plan
    terraform apply tfplan
    echo -e "${GREEN}✅ Infrastructure deployed${NC}"
}

# Function to configure kubectl
configure_kubectl() {
    echo -e "${BLUE}⚙️  Configuring kubectl...${NC}"
    
    # Get cluster name from Terraform outputs
    local cluster_name=$(terraform output -raw cluster_name 2>/dev/null || echo "${PROJECT_NAME}-${ENVIRONMENT}")
    
    if command_exists kubectl; then
        # Update kubeconfig
        aws eks update-kubeconfig \
            --region "$AWS_REGION" \
            --name "$cluster_name" \
            --alias "${PROJECT_NAME}-${ENVIRONMENT}"
        
        echo -e "${GREEN}✅ kubectl configured${NC}"
        
        # Test connection
        if kubectl get nodes >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Kubernetes cluster accessible${NC}"
            kubectl get nodes
        else
            echo -e "${YELLOW}⚠️  Kubernetes cluster not yet ready${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  kubectl not installed, skipping configuration${NC}"
    fi
}

# Function to deploy Kubernetes manifests
deploy_kubernetes_manifests() {
    echo -e "${BLUE}📦 Deploying Kubernetes manifests...${NC}"
    
    if ! command_exists kubectl; then
        echo -e "${YELLOW}⚠️  kubectl not available, skipping manifest deployment${NC}"
        return 0
    fi
    
    # Check if cluster is accessible
    if ! kubectl get nodes >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Kubernetes cluster not accessible yet${NC}"
        return 0
    fi
    
    # Deploy core infrastructure components
    echo "Deploying core services..."
    if [[ -f "../k8s/service.yaml" ]]; then
        kubectl apply -f ../k8s/service.yaml
        echo -e "${GREEN}✅ Service configuration applied${NC}"
    fi
    
    # Deploy PostgreSQL
    if [[ -f "../k8s/postgres-config.yaml" ]]; then
        kubectl apply -f ../k8s/postgres-config.yaml
        echo -e "${GREEN}✅ PostgreSQL configuration applied${NC}"
    fi
    
    # Deploy main application
    if [[ -f "../k8s/deployment.yaml" ]]; then
        kubectl apply -f ../k8s/deployment.yaml
        echo -e "${GREEN}✅ Application deployment applied${NC}"
    fi
    
    # Deploy HPA
    if [[ -f "../k8s/hpa.yaml" ]]; then
        kubectl apply -f ../k8s/hpa.yaml
        echo -e "${GREEN}✅ HPA configuration applied${NC}"
    fi
    
    # Deploy monitoring
    if [[ -f "../k8s/monitoring.yaml" ]]; then
        kubectl apply -f ../k8s/monitoring.yaml
        echo -e "${GREEN}✅ Monitoring configuration applied${NC}"
    fi
    
    # Deploy advanced features
    if [[ -f "../k8s/advanced-features.yaml" ]]; then
        kubectl apply -f ../k8s/advanced-features.yaml
        echo -e "${GREEN}✅ Advanced features applied${NC}"
    fi
}

# Function to show deployment status
show_deployment_status() {
    echo -e "${BLUE}📊 Deployment Status Summary${NC}"
    echo "============================================================"
    
    cd "$TERRAFORM_DIR"
    
    # Show Terraform outputs
    echo -e "${YELLOW}Infrastructure Outputs:${NC}"
    terraform output
    
    # Show Kubernetes status (if available)
    if command_exists kubectl && kubectl get nodes >/dev/null 2>&1; then
        echo -e "\n${YELLOW}Kubernetes Status:${NC}"
        kubectl get nodes
        echo ""
        kubectl get pods --all-namespaces
    fi
}

# Function to show next steps
show_next_steps() {
    echo -e "${GREEN}🎉 Terraform Infrastructure Deployment Completed!${NC}"
    echo ""
    echo -e "${BLUE}📋 Next Steps:${NC}"
    echo "1. Monitor your infrastructure:"
    echo "   cd $TERRAFORM_DIR && terraform output"
    echo ""
    echo "2. Check Kubernetes cluster:"
    kubectl get nodes 2>/dev/null || echo "   kubectl get nodes (when cluster is ready)"
    echo ""
    echo "3. Monitor application deployment:"
    kubectl get pods --all-namespaces 2>/dev/null || echo "   kubectl get pods --all-namespaces (when ready)"
    echo ""
    echo "4. Access application (after load balancer is ready):"
    echo "   kubectl get svc hyperpage-service"
    echo ""
    echo "5. View monitoring (if deployed):"
    echo "   kubectl get pods -n monitoring"
    echo ""
    echo -e "${YELLOW}⚠️  Important Notes:${NC}"
    echo "- Infrastructure deployment may take 10-15 minutes"
    echo "- Kubernetes cluster becomes ready after infrastructure is deployed"
    echo "- Application deployment depends on cluster being ready"
    echo "- Monitor CloudFormation stack in AWS console for progress"
    echo ""
    echo -e "${BLUE}📚 Documentation:${NC}"
    echo "- Phase 5: terraform/ directory contains all infrastructure code"
    echo "- Kubernetes: k8s/ directory contains application manifests"
    echo "- Outputs: See terraform output for connection details"
    echo ""
    echo -e "${BLUE}🔧 Useful Commands:${NC}"
    echo "# Update Terraform state"
    echo "cd $TERRAFORM_DIR && terraform refresh"
    echo ""
    echo "# View current infrastructure"
    echo "cd $TERRAFORM_DIR && terraform show"
    echo ""
    echo "# Check Terraform plan"
    echo "cd $TERRAFORM_DIR && terraform plan"
    echo ""
    echo "# Destroy infrastructure (WARNING: This will delete everything!)"
    echo "cd $TERRAFORM_DIR && terraform destroy"
}

# Function to cleanup on error
cleanup() {
    if [[ $? -ne 0 ]]; then
        echo -e "${RED}❌ Deployment failed!${NC}"
        echo "To debug, check:"
        echo "1. AWS CloudFormation console"
        echo "2. Terraform state: cd $TERRAFORM_DIR && terraform show"
        echo "3. Kubernetes events: kubectl get events --all-namespaces"
    fi
}

# Set up error handling
trap cleanup EXIT

# Main deployment flow
main() {
    echo "Phase 5: Terraform Infrastructure Deployment"
    echo "Environment: $ENVIRONMENT"
    echo "AWS Region: $AWS_REGION"
    echo "Project: $PROJECT_NAME"
    echo ""
    
    # Pre-deployment checks
    check_prerequisites
    create_backend_bucket
    
    # Infrastructure deployment
    validate_terraform
    deploy_infrastructure
    
    # Post-deployment configuration
    configure_kubectl
    deploy_kubernetes_manifests
    
    # Summary
    show_deployment_status
    show_next_steps
    
    echo -e "${GREEN}✅ Phase 5: Terraform Infrastructure Deployment Completed!${NC}"
}

# Handle command line arguments
case "$1" in
    "dev"|"staging"|"prod")
        ENVIRONMENT="$1"
        ;;
    "--help"|"-h")
        echo "Usage: $0 [environment] [aws_region] [project_name]"
        echo "Environments: dev, staging, prod (default: production)"
        echo "AWS Regions: any AWS region (default: us-west-2)"
        echo "Project Name: any name (default: hyperpage)"
        echo ""
        echo "Examples:"
        echo "  $0 dev"
        echo "  $0 production us-east-1"
        echo "  $0 staging eu-west-1 my-project"
        exit 0
        ;;
    *)
        if [[ -n "$1" && "$1" != "production" ]]; then
            echo "Unknown environment: $1"
            echo "Valid environments: dev, staging, prod"
            echo "Use --help for usage information"
            exit 1
        fi
        ;;
esac

# Run main function
main "$@"
