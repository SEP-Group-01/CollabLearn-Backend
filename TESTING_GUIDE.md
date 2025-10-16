# 🧪 Manual Testing Guide

## Quick Start Testing (5 minutes)

### 1. Health Check Test

```bash
# Test if all services are running
curl http://localhost:3000/quizzes/health
curl http://localhost:3000/auth/health
```

Expected Response:

```json
{
  "status": "healthy",
  "service": "quiz-service",
  "timestamp": "2025-10-10T..."
}
```

### 2. Basic API Info Test

```bash
curl http://localhost:3000/quizzes
```

Expected Response:

```json
{
  "message": "Quiz Service API Gateway",
  "endpoints": [
    "GET /quizzes/health",
    "POST /quizzes/thread/:threadId",
    "GET /quizzes/thread/:threadId",
    "POST /quizzes/check-admin-or-moderator",
    "POST /quizzes/start",
    "GET /quizzes/:id"
  ]
}
```

### 3. Test with Your JWT Token

Replace `YOUR_JWT_TOKEN` with your actual token:

```bash
# Test quiz creation in thread
curl -X POST http://localhost:3000/quizzes/thread/test-thread-123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Test Quiz",
    "description": "Testing quiz creation",
    "timeAllocated": 30,
    "questions": [
      {
        "questionText": "What is 2+2?",
        "marks": 5,
        "options": [
          {"text": "3", "isCorrect": false},
          {"text": "4", "isCorrect": true},
          {"text": "5", "isCorrect": false}
        ]
      }
    ]
  }'
```

### 4. Test Admin/Moderator Permission Check

```bash
curl -X POST http://localhost:3000/quizzes/check-admin-or-moderator \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "userId": "your-user-id",
    "threadId": "test-thread-123"
  }'
```

---

## Complete Workflow Testing (Browser)

### Use the HTML Test Suite

1. **Open:** `complete-workflow-tester.html` in your browser
2. **Enter your JWT token** in the configuration section
3. **Follow the step-by-step flow:**
   - ✅ Step 1: Token validation
   - ✅ Step 2: Workspace creation (if you have workspace endpoints)
   - ✅ Step 3: Thread creation (if you have thread endpoints)
   - ✅ Step 4: Permission testing
   - ✅ Step 5: Quiz creation & management
   - ✅ Step 6: Quiz taking flow

---

## What Works Now vs What You Need

### ✅ **Currently Working:**

- Quiz service health checks
- JWT token validation
- Quiz creation in threads
- Quiz listing by thread
- Admin/moderator permission checking
- Quiz attempt starting
- Basic quiz management

### 🔧 **May Need Implementation:**

- Workspace management endpoints
- Thread management endpoints
- User role management in database
- Complete quiz taking flow
- Quiz results and scoring

---

## Next Actions Based on Test Results

### If Tests Pass ✅

1. **Document your working API**
2. **Integrate with frontend**
3. **Deploy to staging/production**
4. **Set up monitoring**

### If Tests Fail ❌

1. **Check service logs:**

   ```bash
   docker-compose logs api-gateway
   docker-compose logs kafka
   ```

2. **Verify database connectivity**
3. **Check Supabase configuration**
4. **Validate JWT token format**

### If Permission Tests Fail 🔒

1. **Check if user exists in database**
2. **Verify admin/moderator roles are set**
3. **Check thread-workspace relationships**
4. **Validate JWT token contains correct user info**

---

## Ready for Production Checklist

- [ ] All health checks pass
- [ ] Quiz creation works end-to-end
- [ ] Permission system validates correctly
- [ ] Frontend integration successful
- [ ] Error handling works properly
- [ ] Database schema is correct
- [ ] Performance tests pass
- [ ] Security tests pass

---

## Troubleshooting Common Issues

### "Invalid or expired token"

- Check JWT token format
- Verify token hasn't expired
- Ensure auth service is running

### "Permission denied"

- Check user has admin/moderator role
- Verify thread-workspace relationship
- Check database permissions

### "Failed to create quiz"

- Verify Supabase connection
- Check database schema
- Validate request payload

### "Service not responding"

- Check if Docker containers are running
- Verify port 3000 is available
- Check service logs
