# 📚 Quiz Service API Documentation

## Overview

The Quiz Service provides comprehensive quiz management functionality including creation, management, and taking quizzes within workspaces and threads.

## Base URL

```
http://localhost:3000/quizzes
```

## Authentication

All endpoints require JWT authentication via the `Authorization: Bearer <token>` header.

---

## 📝 Quiz Management Endpoints

### 1. Create Quiz in Thread

Creates a new quiz associated with a specific thread.

**Endpoint:** `POST /quizzes/thread/{threadId}`

**Headers:**

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Path Parameters:**

- `threadId` (string): The ID of the thread where the quiz will be created

**Request Body:**

```json
{
  "title": "Quiz Title",
  "description": "Quiz description",
  "timeAllocated": 30,
  "questions": [
    {
      "questionText": "What is 2+2?",
      "marks": 5,
      "image": "optional_image_url",
      "options": [
        {
          "text": "3",
          "isCorrect": false,
          "image": "optional_image_url"
        },
        {
          "text": "4",
          "isCorrect": true
        }
      ]
    }
  ]
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "quiz": {
    "id": "quiz_id",
    "title": "Quiz Title",
    "description": "Quiz description",
    "allocated_time": 30,
    "creator_id": "user_id",
    "thread_id": "thread_id",
    "created_at": "2025-10-10T00:00:00Z"
  }
}
```

---

### 2. List Quizzes in Thread

Retrieves all quizzes associated with a specific thread.

**Endpoint:** `GET /quizzes/thread/{threadId}`

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Path Parameters:**

- `threadId` (string): The ID of the thread

**Response (200 OK):**

```json
[
  {
    "id": "quiz_id",
    "title": "Quiz Title",
    "description": "Quiz description",
    "allocated_time": 30,
    "creator_id": "user_id",
    "thread_id": "thread_id",
    "created_at": "2025-10-10T00:00:00Z",
    "questions": [
      {
        "id": "question_id",
        "question": "What is 2+2?",
        "attachment_url": null,
        "marks": 5,
        "answer_option": [
          {
            "id": "option_id",
            "answer_sequence_letter": "a",
            "answer": "3",
            "image_url": null,
            "is_correct": false
          }
        ]
      }
    ]
  }
]
```

---

### 3. Get Specific Quiz

Retrieves detailed information about a specific quiz.

**Endpoint:** `GET /quizzes/{quizId}`

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Path Parameters:**

- `quizId` (string): The ID of the quiz

**Response (200 OK):**

```json
{
  "id": "quiz_id",
  "title": "Quiz Title",
  "description": "Quiz description",
  "allocated_time": 30,
  "creator_id": "user_id",
  "thread_id": "thread_id",
  "questions": [
    {
      "id": "question_id",
      "question": "What is 2+2?",
      "attachment_url": null,
      "marks": 5,
      "answer_option": [
        {
          "id": "option_id",
          "answer_sequence_letter": "a",
          "answer": "3",
          "is_correct": false
        }
      ]
    }
  ]
}
```

---

## 🎮 Quiz Taking Endpoints

### 4. Start Quiz Attempt

Initiates a new quiz attempt for a user.

**Endpoint:** `POST /quizzes/start`

