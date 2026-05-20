#!/bin/bash
# Database Restore Script for Signature Shades
# Restores RDS PostgreSQL 15 from S3 backup (ap-southeast-2)
# Usage: ./restore-db.sh <backup-filename>
# Example: ./restore-db.sh signatureshades-db-20260520_020000.dump

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <backup-filename>"
    echo "Example: $0 signatureshades-db-20260520_020000.dump"
    echo ""
    echo "Available backups in S3:"
    aws s3 ls s3://signatureshades-backups-production/daily/ --recursive --region ap-southeast-2 | sort | tail -20
    exit 1
fi

# ── Configuration ─────────────────────────────────────────────────────────────
BACKUP_FILE="$1"
S3_BUCKET="signatureshades-backups-production"
RDS_HOST="signatureshades-db-production.cr6yg6a2cnx1.ap-southeast-4.rds.amazonaws.com"
DB_USER="signatureshades_prod"
DB_NAME="signatureshades_prod"
DB_PASS="${DB_PASSWORD:-$(grep DATABASE_URL /home/ubuntu/signature-sap/.env | sed 's/.*:\(.*\)@.*/\1/')}"
RESTORE_DIR="/tmp/db-restore"

mkdir -p "$RESTORE_DIR"

echo "[$(date)] Downloading backup from S3..."

# Try common S3 path prefixes
S3_PATH=$(aws s3 ls s3://${S3_BUCKET}/daily/ --recursive --region ap-southeast-2 | grep "$BACKUP_FILE" | awk '{print $4}' | head -1)

if [ -z "$S3_PATH" ]; then
    echo "[$(date)] ERROR: Backup file '$BACKUP_FILE' not found in S3!"
    exit 1
fi

aws s3 cp "s3://${S3_BUCKET}/${S3_PATH}" "${RESTORE_DIR}/${BACKUP_FILE}" --region ap-southeast-2

if [ ! -f "${RESTORE_DIR}/${BACKUP_FILE}" ]; then
    echo "[$(date)] ERROR: Failed to download backup file!"
    exit 1
fi

echo "[$(date)] Downloaded: $(du -sh ${RESTORE_DIR}/${BACKUP_FILE} | cut -f1)"

# Confirm before overwriting
read -p "⚠️  This will OVERWRITE the current RDS database. Are you sure? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    rm -f "${RESTORE_DIR}/${BACKUP_FILE}"
    exit 0
fi

echo "[$(date)] Stopping backend and nginx..."
cd /home/ubuntu/signature-sap
docker compose -f docker-compose.prod.yml stop backend nginx

echo "[$(date)] Restoring database to RDS..."

PGPASSWORD="$DB_PASS" pg_restore \
  --host="$RDS_HOST" \
  --port=5432 \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --no-owner \
  --no-acl \
  --clean \
  "${RESTORE_DIR}/${BACKUP_FILE}"

echo "[$(date)] Database restored successfully!"

echo "[$(date)] Restarting application..."
docker compose -f docker-compose.prod.yml start backend nginx

# Clean up
rm -f "${RESTORE_DIR}/${BACKUP_FILE}"

echo "[$(date)] Restore completed! Verify at https://orders.signatureshades.com.au"
