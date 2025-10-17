# CollabLearn Backend - AWS EC2 Deployment Guide

## 📋 Overview

This guide walks you through deploying the entire CollabLearn backend to a single AWS EC2 instance using Docker Compose. All services (Kafka, Zookeeper, Redis, and microservices) run in containers on one EC2 instance.

**Cost estimate**: ~$15/month for t3.small with your $100 credit = ~6 months runtime

---

## 🎯 Prerequisites

- AWS Account with $100 free credit
- GitHub account (repository already exists)
- Domain name (optional, for custom domain)
- Local machine with Docker and AWS CLI installed
- Firebase project (for file storage)
- Supabase project (for database)

---

## 📊 Resource Planning

### Recommended Instance: **t3.small**

- **vCPU**: 2
- **RAM**: 2 GB
- **Storage**: 30 GB
- **Cost**: ~$0.0208/hour (~$15/month)

### Why not t3.micro?

t3.micro (1 vCPU, 1 GB RAM) is **too small** for:

- Kafka (requires 256-512MB)
- Zookeeper (128-256MB)
- Redis (128-192MB)
- 5 NestJS services (256MB each = 1.28GB)
- 2 Python services (256MB each = 512MB)

**Total memory needed**: ~2.5GB (t3.small is minimum)

### Alternative if budget is very tight:

- Use **t3.small** and shut down instance when not in use
- Or deploy only essential services and comment out others

---

## 🚀 Step-by-Step Deployment

### Phase 1: Launch EC2 Instance

#### 1.1 Launch Instance via AWS Console

1. **Go to EC2 Dashboard** → Click "Launch Instance"

2. **Configure Instance**:
   - **Name**: `collablearn-backend-prod`
   - **AMI**: Ubuntu Server 22.04 LTS (64-bit x86)
   - **Instance Type**: `t3.small`
   - **Key Pair**: Create new or select existing (download .pem file)
3. **Network Settings**:
   - **VPC**: Default VPC (or your custom VPC)
   - **Auto-assign Public IP**: Enable
   - **Security Group**: Create new with these rules:
     - SSH (22) from Your IP only
     - HTTP (80) from 0.0.0.0/0
     - HTTPS (443) from 0.0.0.0/0
     - Custom TCP (3000) from 0.0.0.0/0 (API Gateway)
4. **Storage**:
   - **Size**: 30 GB gp3
5. **Advanced Details**:
   - **IAM Instance Profile**: Create/select role with:
     - `AmazonEC2ContainerRegistryReadOnly` (to pull from ECR)
     - Or create custom policy with ECR read permissions

6. **Launch Instance**

#### 1.2 Connect to Instance

```bash
# Set permissions on your key
chmod 400 your-key.pem

# SSH into instance
ssh -i your-key.pem ubuntu@<your-ec2-public-ip>
```

---

### Phase 2: Prepare EC2 Host

#### 2.1 Update System & Install Docker

```bash
# Update package list
sudo apt update && sudo apt upgrade -y

# Install prerequisites
sudo apt install -y ca-certificates curl gnupg lsb-release unzip jq

# Add Docker GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add ubuntu user to docker group
sudo usermod -aG docker ubuntu

# Verify installation
docker --version
docker compose version
```

#### 2.2 Install AWS CLI v2

```bash
# Download AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Verify
aws --version
```

#### 2.3 Configure AWS CLI (if needed)

If your EC2 doesn't have an IAM role attached, configure credentials:

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter region: us-east-1
# Enter output format: json
```

#### 2.4 Log out and back in

```bash
exit
# SSH back in for docker group to take effect
ssh -i your-key.pem ubuntu@<your-ec2-public-ip>
```

---

### Phase 3: Build & Push Docker Images to ECR

**Do this on your LOCAL machine (Windows with PowerShell)**

#### 3.1 Configure AWS CLI Locally

```powershell
aws configure
# Enter your credentials
```

#### 3.2 Navigate to Your Repo

```powershell
cd "C:\Users\94779\OneDrive\Desktop\SE Project\5-Org\CollabLearn-Backend"
```

#### 3.3 Run Build & Push Script

```powershell
# Make sure Docker Desktop is running

# Run the PowerShell script
.\deploy\build-and-push-ecr.ps1 -Region us-east-1

# This will:
# - Create ECR repositories for each service
# - Build all Docker images
# - Push images to ECR with 'latest' tag and timestamp tag
# - Takes 15-30 minutes depending on your internet speed
```

**Note**: If you get errors, ensure:

- Docker Desktop is running
- You're in the repo root directory
- AWS credentials are configured
- You have permissions to create ECR repos

---

### Phase 4: Deploy on EC2

#### 4.1 Clone Repository on EC2

```bash
# On EC2
cd ~
git clone https://github.com/SEP-Group-01/CollabLearn-Backend.git
cd CollabLearn-Backend
```

#### 4.2 Create .env File

```bash
# Copy template
cp deploy/.env.template .env

