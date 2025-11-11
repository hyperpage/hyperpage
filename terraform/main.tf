# Hyperpage Kubernetes Infrastructure - Terraform Configuration
# Phase 5: Kubernetes Implementation with Infrastructure as Code

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.10"
    }
  }
  
  backend "s3" {
    bucket = "hyperpage-terraform-state"
    key    = "infrastructure/terraform.tfstate"
    region = "us-west-2"
    encrypt = true
  }
}

# Provider Configuration
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "hyperpage"
      Environment = var.environment
      ManagedBy   = "terraform"
      Phase       = "5"
    }
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  token                  = module.eks.cluster_access_token
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    token                  = module.eks.cluster_access_token
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  }
}

# Data Sources
data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

# Local Values
locals {
  cluster_name    = "${var.project_name}-${var.environment}"
  cluster_version = "1.28"
  
  # Common tags
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5"
    Team        = "platform"
  }
  
  # Node group configuration
  node_groups = {
    main = {
      desired_capacity = 3
      max_capacity     = 10
      min_capacity     = 3
      
      instance_types = var.instance_types
      
      k8s_labels = {
        Environment = var.environment
        Application = "hyperpage"
        NodeGroup   = "main"
      }
      
      taints = []
      
      tags = local.common_tags
    }
    
    # High-priority nodes for critical workloads
    critical = {
      desired_capacity = 1
      max_capacity     = 5
      min_capacity     = 1
      
      instance_types = ["c5.2xlarge", "c5a.2xlarge"]
      
      k8s_labels = {
        Environment = var.environment
        Application = "hyperpage"
        NodeGroup   = "critical"
        Priority    = "critical"
      }
      
      # Taint to ensure only critical pods schedule here
      taints = [
        {
          key    = "critical"
          value  = "true"
          effect = "NO_SCHEDULE"
        }
      ]
      
      tags = local.common_tags
    }
  }
  
  # VPC configuration
  vpc_cidr = var.vpc_cidr
  azs      = slice(data.aws_availability_zones.available.names, 0, 3)
  
  # Database subnet group
  database_subnets = [
    for az in local.azs : cidrsubnet(local.vpc_cidr, 8, 100 + index(local.azs, az))
  ]
  
  # Private subnets for application
  private_subnets = [
    for az in local.azs : cidrsubnet(local.vpc_cidr, 8, 10 + index(local.azs, az))
  ]
  
  # Public subnets for load balancers
  public_subnets = [
    for az in local.azs : cidrsubnet(local.vpc_cidr, 8, 20 + index(local.azs, az))
  ]
}
