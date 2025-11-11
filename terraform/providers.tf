# Terraform Providers Configuration for Hyperpage
# Phase 5: Kubernetes Infrastructure with Terraform

# AWS Provider Configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  required_version = ">= 1.0"
  
  backend "s3" {
    bucket = var.terraform_state_bucket
    key    = var.terraform_state_key
    region = var.terraform_state_region
    encrypt = true
    
    # Optional: Use DynamoDB for state locking
    dynamodb_table = "${var.project_name}-${var.environment}-terraform-locks"
  }
}

# Regional AWS Provider
provider "aws" {
  alias  = "main"
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Phase       = "5"
      Team        = "platform"
    }
  }
  
  # Skip EKS cluster creation if not needed
  skip_metadata_api_check     = false
  skip_region_validation      = false
  skip_credentials_validation = false
  skip_requesting_account_id  = false
  skip_short_api              = false
}

# Additional regional providers for multi-region setups (if needed)
provider "aws" {
  alias  = "secondary"
  region = "us-east-1"
  
  skip_metadata_api_check     = false
  skip_region_validation      = false
  skip_credentials_validation = false
  skip_requesting_account_id  = false
  skip_short_api              = false
}

# Local Provider (for local state)
terraform {
  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
  }
}

provider "local" {
  # Local provider doesn't need configuration
}

# Random Provider (for generating random values)
terraform {
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "random" {
  # Random provider doesn't need configuration
}

# TLS Provider (for SSL/TLS certificates)
terraform {
  required_providers {
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

provider "tls" {
  # TLS provider doesn't need configuration
}

# Archive Provider (for file operations)
terraform {
  required_providers {
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

provider "archive" {
  # Archive provider doesn't need configuration
}

# Null Provider (for local operations)
terraform {
  required_providers {
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }
}

provider "null" {
  # Null provider doesn't need configuration
}

# External Provider (for external data sources)
terraform {
  required_providers {
    external = {
      source  = "hashicorp/external"
      version = "~> 2.0"
    }
  }
}

provider "external" {
  # External provider doesn't need configuration
}
