# EKS Cluster Configuration for Hyperpage
# Phase 5: Kubernetes Infrastructure with Terraform

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.15"
  
  cluster_name    = local.cluster_name
  cluster_version = local.cluster_version
  
  vpc_id                         = aws_vpc.main.id
  subnet_ids                     = concat(aws_subnet.private[*].id, aws_subnet.public[*].id)
  cluster_endpoint_public_access = true
  
  # Cluster access entry
  enable_cluster_creator_admin_permissions = true
  
  # Cluster logging
  cluster_enabled_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  
  # IRSA (IAM Roles for Service Accounts)
  enable_irsa = true
  
  # Cluster security group
  cluster_security_group_additional_rules = {
    ingress_nodes_ephemeral_ports_tcp = {
      description                = "Nodes on ephemeral ports"
      protocol                   = "tcp"
      from_port                  = 1025
      to_port                    = 65535
      type                       = "ingress"
      source_node_security_group = true
    }
  }
  
  # Node security group
  node_security_group_additional_rules = {
    ingress_self_all = {
      description = "Node to node all ports/protocols"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "ingress"
      self        = true
    }
    
    ingress_cluster_all = {
      description                   = "Cluster API to node all ports/protocols"
      protocol                      = "-1"
      from_port                     = 0
      to_port                       = 0
      type                          = "ingress"
      source_cluster_security_group = true
    }
    
    egress_all = {
      description = "Node all egress"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "egress"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }
  
  # EKS Managed Node Groups
  eks_managed_node_groups = {
    main = {
      name           = "main"
      use_name_prefix = true
      
      # Node group configuration
      capacity_type  = "ON_DEMAND"
      instance_types = var.instance_types
      capacity_type  = var.capacity_type
      
      # Node group sizing
      desired_capacity = local.node_groups.main.desired_capacity
      max_capacity     = local.node_groups.main.max_capacity
      min_capacity     = local.node_groups.main.min_capacity
      
      # Network configuration
      subnet_ids = aws_subnet.private[*].id
      
      # Node labels and taints
      k8s_labels = local.node_groups.main.k8s_labels
      taints     = local.node_groups.main.taints
      
      # Update configuration
      update_config = {
        max_unavailable_percentage = 25
      }
      
      # Tag specifications
      tags = local.node_groups.main.tags
      
      # T3 instances support for better cost optimization
      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size           = var.node_volume_size
            volume_type           = "gp3"
            iops                  = 3000
            throughput            = 150
            delete_on_termination = true
            encrypted             = true
          }
        }
      }
      
      # SSH access (optional)
      enable_bootstrap_user_data = true
      pre_userdata              = <<-EOT
        # Install SSM Agent
        if ! command -v amazon-ssm-agent &> /dev/null; then
          yum install -y amazon-ssm-agent
          systemctl enable amazon-ssm-agent
          systemctl start amazon-ssm-agent
        fi
        
        # Install kubectl
        curl -LO "https://dl.k8s.io/release/v1.28.0/bin/linux/amd64/kubectl"
        chmod +x kubectl
        mv kubectl /usr/local/bin/
        
        # Install AWS CLI v2
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
        unzip awscliv2.zip
        ./aws/install
      EOT
    }
    
    critical = {
      name           = "critical"
      use_name_prefix = true
      
      # High-priority node group
      capacity_type  = "ON_DEMAND"
      instance_types = local.node_groups.critical.instance_types
      
      # Node group sizing
      desired_capacity = local.node_groups.critical.desired_capacity
      max_capacity     = local.node_groups.critical.max_capacity
      min_capacity     = local.node_groups.critical.min_capacity
      
      # Network configuration
      subnet_ids = aws_subnet.private[*].id
      
      # Node labels and taints
      k8s_labels = local.node_groups.critical.k8s_labels
      taints     = local.node_groups.critical.taints
      
      # Update configuration
      update_config = {
        max_unavailable_percentage = 10
      }
      
      # Tag specifications
      tags = local.node_groups.critical.tags
      
      # Enhanced block device for critical workloads
      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size           = var.node_volume_size
            volume_type           = "gp3"
            iops                  = 3000
            throughput            = 150
            delete_ontermination = true
            encrypted             = true
          }
        }
      }
      
      # Additional bootstrap for critical nodes
      pre_userdata = <<-EOT
        # Install SSM Agent
        if ! command -v amazon-ssm-agent &> /dev/null; then
          yum install -y amazon-ssm-agent
          systemctl enable amazon-ssm-agent
          systemctl start amazon-ssm-agent
        fi
        
        # Install kubectl and other tools
        curl -LO "https://dl.k8s.io/release/v1.28.0/bin/linux/amd64/kubectl"
        chmod +x kubectl
        mv kubectl /usr/local/bin/
        
        # Install AWS CLI v2
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
        unzip awscliv2.zip
        ./aws/install
        
        # Additional monitoring tools
        yum install -y htop iotop nethogs
      EOT
    }
  }
  
  # Self-managed node groups (for specific use cases)
  self_managed_node_groups = {
    # Spot instances for cost optimization during non-critical hours
    spot = {
      name_prefix = "spot"
      
      instance_type = "t3.medium"
      ami_id       = var.ami_id
      
      # Use spot instances
      spot_price = var.spot_price
      
      # Network configuration
      subnet_ids = aws_subnet.private[*].id
      
      # Scaling configuration
      min_size     = 0
      max_size     = 5
      desired_size = 0  # Start with 0, can be scaled manually
      
      # Tags
      tags = merge(local.common_tags, {
        NodeGroup = "spot"
        Spot      = "true"
      })
      
      # Taints to prevent critical pods from scheduling on spot nodes
      taints = [
        {
          key    = "spot"
          value  = "true"
          effect = "NO_SCHEDULE"
        }
      ]
    }
  }
  
  # Cluster add-ons
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }
  
  # OIDC Provider
  enable_oidc = true
  
  # IAM
  create_iam_role = true
  iam_role_name   = "${local.cluster_name}-cluster-role"
  
  iam_role_use_name_prefix = false
  
  iam_role_description = "EKS Cluster role for ${local.cluster_name}"
  
  iam_role_permissions_boundary = var.iam_role_permissions_boundary
  
  iam_role_additional_policies = {
    additional = aws_iam_policy.cluster_additional.arn
  }
  
  # Tags
  tags = local.common_tags
}

