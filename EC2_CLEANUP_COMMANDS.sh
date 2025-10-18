#!/bin/bash
# EC2 Disk Cleanup Commands
# Run these on your EC2 instance to free up disk space

echo "=== Current Disk Usage ==="
df -h

echo ""
echo "=== Cleaning Docker System ==="
# Remove all stopped containers
docker container prune -f

# Remove all unused images
docker image prune -a -f

# Remove all unused volumes
docker volume prune -f

# Remove all unused networks
docker network prune -f

# Complete system prune (CAREFUL - removes everything not in use)
docker system prune -a -f --volumes

echo ""
echo "=== Cleaning Package Cache ==="
# Clean apt cache
sudo apt-get clean
sudo apt-get autoclean
sudo apt-get autoremove -y

echo ""
echo "=== Cleaning Journal Logs ==="
# Clean old journal logs (keep last 3 days)
sudo journalctl --vacuum-time=3d

echo ""
echo "=== Disk Usage After Cleanup ==="
df -h

echo ""
echo "=== Docker Images After Cleanup ==="
docker images

echo ""
echo "✅ Cleanup Complete!"
echo "Now you can pull fresh images with: docker compose -f docker-compose.prod.yml pull"
