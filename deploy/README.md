# CollabLearn Backend Deployment Scripts

This directory contains all the scripts and configuration files needed to deploy CollabLearn backend to AWS EC2.

## 📁 Files Overview

### Documentation

- **`DEPLOYMENT_GUIDE.md`** - Complete step-by-step deployment guide (START HERE!)
- **`QUICK_REFERENCE.md`** - Quick command reference card for common tasks
- **`README.md`** - This file

### Configuration Files

- **`.env.template`** - Template for environment variables (copy to `.env` and fill in values)
- **`collablearn.service`** - Systemd service unit for auto-start on boot

### Build & Deploy Scripts

- **`build-and-push-ecr.sh`** - Bash script to build and push images to ECR (Linux/Mac)
- **`build-and-push-ecr.ps1`** - PowerShell script to build and push images to ECR (Windows)
- **`health-check.sh`** - Health check script to verify all services are running

## 🚀 Quick Start

### For Windows Users

1. **Build and push images** (on your local Windows machine):

   ```powershell
   cd CollabLearn-Backend
   .\deploy\build-and-push-ecr.ps1 -Region us-east-1
   ```

2. **On EC2** (after SSH):

   ```bash
   # Clone repo
   git clone https://github.com/SEP-Group-01/CollabLearn-Backend.git
   cd CollabLearn-Backend

   # Configure environment
   cp deploy/.env.template .env
   nano .env  # Fill in your values

   # Set AWS variables
   export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
   export AWS_REGION=us-east-1

   # Login and deploy
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com
   docker compose -f docker-compose.prod.yml pull
   docker compose -f docker-compose.prod.yml up -d
   ```

3. **Verify deployment**:
   ```bash
   bash deploy/health-check.sh
   ```

## 📖 Detailed Instructions

See **`DEPLOYMENT_GUIDE.md`** for:

- EC2 instance setup
- Docker installation
- Security configuration
- Domain & SSL setup
- Troubleshooting tips
- Cost optimization

## 🔧 Common Tasks

### Check Service Health

```bash
bash deploy/health-check.sh
```

### View Logs

```bash
docker compose -f docker-compose.prod.yml logs -f
```

### Update Services

```bash
# On local machine: rebuild and push
.\deploy\build-and-push-ecr.ps1 -Region us-east-1

# On EC2: pull and restart
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

### Monitor Resources

```bash
docker stats
free -h
df -h
```

## 💰 Cost Information

- **t3.small**: ~$15/month
- **Storage (30GB)**: ~$3/month
- **Total**: ~$18/month
- **With $100 credit**: ~5.5 months

## 🆘 Support

If you encounter issues:

1. Check `DEPLOYMENT_GUIDE.md` troubleshooting section
2. Run `bash deploy/health-check.sh`
3. Check logs: `docker compose -f docker-compose.prod.yml logs -f`
4. Review security groups and IAM permissions

## 📊 Architecture

All services run in Docker containers on a single EC2 instance:

- **Infrastructure**: Kafka, Zookeeper, Redis
- **Node.js Services**: API Gateway, Auth, Workspaces, Resources, Document Editor
- **Python Services**: Document Query, Study Plan

Total: 9 containers with resource limits optimized for t3.small (2GB RAM)

## ⚠️ Important Notes

1. **Never commit `.env`** - It contains secrets
2. **t3.small minimum** - t3.micro is too small for all services
3. **Monitor memory** - Use `docker stats` regularly
4. **Secure SSH** - Only allow your IP in security group
5. **Use HTTPS** - Set up ALB or Nginx with SSL for production

---

**Ready to deploy?** Start with `DEPLOYMENT_GUIDE.md`! 🚀