# Edit with your values
nano .env
```

Fill in all values:

- AWS credentials (account ID, region)
- Frontend URL (your Vercel URL)
- JWT secret (generate a random 32+ character string)
- Supabase credentials
- Firebase credentials (from Firebase Console → Project Settings → Service Accounts)
- Google OAuth (if using)

**Tips**:

- Generate JWT secret: `openssl rand -base64 32`
- For `FIREBASE_PRIVATE_KEY`, keep the quotes and `\n` characters
- Use `Ctrl+X`, `Y`, `Enter` to save in nano

#### 4.3 Set Environment Variables for Docker Compose

```bash
# Get your AWS account ID
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-east-1

# Add to .bashrc for persistence
echo "export AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID" >> ~/.bashrc
echo "export AWS_REGION=$AWS_REGION" >> ~/.bashrc
```

#### 4.4 Login to ECR

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com
```

#### 4.5 Pull Images

```bash
docker compose -f docker-compose.prod.yml pull
```

#### 4.6 Start Services

```bash
# Start all services in detached mode
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker compose -f docker-compose.prod.yml logs -f api-gateway
```

#### 4.7 Verify Services are Running

```bash
# Check all containers
docker ps

# Test API Gateway
curl http://localhost:3000/auth/health

# Test Redis
docker exec -it redis redis-cli ping

# Check Kafka topics
docker exec -it kafka kafka-topics --bootstrap-server localhost:9092 --list
```

---

### Phase 5: Configure Auto-Start with Systemd

#### 5.1 Install Systemd Service

```bash
# Copy service file
sudo cp deploy/collablearn.service /etc/systemd/system/

# Edit to set your AWS account ID
sudo nano /etc/systemd/system/collablearn.service
# Update the AWS_ACCOUNT_ID line with your actual account ID

# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable collablearn

# Check status
sudo systemctl status collablearn
```

#### 5.2 Test Systemd Service

```bash
# Stop current containers
docker compose -f docker-compose.prod.yml down

# Start via systemd
sudo systemctl start collablearn

# Check status
sudo systemctl status collablearn

# View logs
sudo journalctl -u collablearn -f
```

---

### Phase 6: Configure Domain & SSL (Optional but Recommended)

#### Option A: Use AWS Application Load Balancer (Recommended)

1. **Create Target Group**:
   - Target type: Instance
   - Protocol: HTTP, Port: 3000
   - Health check path: `/auth/health`
   - Register your EC2 instance

2. **Create Application Load Balancer**:
   - Scheme: Internet-facing
   - Listeners: HTTP (80) and HTTPS (443)
   - Add target group created above

3. **Request ACM Certificate**:
   - AWS Certificate Manager → Request certificate
   - Add your domain name
   - Validate via DNS (add CNAME to your domain)

4. **Configure ALB Listener**:
   - HTTP (80): Redirect to HTTPS
   - HTTPS (443): Forward to target group with ACM certificate

5. **Update DNS**:
   - Add A record: `api.yourdomain.com` → ALB DNS name (use ALIAS if Route53)

6. **Update Security Group**:
   - EC2: Allow port 3000 only from ALB security group
   - ALB: Allow 80/443 from 0.0.0.0/0

#### Option B: Use Nginx on EC2 with Let's Encrypt

```bash
# Install Nginx
sudo apt install -y nginx certbot python3-certbot-nginx

# Configure Nginx
sudo nano /etc/nginx/sites-available/collablearn

# Add this configuration:
# server {
#     listen 80;
#     server_name api.yourdomain.com;
#
#     location / {
#         proxy_pass http://localhost:3000;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_cache_bypass $http_upgrade;
#     }
# }

# Enable site
sudo ln -s /etc/nginx/sites-available/collablearn /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com
```

---

### Phase 7: Update Frontend Environment

Update your Vercel deployment environment variables:

```env
VITE_API_URL=https://api.yourdomain.com
# or
VITE_API_URL=http://<your-ec2-ip>:3000
```

Redeploy frontend on Vercel.

---

## 🔍 Monitoring & Maintenance

### View Container Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f api-gateway

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100
```

### Check Resource Usage

```bash
# Container stats
docker stats

# System resources
htop  # (install: sudo apt install htop)

# Disk usage
df -h
docker system df
```

### Restart Services

```bash
# Restart all
sudo systemctl restart collablearn

# Restart specific service
docker compose -f docker-compose.prod.yml restart api-gateway

# Recreate containers (after image update)
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

### Update Services (Deploy New Version)

```bash
# On your local machine, rebuild and push:
.\deploy\build-and-push-ecr.ps1 -Region us-east-1

# On EC2:
cd ~/CollabLearn-Backend
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

### Clean Up Resources

```bash
# Remove stopped containers
docker system prune

