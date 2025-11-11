#!/bin/bash

# Terraform Workspace Setup for Multi-Environment Management
# Phase 5: Kubernetes Implementation with Workspace Support

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TERRAFORM_DIR="."
PROJECT_NAME="${1:-hyperpage}"
DEFAULT_REGION="${2:-us-west-2}"

echo -e "${BLUE}🏗️  Terraform Workspace Setup${NC}"
echo "============================================================"
echo "Project: $PROJECT_NAME"
echo "Region: $DEFAULT_REGION"
echo "Directory: $TERRAFORM_DIR"
echo ""

# Function to check prerequisites
check_prerequisites() {
    echo -e "${BLUE}🔍 Checking prerequisites...${NC}"
    
    if ! command -v terraform >/dev/null 2>&1; then
        echo -e "${RED}❌ Terraform is not installed${NC}"
        exit 1
    fi
    
    if ! command -v aws >/dev/null 2>&1; then
        echo -e "${RED}❌ AWS CLI is not installed${NC}"
        exit 1
    fi
    
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        echo -e "${RED}❌ AWS credentials not configured${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All prerequisites met${NC}"
}

# Function to initialize Terraform with workspace support
init_terraform() {
    echo -e "${BLUE}🔧 Initializing Terraform with workspace support...${NC}"
    
    # Initialize Terraform
    terraform init -backend-config="backend-$DEFAULT_REGION.conf"
    
    echo -e "${GREEN}✅ Terraform initialized${NC}"
}

# Function to create backend configuration files
create_backend_configs() {
    echo -e "${BLUE}📝 Creating backend configurations...${NC}"
    
    # Create regional backend configurations
    cat > "backend-us-west-2.conf" << EOF
bucket  = "${PROJECT_NAME}-${DEFAULT_REGION}-terraform-state"
key     = "environments/\${terraform.workspace}/terraform.tfstate"
region  = "${DEFAULT_REGION}"
encrypt = true

dynamodb_table = "${PROJECT_NAME}-${DEFAULT_REGION}-terraform-locks"
EOF

    cat > "backend-us-east-1.conf" << EOF
bucket  = "${PROJECT_NAME}-us-east-1-terraform-state"
key     = "environments/\${terraform.workspace}/terraform.tfstate"
region  = "us-east-1"
encrypt = true

dynamodb_table = "${PROJECT_NAME}-us-east-1-terraform-locks"
EOF

    cat > "backend-eu-west-1.conf" << EOF
bucket  = "${PROJECT_NAME}-eu-west-1-terraform-state"
key     = "environments/\${terraform.workspace}/terraform.tfstate"
region  = "eu-west-1"
encrypt = true

dynamodb_table = "${PROJECT_NAME}-eu-west-1-terraform-locks"
EOF

    echo -e "${GREEN}✅ Backend configurations created${NC}"
}

