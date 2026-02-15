#!/bin/bash
# EC2 User Data Script for Signature Shades
# Runs on first boot to set up Docker and dependencies

set -e

# Update system
apt-get update
apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# Add ubuntu user to docker group
usermod -aG docker ubuntu

# Install Docker Compose V2
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Install Git
apt-get install -y git

# Install AWS CLI (for S3 backups)
apt-get install -y awscli

# Install Certbot for SSL
apt-get install -y certbot

# Create application directory
mkdir -p /opt/signatureshades
chown ubuntu:ubuntu /opt/signatureshades

# Enable Docker service
systemctl enable docker
systemctl start docker

# Create a swap file (recommended for t3.micro with 1GB RAM)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Configure log rotation
cat > /etc/logrotate.d/docker <<EOF
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    missingok
    delaycompress
    copytruncate
}
EOF

# Set up automated backups cron job (runs daily at 2 AM)
cat > /etc/cron.d/signatureshades-backup <<EOF
0 2 * * * ubuntu /opt/signatureshades/scripts/backup-db.sh >> /var/log/backup.log 2>&1
EOF

echo "EC2 instance setup complete!"
