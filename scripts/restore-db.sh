#!/bin/bash
# Database Restore Script for Signature Shades
# Restores PostgreSQL database from S3 backup

set -e

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <backup-filename>"
    echo "Example: $0 signatureshades-db-20260210_020000.sql.gz"
    echo ""
    echo "Available backups:"
    aws s3 ls s3://signatureshades-backups-production/database/ --region ap-southeast-2
    exit 1
fi

BACKUP_FILE="$1"
S3_BUCKET="signatureshades-backups-production"
DB_CONTAINER="signatureshades-db-prod"
RESTORE_DIR="/tmp/db-restore"

# Create restore directory
mkdir -p "$RESTORE_DIR"

echo "[$(date)] Downloading backup from S3..."

# Download from S3
aws s3 cp "s3://${S3_BUCKET}/database/${BACKUP_FILE}" "${RESTORE_DIR}/${BACKUP_FILE}" --region ap-southeast-2

if [ ! -f "${RESTORE_DIR}/${BACKUP_FILE}" ]; then
    echo "[$(date)] ERROR: Failed to download backup file!"
    exit 1
fi

echo "[$(date)] Backup downloaded successfully!"

# Confirm with user
read -p "⚠️  This will OVERWRITE the current database. Are you sure? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo "[$(date)] Stopping application containers..."
cd /opt/signatureshades/signature-sap
docker compose -f docker-compose.prod.yml stop backend frontend nginx

echo "[$(date)] Restoring database..."

# Restore database
gunzip -c "${RESTORE_DIR}/${BACKUP_FILE}" | docker exec -i "$DB_CONTAINER" psql -U signatureshades signatureshades_prod

if [ $? -eq 0 ]; then
    echo "[$(date)] Database restored successfully!"
else
    echo "[$(date)] ERROR: Failed to restore database!"
    exit 1
fi

# Restart containers
echo "[$(date)] Restarting application..."
docker compose -f docker-compose.prod.yml start backend frontend nginx

# Clean up
rm -f "${RESTORE_DIR}/${BACKUP_FILE}"

echo "[$(date)] Restore completed successfully!"
