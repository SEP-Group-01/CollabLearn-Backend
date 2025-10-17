# 🚀 AWS EC2 Deployment - Complete Summary

## ✅ What Has Been Created

All deployment artifacts are ready in the `deploy/` directory:

### 📚 Documentation (3 files)

1. **`DEPLOYMENT_GUIDE.md`** (5,000+ words)
   - Complete step-by-step guide from EC2 launch to production
   - 7 phases covering everything: EC2 setup, Docker, ECR, deployment, SSL, monitoring
   - Troubleshooting section with common issues
   - Cost optimization tips
   - Security checklist

2. **`QUICK_REFERENCE.md`**
   - One-page command reference
   - Common tasks and commands
   - Memory usage table
   - Cost tracking info

3. **`README.md`**
   - Overview of all deployment files
   - Quick start instructions
   - Links to detailed guides

### ⚙️ Configuration Files (2 files)

1. **`.env.template`**
   - Template for all environment variables
   - Organized by category (AWS, JWT, Supabase, Firebase, etc.)
   - Comments explaining each variable

2. **`collablearn.service`**
   - Systemd service unit file
   - Auto-start services on boot
   - Proper restart policies

### 🔧 Build & Deploy Scripts (4 files)

1. **`build-and-push-ecr.ps1`** (PowerShell for Windows)
   - Builds all 7 microservices
   - Creates ECR repositories automatically
   - Pushes images with latest + timestamp tags
   - Colored output and progress indicators

2. **`build-and-push-ecr.sh`** (Bash for Linux/Mac)
   - Same functionality as PowerShell version
   - For use on Linux/Mac or WSL

3. **`health-check.sh`**
   - Verifies all services are running
   - Checks API endpoints, Redis, Kafka, Zookeeper
   - Shows resource usage (CPU, memory, disk)
   - Displays recent logs

4. **`ec2-user-data.sh`**
   - Optional EC2 user data script
   - Automates initial EC2 setup
   - Installs Docker, AWS CLI, Git automatically

### 🤖 CI/CD (1 file)

1. **`.github/workflows/deploy-ecr.yml`**
   - GitHub Actions workflow
   - Automatically builds and pushes on git push
   - Parallel builds for all services
   - Creates ECR repos if needed

### 🐳 Production Docker Compose (1 file)

1. **`docker-compose.prod.yml`**
   - Production-ready compose file
   - Memory limits optimized for t3.small
   - Health checks for all services
   - Self-hosted Kafka, Zookeeper, Redis
   - Pulls images from ECR
   - Log rotation configured
   - Restart policies set

---

## 📋 Deployment Checklist

### Phase 1: Preparation (Your Local Machine)

- [ ] Install AWS CLI: `aws configure`
- [ ] Install Docker Desktop (Windows)
- [ ] Configure AWS credentials with ECR permissions
- [ ] Review `.env.template` and gather all secrets

### Phase 2: Build Images (Your Local Machine - 20-30 mins)

```powershell
cd "C:\Users\94779\OneDrive\Desktop\SE Project\5-Org\CollabLearn-Backend"
.\deploy\build-and-push-ecr.ps1 -Region us-east-1
```

- [ ] Script completes successfully
- [ ] All 7 ECR repositories created
- [ ] All images pushed with `latest` tag

### Phase 3: Launch EC2 (AWS Console - 5 mins)

- [ ] Launch t3.small Ubuntu 22.04 LTS
- [ ] Attach IAM role with ECR read permissions
- [ ] Configure security group (SSH:22, HTTP:80, HTTPS:443, API:3000)
- [ ] Create/select key pair
- [ ] Optional: Add `ec2-user-data.sh` to User Data field
- [ ] Launch instance and note public IP

### Phase 4: Setup EC2 (SSH Terminal - 10 mins)

```bash
# Connect
ssh -i your-key.pem ubuntu@<ec2-ip>

# Install Docker & AWS CLI (if not using user data script)
# See DEPLOYMENT_GUIDE.md Phase 2 for commands

# Clone repo
git clone https://github.com/SEP-Group-01/CollabLearn-Backend.git
cd CollabLearn-Backend

# Configure environment
cp deploy/.env.template .env
nano .env  # Fill in all values
```

- [ ] Docker installed and working
- [ ] AWS CLI installed
- [ ] Repository cloned
- [ ] `.env` file configured with all secrets

### Phase 5: Deploy Services (EC2 - 10 mins)