# Function to create workspace-specific variables
create_workspace_variables() {
    echo -e "${BLUE}📋 Creating workspace-specific variables...${NC}"
    
    # Development workspace variables
    cat > "dev.tfvars" << EOF
# Development Environment
project_name = "${PROJECT_NAME}"
environment  = "dev"
aws_region   = "${DEFAULT_REGION}"

# Resource sizing - Development (cost optimized)
instance_types = ["c5.large", "c5.xlarge"]
node_volume_size = 50
desired_capacity = 2
min_capacity = 2
max_capacity = 5

# Feature flags
enable_spot_instances = false
enable_multi_az = false
enable_rds = false
enable_vpc_flow_logs = false

# Security (relaxed for development)
enable_config = false
enable_guardduty = false
enable_security_hub = false

# Monitoring (basic)
enable_cloudwatch_agent = true
enable_fluentbit = false
log_retention_days = 7

# Cost optimization
spot_price = "0.03"
rds_instance_class = "db.t3.micro"
rds_allocated_storage = 20
rds_backup_retention_period = 1
EOF

    # Staging workspace variables
    cat > "staging.tfvars" << EOF
# Staging Environment
project_name = "${PROJECT_NAME}-staging"
environment  = "staging"
aws_region   = "${DEFAULT_REGION}"

# Resource sizing - Staging (balanced)
instance_types = ["c5.large", "c5.xlarge", "c5a.xlarge"]
node_volume_size = 100
desired_capacity = 3
min_capacity = 2
max_capacity = 8

# Feature flags
enable_spot_instances = true
enable_multi_az = false
enable_rds = true
enable_vpc_flow_logs = true

# Security (standard)
enable_config = true
enable_guardduty = true
enable_security_hub = false

# Monitoring (enhanced)
enable_cloudwatch_agent = true
enable_fluentbit = true
log_retention_days = 14

# Cost optimization
spot_price = "0.04"
rds_instance_class = "db.t3.small"
rds_allocated_storage = 50
rds_backup_retention_period = 3
EOF

    # Production workspace variables
    cat > "production.tfvars" << EOF
# Production Environment
project_name = "${PROJECT_NAME}"
environment  = "production"
aws_region   = "${DEFAULT_REGION}"

# Resource sizing - Production (high availability)
instance_types = ["c5.xlarge", "c5a.xlarge", "c5.2xlarge"]
node_volume_size = 100
desired_capacity = 3
min_capacity = 3
max_capacity = 12

# Feature flags
enable_spot_instances = true
enable_multi_az = true
enable_rds = true
enable_vpc_flow_logs = true

# Security (strict)
enable_config = true
enable_guardduty = true
enable_security_hub = true

# Monitoring (comprehensive)
enable_cloudwatch_agent = true
enable_fluentbit = true
log_retention_days = 30

# Cost optimization
spot_price = "0.05"
rds_instance_class = "db.t3.medium"
rds_allocated_storage = 100
rds_backup_retention_period = 7
rds_multi_az = true
EOF

    echo -e "${GREEN}✅ Workspace variables created${NC}"
}

# Function to create workspace-specific backend buckets
create_workspace_buckets() {
    echo -e "${BLUE}📦 Creating workspace-specific S3 backends...${NC}"
    
    local regions=("us-west-2" "us-east-1" "eu-west-1")
    
    for region in "${regions[@]}"; do
        local bucket_name="${PROJECT_NAME}-${region}-terraform-state"
        
        echo "Creating S3 bucket for region: $region"
        
        # Create bucket if it doesn't exist
        if ! aws s3api head-bucket --bucket "$bucket_name" 2>/dev/null; then
            aws s3api create-bucket \
                --bucket "$bucket_name" \
                --region "$region" \
                --create-bucket-configuration "LocationConstraint=$region" 2>/dev/null || true
            
            # Enable versioning
            aws s3api put-bucket-versioning \
                --bucket "$bucket_name" \
                --versioning-configuration Status=Enabled 2>/dev/null || true
            
            # Enable encryption
            aws s3api put-bucket-encryption \
                --bucket "$bucket_name" \
                --server-side-encryption-configuration Rules=ApplyServerSideEncryptionByDefault,ServerSideEncryptionAlgorithm=AES256 2>/dev/null || true
        fi
        
        # Create DynamoDB table for state locking
        local table_name="${PROJECT_NAME}-${region}-terraform-locks"
        if ! aws dynamodb describe-table --table-name "$table_name" 2>/dev/null >/dev/null; then
            aws dynamodb create-table \
                --table-name "$table_name" \
                --attribute-definitions AttributeName=LockID,AttributeType=S \
                --key-schema AttributeName=LockID,KeyType=HASH \
                --billing-mode PAY_PER_REQUEST \
                --region "$region" 2>/dev/null || true
        fi
    done
    
    echo -e "${GREEN}✅ S3 backends created${NC}"
}

# Function to setup workspaces
setup_workspaces() {
    echo -e "${BLUE}📁 Setting up Terraform workspaces...${NC}"
    
    # Create workspaces
    local workspaces=("development" "staging" "production")
    
    for workspace in "${workspaces[@]}"; do
        if terraform workspace list | grep -q "$workspace"; then
            echo -e "${YELLOW}⚠️  Workspace '$workspace' already exists${NC}"
        else
            terraform workspace new "$workspace"
            echo -e "${GREEN}✅ Created workspace: $workspace${NC}"
        fi
    done
    
    # Show current workspace
    echo -e "${BLUE}Current workspace: $(terraform workspace show)${NC}"
    
    echo -e "${GREEN}✅ Workspaces configured${NC}"
}

