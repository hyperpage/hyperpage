# Terraform Infrastructure for Hyperpage - Workspace Management

## Overview

This directory contains complete Infrastructure as Code (IaC) for deploying the Hyperpage application on AWS EKS using Terraform. The implementation includes **Terraform workspaces** for multi-environment management (development, staging, production).

## Quick Start

### 1. Setup Terraform Workspaces
```bash
# Initialize and setup all workspaces
./workspace-setup.sh hyperpage us-west-2

# Or with custom project name
./workspace-setup.sh myproject eu-west-1
```

### 2. Deploy to Staging
```bash
# Switch to staging workspace
terraform workspace select staging

# Plan and deploy
terraform plan -var-file=staging.tfvars
terraform apply -var-file=staging.tfvars
```

### 3. Deploy to Production
```bash
# Switch to production workspace
terraform workspace select production

# Plan and deploy
terraform plan -var-file=production.tfvars
terraform apply -var-file=production.tfvars
```

## Architecture

### Multi-Environment Support

#### **Development Environment**
- **Resource sizing**: Minimal (2 nodes, t3.micro RDS)
- **Cost optimization**: No spot instances
- **Security**: Relaxed (no GuardDuty, Config, Security Hub)
- **Monitoring**: Basic (7-day log retention)
- **Region**: Configurable (default: us-west-2)

#### **Staging Environment**
- **Resource sizing**: Balanced (3 nodes, t3.small RDS)
- **Cost optimization**: Spot instances enabled
- **Security**: Standard (GuardDuty, Config enabled)
- **Monitoring**: Enhanced (14-day retention, Fluent Bit)
- **Features**: Multi-AZ disabled, RDS enabled

#### **Production Environment**
- **Resource sizing**: High availability (3+ nodes, t3.medium RDS)
- **Cost optimization**: Spot instances with multi-AZ
- **Security**: Strict (all security services enabled)
- **Monitoring**: Comprehensive (30-day retention)
- **Features**: Multi-AZ deployment, RDS Multi-AZ

### Infrastructure Components

#### **VPC Architecture**
- **VPC**: 10.0.0.0/16 with DNS support
- **Public Subnets**: 10.0.20.0/24 - 10.0.22.0/24
- **Private Subnets**: 10.0.10.0/24 - 10.0.12.0/24
- **Database Subnets**: 10.0.100.0/24 - 10.0.102.0/24
- **NAT Gateways**: 1 per availability zone
- **VPC Endpoints**: S3, ECR, CloudWatch Logs

#### **EKS Cluster**
- **Version**: Kubernetes 1.28
- **Node Groups**:
  - **Main**: 3-10 c5.large/xlarge instances
  - **Critical**: 1-5 c5.2xlarge instances (tainted)
  - **Spot**: 0-5 t3.medium spot instances (tainted)
- **Add-ons**: EBS CSI, Load Balancer Controller, Cluster Autoscaler

#### **Security**
- **IAM Roles**: Minimal permissions for cluster and nodes
- **Security Groups**: Isolated for cluster, nodes, load balancers, database
- **Encryption**: All volumes and data encrypted at rest
- **Network Policies**: Strict ingress/egress rules

## File Structure

```
terraform/
├── main.tf              # Provider configuration and locals
├── vpc.tf              # VPC, subnets, routing, security groups
├── eks.tf              # EKS cluster and node groups
├── variables.tf        # 50+ configurable parameters
├── outputs.tf          # Infrastructure outputs and endpoints
├── providers.tf        # Multi-provider configuration
├── workspace-setup.sh  # Automated workspace setup script
├── README.md          # This file
└── *.tfvars           # Environment-specific variables
    ├── dev.tfvars     # Development environment
    ├── staging.tfvars # Staging environment
    └── production.tfvars # Production environment
```

## Configuration Files

### Backend Configuration
The setup automatically creates workspace-specific S3 backends:

- **us-west-2**: `hyperpage-us-west-2-terraform-state`
- **us-east-1**: `hyperpage-us-east-1-terraform-state`
- **eu-west-1**: `hyperpage-eu-west-1-terraform-state`

Each bucket includes:
- **Versioning**: Enabled for state history
- **Encryption**: AES256 server-side encryption
- **DynamoDB Locking**: Prevents concurrent state modifications

### Workspace-Specific Variables

#### **Common Variables Across All Environments**
```hcl
project_name    = "hyperpage"
environment     = "staging"  # dev|staging|production
aws_region      = "us-west-2"
cluster_version = "1.28"
```

