# Variables for Hyperpage Kubernetes Infrastructure
# Phase 5: Terraform Implementation

# Project Configuration
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "hyperpage"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "production"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

# Network Configuration
variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones to use"
  type        = list(string)
  default     = ["us-west-2a", "us-west-2b", "us-west-2c"]
}

# EKS Configuration
variable "cluster_version" {
  description = "EKS cluster version"
  type        = string
  default     = "1.28"
}

variable "instance_types" {
  description = "List of instance types for node groups"
  type        = list(string)
  default     = ["c5.large", "c5.xlarge", "c5a.xlarge"]
}

variable "capacity_type" {
  description = "Capacity type for node groups (ON_DEMAND, SPOT)"
  type        = string
  default     = "ON_DEMAND"
  
  validation {
    condition     = contains(["ON_DEMAND", "SPOT"], var.capacity_type)
    error_message = "Capacity type must be one of: ON_DEMAND, SPOT."
  }
}

variable "spot_price" {
  description = "Spot price for spot instances"
  type        = string
  default     = "0.05"
}

variable "ami_id" {
  description = "Custom AMI ID for self-managed node groups"
  type        = string
  default     = null
}

variable "node_volume_size" {
  description = "EBS volume size for nodes in GB"
  type        = number
  default     = 100
}

# EKS Add-ons
variable "enable_aws_load_balancer_controller" {
  description = "Enable AWS Load Balancer Controller add-on"
  type        = bool
  default     = true
}

variable "aws_lb_controller_version" {
  description = "Version of AWS Load Balancer Controller"
  type        = string
  default     = "v2.7.0"
}

variable "enable_aws_ebs_csi" {
  description = "Enable AWS EBS CSI Driver add-on"
  type        = bool
  default     = true
}

variable "aws_ebs_csi_version" {
  description = "Version of AWS EBS CSI Driver"
  type        = string
  default     = "v1.20.0"
}

variable "enable_aws_efs_csi" {
  description = "Enable AWS EFS CSI Driver add-on"
  type        = bool
  default     = false
}

variable "aws_efs_csi_version" {
  description = "Version of AWS EFS CSI Driver"
  type        = string
  default     = "v1.6.0"
}

# AWS Services
variable "enable_cloudwatch_logs" {
  description = "Enable CloudWatch Logs VPC endpoint"
  type        = bool
  default     = true
}

variable "enable_ecr" {
  description = "Enable ECR VPC endpoints"
  type        = bool
  default     = true
}

# Security
variable "iam_role_permissions_boundary" {
  description = "ARN of the IAM permissions boundary to apply"
  type        = string
  default     = null
}

# Database Configuration
variable "enable_rds" {
  description = "Enable RDS PostgreSQL instance"
  type        = bool
  default     = false
}

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "rds_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 100
}

variable "rds_max_allocated_storage" {
  description = "RDS max allocated storage in GB"
  type        = number
  default     = 1000
}

variable "rds_backup_retention_period" {
  description = "RDS backup retention period in days"
  type        = number
  default     = 7
}

variable "rds_multi_az" {
  description = "Enable RDS Multi-AZ deployment"
  type        = bool
  default     = false
}

variable "rds_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "rds_master_username" {
  description = "RDS master username"
  type        = string
  default     = "postgres"
  sensitive   = true
}

variable "rds_master_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}

# Monitoring and Logging
variable "enable_cloudwatch_agent" {
  description = "Enable CloudWatch agent for monitoring"
  type        = bool
  default     = true
}

