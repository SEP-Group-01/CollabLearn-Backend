# Forum Service API Testing Guide

## Forum Service Endpoints

Base URL: `http://localhost:3003`

### Health Check

- **GET** `/health`
  - Returns service status and information

### Forum Messages

#### Get Group Messages

- **GET** `/forum/groups/{groupId}/messages?userId={userId}`
  - Parameters:
    - `groupId`: Group ID (number)
    - `userId`: User ID (number) - query parameter
  - Returns: Array of messages with replies and likes

#### Create Message

- **POST** `/forum/messages`
  - Body:
    ```json
    {
      "content": "Your message content here",
      "groupId": 1,
      "authorId": 1,
      "image": "optional_image_url",
      "isPinned": false
    }
    ```

#### Create Reply

- **POST** `/forum/replies`
  - Body:
    ```json
    {
      "content": "Your reply content here",
      "messageId": 1,
      "authorId": 1
    }
    ```

#### Toggle Message Like

- **POST** `/forum/messages/like`
  - Body:
    ```json
    {
      "messageId": 1,
      "userId": 1
    }
    ```

#### Toggle Reply Like

- **POST** `/forum/replies/{messageId}/{replyId}/like`
  - Parameters:
    - `messageId`: Message ID (number)
    - `replyId`: Reply ID (number)
  - Body:
    ```json
    {
      "userId": 1
    }
    ```

#### Pin Message

- **PUT** `/forum/messages/{messageId}/pin`
  - Parameters:
    - `messageId`: Message ID (number)
  - Body:
    ```json
    {
      "userId": 1
    }
    ```
  - Note: Only admin users can pin messages

#### Unpin Message

- **PUT** `/forum/messages/{messageId}/unpin`
  - Parameters:
    - `messageId`: Message ID (number)
  - Body:
    ```json
    {
      "userId": 1
    }
    ```
  - Note: Only admin users can unpin messages

# Forum Service API Testing Guide - Updated for UUID

## Forum Service Endpoints

Base URL: `http://localhost:3003`

### Health Check

- **GET** `/health`
  - Returns service status and information

### Forum Messages

#### Get Group Messages

- **GET** `/forum/groups/{groupId}/messages?userId={userId}`
  - Parameters:
    - `groupId`: Group ID (number)
    - `userId`: User UUID (string) - query parameter
  - Returns: Array of messages with replies and likes

#### Create Message

- **POST** `/forum/messages`
  - Body:
    ```json
    {
      "content": "Your message content here",
      "groupId": 1,
      "authorId": "00000000-0000-0000-0000-000000000001",
      "image": "optional_image_url",
      "isPinned": false
    }
    ```

#### Create Reply

- **POST** `/forum/replies`
  - Body:
    ```json
    {
      "content": "Your reply content here",
      "messageId": 1,
      "authorId": "00000000-0000-0000-0000-000000000001"
    }
    ```

#### Toggle Message Like

- **POST** `/forum/messages/like`
  - Body:
    ```json
    {
      "messageId": 1,
      "userId": "00000000-0000-0000-0000-000000000001"
    }
    ```

#### Toggle Reply Like

- **POST** `/forum/replies/{messageId}/{replyId}/like`
  - Parameters:
    - `messageId`: Message ID (number)
    - `replyId`: Reply ID (number)
  - Body:
    ```json
    {
      "userId": "00000000-0000-0000-0000-000000000001"
    }
    ```

#### Pin Message

- **PUT** `/forum/messages/{messageId}/pin`
  - Parameters:
    - `messageId`: Message ID (number)
  - Body:
    ```json
    {
      "userId": "00000000-0000-0000-0000-000000000001"
    }
    ```
  - Note: Only admin users can pin messages

#### Unpin Message

- **PUT** `/forum/messages/{messageId}/unpin`
  - Parameters:
    - `messageId`: Message ID (number)
  - Body:
    ```json
    {
      "userId": "00000000-0000-0000-0000-000000000001"
    }
    ```
  - Note: Only admin users can unpin messages

## Testing with cURL

### 1. Health Check

```bash
curl -X GET http://localhost:3003/health
```

### 2. Get Messages (replace groupId and userId with actual values)

```bash
curl -X GET "http://localhost:3003/forum/groups/1/messages?userId=00000000-0000-0000-0000-000000000001"
```

### 3. Create a Message

```bash
curl -X POST http://localhost:3003/forum/messages \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello from the forum!",
    "groupId": 1,
    "authorId": "00000000-0000-0000-0000-000000000001",
    "isPinned": false
  }'
```

### 4. Create a Reply

```bash
curl -X POST http://localhost:3003/forum/replies \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This is a reply!",
    "messageId": 1,
    "authorId": "00000000-0000-0000-0000-000000000002"
  }'
```

### 5. Like a Message

```bash
curl -X POST http://localhost:3003/forum/messages/like \
  -H "Content-Type: application/json" \
  -d '{
    "messageId": 1,
    "userId": "00000000-0000-0000-0000-000000000001"
  }'
```

## Important Notes

### UUID Format

- User IDs are now UUIDs (strings) instead of numbers
- Sample UUIDs in the database:
  - `00000000-0000-0000-0000-000000000001` (John Doe - Admin)
  - `00000000-0000-0000-0000-000000000002` (Jane Smith - Member)
  - `00000000-0000-0000-0000-000000000003` (Bob Wilson - Member)

### Getting Real User UUIDs

To get actual user UUIDs from your Supabase database:

```sql
SELECT id, email FROM auth.users;
```

## Database Setup

1. Run the updated SQL schema in your Supabase database
2. The schema now uses UUID for user references
3. Sample data includes test UUIDs for immediate testing

## Frontend Integration

Updated JavaScript examples:

```javascript
// Get messages for a group
const getMessages = async (groupId, userId) => {
  const response = await fetch(
    `http://localhost:3003/forum/groups/${groupId}/messages?userId=${userId}`,
  );
  return response.json();
};

// Create a new message
const createMessage = async (messageData) => {
  const response = await fetch('http://localhost:3003/forum/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...messageData,
      authorId: 'your-user-uuid-here', // Make sure this is a UUID string
    }),
  });
  return response.json();
};
```
