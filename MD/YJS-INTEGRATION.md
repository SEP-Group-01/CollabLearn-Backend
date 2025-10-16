# Y.js Collaborative Document Editor Integration

This document explains how to use the Y.js collaborative document editor with your NestJS backend.

## Overview

The system uses Y.js (Yjs) for conflict-free collaborative editing with the following architecture:

```
Frontend (Y.js) ↔ WebSocket ↔ API Gateway ↔ TCP ↔ Document Editor Service (Y.js)
```

## Features

✅ **Real-time Collaboration**: Multiple users can edit simultaneously  
✅ **Conflict Resolution**: Y.js CRDTs handle conflicts automatically  
✅ **User Awareness**: See other users' cursors and selections  
✅ **Offline Support**: Changes sync when reconnected  
✅ **Binary Efficiency**: Y.js uses efficient binary protocol  
✅ **Document Persistence**: Documents stored in memory (can be extended to DB)

## WebSocket Events

### Document Management

- `document:join` - Join a document for collaboration
- `document:leave` - Leave a document
- `document:get` - Get document content

### Y.js Synchronization

- `yjs:update` - Send Y.js document updates
- `yjs:sync-request` - Request document synchronization
- `yjs:sync-update` - Receive document updates

### User Awareness

- `awareness:update` - Update user cursor/selection
- `collaborator:joined` - User joined document
- `collaborator:left` - User left document

## Frontend Integration

### Installation

```bash
npm install yjs y-websocket
```

### Basic Usage

```javascript
import * as Y from 'yjs';

// Create Y.js document
const ydoc = new Y.Doc();
const ytext = ydoc.getText('content');

// Connect to WebSocket
const ws = new WebSocket('ws://localhost:3000');

// Listen for document updates
ydoc.on('update', (update) => {
  ws.send(
    JSON.stringify({
      event: 'yjs:update',
      documentId: 'doc123',
      userId: 'user456',
      update: update,
    }),
  );
});

// Apply incoming updates
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.event === 'yjs:update') {
    const updateArray = new Uint8Array(message.data.update);
    Y.applyUpdate(ydoc, updateArray);
  }
};
```

### Editor Integration Examples

#### Monaco Editor

```javascript
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';

const ydoc = new Y.Doc();
const ytext = ydoc.getText('content');
const editor = monaco.editor.create(document.getElementById('editor'));

// Bind Y.js to Monaco
const binding = new MonacoBinding(ytext, editor.getModel(), new Set([editor]));
```

#### CodeMirror

```javascript
import * as Y from 'yjs';
import { CodemirrorBinding } from 'y-codemirror';

const ydoc = new Y.Doc();
const ytext = ydoc.getText('content');

// Bind Y.js to CodeMirror
const binding = new CodemirrorBinding(ytext, editor);
```

#### Quill

```javascript
import * as Y from 'yjs';
import { QuillBinding } from 'y-quill';

const ydoc = new Y.Doc();
const ytext = ydoc.getText('content');
const quill = new Quill('#editor');

// Bind Y.js to Quill
const binding = new QuillBinding(ytext, quill);
```

## Backend API

### REST Endpoints

- `GET /documents/:id` - Get document
- `POST /documents` - Create document
- `PUT /documents/:id` - Update document
- `DELETE /documents/:id` - Delete document
- `GET /documents/:id/collaborators` - Get active collaborators

### TCP Message Patterns (Internal)

- `document.get` - Get document
- `document.create` - Create document
- `document.yjs.update` - Apply Y.js update
- `document.yjs.stateVector` - Get document state vector
- `document.yjs.updateSince` - Get updates since state vector
- `document.awareness.update` - Update user awareness

## Starting the Services

### Development

```bash
# Start Document Editor Service
npm run start:dev document-editor-service

# Start API Gateway
npm run start:dev api-gateway
```

### Production

```bash
# Build all services
npm run build

# Start services
npm run start:prod document-editor-service
npm run start:prod api-gateway
```

## Configuration

### Ports

- API Gateway: `3000` (HTTP/WebSocket)
- API Gateway Microservice: `3001` (TCP)
- Document Editor Service: `3004` (TCP)

### Environment Variables

```env
FRONTEND_URL=http://localhost:3000
KAFKA_BROKERS=kafka:9092
```

## Advanced Features

### Persistence

To add database persistence, modify the Document Editor Service:

```typescript
// Add database storage
async saveDocumentState(documentId: string, state: Uint8Array) {
  // Save Y.js document state to database
}

async loadDocumentState(documentId: string): Promise<Uint8Array> {
  // Load Y.js document state from database
}
```

### Scaling

For horizontal scaling:

1. Use Redis for document state storage
2. Implement proper document room management
3. Add load balancer for WebSocket connections

### Security

Add authentication and authorization:

```typescript
@SubscribeMessage('document:join')
async handleJoinDocument(
  @MessageBody() data: { documentId: string; token: string },
  @ConnectedSocket() client: WebSocket,
) {
  // Validate JWT token
  const user = await this.authService.validateToken(data.token);
  // Check document permissions
  const hasAccess = await this.permissionService.canAccessDocument(user.id, data.documentId);
}
```

## Troubleshooting

### Common Issues

1. **Binary data not syncing**: Ensure you're converting ArrayBuffer to Uint8Array
2. **Conflicts not resolving**: Check Y.js update order and network connectivity
3. **Memory usage**: Implement document cleanup for inactive documents
4. **Connection drops**: Implement reconnection logic with exponential backoff

### Debug Mode

Enable detailed logging:

```typescript
// In document-editor-service.service.ts
private readonly logger = new Logger(DocumentEditorServiceService.name);
```

## Next Steps

1. **Implement persistence** with MongoDB/PostgreSQL
2. **Add authentication** and user management
3. **Scale horizontally** with Redis
4. **Add document versioning** and history
5. **Implement rich text features** with Quill/Monaco
6. **Add file upload** and media support
7. **Create document templates** and sharing

## Resources

- [Y.js Documentation](https://docs.yjs.dev/)
- [Y.js Protocol Guide](https://docs.yjs.dev/api/protocols)
- [Editor Bindings](https://docs.yjs.dev/ecosystem/editor-bindings)
- [Y.js Examples](https://github.com/yjs/yjs-demos)
