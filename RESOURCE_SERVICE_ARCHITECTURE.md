# Resource Service Architecture

## Overview

The resource management functionality has been separated into its own microservice to follow proper microservices architecture principles.

## Service Architecture

### Resource Service

- **Port 3007**: HTTP API for direct access
- **Port 3008**: TCP microservice for inter-service communication
- **Responsibilities**: Handle documents, videos, and links with Firebase Storage integration

### Workspaces Service

- **Port 3003**: Combined HTTP API and TCP microservice
- **Responsibilities**: Handle workspace management, forum messages, user management

### API Gateway

- **Port 3001**: Main entry point for frontend applications
- **Routes resource requests** to Resource Service (port 3008)
- **Routes workspace requests** to Workspaces Service (port 3003)

## API Endpoints

### Resource Management (via API Gateway)

```
GET    /workspaces/:workspaceId/threads/:threadId/documents
POST   /workspaces/:workspaceId/threads/:threadId/documents (with file upload)
GET    /workspaces/:workspaceId/threads/:threadId/videos
POST   /workspaces/:workspaceId/threads/:threadId/videos (with file upload)
GET    /workspaces/:workspaceId/threads/:threadId/links
POST   /workspaces/:workspaceId/threads/:threadId/links
DELETE /workspaces/:workspaceId/threads/:threadId/:resourceType/:resourceId
```

### Direct Resource Service Access

```
GET    /workspace/:workspaceId/threads/:threadId/documents
POST   /workspace/:workspaceId/threads/:threadId/documents (with file upload)
GET    /workspace/:workspaceId/threads/:threadId/videos
POST   /workspace/:workspaceId/threads/:threadId/videos (with file upload)
GET    /workspace/:workspaceId/threads/:threadId/links
POST   /workspace/:workspaceId/threads/:threadId/links
DELETE /workspace/:workspaceId/threads/:threadId/:resourceType/:resourceId
```

## Starting Services

### Start Resource Service

```bash
cd apps/resource-service
npm run start:dev
```

### Start Workspaces Service

```bash
cd apps/workspaces-service
npm run start:dev
```

### Start API Gateway

```bash
cd apps/api-gateway
npm run start:dev
```

## Firebase Integration

- Resource Service handles all Firebase Storage operations
- Files are organized: `workspaces/{workspaceId}/threads/{threadId}/{resourceType}s/{filename}`
- Metadata stored in Supabase `thread_resources` table
- Firebase URLs and paths tracked for file management

## Database Schema

The `thread_resources` table remains the same and is accessed by the Resource Service:

- `id`, `thread_id`, `user_id`, `resource_type`, `title`, `description`
- `url` (for links or Firebase URLs)
- `firebase_path`, `firebase_url`, `file_name`, `file_size`, `mime_type`
- `created_at`, `updated_at`

## Testing with Postman

### Via API Gateway (Recommended)

```
POST http://localhost:3001/workspaces/{workspaceId}/threads/{threadId}/documents
Content-Type: multipart/form-data
- file: [your file]
- user_id: [uuid]
- title: "Document Title"
- description: "Document Description" (optional)
```

### Direct to Resource Service

```
POST http://localhost:3007/workspace/{workspaceId}/threads/{threadId}/documents
Content-Type: multipart/form-data
- file: [your file]
- user_id: [uuid]
- title: "Document Title"
- description: "Document Description" (optional)
```

## Migration Notes

- All resource-related files have been moved from `workspaces-service` to `resource-service`
- API Gateway now routes resource requests to the Resource Service
- Workspaces Service no longer handles resource management
- Firebase and resource functionality is completely isolated in Resource Service