variable "enable_fluentbit" {
  description = "Enable Fluent Bit for log aggregation"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

# Cost Optimization
variable "enable_spot_instances" {
  description = "Enable spot instances for non-critical workloads"
  type        = bool
  default     = true
}

variable "enable_auto_scaling" {
  description = "Enable cluster autoscaler"
  type        = bool
  default     = true
}

variable "enable_node_termination_handler" {
  description = "Enable AWS Node Termination Handler"
  type        = bool
  default     = true
}

# Security and Compliance
variable "enable_vpc_flow_logs" {
  description = "Enable VPC flow logs"
  type        = bool
  default     = true
}

variable "enable_config" {
  description = "Enable AWS Config"
  type        = bool
  default     = true
}

variable "enable_guardduty" {
  description = "Enable AWS GuardDuty"
  type        = bool
  default     = true
}

variable "enable_security_hub" {
  description = "Enable AWS Security Hub"
  type        = bool
  default     = true
}

# Backup and DR
variable "enable_ebs_encryption" {
  description = "Enable EBS encryption"
  type        = bool
  default     = true
}

variable "enable_rds_encryption" {
  description = "Enable RDS encryption"
  type        = bool
  default     = true
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection for RDS"
  type        = bool
  default     = true
}

# Node Labels and Taints
variable "additional_node_labels" {
  description = "Additional labels to add to all node groups"
  type        = map(string)
  default     = {}
}

variable "additional_node_taints" {
  description = "Additional taints to add to all node groups"
  type = list(object({
    key    = string
    value  = string
    effect = string
  }))
  default = []
}

# Cluster Add-ons Versions
variable "cluster_addons_versions" {
  description = "Versions for cluster add-ons"
  type = map(string)
  default = {
    coredns     = "v1.11.1-eksbuild.1"
    kube-proxy  = "v1.28.0-eksbuild.1"
    vpc-cni     = "v1.16.0-eksbuild.1"
  }
}

# External DNS
variable "enable_external_dns" {
  description = "Enable External DNS"
  type        = bool
  default     = true
}

variable "external_dns_zone_id" {
  description = "Route53 hosted zone ID for external DNS"
  type        = string
  default     = null
}

# Certificate Manager
variable "enable_cert_manager" {
  description = "Enable cert-manager"
  type        = bool
  default     = true
}

variable "cert_manager_email" {
  description = "Email for cert-manager (Let's Encrypt)"
  type        = string
  default     = "admin@example.com"
}

# Resource Tags
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Terraform State
variable "terraform_state_bucket" {
  description = "S3 bucket for Terraform state"
  type        = string
  default     = "hyperpage-terraform-state"
}

variable "terraform_state_key" {
  description = "S3 key for Terraform state"
  type        = string
  default     = "infrastructure/terraform.tfstate"
}

variable "terraform_state_region" {
  description = "Region for Terraform state bucket"
  type        = string
  default     = "us-west-2"
}

# Feature Flags
variable "enable_service_mesh" {
  description = "Enable service mesh (Istio/App Mesh)"
  type        = bool
  default     = false
}

variable "service_mesh_type" {
  description = "Service mesh type (istio, appmesh)"
  type        = string
  default     = "istio"
  
  validation {
    condition     = contains(["istio", "appmesh"], var.service_mesh_type)
    error_message = "Service mesh type must be one of: istio, appmesh."
  }
}

variable "enable_ingress_nginx" {
  description = "Enable NGINX Ingress Controller"
  type        = bool
  default     = true
}

variable "enable_aws_lb_ingress" {
  description = "Enable AWS Load Balancer Ingress"
  type        = bool
  default     = false
}

# Performance and Scaling
variable "enable_cluster_autoscaler" {
  description = "Enable Cluster Autoscaler"
  type        = bool
  default     = true
}

variable "enable_metrics_server" {
  description = "Enable Metrics Server"
  type        = bool
  default     = true
}

variable "enable_vertical_pod_autoscaler" {
  description = "Enable Vertical Pod Autoscaler"
  type        = bool
  default     = false
}

# GitOps
variable "enable_argocd" {
  description = "Enable ArgoCD"
  type        = bool
  default     = true
}

variable "argocd_namespace" {
  description = "Namespace for ArgoCD"
  type        = string
  default     = "argocd"
}

variable "enable_flux" {
  description = "Enable Flux (alternative to ArgoCD)"
  type        = bool
  default     = false
}
