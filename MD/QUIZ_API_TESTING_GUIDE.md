# Quiz Service API Testing Guide

## Base URL

- **API Gateway**: `http://localhost:3000`
- **Quiz Endpoints**: `http://localhost:3000/quizzes`

## Available Endpoints

### 1. Health Check

```
GET /quizzes/health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-10-05T10:30:00.000Z"
}
```

### 2. Create Quiz (Requires Authentication)

```
POST /quizzes
Headers: {
  "Authorization": "Bearer <JWT_TOKEN>",
  "Content-Type": "application/json"
}
```

**Request Body:**

```json
{
  "title": "JavaScript Fundamentals",
  "description": "Test your knowledge of JavaScript basics",
  "timeAllocated": 30,
  "totalMarks": 20,
  "thread_id": "550e8400-e29b-41d4-a716-446655440000",
  "topics": "JavaScript, Variables, Functions",
  "selectedResources": ["resource1", "resource2"],
  "questions": [
    {
      "question_text": "What is a variable in JavaScript?",
      "image": null,
      "marks": 5,
      "options": [
        {
          "text": "A container for storing data",
          "image": null,
          "is_correct": true
        },
        {
          "text": "A function",
          "image": null,
          "is_correct": false
        }
      ]
    }
  ],
  "tags": ["javascript", "programming"],
  "resourceTags": ["beginner"]
}
```

### 3. Get All Quizzes (Requires Authentication)

```
GET /quizzes
Headers: {
  "Authorization": "Bearer <JWT_TOKEN>"
}
Query Parameters:
- workspaceId: UUID (optional)
- threadId: UUID (optional)
```

### 4. Get Quiz by ID

```
GET /quizzes/:id
```

### 5. Start Quiz Attempt (Requires Authentication)

```
POST /quizzes/:id/attempt
Headers: {
  "Authorization": "Bearer <JWT_TOKEN>",
  "Content-Type": "application/json"
}
```

### 6. Get Quiz Attempts

```
GET /quizzes/:id/attempts
```

## Frontend Integration Steps

### Step 1: Authentication

First, get a JWT token from the auth service:

```javascript
// Login to get JWT token
const loginResponse = await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password',
  }),
});

const { token } = await loginResponse.json();
```

### Step 2: Test Quiz Creation

```javascript
const createQuiz = async () => {
  const response = await fetch('http://localhost:3000/quizzes', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Sample Quiz',
      description: 'A test quiz',
      timeAllocated: 15,
      thread_id: '550e8400-e29b-41d4-a716-446655440000', // Use valid thread ID
      questions: [
        {
          question_text: 'What is 2 + 2?',
          marks: 5,
          options: [
            { text: '4', is_correct: true },
            { text: '5', is_correct: false },
          ],
        },
      ],
    }),
  });

  const result = await response.json();
  console.log('Quiz created:', result);
  return result;
};
```

### Step 3: Fetch Quizzes

```javascript
const fetchQuizzes = async () => {
  const response = await fetch('http://localhost:3000/quizzes', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const quizzes = await response.json();
  console.log('Quizzes:', quizzes);
  return quizzes;
};
```

## Postman Testing Collection

### Environment Variables

Create a Postman environment with:

- `baseUrl`: `http://localhost:3000`
- `token`: `<Your_JWT_Token>`

### Test Collection

#### 1. Health Check

- **Method**: GET
- **URL**: `{{baseUrl}}/quizzes/health`

#### 2. Create Quiz

- **Method**: POST
- **URL**: `{{baseUrl}}/quizzes`
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
  - `Content-Type`: `application/json`
- **Body** (raw JSON):

```json
{
  "title": "Postman Test Quiz",
  "description": "Testing quiz creation via Postman",
  "timeAllocated": 20,
  "thread_id": "550e8400-e29b-41d4-a716-446655440000",
  "questions": [
    {
      "question_text": "Which HTTP method is used to create resources?",
      "marks": 10,
      "options": [
        { "text": "POST", "is_correct": true },
        { "text": "GET", "is_correct": false },
        { "text": "PUT", "is_correct": false },
        { "text": "DELETE", "is_correct": false }
      ]
    }
  ],
  "tags": ["http", "api"]
}
```

#### 3. Get Quizzes

- **Method**: GET
- **URL**: `{{baseUrl}}/quizzes`
- **Headers**: `Authorization`: `Bearer {{token}}`

## WebSocket Testing (Real-time Features)

### Connect to Quiz Socket

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000/quiz', {
  auth: {
    token: 'Bearer ' + jwtToken,
  },
});

// Join a quiz attempt
socket.emit('joinQuizAttempt', {
  quizId: 'quiz-uuid',
  attemptId: 'attempt-uuid',
});

// Submit an answer
socket.emit('submitAnswer', {
  attemptId: 'attempt-uuid',
  questionId: 'question-uuid',
  selectedOptions: ['option-uuid'],
});

// Listen for timer updates
socket.on('timerUpdate', (data) => {
  console.log('Time remaining:', data.timeRemaining);
});
```

## Error Handling

### Common Error Responses

#### 401 Unauthorized

```json
{
  "message": "Invalid or expired token",
  "error": "Unauthorized",
  "statusCode": 401
}
```

#### 403 Forbidden

```json
{
  "message": "Permission denied: You must be a workspace admin or thread moderator to create quizzes",
  "error": "Forbidden",
  "statusCode": 403
}
```

#### 400 Bad Request

```json
{
  "message": "Validation failed",
  "error": "Bad Request",
  "statusCode": 400
}
```

## Database Schema Updates Required

Make sure the database has the `thread_id` column:

```sql
-- Add thread_id column if not exists
ALTER TABLE public.quiz_quizzes ADD COLUMN IF NOT EXISTS thread_id UUID NOT NULL DEFAULT uuid_generate_v4();

-- Update RLS policies for thread-based access
CREATE POLICY "quiz_thread_access" ON public.quiz_quizzes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM thread_permissions tp
      WHERE tp.thread_id = quiz_quizzes.thread_id
      AND tp.user_id = auth.uid()
    )
  );
```

## Next Steps

1. **Update Database**: Run the SQL commands to add `thread_id` column
2. **Get JWT Token**: Use auth service to get a valid token
3. **Test Health**: Verify `/quizzes/health` endpoint works
4. **Test Create**: Create a quiz with valid `thread_id` and token
5. **Test Fetch**: Retrieve quizzes list
6. **Frontend Integration**: Use the provided JavaScript examples
7. **WebSocket Testing**: Test real-time quiz features

## Troubleshooting

- **CORS Issues**: Check if frontend domain is allowed in API Gateway
- **Token Issues**: Verify JWT token is valid and not expired
- **Database Issues**: Check if all tables exist and RLS policies are set
- **Service Issues**: Verify all microservices (auth, workspace, quiz) are running
- **Thread Permissions**: Ensure user has proper permissions for the thread_id used
