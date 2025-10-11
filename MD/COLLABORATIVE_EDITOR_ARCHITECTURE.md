# Real-time Collaborative Document Editor Architecture

## Current Issues Identified

1. **Port Mismatch**: Document Editor Service was running on port 3004 but API Gateway expected port 3006 ✅ FIXED
2. **Dual Collaboration Systems**: You have both WebSocket custom implementation and Yjs CRDT - need to unify
3. **Missing Features**: Version control, permissions, audit trail, export capabilities need proper integration

## Recommended Architecture

```
Frontend (React)
├── Collaboration Hooks
│   ├── useYjsCollaboration (Primary - CRDT)
│   └── useWebSocketCollaboration (Fallback)
├── Document Editor Component
├── Version Control UI
├── User Presence Indicators
└── Export/Import Handlers

API Gateway (Port 3000)
├── WebSocket Gateway (document-editor.gateway.ts)
├── REST Controllers
│   ├── DocumentController (CRUD)
│   ├── VersionController (snapshots)
│   ├── PermissionsController
│   └── ExportController
└── Microservice Clients

Document Editor Service (Port 3006)
├── Yjs Document Management
├── Version Control Service
├── Permissions Service
├── Audit Service
└── Export Service

External Services
├── Supabase (Document Storage)
├── Firebase (Media Storage)
└── File Export Service
```

## Component Relationships

### 1. Real-time Collaboration (CRDT)

**Primary**: Yjs with WebSocket Provider
**Fallback**: Custom WebSocket implementation

### 2. Version Control

**Storage**: Supabase with document snapshots
**Triggers**: Auto-save intervals, manual saves, major edits

### 3. User Presence & Awareness

**Implementation**: Yjs Awareness API
**Features**: Cursor tracking, active users, user colors

### 4. Permissions System

**Levels**: Read, Write, Admin
**Integration**: Middleware on all document operations

### 5. Media Support

**Storage**: Firebase Storage
**Integration**: Upload API with document embedding

### 6. Export Capabilities

**Formats**: PDF, DOCX, HTML
**Implementation**: Dedicated export service

## Implementation Priority

1. **Unify Collaboration** (Yjs as primary)
2. **Add Version Control**
3. **Implement Permissions**
4. **Add Export Features**
5. **Enhance Audit Trail**