# Remove unused images
docker image prune -a

# Free up disk space
sudo apt autoremove
sudo apt clean
```

---

## 🚨 Troubleshooting

### Services Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs

# Check container status
docker ps -a

# Restart specific service
docker compose -f docker-compose.prod.yml restart <service-name>
```

### Out of Memory Errors

```bash
# Check memory usage
free -h
docker stats

# Solutions:
# 1. Reduce memory limits in docker-compose.prod.yml
# 2. Disable non-essential services temporarily
# 3. Upgrade to t3.medium ($30/month)
```

### Kafka Connection Issues

```bash
# Check if Kafka is running
docker compose -f docker-compose.prod.yml ps kafka

# Check Kafka logs
docker compose -f docker-compose.prod.yml logs kafka

# Test Kafka connection
docker exec -it kafka kafka-broker-api-versions --bootstrap-server localhost:9092
```

### Cannot Pull from ECR

```bash
# Re-authenticate
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com

# Check IAM permissions
aws ecr describe-repositories --region us-east-1
```

### Port Already in Use

```bash
# Check what's using the port
sudo lsof -i :3000

# Kill the process
sudo kill -9 <PID>
```

---

## 💰 Cost Optimization

### Reduce Costs:

1. **Stop instance when not in use**:

   ```bash
   # From AWS Console or CLI
   aws ec2 stop-instances --instance-ids i-xxxxx
   ```

2. **Use Reserved Instances** (if running 24/7 for months)

3. **Enable detailed monitoring** to track usage

4. **Set up billing alerts**:
   - AWS Console → Billing → Budgets
   - Set alert at $50, $75, $90

5. **Disable unused services** in docker-compose.prod.yml

---

## 📝 Security Checklist

- [ ] EC2 security group allows SSH only from your IP
- [ ] API Gateway is behind HTTPS (ALB with ACM or Let's Encrypt)
- [ ] `.env` file has secure permissions (`chmod 600 .env`)
- [ ] `.env` is in `.gitignore` (never commit secrets)
- [ ] JWT_SECRET is strong random string (32+ characters)
- [ ] Firebase and Supabase credentials are protected
- [ ] Regular security updates: `sudo apt update && sudo apt upgrade`
- [ ] Consider using AWS Secrets Manager for production secrets

---

## 🎉 Success Checklist

- [ ] EC2 instance running and accessible via SSH
- [ ] Docker and Docker Compose installed
- [ ] All container images pushed to ECR
- [ ] `.env` file configured with all secrets
- [ ] All containers running (`docker ps` shows 9 containers)
- [ ] API Gateway responds: `curl http://localhost:3000/auth/health`
- [ ] Kafka and Redis are healthy
- [ ] Systemd service enabled and working
- [ ] Domain pointing to EC2/ALB (if using)
- [ ] SSL certificate installed (if using HTTPS)
- [ ] Frontend can connect to backend API
- [ ] Basic smoke tests pass (login, create workspace, etc.)

---

## 📞 Support & Resources

- **GitHub Repository**: https://github.com/SEP-Group-01/CollabLearn-Backend
- **AWS Documentation**: https://docs.aws.amazon.com/ec2/
- **Docker Documentation**: https://docs.docker.com/
- **NestJS Documentation**: https://docs.nestjs.com/

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                AWS EC2 (t3.small)               │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  Docker Compose Environment              │  │
│  │                                          │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐ │  │
│  │  │ Kafka   │  │Zookeeper│  │  Redis  │ │  │
│  │  └─────────┘  └─────────┘  └─────────┘ │  │
│  │                                          │  │
│  │  ┌──────────────┐  ┌──────────────┐    │  │
│  │  │ API Gateway  │  │ Auth Service │    │  │
│  │  └──────────────┘  └──────────────┘    │  │
│  │                                          │  │
│  │  ┌──────────────┐  ┌──────────────┐    │  │
│  │  │ Workspaces   │  │  Resources   │    │  │
│  │  └──────────────┘  └──────────────┘    │  │
│  │                                          │  │
│  │  ┌──────────────┐  ┌──────────────┐    │  │
│  │  │ Doc Editor   │  │ Query Svc    │    │  │
│  │  └──────────────┘  └──────────────┘    │  │
│  │                                          │  │
│  │  ┌──────────────┐                       │  │
│  │  │Study Plan Svc│                       │  │
│  │  └──────────────┘                       │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  Security Group: 22 (SSH), 80, 443, 3000       │
└─────────────────────────────────────────────────┘
          │                          │
          ▼                          ▼
   ALB (Optional)              Direct Access
    HTTPS://                   HTTP://IP:3000
    api.domain.com
          │
          ▼
    Vercel Frontend
```

---

**Good luck with your deployment! 🚀**
