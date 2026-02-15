# AWS Infrastructure - Terraform

This directory contains Infrastructure as Code (IaC) for deploying Signature Shades to AWS.

## 📁 Files

- **main.tf** — Core infrastructure (EC2, VPC, Route 53)
- **variables.tf** — Input variables
- **outputs.tf** — Output values (IP address, DNS, etc.)
- **security.tf** — Security groups and firewall rules
- **s3.tf** — S3 bucket for database backups
- **user-data.sh** — EC2 bootstrap script (installs Docker, etc.)
- **terraform.tfvars.example** — Example configuration (copy to `terraform.tfvars`)

## 🚀 Quick Start

### 1. Prerequisites

```powershell
# Install Terraform
choco install terraform

# Install AWS CLI
winget install Amazon.AWSCLI

# Configure AWS credentials
aws configure
```

### 2. Create SSH Key

```powershell
ssh-keygen -t ed25519 -f "$HOME\.ssh\signatureshades-ec2" -C "signatureshades"
```

### 3. Configure Variables

```powershell
cd terraform
cp terraform.tfvars.example terraform.tfvars
notepad terraform.tfvars
```

**Edit these values:**
- `domain_name` = "signatureshades.com.au"
- `subdomain` = "orders"
- `ssh_public_key_path` = "C:\\Users\\vdula\\.ssh\\signatureshades-ec2.pub"
- `db_password` = (strong password)
- `jwt_secret` = (random 32+ character string)

### 4. Deploy Infrastructure

```powershell
terraform init
terraform plan
terraform apply
```

### 5. Save Outputs

```powershell
# Note these values from output:
terraform output ec2_public_ip
terraform output nameservers_for_route53
```

## 📊 Infrastructure Created

- **EC2 t3.micro** — Application server (Free Tier eligible)
- **Elastic IP** — Static public IP
- **Route 53 Hosted Zone** — Subdomain DNS management
- **Security Group** — Firewall rules (SSH, HTTP, HTTPS)
- **S3 Bucket** — Encrypted database backups (30-day lifecycle)

## 💰 Cost Estimate

| Service | Free Tier (Year 1) | After Free Tier |
|---------|-------------------|-----------------|
| EC2 t3.micro | $0.00 | ~$8.50 AUD/month |
| Route 53 hosted zone | $0.75 AUD/month | $0.75 AUD/month |
| S3 (backups) | $0.00 | ~$0.20 AUD/month |
| **Total** | **~$0.75 AUD/month** | **~$9.45 AUD/month** |

## 🔄 Scaling Up

To upgrade the EC2 instance:

```hcl
# In terraform.tfvars
instance_type = "t3.small"  # or t3.medium
```

Then run:
```powershell
terraform apply
```

## 🗑️ Destroy Infrastructure

```powershell
terraform destroy
```

> ⚠️ **WARNING:** This will delete all infrastructure. Ensure you have backups!

## 📝 Notes

- Terraform state is stored locally by default
- For team collaboration, enable S3 backend in `main.tf`
- Never commit `terraform.tfvars` to Git (contains secrets)
- Route 53 nameservers must be delegated in your domain registrar
