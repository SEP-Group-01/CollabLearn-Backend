# Forum Service Troubleshooting Guide

## Issue: Terminal not working in VS Code

### Solution 1: Use Command Prompt or PowerShell directly

1. Open Command Prompt or PowerShell as Administrator
2. Navigate to the project directory:
   ```cmd
   cd "c:\Users\94764\Desktop\study\CollabLearn-Backend"
   ```
3. Run the forum service:
   ```cmd
   npm run start:dev:forum-service
   ```

### Solution 2: Use the batch file

1. Double-click on `start-forum.bat` in the project root
2. This will open Command Prompt and start the service

### Solution 3: Use PowerShell script

1. Right-click on `start-forum.ps1` and select "Run with PowerShell"
2. If execution policy prevents it, run:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

### Solution 4: Use Node.js script

1. Open Command Prompt in the project directory
2. Run: `node start-forum.js`

## Checking if the service is running

Once started, you should see:

```
Forum and Notification Service is running on port 3003
```

## Testing the API

### 1. Test health endpoint

Open your browser or use curl:

```
http://localhost:3003/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "forum-and-notification-service",
  "timestamp": "2025-09-15T...",
  "message": "Forum service is running successfully!"
}
```

### 2. Test with Postman or curl

#### Get messages (you need to create test data first):

```bash
curl -X GET "http://localhost:3003/forum/groups/1/messages?userId=1"
```

#### Create a message:

```bash
curl -X POST http://localhost:3003/forum/messages \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello from the forum!",
    "groupId": 1,
    "authorId": 1,
    "isPinned": false
  }'
```

## Database Setup

Before testing, make sure to:

1. Run the SQL schema in your Supabase database:
   - Copy the content from `apps/forum-and-notification-service/database/forum_schema.sql`
   - Paste it in Supabase SQL Editor and execute

2. Verify your environment variables in the `.env` file:
   ```
   SUPABASE_URL=https://cfcgwqdbnftjqsbgmsun.supabase.co
   SUPABASE_SERVICE_KEY=your_service_key_here
   PORT=3003
   ```

## Common Issues and Solutions

### Issue: Module not found errors

**Solution:** Run `npm install` in the project root

### Issue: TypeScript compilation errors

**Solution:** Run `npm run build:forum-service` to see specific errors

### Issue: Port already in use

**Solution:**

1. Find what's using port 3003: `netstat -ano | findstr :3003`
2. Kill the process or change the port in `.env`

### Issue: Supabase connection errors

**Solution:**

1. Verify your Supabase URL and service key
2. Check if your Supabase project is active
3. Ensure the database schema is properly set up

## VS Code Terminal Fix

If VS Code terminal is not working:

1. **Restart VS Code**: Close and reopen VS Code
2. **Change default terminal**:
   - Press `Ctrl+Shift+P`
   - Type "Terminal: Select Default Profile"
   - Choose "Command Prompt" or "PowerShell"
3. **Reset terminal**:
   - Press `Ctrl+Shift+P`
   - Type "Developer: Reload Window"

## Alternative Development Setup

If you continue having terminal issues, you can:

1. Use an external terminal (Command Prompt, PowerShell, or Git Bash)
2. Use VS Code's integrated terminal alternatives
3. Use the provided batch/PowerShell scripts
4. Use the Node.js startup script

## Success Indicators

When everything is working correctly, you should see:

1. ✅ Service starts without errors
2. ✅ Health endpoint responds with 200 status
3. ✅ Console shows: "Forum and Notification Service is running on port 3003"
4. ✅ No TypeScript compilation errors
5. ✅ Supabase connection established
