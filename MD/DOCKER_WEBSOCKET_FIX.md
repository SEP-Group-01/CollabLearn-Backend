# WebSocket Connection Fix - Docker Deployment Steps

## Problem Identified
The CORS error occurs because:
1. The API Gateway is running in Docker with old configuration
2. The WebSocket connection was using `withCredentials: true` which requires specific CORS origin (not wildcard `*`)

## Solution Applied

### Frontend Changes
✅ Removed `withCredentials: true` from WebSocket configuration
✅ Fixed localStorage key from `accessToken` to `access_token`
✅ Fixed user ID extraction from `user_data`

### Backend Changes Required
The API Gateway's forum.gateway.ts already has the correct CORS configuration:
```typescript
@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
  },
  namespace: '/forum',
})
```

## Steps to Fix

### 1. Rebuild and Restart API Gateway (Required!)

**Option A: Using Docker Compose**
```bash
cd c:\Users\94764\Desktop\c\CollabLearn-Backend

# Rebuild and restart only the API Gateway
docker-compose build api-gateway
docker-compose up -d api-gateway

# Check logs
docker-compose logs -f api-gateway
```

**Option B: Rebuild All Services**
```bash
cd c:\Users\94764\Desktop\c\CollabLearn-Backend

# Stop all services
docker-compose down

# Rebuild all
docker-compose build

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f
```

### 2. Verify Services are Running

```bash
# Check if API Gateway is running
curl http://localhost:3000/api/health

# Or in PowerShell:
Invoke-WebRequest -Uri http://localhost:3000/api/health
```

### 3. Test WebSocket Connection

1. Open the frontend at `http://localhost:5173`
2. Navigate to a workspace forum
3. Open browser DevTools (F12) → Console
4. You should see:
   ```
   ✅ Authentication token found
   ✅ WebSocket connected successfully
   📡 Joining workspace forum: <workspace-id>
   ✅ Successfully joined workspace forum
   ```

### 4. If Still Having Issues

**Check Docker Logs:**
```bash
# API Gateway logs
docker-compose logs api-gateway | findstr "forum"

# Forum Service logs
docker-compose logs forum-and-notification-service
```

**Verify Ports:**
```bash
# Check what's running on port 3000
netstat -ano | findstr :3000
```

**Check Environment Variables:**
```bash
docker-compose exec api-gateway env | findstr CORS
```

## Expected Console Output (Success)

```
🔌 Attempting to connect to WebSocket server (API Gateway)...
✅ Authentication token found
✅ WebSocket connected successfully { socketId: 'abc123', transport: 'polling' }
📡 Joining workspace forum: 40025d51-eb11-4220-ae34-3dc5512f5f2e
✅ Successfully joined workspace forum: { success: true, groupId: '...' }
```

## Common Issues

### Issue 1: CORS Error (still happening)
**Symptom:** `Access to XMLHttpRequest ... blocked by CORS policy`
**Solution:** Make sure you rebuilt and restarted the API Gateway Docker container

### Issue 2: Connection Timeout
**Symptom:** `TransportError: xhr poll error`
**Solution:** 
- Check if API Gateway is running: `docker-compose ps`
- Check API Gateway logs: `docker-compose logs api-gateway`
- Verify port 3000 is accessible

### Issue 3: 404 on /socket.io/
**Symptom:** `GET http://localhost:3000/socket.io/ 404`
**Solution:** 
- API Gateway WebSocket server may not have started
- Check if ForumGateway is properly registered in the module
- Restart API Gateway

### Issue 4: Authentication Token Not Found
**Symptom:** `❌ No authentication token found`
**Solution:**
- Sign out and sign in again
- Check localStorage: `localStorage.getItem('access_token')`
- Clear browser storage and re-authenticate

## Verification Checklist

- [ ] API Gateway Docker container rebuilt and running
- [ ] Frontend showing "✅ Authentication token found"
- [ ] No CORS errors in console
- [ ] WebSocket connects successfully
- [ ] Can send and receive messages in real-time
- [ ] Multiple users see messages instantly
- [ ] Connection status shows "Online"

## Architecture Reminder

```
Frontend (http://localhost:5173)
    ↓ WebSocket
API Gateway (http://localhost:3000/forum)
    ↓ TCP
Forum Service (internal port 3003)
    ↓
Database (Supabase)
```

The frontend should ONLY connect to API Gateway, never directly to Forum Service.

## Quick Test

After rebuilding, run this in browser console:
```javascript
// Check auth
console.log('Token:', !!localStorage.getItem('access_token'));
console.log('User:', JSON.parse(localStorage.getItem('user_data')));

// Test WebSocket manually
const io = require('socket.io-client');
const socket = io('http://localhost:3000/forum', {
  auth: { token: localStorage.getItem('access_token') }
});
socket.on('connect', () => console.log('Connected:', socket.id));
socket.on('connect_error', (err) => console.error('Error:', err));
```