# Function to show workspace information
show_workspace_info() {
    echo -e "${BLUE}📊 Workspace Information${NC}"
    echo "============================================================"
    
    echo "Available workspaces:"
    terraform workspace list
    
    echo ""
    echo "Current workspace: $(terraform workspace show)"
    
    echo ""
    echo "Backend configuration for current workspace:"
    terraform backend config 2>/dev/null || echo "Run 'terraform init' to configure backend"
    
    echo ""
    echo "Variable files for each workspace:"
    ls -la *.tfvars 2>/dev/null || echo "No .tfvars files found"
}

# Function to show usage examples
show_usage_examples() {
    echo -e "${BLUE}💡 Usage Examples${NC}"
    echo "============================================================"
    
    echo "1. Switch to a workspace:"
    echo "   terraform workspace select staging"
    echo ""
    
    echo "2. Plan with workspace-specific variables:"
    echo "   terraform plan -var-file=\$(terraform workspace show).tfvars"
    echo ""
    
    echo "3. Apply with workspace-specific variables:"
    echo "   terraform apply -var-file=\$(terraform workspace show).tfvars"
    echo ""
    
    echo "4. Deploy staging environment:"
    echo "   terraform workspace select staging"
    echo "   terraform plan -var-file=staging.tfvars"
    echo "   terraform apply -var-file=staging.tfvars"
    echo ""
    
    echo "5. Deploy production environment:"
    echo "   terraform workspace select production"
    echo "   terraform plan -var-file=production.tfvars"
    echo "   terraform apply -var-file=production.tfvars"
    echo ""
    
    echo "6. List all resources in a workspace:"
    echo "   terraform workspace select <workspace>"
    echo "   terraform state list"
    echo ""
    
    echo "7. Show current workspace outputs:"
    echo "   terraform workspace select <workspace>"
    echo "   terraform output"
}

# Function to cleanup (optional)
cleanup_workspaces() {
    read -p "Do you want to delete all workspaces? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        local workspaces=("development" "staging" "production")
        for workspace in "${workspaces[@]}"; do
            terraform workspace select "$workspace" 2>/dev/null || continue
            terraform workspace delete "$workspace" 2>/dev/null || echo "Cannot delete workspace '$workspace' (contains resources)"
        done
        echo -e "${GREEN}✅ Workspace cleanup completed${NC}"
    fi
}

# Main setup function
main() {
    echo "Terraform Workspace Setup for $PROJECT_NAME"
    echo "=============================================="
    
    check_prerequisites
    create_backend_configs
    create_workspace_variables
    create_workspace_buckets
    init_terraform
    setup_workspaces
    
    echo ""
    show_workspace_info
    show_usage_examples
    
    echo ""
    echo -e "${GREEN}🎉 Terraform workspace setup completed!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Select a workspace: terraform workspace select staging"
    echo "2. Plan the deployment: terraform plan -var-file=staging.tfvars"
    echo "3. Apply the configuration: terraform apply -var-file=staging.tfvars"
    echo ""
    echo -e "${YELLOW}Note: Each workspace maintains separate state files for isolation${NC}"
}

# Handle command line arguments
case "$1" in
    "--help"|"-h")
        echo "Usage: $0 [project_name] [aws_region]"
        echo ""
        echo "Arguments:"
        echo "  project_name  Name of the project (default: hyperpage)"
        echo "  aws_region    AWS region (default: us-west-2)"
        echo ""
        echo "Examples:"
        echo "  $0 hyperpage us-west-2"
        echo "  $0 myproject eu-west-1"
        echo ""
        echo "This script will:"
        echo "1. Create workspace-specific backend configurations"
        echo "2. Generate environment-specific variable files"
        echo "3. Set up S3 backends with DynamoDB locking"
        echo "4. Initialize Terraform workspaces"
        echo "5. Show usage examples"
        exit 0
        ;;
    "cleanup")
        cleanup_workspaces
        exit 0
        ;;
esac

# Run main function
main "$@"