#### **Environment-Specific Sizing**
```hcl
# Development (Cost Optimized)
desired_capacity = 2
min_capacity     = 2
max_capacity     = 5
node_volume_size = 50
rds_instance_class = "db.t3.micro"

# Staging (Balanced)
desired_capacity = 3
min_capacity     = 2
max_capacity     = 8
node_volume_size = 100
rds_instance_class = "db.t3.small"

# Production (High Availability)
desired_capacity = 3
min_capacity     = 3
max_capacity     = 12
node_volume_size = 100
rds_instance_class = "db.t3.medium"
rds_multi_az     = true
```

#### **Feature Flags**
```hcl
# Development
enable_spot_instances = false
enable_multi_az       = false
enable_rds            = false
enable_guardduty      = false

# Staging
enable_spot_instances = true
enable_multi_az       = false
enable_rds            = true
enable_guardduty      = true

# Production
enable_spot_instances = true
enable_multi_az       = true
enable_rds            = true
enable_guardduty      = true
enable_security_hub   = true
```

## Deployment Workflows

### 1. **Initial Setup**
```bash
# 1. Setup workspaces and backends
./workspace-setup.sh hyperpage us-west-2

# 2. Verify workspaces
terraform workspace list
terraform workspace show

# 3. Check backend configuration
terraform backend config
```

### 2. **Development Environment**
```bash
# Switch to development
terraform workspace select development

# Plan with dev variables
terraform plan -var-file=dev.tfvars

# Apply configuration
terraform apply -var-file=dev.tfvars

# Show outputs
terraform output
```

### 3. **Staging Environment**
```bash
# Switch to staging
terraform workspace select staging

# Plan with staging variables
terraform plan -var-file=staging.tfvars

# Apply configuration
terraform apply -var-file=staging.tfvars

# Configure kubectl
aws eks update-kubeconfig --region us-west-2 --name hyperpage-staging

# Deploy Kubernetes manifests
kubectl apply -f ../k8s/
```

### 4. **Production Environment**
```bash
# Switch to production
terraform workspace select production

# Plan with production variables
terraform plan -var-file=production.tfvars

# Apply configuration (review plan carefully!)
terraform apply -var-file=production.tfvars

# Configure kubectl
aws eks update-kubeconfig --region us-west-2 --name hyperpage

# Deploy Kubernetes manifests
kubectl apply -f ../k8s/
```

### 5. **State Management**
```bash
# Check current state
terraform state list

# Show outputs for current workspace
terraform output

# Refresh state
terraform refresh

# Plan changes
terraform plan

# Apply changes
terraform apply

# Destroy (WARNING: This deletes everything!)
terraform destroy
```

## Cost Optimization

### **Estimated Monthly Costs**

#### **Development Environment**
- VPC with 1 NAT Gateway: ~$45
- EKS cluster: ~$73/month
- EC2 instances (2x c5.large): ~$59/month
- EBS volumes: ~$20/month
- Load balancer: ~$22/month
- CloudWatch logs: ~$5/month
- Data transfer: ~$10/month
- RDS (optional): ~$15/month
- **Total: ~$249/month**

#### **Staging Environment**
- VPC with 1 NAT Gateway: ~$45
- EKS cluster: ~$73/month
- EC2 instances (3x c5.large): ~$88/month
- Spot instances: ~$44/month (50% savings)
- EBS volumes: ~$30/month
- Load balancer: ~$22/month
- CloudWatch logs: ~$8/month
- Data transfer: ~$15/month
- RDS: ~$31/month
- **Total: ~$356/month**

#### **Production Environment**
- VPC with 3 NAT Gateways: ~$135
- EKS cluster: ~$73/month
- EC2 instances (3x c5.xlarge): ~$176/month
- Spot instances: ~$88/month (50% savings)
- EBS volumes: ~$90/month
- Load balancers: ~$66/month
- CloudWatch logs: ~$30/month
- Data transfer: ~$45/month
- RDS Multi-AZ: ~$92/month
- **Total: ~$795/month**

### **Cost Optimization Strategies**
1. **Spot Instances**: Up to 70% savings for non-critical workloads
2. **Auto-scaling**: Scale down during low traffic periods
3. **Reserved Instances**: For predictable workloads in production
4. **Storage Optimization**: Right-sized volumes with lifecycle policies
5. **Multi-AZ**: Only enable for production high availability

