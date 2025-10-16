# Frontend-Backend Integration Testing Guide

## Quick Start Testing

Let me help you verify that your frontend API calls are working with the backend. Here's a step-by-step approach:

### Step 1: Start Your Services

1. **Start the backend services**:

   ```bash
   # In your backend directory
   npm run start:dev
   # or
   npm run start
   ```

2. **Verify services are running**:
   ```bash
   # Check API Gateway
   curl http://localhost:3000/api/quizzes
   ```

### Step 2: Test with the HTML Tool

I've created a comprehensive testing tool for you. Let's use it:

1. **Open the test tool**:
   - Navigate to your backend folder
   - Open `quiz-api-test.html` in your browser

2. **Configure the test settings**:
   - API Base URL: `http://localhost:3000/api`
   - Get a valid JWT token from your frontend login
   - Get Thread ID and User ID from your database

### Step 3: Run the Node.js Test Script

For automated testing, use the Node.js script:

```bash
# Install axios if not already installed
npm install axios

# Edit test-quiz-api.js and update the configuration:
# - AUTH_TOKEN: Your JWT token
# - TEST_THREAD_ID: A valid thread UUID
# - TEST_USER_ID: A valid user UUID

# Run the tests
node test-quiz-api.js
```

### Step 4: Check Database Data

Before testing, ensure you have sample data:

```sql
-- Check if you have threads
SELECT id, name FROM threads LIMIT 5;

-- Check if you have users
SELECT id, email FROM users LIMIT 5;

-- Check existing quizzes
SELECT id, title, thread_id FROM quizzes LIMIT 5;
```

## Common Issues to Check

### 1. CORS Issues

If testing from browser, make sure your API Gateway has CORS enabled:

```typescript
// In your main.ts or app setup
app.enableCors({
  origin: ['http://localhost:3000', 'http://localhost:5173'], // Add your frontend URLs
  credentials: true,
});
```

### 2. Authentication Token

Make sure you're using a valid JWT token. You can get one by:

- Logging into your frontend
- Checking browser dev tools → Network → Authorization headers
- Or using your auth service to generate a test token

### 3. Database Schema

Run the migration I created:

```bash
# Apply the schema fixes
psql -d your_database -f database/migrations/004_fix_quiz_schema.sql
```

## Testing Each Frontend API Call

Based on your `quizApi.ts`, here are the endpoints to test:

### 1. getQuizzes(threadId)

**Frontend calls**: `GET /threads/${threadId}/quizzes`
**Test**: Use the HTML tool or:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/threads/YOUR_THREAD_ID/quizzes
```

### 2. getQuizById(quizId)

**Frontend calls**: `GET /quizzes/${quizId}`
**Test**:

```bash
curl http://localhost:3000/api/quizzes/YOUR_QUIZ_ID
```

### 3. createQuiz(threadId, quizData)

**Frontend calls**: `POST /threads/${threadId}/quizzes/create`
**Test**: Use the "Create Quiz" button in the HTML tool

### 4. submitQuizAttempt(quizId, attemptData)

**Frontend calls**: `POST /quizzes/${quizId}/attempts`
**Test**: First start a quiz, then submit answers

### 5. getQuizAttempts(quizId)

**Frontend calls**: `GET /quizzes/${quizId}/attempts`
**Test**: After submitting attempts

### 6. getMyAttemptsForQuiz(quizId)

**Frontend calls**: `GET /quizzes/${quizId}/attempts/me`
**Test**: Shows only current user's attempts

## Debugging Tips

### 1. Check Backend Logs

Watch your backend console for errors when making requests

### 2. Check Network Tab

In browser dev tools, check:

- Request URL and method
- Request headers (especially Authorization)
- Request payload
- Response status and data

### 3. Database Queries

Check if data is being inserted correctly:

```sql
-- After creating a quiz
SELECT * FROM quizzes ORDER BY created_at DESC LIMIT 1;

-- After starting a quiz
SELECT * FROM quiz_attempt ORDER BY created_at DESC LIMIT 1;

-- After submitting answers
SELECT * FROM user_answer ORDER BY created_at DESC LIMIT 5;
```

## Quick Test Checklist

- [ ] Backend services running
- [ ] Database accessible
- [ ] Valid JWT token
- [ ] Health check works (`GET /api/quizzes`)
- [ ] Can create quiz (`POST /threads/{id}/quizzes/create`)
- [ ] Can list quizzes (`GET /threads/{id}/quizzes`)
- [ ] Can get quiz details (`GET /quizzes/{id}`)
- [ ] Can start quiz attempt (`POST /quizzes/{id}/start`)
- [ ] Can submit answers (`POST /quizzes/{id}/attempts`)
- [ ] Can view results (`GET /quizzes/{id}/attempts/me`)

## Sample Frontend Test Code

If you want to test directly from your frontend, here's some sample code:

```javascript
// Test the quiz API integration
async function testQuizAPI() {
  const threadId = 'your-thread-id';

  try {
    // 1. Get quizzes for thread
    console.log('Testing getQuizzes...');
    const quizzes = await getQuizzes(threadId);
    console.log('Quizzes:', quizzes);

    // 2. Create a new quiz
    console.log('Testing createQuiz...');
    const newQuiz = await createQuiz(threadId, {
      title: 'Test Quiz',
      description: 'Testing API',
      timeAllocated: 30,
      questions: [
        /* your questions */
      ],
    });
    console.log('Created quiz:', newQuiz);

    // 3. Get the created quiz
    console.log('Testing getQuizById...');
    const quiz = await getQuizById(newQuiz.quizId);
    console.log('Quiz details:', quiz);
  } catch (error) {
    console.error('API test failed:', error);
  }
}

// Run the test
testQuizAPI();
```

This comprehensive approach will help you identify exactly where any issues are occurring in the frontend-backend integration.
