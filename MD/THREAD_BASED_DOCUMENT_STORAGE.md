# Thread-Based Document Storage Implementation

## Updated Database Schema

The document storage has been updated to use a **thread-based architecture** instead of workspace-based, aligning with your application's structure where documents belong to threads, and threads belong to workspaces.

### Key Schema Changes

1. **Documents Table**: `workspace_id` → `thread_id`
2. **New View**: `documents_with_latest_version` includes thread and workspace information
3. **Updated Indexes**: Optimized for thread-based queries
4. **Firebase Storage**: Organized by thread hierarchy

## Database Migration Required

Run this SQL in your Supabase console:

```sql
-- Update existing documents table if it exists
ALTER TABLE documents DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE documents ADD COLUMN thread_id UUID REFERENCES threads(id) ON DELETE CASCADE;

-- Update indexes
DROP INDEX IF EXISTS idx_documents_workspace_id;
CREATE INDEX IF NOT EXISTS idx_documents_thread_id ON documents(thread_id);
```

## Updated API Methods

### DatabaseService Methods

```typescript
// New method: Get documents by thread
async getDocumentsByThread(threadId: string, userId: string): Promise<Document[]>

// Updated method: Get documents by workspace (via threads)
async getDocumentsByWorkspace(workspaceId: string, userId: string): Promise<Document[]>

// New method: Search documents within a thread
async searchDocumentsByThread(query: string, threadId: string, userId: string): Promise<Document[]>

// Updated method: Create document with thread_id
async createDocument(data: {
  title: string;
  content: string;
  yjs_state: Buffer;
  thread_id: string;  // Changed from workspace_id
  created_by: string;
  is_public?: boolean;
}): Promise<Document>
```

### FirebaseStorageService Methods

```typescript
// Updated method: Upload file with optional threadId
async uploadFile(
  file: Express.Multer.File,
  documentId: string,
  userId: string,
  threadId?: string,  // New optional parameter
): Promise<MediaUploadResult>

// Updated method: Create backup with thread context
async createDocumentBackup(
  documentId: string,
  content: string,
  versions: any[],
  permissions: any[],
  auditLog: any[],
  threadId?: string,  // New optional parameter
): Promise<string>
```

## Firebase Storage Structure

### Hierarchical Organization

```
/threads/{threadId}/
  ├── documents/{documentId}/
  │   ├── media/
  │   │   ├── images/
  │   │   ├── videos/
  │   │   ├── documents/
  │   │   └── other/
  │   ├── exports/
  │   └── backups/
  └── attachments/          # Thread-level attachments
      ├── images/
      └── files/

/workspaces/{workspaceId}/   # Workspace-level resources
  ├── templates/
  └── exports/

/users/{userId}/             # User-specific files
  ├── avatar/
  └── temp/
```

### Path Examples

```typescript
// Document media in thread
`threads/thread_123/documents/doc_456/media/images/img_789.jpg`
// Thread-level attachment
`threads/thread_123/attachments/files/spec_document.pdf`
// Document backup
`threads/thread_123/documents/doc_456/backups/2025-10-09_backup.zip`
// Workspace template
`workspaces/workspace_abc/templates/meeting_notes.html`;
```

## Benefits of Thread-Based Structure

### 1. **Logical Organization**

- Documents naturally grouped by thread context
- Easier to manage thread-specific resources
- Clear hierarchy: Workspace → Thread → Document

### 2. **Permission Management**

- Thread-level access control
- Inherited workspace permissions
- Document-specific overrides

### 3. **Performance Optimization**

- Faster queries within thread scope
- Reduced data transfer for thread views
- Better caching strategies

### 4. **Backup and Export**

- Thread-level exports for project delivery
- Document backups with thread context
- Easier migration between threads

## Usage Examples

### Creating a Document

```typescript
// Create document in specific thread
const document = await databaseService.createDocument({
  title: 'Project Requirements',
  content: 'Initial requirements...',
  yjs_state: yjsBuffer,
  thread_id: 'thread_123',
  created_by: 'user_456',
  is_public: false,
});
```

### Uploading Media

```typescript
// Upload file to document within thread context
const mediaResult = await firebaseStorageService.uploadFile(
  file,
  documentId,
  userId,
  threadId, // Thread context for proper organization
);
```

### Querying Documents

```typescript
// Get all documents in a thread
const threadDocs = await databaseService.getDocumentsByThread(threadId, userId);

// Get all documents in workspace (across all threads)
const workspaceDocs = await databaseService.getDocumentsByWorkspace(
  workspaceId,
  userId,
);

// Search within specific thread
const searchResults = await databaseService.searchDocumentsByThread(
  'requirements',
  threadId,
  userId,
);
```

## Migration Strategy

### Phase 1: Update Schema

1. Run database migration to add `thread_id` column
2. Update indexes for performance
3. Create the new view with thread/workspace joins

### Phase 2: Update Services

1. Deploy updated DatabaseService with thread methods
2. Deploy updated FirebaseStorageService with thread support
3. Update API endpoints to accept thread context

### Phase 3: Data Migration (if needed)

1. Migrate existing documents to appropriate threads
2. Reorganize Firebase Storage structure
3. Update existing file references

### Phase 4: Frontend Updates

1. Update document creation to specify thread
2. Update file upload components with thread context
3. Update document listing to use thread-based queries

## Environment Variables

No changes needed - existing Supabase and Firebase configuration remains the same.

## Security Considerations

### Row Level Security Updates

```sql
-- Update RLS policies for thread-based access
CREATE POLICY "Users can view documents in threads they have access to" ON documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM document_permissions dp
            WHERE dp.document_id = documents.id
            AND dp.user_id = auth.uid()
            AND dp.is_active = TRUE
        ) OR
        EXISTS (
            SELECT 1 FROM threads t
            JOIN workspaces w ON t.workspace_id = w.id
            JOIN workspace_members wm ON w.id = wm.workspace_id
            WHERE t.id = documents.thread_id
            AND wm.user_id = auth.uid()
            AND wm.is_active = TRUE
        )
    );
```

## Monitoring and Analytics

### New Metrics to Track

- Documents per thread
- Thread activity levels
- Storage usage by thread
- Cross-thread document references

This thread-based architecture provides better organization, improved performance, and clearer data relationships that align with your application's workflow!
