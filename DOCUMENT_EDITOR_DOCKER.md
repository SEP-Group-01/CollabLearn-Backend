# Document Editor Service Dockerization Summary

## ✅ Changes Made

### 1. Created Dockerfile (`apps/document-editor-service/Dockerfile`)

- **Base Image**: `node:20-slim` for builder, `node:20-alpine` for production
- **Multi-stage build**: Optimized for smaller final image
- **Port**: Exposes 3006 (TCP microservice)
- **Security**: Runs as non-root user
- **Health Check**: TCP connection check on port 3006

### 2. Created .dockerignore (`apps/document-editor-service/.dockerignore`)

- Excludes unnecessary files (node_modules, tests, logs, etc.)
- Reduces build context size
- Keeps Docker image lean

### 3. Updated docker-compose.yml

Added `document-editor-service` with:

- Port mapping: `3006:3006`
- **Redis Configuration**:
  - `REDIS_HOST=redis` (Docker service name, not localhost)
  - `REDIS_PORT=6379`
  - `REDIS_PASSWORD` (optional, from env)
  - `REDIS_DB=0` (default database)
- Environment variables for Supabase and Firebase
- Dependencies: Waits for Redis to be healthy before starting
- Health check, restart policy, and network configuration

## 🔧 Redis Connection Fix

### The Issue

The `RedisService` was using `localhost` as the default Redis host, which doesn't work in Docker containers.

### The Solution

✅ **Already handled correctly!** The `RedisService` uses:

```typescript
const redisConfig = {
  host: this.configService.get('REDIS_HOST', 'localhost'),
  port: this.configService.get('REDIS_PORT', 6379),
  password: this.configService.get('REDIS_PASSWORD'),
  db: this.configService.get('REDIS_DB', 0),
  // ...
};
```

This means:

- In Docker: Uses `REDIS_HOST=redis` from docker-compose.yml → connects to Redis container
- In local dev: Uses `localhost` as fallback → connects to local Redis

## 🚀 How to Use

### Build and start the service:

```powershell
docker-compose up -d --build document-editor-service
```

### Start all services:

```powershell
docker-compose up -d --build
```

### View logs:

```powershell
docker-compose logs -f document-editor-service
```

### Check service health:

```powershell
docker-compose ps
```

## 📋 Service Details

- **Service Name**: document-editor-service
- **TCP Port**: 3006
- **Dependencies**: Redis (waits for health check)
- **Network**: collab-network
- **Restart Policy**: unless-stopped

## 🔗 Redis Connection in Docker

The document-editor-service connects to Redis using:

- **Hostname**: `redis` (Docker service name)
- **Port**: `6379`
- **Network**: `collab-network` (internal Docker network)

This configuration ensures seamless communication between containers without exposing Redis ports to the host unnecessarily.

## ⚠️ Important Notes

1. **No Code Changes Needed**: The existing `RedisService` is already properly configured to read from environment variables
2. **Environment Variables**: Make sure your `.env` file has all required variables (Supabase, Firebase, etc.)
3. **Redis Dependency**: The service will wait for Redis to be healthy before starting
4. **Network Isolation**: All services communicate through the `collab-network` Docker network
