#!/bin/bash

set -e

echo "🚀 Deploying Signature Shades to Production..."

# Load environment variables
if [ ! -f .env.production ]; then
    echo "❌ Error: .env.production file not found"
    echo "Please create .env.production from .env.production.example"
    exit 1
fi

source .env.production

# Pull latest code
echo "📥 Pulling latest code from GitHub..."
git pull origin main

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down

# Remove old images (optional - uncomment if needed)
# echo "🗑️  Removing old images..."
# docker image prune -f

# Build new images
echo "🔨 Building new images..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Start services
echo "▶️  Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 15

# Run database migrations
echo "🔄 Running database migrations..."
docker exec signatureshades-api-prod npx prisma migrate deploy

# Health check
echo "🏥 Performing health check..."
sleep 5

if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ Health check passed!"
else
    echo "⚠️  Warning: Health check failed"
    echo "Check logs with: docker-compose -f docker-compose.prod.yml logs"
fi

echo ""
echo "✅ Deployment complete!"
echo "🌐 Application is running"
echo ""
echo "Useful commands:"
echo "  View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "  Stop services: docker-compose -f docker-compose.prod.yml down"
echo "  Restart: docker-compose -f docker-compose.prod.yml restart"

# Show recent logs
echo ""
echo "📋 Recent logs:"
docker-compose -f docker-compose.prod.yml logs --tail=50
