#!/bin/bash
# Local development backup script
# For PRODUCTION backups see: /home/ubuntu/scripts/db-backup.sh on EC2
# Production runs automatically via cron at 3am AEST daily → S3

set -e

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

echo "Starting backup process..."

mkdir -p $BACKUP_DIR

# Development only — backs up local Docker DB
if docker ps | grep -q "signatureshades-db-local"; then
    CONTAINER_NAME="signatureshades-db-local"
    DB_USER="signatureshades_dev"
    DB_NAME="signatureshades_dev"
    ENV_TYPE="dev"
else
    echo "Error: Local dev database container not found."
    echo "For production backups, run /home/ubuntu/scripts/db-backup.sh on the EC2 server."
    exit 1
fi

echo "Backing up local database: $DB_NAME..."

docker exec $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME > $BACKUP_DIR/db_backup_${ENV_TYPE}_$DATE.sql

echo "Database backup completed: db_backup_${ENV_TYPE}_$DATE.sql"

# Backup uploads folder
if [ -d "./uploads" ]; then
    echo "Backing up uploads folder..."
    tar -czf $BACKUP_DIR/uploads_backup_${ENV_TYPE}_$DATE.tar.gz ./uploads
    echo "Uploads backup completed"
fi

echo ""
echo "Backup Summary:"
echo "  Date: $DATE"
echo "  Location: $BACKUP_DIR"
ls -lh $BACKUP_DIR/*$DATE* 2>/dev/null || true

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup process completed!"
