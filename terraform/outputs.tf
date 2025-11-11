# Outputs for Hyperpage Kubernetes Infrastructure
# Phase 5: Terraform Implementation

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "database_subnet_ids" {
  description = "IDs of the database subnets"
  value       = aws_subnet.database[*].id
}

output "database_subnet_group_name" {
  description = "Name of the database subnet group"
  value       = aws_db_subnet_group.main.name
}

# EKS Outputs
output "cluster_arn" {
  description = "ARN of the EKS cluster"
  value       = module.eks.cluster_arn
}

output "cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = module.eks.cluster_endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data for EKS cluster"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "cluster_oidc_issuer_url" {
  description = "The URL on the EKS cluster OIDC Issuer"
  value       = module.eks.cluster_oidc_issuer_url
}

output "cluster_security_group_id" {
  description = "Security group IDs attached to the cluster control plane"
  value       = module.eks.cluster_security_group_id
}

output "node_security_group_id" {
  description = "Security group IDs attached to the cluster control plane"
  value       = module.eks.node_security_group_id
}

# EKS Node Groups
output "eks_managed_node_groups" {
  description = "EKS managed node groups"
  value       = module.eks.eks_managed_node_groups
}

output "self_managed_node_groups" {
  description = "Self managed node groups"
  value       = module.eks.self_managed_node_groups
}

# IAM Outputs
output "cluster_iam_role_name" {
  description = "IAM role name associated with EKS cluster"
  value       = module.eks.cluster_iam_role_name
}

output "cluster_iam_role_arn" {
  description = "IAM role ARN associated with EKS cluster"
  value       = module.eks.cluster_iam_role_arn
}

output "cluster_iam_role_unique_id" {
  description = "IAM role unique ID associated with EKS cluster"
  value       = module.eks.cluster_iam_role_unique_id
}

output "node_iam_role_arn" {
  description = "IAM role ARN of the EKS node groups"
  value       = module.eks.node_iam_role_arn
}

output "node_iam_role_name" {
  description = "IAM role name of the EKS node groups"
  value       = module.eks.node_iam_role_name
}

# Security Group Outputs
output "cluster_security_group_arn" {
  description = "ARN of the cluster security group"
  value       = aws_security_group.cluster.arn
}

output "node_security_group_arn" {
  description = "ARN of the node security group"
  value       = aws_security_group.node.arn
}

output "lb_security_group_arn" {
  description = "ARN of the load balancer security group"
  value       = aws_security_group.lb.arn
}

output "database_security_group_arn" {
  description = "ARN of the database security group"
  value       = aws_security_group.database.arn
}

# NAT Gateway Outputs
output "nat_gateway_ids" {
  description = "IDs of the NAT gateways"
  value       = aws_nat_gateway.main[*].id
}

output "nat_gateway_public_ips" {
  description = "Public IPs of the NAT gateways"
  value       = aws_eip.nat[*].public_ip
}

# VPC Endpoints
output "vpc_endpoints" {
  description = "VPC endpoints"
  value = {
    s3 = aws_vpc_endpoint.s3.id
    logs = var.enable_cloudwatch_logs ? aws_vpc_endpoint.logs[0].id : null
    ecr_api = var.enable_ecr ? aws_vpc_endpoint.ecr_api[0].id : null
    ecr_dkr = var.enable_ecr ? aws_vpc_endpoint.ecr_dkr[0].id : null
  }
}

# Kubernetes Configuration
output "kubeconfig" {
  description = "kubectl config as base64 encoded string"
  value       = module.eks.kubeconfig
  sensitive   = true
}

output "cluster_config_map_aws_auth" {
  description = "A.kubernetes_config_map_yaml of aws_auth_configmap.yaml"
  value       = module.eks.cluster_config_map_aws_auth
  sensitive   = true
}

# Add-on Outputs
output "aws_lb_controller_role_arn" {
  description = "ARN of AWS Load Balancer Controller IAM role"
  value       = try(aws_eks_addon.aws_lb_controller[0].service_account_role_arn, null)
}

