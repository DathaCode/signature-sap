# Terraform Main Configuration
# AWS Infrastructure for Signature Shades Order System

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment to use S3 backend for state (recommended for team collaboration)
  # backend "s3" {
  #   bucket = "signatureshades-terraform-state"
  #   key    = "production/terraform.tfstate"
  #   region = "ap-southeast-2"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Data source for latest Ubuntu AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# VPC - Use default VPC to save costs
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# SSH Key Pair
resource "aws_key_pair" "ec2_key" {
  key_name   = "${var.project_name}-ec2-key"
  public_key = file(var.ssh_public_key_path)

  tags = {
    Name = "${var.project_name}-ec2-key"
  }
}

# EC2 Instance
resource "aws_instance" "app" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  key_name      = aws_key_pair.ec2_key.key_name

  vpc_security_group_ids = [aws_security_group.app.id]
  subnet_id              = tolist(data.aws_subnets.default.ids)[0]

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = file("${path.module}/user-data.sh")

  tags = {
    Name = "${var.project_name}-app-${var.environment}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Elastic IP
resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-eip-${var.environment}"
  }
}

# Route 53 Hosted Zone for subdomain
resource "aws_route53_zone" "subdomain" {
  name = "${var.subdomain}.${var.domain_name}"

  tags = {
    Name = "${var.project_name}-subdomain-zone"
  }
}

# Route 53 A Record pointing to Elastic IP
resource "aws_route53_record" "subdomain_a" {
  zone_id = aws_route53_zone.subdomain.zone_id
  name    = "${var.subdomain}.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [aws_eip.app.public_ip]
}

# Route 53 WWW CNAME (optional)
resource "aws_route53_record" "subdomain_www" {
  zone_id = aws_route53_zone.subdomain.zone_id
  name    = "www.${var.subdomain}.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = ["${var.subdomain}.${var.domain_name}"]
}
