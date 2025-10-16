# WebSocket Connection Fix Guide

## Problem Summary
The frontend was trying to connect to the Forum Service WebSocket directly at `http://localhost:3003/forum`, but the correct architecture requires:
- Frontend → API Gateway WebSocket (port 3000)
- API Gateway → Forum Service via TCP (internal communication)

## Architecture Flow

```
Frontend (port 5173)
    ↓ HTTP/WebSocket
API Gateway (port 3000)
    ↓ TCP
Forum Service (port 3003)
    ↓
Database (Supabase)
```

## Changes Made

### 1. Frontend WebSocket Connection (`useForumWebSocket.ts`)
- ✅ Changed connection URL from `http://localhost:3003/forum` to `http://localhost:3000/forum`
- ✅ Added authentication token to connection
- ✅ Improved error handling and logging
- ✅ Added reconnection limits (max 3 attempts)
- ✅ Fixed join-group event to send correct data structure

### 2. API Configuration (`forumApi.ts`)
- ✅ Already correctly pointing to `http://localhost:3000`
- ✅ Using `/api` prefix for REST endpoints

## How to Test

### 1. Start the Backend Services

```bash
# Terminal 1 - Start API Gateway
cd CollabLearn-Backend
npm run start:dev api-gateway

# Terminal 2 - Start Forum Service  
npm run start:dev forum-and-notification-service
```

### 2. Verify Services are Running

API Gateway should log:
```
[API Gateway] Microservice listening on localhost:3001
[API Gateway] HTTP server listening on http://localhost:3000
[ForumGateway] WebSocket server started on /forum namespace
```

Forum Service should log:
```
[ForumAndNotificationService] Microservice is listening
[ForumAndNotificationService] TCP server ready on port 3003
```

### 3. Start the Frontend

```bash
cd CollabLearn-Frontend/client
npm run dev
```

### 4. Test WebSocket Connection

1. Navigate to a workspace forum page
2. Open browser DevTools (F12) → Console
3. Look for these logs:

**Success indicators:**
```
🔌 Attempting to connect to WebSocket server (API Gateway)...
✅ WebSocket connected successfully { socketId: '...', transport: '...' }
📡 Joining workspace forum: <workspace-id>
✅ Successfully joined workspace forum
```

**The connection status indicator at the top should show "Online" (green)**

### 5. Test Message Sending

1. Type a message in the input field
2. Click Send
3. Look for these logs:

**Success indicators:**
```
📨 Creating forum message: { workspaceId: '...', content: '...' }
🔍 Getting current user ID...
✅ Got user ID: <user-id>
🔧 Creating authenticated request...
📡 Request path: /workspaces/<workspace-id>/forum/messages
```

4. The message should appear in the chat immediately
5. Other users in the same workspace should see it in real-time

## Troubleshooting

### WebSocket Connection Errors

**Error:** `🚫 WebSocket connection error: Error: timeout`
**Solution:** 
- Check if API Gateway is running on port 3000
- Verify CORS settings allow `http://localhost:5173`
- Check browser console for more details

**Error:** `❌ No authentication token found`
**Solution:**
- Sign out and sign in again
- Clear localStorage and refresh

**Error:** `WebSocket connection to 'ws://localhost:3000/...' failed`
**Solution:**
- Make sure API Gateway's WebSocket server is enabled
- Check for port conflicts (something else using port 3000)

### Message Sending Errors

**Error:** `Please sign in to send messages`
**Solution:**
- Clear localStorage
- Sign out and sign in
- Check if token is valid

**Error:** `❌ Error creating forum message`
**Solution:**
- Check if Forum Service is running
- Verify TCP connection between API Gateway and Forum Service
- Check backend logs for detailed error

## Expected Console Output (Clean Connection)

```
Forum.tsx:45 🔍 Forum Component Mounted with workspaceId: <workspace-id>
useForumWebSocket.ts:55 🔌 Attempting to connect to WebSocket server (API Gateway)...
useForumWebSocket.ts:70 ✅ WebSocket connected successfully { socketId: 'xyz123', transport: 'polling' }
useForumWebSocket.ts:76 📡 Joining workspace forum: <workspace-id>
useForumWebSocket.ts:81 ✅ Successfully joined workspace forum: { success: true, groupId: '...' }
Forum.tsx:454 🔍 Raw messages from API: (14) [{…}, {…}, ...]
Forum.tsx:459 🔍 Organized messages: (14) [{…}, {…}, ...]
```

## Key Files Modified

1. `client/src/hooks/useForumWebSocket.ts` - WebSocket connection logic
2. `client/src/api/forumApi.ts` - HTTP API calls (already correct)

## Key Files to Review (Backend)

1. `apps/api-gateway/src/app/gateways/forum.gateway.ts` - WebSocket gateway
2. `apps/forum-and-notification-service/src/controllers/forum-tcp.controller.ts` - TCP message handlers
3. `apps/api-gateway/src/app/controllers/forum.controller.ts` - HTTP endpoints

## Notes

- The Forum Service's `forum.gateway.ts` is NOT used in this architecture
- All WebSocket connections go through API Gateway
- Forum Service only handles TCP messages from API Gateway
- Real-time updates flow: Frontend WS → API Gateway WS → API Gateway TCP → Forum Service TCP

## Testing Checklist

- [ ] Backend services start without errors
- [ ] WebSocket connects to API Gateway successfully
- [ ] Connection status shows "Online"
- [ ] Can send messages successfully
- [ ] Messages appear in real-time
- [ ] Multiple users see messages instantly
- [ ] Reconnection works after disconnection
- [ ] Error messages are clear and helpful
