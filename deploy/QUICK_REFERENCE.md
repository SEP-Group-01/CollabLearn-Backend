# 🚀 Quick Deployment Reference Card

## 💻 On Your Local Machine (Windows)

### 1. Configure AWS CLI

```powershell
aws configure
# Enter: Access Key, Secret Key, Region (us-east-1), Format (json)
```

### 2. Build & Push to ECR

```powershell
cd "C:\Users\94779\OneDrive\Desktop\SE Project\5-Org\CollabLearn-Backend"
.\deploy\build-and-push-ecr.ps1 -Region us-east-1
# ☕ Takes 15-30 minutes
```

---

## 🖥️ On EC2 Instance (Ubuntu)

### Initial Setup (One-time)

```bash
# 1. Update & Install Docker
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg lsb-release unzip jq
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo mkdir -p /etc/apt/keyrings
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker ubuntu

# 2. Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# 3. Log out and back in
exit
# Then SSH back in
```

### Clone & Configure

```bash
# Clone repo
git clone https://github.com/SEP-Group-01/CollabLearn-Backend.git
cd CollabLearn-Backend

# Create .env file
cp deploy/.env.template .env
nano .env  # Fill in your values

# Set AWS variables
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-east-1
echo "export AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID" >> ~/.bashrc
echo "export AWS_REGION=$AWS_REGION" >> ~/.bashrc
```

### Deploy Services

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com

# Pull images
docker compose -f docker-compose.prod.yml pull

# Start services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

### Setup Auto-Start

```bash
# Edit service file with your AWS account ID
sudo nano /etc/systemd/system/collablearn.service
# Update AWS_ACCOUNT_ID line

# Or copy and edit
sudo cp deploy/collablearn.service /etc/systemd/system/
sudo nano /etc/systemd/system/collablearn.service

# Enable
sudo systemctl daemon-reload
sudo systemctl enable collablearn
sudo systemctl start collablearn
```

---

## 🔧 Common Commands

### Service Management

```bash
# Start all services
docker compose -f docker-compose.prod.yml up -d

# Stop all services
docker compose -f docker-compose.prod.yml down

# Restart specific service
docker compose -f docker-compose.prod.yml restart api-gateway

# View logs
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs -f api-gateway

# Check status
docker compose -f docker-compose.prod.yml ps
docker ps
```

### Updates & Maintenance

```bash
# Update services (after pushing new images)
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --force-recreate

# Clean up
docker system prune
docker image prune -a

# Check resources
docker stats
free -h
df -h
```

### Troubleshooting

```bash
# Check specific service
docker logs <container-name>
docker exec -it <container-name> sh

# Test services
curl http://localhost:3000/auth/health
docker exec -it redis redis-cli ping
docker exec -it kafka kafka-topics --bootstrap-server localhost:9092 --list

# Restart everything
sudo systemctl restart collablearn
```

---

## 🌐 Access Points

- **API Gateway**: http://your-ec2-ip:3000
- **Health Check**: http://your-ec2-ip:3000/auth/health
- **SSH**: `ssh -i your-key.pem ubuntu@your-ec2-ip`

---

## 📊 Expected Memory Usage (t3.small = 2GB)

| Service       | Memory Limit |
| ------------- | ------------ |
| Kafka         | 512 MB       |
| Zookeeper     | 256 MB       |
| Redis         | 192 MB       |
| API Gateway   | 256 MB       |
| Auth Service  | 256 MB       |
| Workspaces    | 256 MB       |
| Resources     | 256 MB       |
| Doc Editor    | 256 MB       |
| Query Service | 256 MB       |
| Study Plan    | 256 MB       |
| **Total**     | **~2.5 GB**  |

⚠️ **Note**: t3.small (2GB) will be tight. Monitor with `docker stats` and `free -h`.

---

## 💰 Cost Tracking

- **t3.small**: $0.0208/hour = ~$15/month
- **Your $100 credit**: ~6.6 months runtime
- **Tip**: Stop instance when not in use to save credits

```bash
# Stop instance (from local machine)
aws ec2 stop-instances --instance-ids i-xxxxxxxxx

# Start instance
aws ec2 start-instances --instance-ids i-xxxxxxxxx
```

---

## ⚠️ Before Launch Checklist

- [ ] EC2 t3.small launched with Ubuntu 22.04 LTS
- [ ] Security group: SSH (22), HTTP (80), HTTPS (443), API (3000)
- [ ] IAM role attached with ECR read permissions
- [ ] Docker & Docker Compose installed
- [ ] AWS CLI configured
- [ ] .env file filled with all secrets
- [ ] Images pushed to ECR
- [ ] Can pull images from ECR on EC2

---

**📖 Full Guide**: See `deploy/DEPLOYMENT_GUIDE.md` for detailed instructions
