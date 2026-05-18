# S3 Bucket for Backups
# Bucket stays in Sydney (ap-southeast-2) — cross-region uploads from Melbourne EC2 work fine.
# All resources use the "sydney" provider alias defined in main.tf.

resource "aws_s3_bucket" "backups" {
  provider = aws.sydney
  bucket   = "${var.project_name}-backups-${var.environment}"

  tags = {
    Name = "${var.project_name}-backups-${var.environment}"
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  provider = aws.sydney
  bucket   = aws_s3_bucket.backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  provider = aws.sydney
  bucket   = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  provider = aws.sydney
  bucket   = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  provider = aws.sydney
  bucket   = aws_s3_bucket.backups.id

  rule {
    id     = "delete-old-backups"
    status = "Enabled"

    filter {
      prefix = ""
    }

    expiration {
      days = 30
    }

    transition {
      days          = 7
      storage_class = "GLACIER"
    }
  }
}
