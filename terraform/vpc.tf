# VPC and Networking Configuration for Hyperpage
# Phase 5: Kubernetes Infrastructure with Terraform

# VPC
resource "aws_vpc" "main" {
  cidr_block           = local.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-vpc"
  })
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  
  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-igw"
  })
}

# Elastic IP for NAT Gateway
resource "aws_eip" "nat" {
  count  = length(local.azs)
  domain = "vpc"
  
  depends_on = [aws_internet_gateway.main]
  
  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-eip-${count.index}"
  })
}

# NAT Gateways for private subnet internet access
resource "aws_nat_gateway" "main" {
  count         = length(local.azs)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  
  depends_on = [aws_internet_gateway.main]
  
  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-nat-${count.index}"
  })
}

# Public Subnets
resource "aws_subnet" "public" {
  count = length(local.azs)
  
  vpc_id                  = aws_vpc.main.id
  cidr_block              = local.public_subnets[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true
  
  tags = merge(local.common_tags, {
    Name                             = "${local.cluster_name}-public-${local.azs[count.index]}"
    "kubernetes.io/role/elb"         = "1"
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
  })
}

# Private Subnets
resource "aws_subnet" "private" {
  count = length(local.azs)
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = local.private_subnets[count.index]
  availability_zone = local.azs[count.index]
  
  tags = merge(local.common_tags, {
    Name                                 = "${local.cluster_name}-private-${local.azs[count.index]}"
    "kubernetes.io/role/internal-elb"    = "1"
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
  })
}

# Database Subnets
resource "aws_subnet" "database" {
  count = length(local.azs)
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = local.database_subnets[count.index]
  availability_zone = local.azs[count.index]
  
  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-db-${local.azs[count.index]}"
  })
}

# Route Tables

# Public Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-public-rt"
  })
}

# Private Route Tables
resource "aws_route_table" "private" {
  count  = length(local.azs)
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-private-rt-${count.index}"
  })
}

# Route Table Associations

# Public Subnet Associations
resource "aws_route_table_association" "public" {
  count = length(local.azs)
  
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Private Subnet Associations
resource "aws_route_table_association" "private" {
  count = length(local.azs)
  
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# Database Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${local.cluster_name}-db-subnet-group"
  subnet_ids = aws_subnet.database[*].id
  
  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-db-subnet-group"
  })
}

# Security Groups

# EKS Cluster Security Group
resource "aws_security_group" "cluster" {
  name_prefix = "${local.cluster_name}-cluster"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [local.vpc_cidr]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-cluster-sg"
  })
}

# EKS Node Security Group
resource "aws_security_group" "node" {
  name_prefix = "${local.cluster_name}-node"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    from_port       = 1025
    to_port         = 65535
    protocol        = "tcp"
    cidr_blocks     = [local.vpc_cidr]
    security_groups = [aws_security_group.cluster.id]
  }
  
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [local.vpc_cidr]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-node-sg"
  })
}

# Load Balancer Security Group
resource "aws_security_group" "lb" {
  name_prefix = "${local.cluster_name}-lb"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-lb-sg"
  })
}

# Database Security Group
resource "aws_security_group" "database" {
  name_prefix = "${local.cluster_name}-db"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.node.id]
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-db-sg"
  })
}

# VPC Endpoints for S3 (to avoid internet gateway for S3 access)
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  route_table_ids   = [aws_route_table.private[*].id, aws_route_table.public.id]
  vpc_endpoint_type = "Gateway"
  
  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-s3-endpoint"
  })
}

# CloudWatch Logs VPC Endpoint
resource "aws_vpc_endpoint" "logs" {
  count             = var.enable_cloudwatch_logs ? 1 : 0
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.logs"
  subnet_ids        = aws_subnet.private[*].id
  security_group_ids = [aws_security_group.node.id]
  private_dns_enabled = true
  
  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-logs-endpoint"
  })
}

# ECR VPC Endpoint
resource "aws_vpc_endpoint" "ecr_api" {
  count             = var.enable_ecr ? 1 : 0
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.ecr.api"
  subnet_ids        = aws_subnet.private[*].id
  security_group_ids = [aws_security_group.node.id]
  private_dns_enabled = true
  
  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-ecr-api-endpoint"
  })
}

resource "aws_vpc_endpoint" "ecr_dkr" {
  count             = var.enable_ecr ? 1 : 0
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.ecr.dkr"
  subnet_ids        = aws_subnet.private[*].id
  security_group_ids = [aws_security_group.node.id]
  private_dns_enabled = true
  
  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-ecr-dkr-endpoint"
  })
}
