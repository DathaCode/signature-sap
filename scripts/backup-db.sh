#!/bin/bash
# Database Backup Script for Signature Shades
# Backs up RDS PostgreSQL 15 (ap-southeast-4) to S3 (ap-southeast-2)

set -e

# ── Configuration ─────────────────────────────────────────────────────────────
RDS_HOST="signatureshades-db-production.cr6yg6a2cnx1.ap-southeast-4.rds.amazonaws.com"
DB_USER="signatureshades_prod"
DB_NAME="signatureshades_prod"
DB_PASS="${DB_PASSWORD:-$(grep DATABASE_URL /home/ubuntu/signature-sap/.env | sed 's/.*:\(.*\)@.*/\1/')}"

BACKUP_DIR="/tmp/db-backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="signatureshades-db-${TIMESTAMP}.dump"
S3_BUCKET="signatureshades-backups-production"
S3_PREFIX="daily/$(date +%Y/%m)"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting RDS database backup..."

# Dump RDS database directly (requires postgresql-client-15)
PGPASSWORD="$DB_PASS" pg_dump \
  --host="$RDS_HOST" \
  --port=5432 \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --no-owner \
  --no-acl \
  -Fc \
  > "${BACKUP_DIR}/${BACKUP_FILE}"

if [ ! -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
    echo "[$(date)] ERROR: Backup file was not created!"
    exit 1
fi

echo "[$(date)] Database dumped: $(du -sh ${BACKUP_DIR}/${BACKUP_FILE} | cut -f1)"

# Upload to S3 (backup bucket stays in Sydney)
aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}" \
  "s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}" \
  --storage-class STANDARD_IA \
  --region ap-southeast-2

echo "[$(date)] Uploaded to s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}"

# Clean up local file
rm -f "${BACKUP_DIR}/${BACKUP_FILE}"

echo "[$(date)] Backup completed successfully!"
