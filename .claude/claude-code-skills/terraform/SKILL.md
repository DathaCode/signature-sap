---
name: terraform
description: AWS infrastructure for the signature-sap production deployment is managed by Terraform in [terraform/](terraform/). Read whenever editing `.tf` files, running `terraform plan/apply`, adding/modifying AWS resources (EC2, EIP, Route53, S3, security groups), or rotating secrets stored in tfvars.
applies-to: signature-sap
---

# Terraform Skill — Signature Shades

## Project Context
- **Folder:** [terraform/](terraform/) — files: `main.tf`, `s3.tf`, `security.tf`, `variables.tf`, `outputs.tf`, `user-data.sh`
- **Region:** `ap-southeast-4` (Melbourne) — **not** ap-southeast-2; updated 2026-05-19
- **Provider:** `hashicorp/aws ~> 5.0`, Terraform `>= 1.0`
- **Resources currently managed:**
  - EC2 instance (Ubuntu 22.04 jammy, in default VPC, gp3 30 GB encrypted root)
  - Elastic IP attached to EC2
  - RDS instance (`aws_db_instance.postgres`) — `db.t4g.micro` PostgreSQL 15, private, EC2-only access
  - Route53 zone + A record for `orders.signatureshades.com.au`, plus `www` CNAME
  - SSH key pair from `var.ssh_public_key_path`
  - Security group (`security.tf`) — includes RDS inbound rule from EC2 SG
  - S3 backup bucket (`s3.tf`) — versioned, AES256, blocked-public, 7-day → Glacier, 30-day expiry
  - EC2 user-data bootstrap script (`user-data.sh`)
- **State backend:** local `terraform.tfstate` in the folder. **S3 backend is commented out** in `main.tf` — single-operator OK for now; switch to S3+DynamoDB lock if a second person ever runs Terraform.
- **Secrets in tfvars:** `db_password`, `jwt_secret` live in `terraform.tfvars` (gitignored). NEVER commit `terraform.tfvars` or `*.tfstate`. Example file is `terraform.tfvars.example`.
- **Apply flow:** `terraform plan -out=tfplan` → review → `terraform apply tfplan`. Always plan before apply on production.
- **Cost-aware defaults already applied:** default VPC (no NAT cost), single EC2, S3 lifecycle to Glacier. Don't add managed services without a cost discussion.

## When to Activate
- Editing any file in [terraform/](terraform/)
- Adding a new AWS resource (RDS, ALB, CloudFront, additional S3 bucket, etc.)
- Rotating `db_password` / `jwt_secret` in `terraform.tfvars`
- Updating instance type, volume size, or DNS records
- Investigating drift between state and live AWS resources

## Sub-Skills
| File | When to Read |
|------|-------------|
| `aws-modules.md` | Adding/modifying AWS resources — match patterns to existing project style |
| `best-practices.md` | Variable naming, tagging, lifecycle blocks, plan/apply discipline |
| `state-management.md` | Migrating to S3 backend with DynamoDB lock, importing existing resources, state surgery |
| `oracle-modules.md` | Not applicable — project is AWS-only |

## Also Read
- `security/cloud-security.md` — IAM, security group rules, S3 hardening
- `cost-reducer/cloud-and-infra.md` — sizing the EC2, S3 lifecycle, region choice

## Purpose (generic reference below)
Infrastructure as Code for provisioning and managing AWS and Oracle Cloud Infrastructure. Single source of truth for all cloud resources.

## When to Activate
- Provisioning any cloud resource (compute, network, database, storage, etc.)
- Modifying existing infrastructure
- Setting up new environments (dev/staging/prod)
- Migrating resources between clouds
- Debugging infrastructure issues
- Cost optimization of cloud resources

## Sub-Skills
| File | When to Read |
|------|-------------|
| `aws-modules.md` | Provisioning any AWS resource |
| `oracle-modules.md` | Provisioning any OCI resource |
| `state-management.md` | Setting up backends, workspaces, state operations |
| `best-practices.md` | Code structure, naming, variables, outputs |

## Also Read
- `security/cloud-security.md` — IAM, encryption, network security
- `cost-reducer/cloud-and-infra.md` — Right-sizing, free tiers, spot instances

## Production Deploy Rule — Signature Shades

**NEVER automatically run `terraform apply` or any destructive/production command.**
When production infrastructure changes are needed, provide the commands for the user to run — never execute them directly.

```bash
# Provide these commands, don't run them:
cd terraform
terraform plan -out=tfplan
terraform apply tfplan
terraform apply -target="aws_<resource>.<name>"
```

## Core Terraform Rules
1. **Never modify state manually** — use `terraform state` commands or `terraform import`
2. **Never apply without plan** — always run `terraform plan` first
3. **Remote state only** — never use local state for shared infrastructure
4. **Lock state** — enable state locking to prevent concurrent modifications
5. **Pin provider versions** — avoid surprises from provider updates
6. **Use modules** — DRY principle, reuse common patterns
7. **Separate environments** — use workspaces or separate state files
8. **Tag everything** — every resource must have standard tags
9. **Use variables** — never hardcode values
10. **Sensitive outputs** — mark sensitive values with `sensitive = true`

## Project Structure
```
infrastructure/
├── modules/                    # Reusable modules
│   ├── aws-vpc/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   ├── aws-ecs/
│   ├── aws-rds/
│   ├── oci-vcn/
│   ├── oci-compute/
│   └── oci-autonomous-db/
│
├── environments/               # Environment-specific configs
│   ├── dev/
│   │   ├── main.tf            # Uses modules with dev values
│   │   ├── variables.tf
│   │   ├── terraform.tfvars
│   │   ├── backend.tf
│   │   └── outputs.tf
│   ├── staging/
│   └── prod/
│
├── global/                     # Shared resources (IAM, DNS, etc.)
│   ├── iam/
│   ├── route53/
│   └── ecr/
│
└── scripts/
    ├── plan.sh
    └── apply.sh
```

## Required Provider Setup
```hcl
# versions.tf — in every environment directory
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"        # Pin major version
    }
    oci = {
      source  = "oracle/oci"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

provider "oci" {
  tenancy_ocid = var.tenancy_ocid
  region       = var.oci_region
}
```

## Quick Reference Commands
```bash
# Initialize
terraform init
terraform init -upgrade          # Upgrade providers

# Plan
terraform plan -out=tfplan       # Save plan to file
terraform plan -target=aws_instance.app  # Plan specific resource

# Apply
terraform apply tfplan           # Apply saved plan
terraform apply -auto-approve    # Skip approval (CI/CD only)

# State management
terraform state list             # List all managed resources
terraform state show aws_instance.app  # Show resource details
terraform import aws_instance.app i-1234567890  # Import existing resource
terraform state rm aws_instance.app  # Remove from state (doesn't destroy)

# Destroy
terraform plan -destroy          # Preview destruction
terraform destroy -target=aws_instance.temp  # Destroy specific resource

# Format and validate
terraform fmt -recursive         # Format all files
terraform validate               # Check syntax
```
