#!/bin/bash

set -e

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

echo "🔄 Starting backup process..."

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Determine if running in development or production
if docker ps | grep -q "signatureshades-db-prod"; then
    CONTAINER_NAME="signatureshades-db-prod"
    DB_USER="signatureshades_prod"
    DB_NAME="signatureshades_prod"
    ENV_TYPE="prod"
elif docker ps | grep -q "signatureshades-db-local"; then
    CONTAINER_NAME="signatureshades-db-local"
    DB_USER="signatureshades_dev"
    DB_NAME="signatureshades_dev"
    ENV_TYPE="dev"
else
    echo "❌ Error: No database container found running"
    exit 1
fi

echo "📊 Backing up database: $DB_NAME from $CONTAINER_NAME..."

# Backup database
docker exec $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME > $BACKUP_DIR/db_backup_${ENV_TYPE}_$DATE.sql

if [ $? -eq 0 ]; then
    echo "✅ Database backup completed: db_backup_${ENV_TYPE}_$DATE.sql"
else
    echo "❌ Database backup failed"
    exit 1
fi

# Backup uploads folder if it exists
if [ -d "./uploads" ]; then
    echo "📁 Backing up uploads folder..."
    tar -czf $BACKUP_DIR/uploads_backup_${ENV_TYPE}_$DATE.tar.gz ./uploads
    
    if [ $? -eq 0 ]; then
        echo "✅ Uploads backup completed: uploads_backup_${ENV_TYPE}_$DATE.tar.gz"
    else
        echo "⚠️  Uploads backup failed (non-critical)"
    fi
fi

# Backup environment files (production only)
if [ "$ENV_TYPE" == "prod" ] && [ -f ".env.production" ]; then
    echo "🔐 Backing up environment file..."
    cp .env.production $BACKUP_DIR/env_backup_$DATE.txt
    echo "✅ Environment file backed up"
fi

# Display backup summary
echo ""
echo "📦 Backup Summary:"
echo "  Date: $DATE"
echo "  Environment: $ENV_TYPE"
echo "  Location: $BACKUP_DIR"
ls -lh $BACKUP_DIR/*$DATE*

# Keep only last 7 days of backups
echo ""
echo "🗑️  Cleaning up old backups (keeping last 7 days)..."
find $BACKUP_DIR -type f -mtime +7 -delete

REMAINING=$(ls -1 $BACKUP_DIR | wc -l)
echo "📊 Total backups retained: $REMAINING"

echo ""
echo "✅ Backup process completed successfully!"
