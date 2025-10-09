# Real-time Collaborative Document Editor Architecture

## Overview

This document describes the complete architecture for the real-time collaborative document editor system, featuring Redis-backed distributed state management and WebSocket communication between services.

## Architecture Components

### 1. Frontend Integration (React)

#### Unified Collaboration Hook (`useUnifiedCollaboration.ts`)

- **Primary Strategy**: Yjs CRDT with WebSocket provider
- **Fallback Strategy**: Custom WebSocket collaboration client
- **Features**: Version control, permissions, export, media upload, audit trail

```typescript
const {
  yjsProvider,
  wsClient,
  isConnected,
  collaborators,
  permissions,
  versions,
} = useUnifiedCollaboration({
  documentId: 'doc-123',
  userId: 'user-456',
  serverUrl: 'ws://localhost:3001',
});
```

### 2. API Gateway (Port 3001)

#### WebSocket Gateway (`document-editor.gateway.ts`)

- **Purpose**: WebSocket endpoint for real-time client connections
- **Features**: Document rooms, event broadcasting, Y.js sync handling
- **Redis Integration**: Listens to Redis pub/sub for cross-service events

#### Redis Bridge Service (`redis-bridge.service.ts`)

- **Purpose**: Bridges Redis events to WebSocket clients
- **Subscription Pattern**: `document:*`
- **Event Types**: user-join, user-leave, awareness-update, document-change, yjs-update

```typescript
// WebSocket Events Handled:
- document:join / document:leave
- yjs:update / yjs:sync-request
- awareness:update
- document:get / document:update (legacy)
```

### 3. Document Editor Service (Port 3006)

#### Core Service (`document-editor-service.service.ts`)

- **Yjs Integration**: Manages Y.Doc instances with Redis persistence
- **Redis State**: Distributed document state, collaborator tracking
- **Features**: Version control, permissions, export, media handling

#### Redis Service (`redis.service.ts`)

- **Document State**: Save/load Y.js document state
- **Collaborators**: Track active users per document
- **Awareness**: User cursor positions and selections
- **Events**: Publish real-time events to Redis channels

```typescript
// Redis Operations:
- Document state: setDocumentState(), getDocumentState()
- Collaborators: addCollaborator(), removeCollaborator()
- Awareness: setUserAwareness(), getUserAwareness()
- Events: publishDocumentEvent()
```

## Data Flow Architecture

### 1. Document Collaboration Flow

```
Frontend (Yjs) → WebSocket → API Gateway → TCP → Document Service → Redis
                    ↓                                      ↓
             WebSocket Broadcast ← Redis Pub/Sub ← Redis Bridge Service
```

### 2. Real-time Event Distribution

```
Document Service → Redis Pub/Sub → Redis Bridge Service → WebSocket Clients
```

### 3. State Persistence

```
Y.js Document State → Redis Storage → Distributed Access Across Instances
```

## Redis Integration Details

### Channel Patterns

- **Document Events**: `document:{documentId}`
- **Event Types**: user-join, user-leave, awareness-update, document-change, yjs-update

### Data Structures

```redis
# Document state
document_state:{documentId} → Yjs state (binary)

# Active collaborators
document_collaborators:{documentId} → Set of user IDs

# User awareness
document_awareness:{documentId}:{userId} → Awareness data (JSON)

# Session management
user_session:{userId} → Session data
```

## WebSocket Event Protocol

### Client → Server Events

```typescript
// Join document collaboration
{
  event: 'document:join',
  data: { documentId: string, userId: string }
}

// Y.js state synchronization
{
  event: 'yjs:update',
  data: { documentId: string, userId: string, update: ArrayBuffer }
}

// User awareness (cursor position, selection)
{
  event: 'awareness:update',
  data: { documentId: string, userId: string, awareness: any }
}
```

### Server → Client Events

```typescript
// Document collaboration joined
{
  event: 'document:joined',
  data: { document: Doc, collaborators: string[], joinedUser: string }
}

// Real-time Y.js updates
{
  event: 'yjs:update',
  data: { documentId: string, userId: string, update: number[] }
}

// Collaborator presence changes
{
  event: 'collaborator:joined',
  data: { userId: string, documentId: string }
}
```

## Service Communication

### API Gateway ↔ Document Service (TCP)

```typescript
// Message patterns for NestJS microservices
'document.join' → joinDocument()
'document.leave' → leaveDocument()
'document.yjs.update' → updateDocument()
'document.yjs.updateSince' → getYjsUpdateSince()
'document.awareness.update' → updateAwareness()
```

### Cross-Service Event Broadcasting (Redis)

```typescript
// Events published by Document Service
{
  type: 'user-join',
  data: { userId: string }
}

{
  type: 'yjs-update',
  data: { userId: string, update: ArrayBuffer }
}

{
  type: 'awareness-update',
  data: { userId: string, awareness: any }
}
```

## Environment Configuration

### Required Environment Variables

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Service Ports
API_GATEWAY_PORT=3001
DOCUMENT_EDITOR_SERVICE_PORT=3006

# WebSocket Configuration
WEBSOCKET_CORS_ORIGIN=*
```

### Dependencies

```json
{
  "ioredis": "^5.x.x",
  "@types/ioredis": "^5.x.x",
  "yjs": "^13.6.7",
  "y-websocket": "^1.5.0",
  "@nestjs/websockets": "^11.x.x"
}
```

## Deployment Considerations

### Redis Setup

- **Single Instance**: For development and small-scale deployments
- **Redis Cluster**: For production high-availability setups
- **Persistence**: Enable RDB snapshots for document state recovery

### Scaling Considerations

- **Horizontal Scaling**: Multiple Document Service instances share Redis state
- **WebSocket Sticky Sessions**: Ensure consistent connection handling
- **Redis Pub/Sub**: Enables event distribution across service instances

### Monitoring

- **Redis Memory Usage**: Monitor document state storage
- **WebSocket Connections**: Track active collaboration sessions
- **Event Throughput**: Monitor real-time event processing

## Development Workflow

### Starting Services

```bash
# Start Redis
docker run -d -p 6379:6379 redis:alpine

# Start Document Editor Service
cd apps/document-editor-service
npm run start:dev

# Start API Gateway
cd apps/api-gateway
npm run start:dev
```

### Testing Real-time Features

1. **WebSocket Connection**: Connect multiple clients to same document
2. **Y.js Synchronization**: Verify conflict-free collaborative editing
3. **Redis Events**: Monitor Redis pub/sub for event propagation
4. **Cross-Service Communication**: Test TCP message handling

## Security Considerations

### Authentication

- **JWT Validation**: Verify user tokens in WebSocket connections
- **Document Permissions**: Enforce read/write access controls
- **Session Management**: Track user sessions in Redis

### Data Protection

- **Document Encryption**: Consider encrypting sensitive document content
- **Redis Security**: Use Redis AUTH and secure network access
- **WebSocket Security**: Implement rate limiting and connection validation

## Future Enhancements

### Performance Optimizations

- **Document Chunking**: Split large documents for efficient synchronization
- **Differential Sync**: Send only document deltas, not full state
- **Caching Layers**: Implement document metadata caching

### Feature Extensions

- **Operational Transform**: Alternative to CRDT for certain use cases
- **Voice/Video Integration**: Real-time communication during collaboration
- **Advanced Permissions**: Fine-grained document section permissions

This architecture provides a robust, scalable foundation for real-time collaborative document editing with proper separation of concerns and distributed state management.
