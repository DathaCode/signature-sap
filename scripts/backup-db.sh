#!/bin/bash
# Database Backup Script for Signature Shades
# Backs up PostgreSQL database to S3

set -e

# Configuration
BACKUP_DIR="/tmp/db-backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="signatureshades-db-${TIMESTAMP}.sql.gz"
S3_BUCKET="signatureshades-backups-production"
DB_CONTAINER="signatureshades-db-prod"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup..."

# Dump database from Docker container
docker exec "$DB_CONTAINER" pg_dump -U signatureshades signatureshades_prod | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

# Check if backup file was created
if [ ! -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
    echo "[$(date)] ERROR: Backup file was not created!"
    exit 1
fi

echo "[$(date)] Database dumped to ${BACKUP_FILE}"

# Upload to S3
aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}" "s3://${S3_BUCKET}/database/${BACKUP_FILE}" \
    --storage-class STANDARD_IA \
    --region ap-southeast-2

if [ $? -eq 0 ]; then
    echo "[$(date)] Backup uploaded to S3 successfully!"
else
    echo "[$(date)] ERROR: Failed to upload backup to S3!"
    exit 1
fi

# Clean up local backup file
rm -f "${BACKUP_DIR}/${BACKUP_FILE}"

# Clean up old local backups (keep last 3 days locally)
find "$BACKUP_DIR" -name "signatureshades-db-*.sql.gz" -mtime +3 -delete

echo "[$(date)] Backup completed successfully!"