## Security Implementation

### **Network Security**
- **VPC Isolation**: Separate subnets for different tiers
- **Security Groups**: Principle of least privilege
- **NAT Gateways**: Private subnet internet access
- **VPC Endpoints**: Private AWS service access

### **IAM Security**
- **Cluster Role**: Minimal EKS permissions
- **Node Roles**: Limited EC2 and EKS permissions
- **Service Accounts**: IRSA for pod-level permissions
- **No Wildcard Policies**: All resources explicitly scoped

### **Data Security**
- **Encryption at Rest**: EBS volumes and RDS storage
- **Encryption in Transit**: TLS for all endpoints
- **Secrets Management**: Kubernetes secrets and AWS Secrets Manager
- **Network Policies**: Kubernetes pod-to-pod restrictions

## Monitoring & Observability

### **Infrastructure Monitoring**
- **CloudWatch**: AWS resource monitoring
- **EKS Control Plane Logs**: Cluster audit and authentication
- **VPC Flow Logs**: Network traffic analysis
- **GuardDuty**: Threat detection

### **Application Monitoring**
- **Prometheus**: Metrics collection
- **Grafana**: Visualization and dashboards
- **AlertManager**: Alert routing
- **Fluent Bit**: Log aggregation

### **Performance Metrics**
- **EKS Metrics**: Node and pod resource usage
- **HPA Metrics**: Application scaling events
- **RDS Metrics**: Database performance
- **ALB Metrics**: Load balancer performance

## Troubleshooting

### **Common Issues**

#### **1. Workspace Not Found**
```bash
# List available workspaces
terraform workspace list

# Create missing workspace
terraform workspace new staging
```

#### **2. Backend Lock**
```bash
# Check for active locks
aws dynamodb describe-table --table-name hyperpage-us-west-2-terraform-locks

# Force unlock (only if you're sure no one else is running terraform)
terraform force-unlock <lock-id>
```

#### **3. EKS Cluster Not Accessible**
```bash
# Update kubeconfig
aws eks update-kubeconfig --region us-west-2 --name hyperpage-staging

# Check cluster status
aws eks describe-cluster --name hyperpage-staging --region us-west-2
```

#### **4. Node Group Creation Failed**
```bash
# Check IAM roles
aws iam get-role --role-name hyperpage-staging-eks-node-role

# Check security groups
aws ec2 describe-security-groups --group-ids sg-12345678
```

### **Useful Commands**
```bash
# Check Terraform version and providers
terraform version
terraform providers

# Validate configuration
terraform validate

# Format code
terraform fmt -recursive

# Show current state
terraform show

# Debug mode
TF_LOG=DEBUG terraform plan
```

## Best Practices

### **1. State Management**
- Always use S3 backends with DynamoDB locking
- Never commit `.terraform.tfstate` files
- Use `terraform workspace` for environment separation
- Regular backups of state files

### **2. Variable Management**
- Use `.tfvars` files for environment-specific variables
- Never commit sensitive data to version control
- Use Terraform variables for sensitive data
- Document all variables in `variables.tf`

### **3. Security**
- Enable encryption for all storage
- Use least privilege IAM policies
- Enable VPC flow logs and CloudTrail
- Regular security audits with AWS Config

### **4. Cost Optimization**
- Use spot instances for non-critical workloads
- Enable auto-scaling for variable workloads
- Right-size resources based on monitoring
- Regular cost reviews and optimization

### **5. Monitoring**
- Set up comprehensive monitoring from day one
- Use meaningful alert thresholds
- Regular review of performance metrics
- Plan for capacity based on growth projections

## Next Steps

After successful deployment:

1. **Configure kubectl**: Update kubeconfig for your environment
2. **Deploy Applications**: Apply Kubernetes manifests
3. **Setup Monitoring**: Deploy Prometheus and Grafana
4. **Configure DNS**: Set up external DNS and certificates
5. **Setup CI/CD**: Integrate with your deployment pipeline
6. **Security Review**: Conduct security audit
7. **Performance Testing**: Load test your application
8. **Backup Strategy**: Implement backup and recovery procedures

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review AWS EKS documentation
3. Check Terraform AWS provider documentation
4. Review application logs and metrics
5. Open an issue in the project repository

---

**Note**: This infrastructure is designed for production use but should be reviewed and tested in lower environments before production deployment. Always follow your organization's security and compliance requirements.
