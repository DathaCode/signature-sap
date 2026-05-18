# Terraform Variables

variable "aws_region" {
  description = "Primary AWS region (Melbourne)"
  type        = string
  default     = "ap-southeast-4"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "signatureshades"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"

  validation {
    condition     = contains(["t2.micro", "t3.micro", "t3.small", "t3.medium"], var.instance_type)
    error_message = "Instance type must be one of: t2.micro, t3.micro, t3.small, t3.medium"
  }
}

variable "ec2_iam_instance_profile" {
  description = "IAM instance profile name to attach to EC2 (for S3 access etc.)"
  type        = string
  default     = "ec2-service"
}

variable "domain_name" {
  description = "Root domain name (e.g., signatureshades.com.au)"
  type        = string
}

variable "subdomain" {
  description = "Subdomain for the application"
  type        = string
  default     = "orders"
}

variable "ssh_public_key_path" {
  description = "Path to SSH public key for EC2 access"
  type        = string
}

variable "db_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT secret for authentication"
  type        = string
  sensitive   = true
}

# ── RDS ───────────────────────────────────────────────────────────────────────

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "signatureshades_prod"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "signatureshades_prod"
}
