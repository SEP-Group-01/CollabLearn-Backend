#!/bin/bash
# EC2 User Data Script for CollabLearn Backend
# This script runs automatically when the EC2 instance first launches
# Copy this to "User data" field in EC2 Advanced Details during launch

set -e

# Update system
apt-get update
apt-get upgrade -y

# Install prerequisites
apt-get install -y ca-certificates curl gnupg lsb-release unzip jq git

# Install Docker
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add ubuntu user to docker group
usermod -aG docker ubuntu

# Install AWS CLI v2
cd /tmp
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install
rm -rf aws awscliv2.zip

# Configure git (optional - adjust with your details)
sudo -u ubuntu git config --global user.name "CollabLearn Deploy"
sudo -u ubuntu git config --global user.email "deploy@collablearn.com"

# Create application directory
mkdir -p /home/ubuntu/CollabLearn-Backend
chown ubuntu:ubuntu /home/ubuntu/CollabLearn-Backend

# Clone repository (if you want to auto-clone - otherwise do it manually)
# sudo -u ubuntu git clone https://github.com/SEP-Group-01/CollabLearn-Backend.git /home/ubuntu/CollabLearn-Backend

# Create a setup status file
cat > /home/ubuntu/setup-status.txt << 'EOF'
✅ EC2 Setup Complete!

Next steps:
1. SSH into this instance
2. Clone the repository:
   git clone https://github.com/SEP-Group-01/CollabLearn-Backend.git
   cd CollabLearn-Backend

3. Create .env file:
   cp deploy/.env.template .env
   nano .env

4. Set AWS variables:
   export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
   export AWS_REGION=us-east-1

5. Login to ECR and deploy:
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com
   docker compose -f docker-compose.prod.yml pull
   docker compose -f docker-compose.prod.yml up -d

6. Setup systemd service:
   sudo cp deploy/collablearn.service /etc/systemd/system/
   sudo nano /etc/systemd/system/collablearn.service  # Update AWS_ACCOUNT_ID
   sudo systemctl daemon-reload
   sudo systemctl enable collablearn
   sudo systemctl start collablearn

7. Run health check:
   bash deploy/health-check.sh

See deploy/DEPLOYMENT_GUIDE.md for detailed instructions!
EOF

chown ubuntu:ubuntu /home/ubuntu/setup-status.txt

# Log completion
echo "EC2 setup completed at $(date)" >> /var/log/user-data.log
echo "Docker version: $(docker --version)" >> /var/log/user-data.log
echo "AWS CLI version: $(aws --version)" >> /var/log/user-data.log

# Reboot to ensure all changes take effect (optional)
# reboot
