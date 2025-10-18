# Deploy to EC2 - Manual Steps

## After GitHub Actions Completes Successfully

### 1. SSH to EC2

```powershell
ssh -i "$env:USERPROFILE\Downloads\CollabLearn-Key-Pair.pem" ubuntu@13.238.155.110
```

### 2. Navigate to project directory

```bash
cd ~/CollabLearn-Backend
```

### 3. Login to ECR

```bash
aws ecr get-login-password --region ap-southeast-2 | \
  docker login --username AWS --password-stdin \
  314431973177.dkr.ecr.ap-southeast-2.amazonaws.com
```

### 4. Pull latest images

```bash
docker compose -f docker-compose.prod.yml pull
```

### 5. Restart all services with new images

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

### 6. Verify services are running

```bash
docker ps
```

### 7. Check logs if any service fails

```bash
docker logs api-gateway --tail 50
docker logs auth-service --tail 50
# etc...
```

### 8. Test API endpoints

```bash
curl https://collablearn.duckdns.org/health
curl https://collablearn.duckdns.org/api/workspaces/top?limit=10
```

---

## Quick Deploy Script (Copy-paste all at once)

```bash
cd ~/CollabLearn-Backend && \
aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin 314431973177.dkr.ecr.ap-southeast-2.amazonaws.com && \
docker compose -f docker-compose.prod.yml pull && \
docker compose -f docker-compose.prod.yml up -d --force-recreate && \
echo "✅ Deployment complete!" && \
docker ps
```

---

## Troubleshooting

### If CORS still fails:

1. Check if FRONTEND_URL is set in .env on EC2
2. Restart api-gateway specifically:
   ```bash
   docker restart api-gateway
   docker logs api-gateway -f
   ```

### If services won't start:

1. Check logs: `docker logs <container-name>`
2. Check disk space: `df -h`
3. Check memory: `free -h`
4. Restart Docker: `sudo systemctl restart docker`

---

## CORS Configuration

Your API Gateway already has CORS configured for:

- ✅ All Vercel preview deployments (regex pattern)
- ✅ Your specific Vercel URL
- ✅ localhost for development

If CORS still fails, the CORS config is correct - it's likely a caching issue or the old container is still running.