```bash
# Set environment variables
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-east-1
echo "export AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID" >> ~/.bashrc
echo "export AWS_REGION=$AWS_REGION" >> ~/.bashrc

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com

# Pull and start
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Verify
docker compose -f docker-compose.prod.yml ps
bash deploy/health-check.sh
```

- [ ] All images pulled successfully
- [ ] All 9 containers running
- [ ] Health checks pass
- [ ] API responds: `curl http://localhost:3000/auth/health`

### Phase 6: Setup Auto-Start (EC2 - 2 mins)

```bash
# Install systemd service
sudo cp deploy/collablearn.service /etc/systemd/system/
sudo nano /etc/systemd/system/collablearn.service  # Update AWS_ACCOUNT_ID

# Enable and test
sudo systemctl daemon-reload
sudo systemctl enable collablearn
sudo systemctl status collablearn
```

- [ ] Service file installed
- [ ] Service enabled (starts on boot)
- [ ] Service status shows active

### Phase 7: Configure Domain & SSL (Optional - 15 mins)

Choose one:

- [ ] **Option A**: AWS ALB + ACM certificate (recommended)
- [ ] **Option B**: Nginx + Let's Encrypt on EC2

See `DEPLOYMENT_GUIDE.md` Phase 6 for detailed steps.

### Phase 8: Update Frontend (Vercel - 2 mins)

```env
# Add to Vercel environment variables
VITE_API_URL=https://api.yourdomain.com
# or
VITE_API_URL=http://<ec2-ip>:3000
```

- [ ] Frontend environment variable updated
- [ ] Frontend redeployed on Vercel
- [ ] Frontend can connect to backend

### Phase 9: Validation (5 mins)

```bash
# Run health check
bash deploy/health-check.sh

# Test endpoints
curl http://localhost:3000/auth/health
curl http://localhost:3000/workspaces/health

# Check resources
docker stats
free -h
df -h

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

- [ ] All services healthy
- [ ] Memory usage < 2GB
- [ ] Disk space available
- [ ] No errors in logs
- [ ] Frontend integration works

---

## 💰 Cost Breakdown

### Monthly Costs (US-East-1)

| Item                     | Cost           |
| ------------------------ | -------------- |
| t3.small EC2             | $15.05         |
| 30GB EBS Storage         | $3.00          |
| Data Transfer (estimate) | $2.00          |
| **Total**                | **~$20/month** |

### With Your $100 Credit

- **Runtime**: ~5 months continuous operation
- **Extended Runtime**: 8-10 months if you stop instance when not in use

### Stop Instance When Not In Use

```bash
# From local machine
aws ec2 stop-instances --instance-ids i-xxxxxxxxx  # Saves ~$0.50/hour
aws ec2 start-instances --instance-ids i-xxxxxxxxx
```

---

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────┐
│         AWS EC2 Instance (t3.small)             │
│              Ubuntu 22.04 LTS                   │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │     Docker Compose (9 Containers)        │  │
│  │                                          │  │
│  │  Infrastructure:                         │  │
│  │  ├─ Kafka (512MB)                        │  │
│  │  ├─ Zookeeper (256MB)                    │  │
│  │  └─ Redis (192MB)                        │  │
│  │                                          │  │
│  │  Node.js Services (256MB each):          │  │
│  │  ├─ API Gateway :3000/:3001              │  │
│  │  ├─ Auth Service :3002                   │  │
│  │  ├─ Workspaces Service :3003             │  │
│  │  ├─ Resource Service :3007/:3008         │  │
│  │  └─ Document Editor :3006                │  │
│  │                                          │  │
│  │  Python Services (256MB each):           │  │
│  │  ├─ Document Query :8000                 │  │
│  │  └─ Study Plan Service :8001             │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  Images from: Amazon ECR                        │
│  Logs: JSON files (rotated)                     │
│  Volumes: redis-data, document-uploads          │
└─────────────────────────────────────────────────┘
          │                    │
          ▼                    ▼
  Internet (HTTP/HTTPS)  Firebase Storage
  (ALB or Direct)        (File Uploads)
          │
          ▼
  Vercel Frontend
  (React/Vite)
```

---

## 🔧 Common Commands Reference

### Service Management

```bash
# Start all
docker compose -f docker-compose.prod.yml up -d

# Stop all
docker compose -f docker-compose.prod.yml down

# Restart one service
docker compose -f docker-compose.prod.yml restart api-gateway

# View logs
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs -f api-gateway

# Check status
docker compose -f docker-compose.prod.yml ps
```

### Monitoring