# Additional IAM policies for cluster
resource "aws_iam_policy" "cluster_additional" {
  name        = "${local.cluster_name}-cluster-additional"
  description = "Additional EKS cluster permissions for ${local.cluster_name}"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath",
          "ssm:PutParameter",
          "ssm:DeleteParameter",
          "ssm:DescribeParameters",
          "ssm:GetParameterHistory",
          "ssm:ListTagsForResource",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:CreateLogGroup",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:CreateSecret",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecret",
          "secretsmanager:DeleteSecret",
          "secretsmanager:DescribeSecret",
          "secretsmanager:GetSecretValue",
          "secretsmanager:ListSecretVersionIds",
          "secretsmanager:ListSecrets",
        ]
        Resource = "*"
      },
    ]
  })
  
  tags = local.common_tags
}

# EKS Access Entry for local development
resource "aws_eks_access_entry" "local" {
  cluster_name  = module.eks.cluster_name
  principal_arn = data.aws_caller_identity.current.arn
  
  username = "admin"
  groups   = ["system:masters"]
  
  depends_on = [module.eks]
}

# EKS Add-on: AWS Load Balancer Controller
resource "aws_eks_addon" "aws_lb_controller" {
  count = var.enable_aws_load_balancer_controller ? 1 : 0
  
  cluster_name = module.eks.cluster_name
  addon_name   = "aws-load-balancer-controller"
  addon_version = var.aws_lb_controller_version
  
  resolve_conflicts = "OVERWRITE"
  
  configuration_values = jsonencode({
    resources = {
      limits = {
        cpu    = "200m"
        memory = "200Mi"
      }
      requests = {
        cpu    = "100m"
        memory = "100Mi"
      }
    }
    serviceAccount = {
      create = true
      name   = "aws-load-balancer-controller"
    }
  })
  
  tags = local.common_tags
  
  depends_on = [module.eks]
}

# EKS Add-on: AWS EBS CSI Driver
resource "aws_eks_addon" "aws_ebs_csi" {
  count = var.enable_aws_ebs_csi ? 1 : 0
  
  cluster_name = module.eks.cluster_name
  addon_name   = "aws-ebs-csi-driver"
  addon_version = var.aws_ebs_csi_version
  
  resolve_conflicts = "OVERWRITE"
  
  tags = local.common_tags
  
  depends_on = [module.eks]
}

# EKS Add-on: AWS EFS CSI Driver
resource "aws_eks_addon" "aws_efs_csi" {
  count = var.enable_aws_efs_csi ? 1 : 0
  
  cluster_name = module.eks.cluster_name
  addon_name   = "aws-efs-csi-driver"
  addon_version = var.aws_efs_csi_version
  
  resolve_conflicts = "OVERWRITE"
  
  tags = local.common_tags
  
  depends_on = [module.eks]
}

# Node group monitoring
resource "aws_autoscaling_group_tag" "node_groups" {
  for_each = {
    for group in flatten([
      for group_name, group_config in local.node_groups : [
        for i in range(group_config.desired_capacity) : {
          group_name = "${group_name}-${group_name}-${format("%02d", i)}"
          asg_name   = "${local.cluster_name}-${group_name}-${format("%02d", i)}"
        }
      ]
    ]) : "${each.value.group_name}" => each.value
  }
  
  autoscaling_group_name = each.value.asg_name
  key                    = "k8s.io/cluster-autoscaler/node-template/label/alpha.eksctl.io/nodegroup"
  value                  = split("-", each.value.group_name)[0]
  propagate_at_launch    = false
}
