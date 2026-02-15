# Terraform Variables

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "ap-southeast-2"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "signatureshades"
}

variable "environment" {
  description = "Environment name (production, staging, etc.)"
  type        = string
  default     = "production"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro" # Free tier eligible

  validation {
    condition     = contains(["t2.micro", "t3.micro", "t3.small", "t3.medium"], var.instance_type)
    error_message = "Instance type must be one of: t2.micro, t3.micro, t3.small, t3.medium"
  }
}

variable "domain_name" {
  description = "Root domain name (e.g., signatureshades.com.au)"
  type        = string
}

variable "subdomain" {
  description = "Subdomain for the application (e.g., 'orders' for orders.signatureshades.com.au)"
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