**Headers:**

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "quizId": "quiz_id",
  "userId": "user_id"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "attemptId": "attempt_id",
  "startedAt": "2025-10-10T00:00:00Z",
  "timeLimit": 30
}
```

---

### 5. Submit Quiz Answer

Submits an answer for a specific question during an active quiz attempt.

**Endpoint:** `POST /quizzes/attempt/{attemptId}/answer`

**Headers:**

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Path Parameters:**

- `attemptId` (string): The ID of the quiz attempt

**Request Body:**

```json
{
  "questionId": "question_id",
  "selectedAnswerId": "option_id"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Answer submitted successfully"
}
```

---

### 6. Get Active Quiz Attempt

Retrieves information about an active quiz attempt.

**Endpoint:** `GET /quizzes/attempt/{attemptId}`

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Path Parameters:**

- `attemptId` (string): The ID of the quiz attempt

**Response (200 OK):**

```json
{
  "id": "attempt_id",
  "quiz_id": "quiz_id",
  "user_id": "user_id",
  "started_at": "2025-10-10T00:00:00Z",
  "status": "in_progress",
  "time_remaining": 1200
}
```

---

### 7. Complete Quiz Attempt

Marks a quiz attempt as completed and calculates the final score.

**Endpoint:** `POST /quizzes/attempt/{attemptId}/complete`

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Path Parameters:**

- `attemptId` (string): The ID of the quiz attempt

**Response (200 OK):**

```json
{
  "success": true,
  "score": 85,
  "totalMarks": 100,
  "percentage": 85,
  "completedAt": "2025-10-10T00:30:00Z"
}
```

---

## 🔒 Permission & Security Endpoints

### 8. Check Admin or Moderator Status

Verifies if a user has admin or moderator permissions for a specific thread.

**Endpoint:** `POST /quizzes/check-admin-or-moderator`

**Headers:**

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "userId": "user_id",
  "threadId": "thread_id"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "role": "admin",
  "workspaceId": "workspace_id",
  "threadId": "thread_id"
}
```

**Response (403 Forbidden):**

```json
{
  "success": false,
  "error": "User is not an admin or moderator",
  "workspaceId": "workspace_id",
  "threadId": "thread_id"
}
```

---

## 🏥 Health Check Endpoints

### 9. Service Health Check

Checks if the quiz service is healthy and operational.

**Endpoint:** `GET /quizzes/health`

**Response (200 OK):**

```json
{
  "status": "healthy",
  "service": "quiz-service",
  "timestamp": "2025-10-10T00:00:00Z"
}
```

---

## 🗄️ Database Schema

### Tables Used

#### 1. quizzes

```sql
- id (UUID, Primary Key)
- title (VARCHAR)
- description (TEXT)
- allocated_time (INTEGER) -- in minutes
- creator_id (UUID)
- thread_id (UUID)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 2. questions

```sql
- id (UUID, Primary Key)
- quiz_id (UUID, Foreign Key)
- question (TEXT)
- attachment_url (VARCHAR, Optional)
- marks (INTEGER)
- created_at (TIMESTAMP)
```

#### 3. answer_option

```sql
- id (UUID, Primary Key)
- question_id (UUID, Foreign Key)
- answer_sequence_letter (CHAR) -- 'a', 'b', 'c', etc.
- answer (TEXT)
- image_url (VARCHAR, Optional)
- is_correct (BOOLEAN)
```

#### 4. quiz_attempt

```sql
- id (UUID, Primary Key)
- quiz_id (UUID, Foreign Key)
- user_id (UUID)
- started_at (TIMESTAMP)
- completed_at (TIMESTAMP, Optional)
- score (INTEGER, Optional)
- status (ENUM: 'in_progress', 'completed', 'abandoned')
```

#### 5. user_answers

```sql
- id (UUID, Primary Key)
- attempt_id (UUID, Foreign Key)
- question_id (UUID, Foreign Key)
- selected_answer_id (UUID, Foreign Key)
- answered_at (TIMESTAMP)
```

---

## 🚨 Error Codes

| Code | Description                                 |
| ---- | ------------------------------------------- |
| 400  | Bad Request - Invalid request data          |
| 401  | Unauthorized - Invalid or missing JWT token |
| 403  | Forbidden - Insufficient permissions        |
| 404  | Not Found - Resource does not exist         |
| 409  | Conflict - Resource already exists          |
| 500  | Internal Server Error - Server-side error   |

---

## 🧪 Testing

Use the provided test suite (`comprehensive-test-suite.html`) to test all endpoints:

1. Open the test suite in a web browser
2. Configure your API URL and JWT token
3. Run the comprehensive tests to verify functionality

---

## 📋 Prerequisites

1. **Supabase Database**: Ensure all required tables are created
2. **JWT Authentication**: Valid JWT token for API access
3. **Admin/Moderator Setup**: Users must have proper permissions in the database
4. **Kafka**: Message broker for microservice communication

---

## 🔧 Configuration

Environment variables required:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
KAFKA_BROKER=localhost:9092
```