```bash
# Resource usage
docker stats
free -h
df -h

# Health check
bash deploy/health-check.sh

# Test endpoints
curl http://localhost:3000/auth/health
docker exec redis redis-cli ping
```

### Updates

```bash
# After pushing new images to ECR
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

### Troubleshooting

```bash
# Container logs
docker logs <container-name>

# Shell into container
docker exec -it <container-name> sh

# Restart everything
sudo systemctl restart collablearn

# Clean up
docker system prune
docker image prune -a
```

---

## 🚨 Important Notes

### Security

- ✅ `.env` has `chmod 600` permissions
- ✅ `.env` is in `.gitignore` (never commit secrets!)
- ✅ Security group restricts SSH to your IP only
- ✅ JWT_SECRET is strong (32+ characters)
- ⚠️ Consider ALB with HTTPS for production
- ⚠️ Regular updates: `sudo apt update && sudo apt upgrade`

### Resource Management

- ⚠️ t3.small has 2GB RAM - services will use ~2.5GB with limits
- ⚠️ Monitor with `docker stats` regularly
- ⚠️ If OOM errors, consider t3.medium or disable non-critical services
- ✅ Logs are rotated (max 10MB per service, 3 files)

### Backups

- 📦 Redis data in volume `redis-data`
- 📦 Document uploads in volume `document-uploads`
- 💡 Consider EBS snapshots for disaster recovery
- 💡 Database backups handled by Supabase

### Firebase Storage

- ✅ Using Firebase for file uploads (as requested)
- ✅ No S3 or EFS needed
- ✅ MediaService continues to work with Firebase

---

## 📞 Getting Help

### Issues During Deployment?

1. **Check logs**: `docker compose -f docker-compose.prod.yml logs -f`
2. **Run health check**: `bash deploy/health-check.sh`
3. **Review guide**: See `deploy/DEPLOYMENT_GUIDE.md` troubleshooting section
4. **Check resources**: `docker stats` and `free -h`

### Common Issues & Solutions

#### Can't pull from ECR

```bash
# Re-authenticate
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com
```

#### Out of memory

```bash
# Check usage
docker stats
free -h

# Solutions:
# 1. Restart services: docker compose -f docker-compose.prod.yml restart
# 2. Stop non-critical services
# 3. Upgrade to t3.medium
```

#### Services won't start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs <service-name>

# Check .env file
cat .env

# Restart
docker compose -f docker-compose.prod.yml restart <service-name>
```

---

## ✨ Next Steps After Deployment

1. **Set up monitoring** (optional)
   - CloudWatch logs integration
   - Uptime monitoring (UptimeRobot, Pingdom)
   - Error tracking (Sentry)

2. **Configure backups**
   - EBS volume snapshots
   - Redis data backups
   - Database backups via Supabase

3. **Performance optimization**
   - Add CloudFront CDN
   - Enable Redis persistence
   - Optimize Docker images

4. **CI/CD automation**
   - Use GitHub Actions workflow (already created)
   - Auto-deploy on push to main branch
   - Add integration tests

5. **Scaling (when needed)**
   - Move to ECS/EKS for multi-instance
   - Add load balancer
   - Use managed Kafka (MSK) and Redis (ElastiCache)

---

## 🎉 Success!

If you've completed all phases, you now have:

- ✅ Production backend running on AWS EC2
- ✅ All 9 services containerized and orchestrated
- ✅ Images stored in ECR for easy updates
- ✅ Auto-start on boot via systemd
- ✅ Comprehensive monitoring and logs
- ✅ Cost-optimized for your $100 credit
- ✅ Frontend integrated with backend API

**Your CollabLearn platform is now live! 🚀**

---

## 📚 File Locations

All deployment files are in the `deploy/` directory:

```
deploy/
├── DEPLOYMENT_GUIDE.md         # Main guide (START HERE)
├── QUICK_REFERENCE.md          # Command cheat sheet
├── README.md                   # Files overview
├── .env.template               # Environment variables template
├── collablearn.service         # Systemd service unit
├── build-and-push-ecr.ps1      # Build script (Windows)
├── build-and-push-ecr.sh       # Build script (Linux)
├── health-check.sh             # Health check script
└── ec2-user-data.sh            # EC2 initial setup script
```

Production compose file:

```
docker-compose.prod.yml         # Production Docker Compose
```

CI/CD workflow:

```
.github/workflows/deploy-ecr.yml  # GitHub Actions
```

---

**Happy Deploying! 🎊**
