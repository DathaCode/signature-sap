# RDS PostgreSQL — Melbourne (ap-southeast-4)
# Replaces the postgres Docker container running on EC2

# DB Subnet Group — uses Melbourne default VPC subnets (defined in main.tf)
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group-${var.environment}"
  subnet_ids = data.aws_subnets.default.ids

  tags = {
    Name = "${var.project_name}-db-subnet-group-${var.environment}"
  }
}

# Parameter Group — PostgreSQL 15 with connection logging
resource "aws_db_parameter_group" "postgres" {
  name   = "${var.project_name}-pg15-${var.environment}"
  family = "postgres15"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  tags = {
    Name = "${var.project_name}-pg15-${var.environment}"
  }
}

# RDS PostgreSQL Instance — Melbourne
resource "aws_db_instance" "postgres" {
  identifier = "${var.project_name}-db-${var.environment}"

  engine         = "postgres"
  engine_version = "15"
  instance_class = var.rds_instance_class

  allocated_storage     = 20
  max_allocated_storage = 100 # Auto-scales up to 100 GB
  storage_type          = "gp2"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.postgres.name

  multi_az                = false  # Single-AZ; upgrade if uptime SLA requires it
  publicly_accessible     = false  # Private — EC2 access only
  backup_retention_period = 7
  backup_window           = "17:00-18:00"     # 3:00 AM AEST (UTC+10)
  maintenance_window      = "mon:18:00-mon:19:00" # 4:00 AM AEST Monday

  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project_name}-db-final-${var.environment}"

  auto_minor_version_upgrade = true

  tags = {
    Name = "${var.project_name}-db-${var.environment}"
  }
}