output "aws_ebs_csi_role_arn" {
  description = "ARN of AWS EBS CSI Driver IAM role"
  value       = try(aws_eks_addon.aws_ebs_csi[0].service_account_role_arn, null)
}

output "aws_efs_csi_role_arn" {
  description = "ARN of AWS EFS CSI Driver IAM role"
  value       = try(aws_eks_addon.aws_efs_csi[0].service_account_role_arn, null)
}

# RDS Outputs (if enabled)
output "rds_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = try(aws_rds_cluster.main.endpoint, null)
  sensitive   = true
}

output "rds_instance_read_endpoint" {
  description = "RDS instance read endpoint"
  value       = try(aws_rds_cluster.main.reader_endpoint, null)
  sensitive   = true
}

output "rds_instance_port" {
  description = "RDS instance port"
  value       = try(aws_rds_cluster.main.port, null)
}

output "rds_cluster_identifier" {
  description = "RDS cluster identifier"
  value       = try(aws_rds_cluster.main.cluster_identifier, null)
}

output "rds_instance_identifier" {
  description = "RDS instance identifier"
  value       = try(aws_rds_cluster_instance.main[0].identifier, null)
}

# Database Secrets Manager
output "rds_secret_arn" {
  description = "ARN of the RDS secret"
  value       = try(aws_secretsmanager_secret_version.rds[0].arn, null)
  sensitive   = true
}

# Monitoring Outputs
output "cloudwatch_log_group_name" {
  description = "CloudWatch log group name"
  value       = try(aws_cloudwatch_log_group.eks[0].name, null)
}

output "cloudwatch_log_group_arn" {
  description = "CloudWatch log group ARN"
  value       = try(aws_cloudwatch_log_group.eks[0].arn, null)
}

# Cost and Performance
output "estimated_monthly_cost" {
  description = "Estimated monthly cost of the infrastructure"
  value       = <<-EOT
    VPC with 3 NAT Gateways: ~\$45/month
    EKS cluster: ~\$0.10/hour
    EC2 instances (3x c5.large): ~\$88/month
    EBS volumes: ~\$30/month
    Load balancers: ~\$22/month
    CloudWatch logs: ~\$10/month
    Data transfer: ~\$15/month
    RDS (optional): varies by configuration
    Total estimated: ~\$210-250/month (excluding RDS)
  EOT
}

# Deployment URLs and Commands
output "kubectl_commands" {
  description = "Useful kubectl commands for the cluster"
  value = <<-EOT
    # Configure kubectl
    aws eks update-kubeconfig --region ${var.aws_region} --name ${local.cluster_name}
    
    # Check cluster status
    kubectl get nodes
    kubectl get pods --all-namespaces
    
    # Deploy the application
    kubectl apply -f ../k8s/service.yaml
    kubectl apply -f ../k8s/deployment.yaml
    kubectl apply -f ../k8s/hpa.yaml
    
    # Check application status
    kubectl get services
    kubectl get deployments
    kubectl get hpa
  EOT
}

output "helm_repositories" {
  description = "Helm repositories to add"
  value = <<-EOT
    # Add required Helm repositories
    helm repo add eks https://aws.github.io/eks-charts
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo add jetstack https://charts.jetstack.io
    helm repo add external-dns https://kubernetes-sigs.github.io/external-dns/
    helm repo update
  EOT
}

output "next_steps" {
  description = "Next steps after infrastructure deployment"
  value = <<-EOT
    1. Update kubeconfig: aws eks update-kubeconfig --region ${var.aws_region} --name ${local.cluster_name}
    2. Deploy Kubernetes manifests: kubectl apply -f ../k8s/
    3. Install monitoring: helm install prometheus prometheus-community/kube-prometheus-stack
    4. Install ingress: helm install ingress-nginx ingress-nginx/ingress-nginx
    5. Install cert-manager: helm install cert-manager jetstack/cert-manager
    6. Configure external DNS with your domain
    7. Set up monitoring dashboards in Grafana
    8. Configure alerting rules
  EOT
}
