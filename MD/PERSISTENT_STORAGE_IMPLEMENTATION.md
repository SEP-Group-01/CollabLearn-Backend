# Required Dependencies for Persistent Storage

## NPM Dependencies to Install

Run these commands in your CollabLearn-Backend directory:

```bash
# Supabase client
npm install @supabase/supabase-js

# Firebase Admin SDK
npm install firebase-admin

# Additional utilities for media processing (optional but recommended)
npm install sharp  # For image processing and thumbnails
npm install archiver  # For creating ZIP archives
npm install pdfkit  # For PDF generation

# Development dependencies for better TypeScript support
npm install --save-dev @types/sharp @types/archiver @types/pdfkit
```

## Environment Variables to Add

Add these to your `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# Redis Configuration (already exists but ensure these are set)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## Database Migration

Run the SQL migration file to create the database schema:

```sql
-- Execute the contents of: database/migrations/004_document_storage_schema.sql
-- in your Supabase SQL editor or PostgreSQL client
```

## File Structure Changes

Your updated service structure should be:

```
apps/document-editor-service/src/services/
├── document-editor-service.service.ts  (main orchestrator)
├── document-management.service.ts       (version control, permissions)
├── document-export.service.ts          (export functionality)
├── redis.service.ts                    (real-time cache & pub/sub)
├── database.service.ts                 (persistent Supabase storage)
├── firebase-storage.service.ts         (media file storage)
└── media.service.ts                    (media management - can be deprecated)
```

## Key Changes Made

### 1. **Persistent Document Storage**

- Documents now saved to Supabase PostgreSQL
- Y.js document state persisted as binary data
- Version history stored with proper indexing
- Full-text search capability

### 2. **Media File Storage**

- Files uploaded to Firebase Storage
- Metadata stored in Supabase
- Automatic thumbnail generation (placeholder implementation)
- Organized folder structure in Firebase

### 3. **Permissions & Security**

- Row-level security policies in Supabase
- Granular permissions (read/write/admin)
- Audit logging for all actions
- File access control through signed URLs

### 4. **Real-time Features**

- Redis still handles real-time collaboration
- Document state synced between Redis and Supabase
- User presence and awareness data in Redis
- Event publishing for distributed systems

### 5. **Backup & Export**

- Full document backups to Firebase Storage
- Export to PDF, DOCX, HTML with metadata
- Version history included in backups
- Audit trail preservation

## Migration Strategy

1. **Phase 1**: Add new services alongside existing ones
2. **Phase 2**: Run database migration to create tables
3. **Phase 3**: Configure Firebase Storage
4. **Phase 4**: Update environment variables
5. **Phase 5**: Test with new document creation
6. **Phase 6**: Migrate existing documents (if any)

## Performance Considerations

- **Caching**: Redis caches frequently accessed documents
- **Lazy Loading**: Documents loaded from DB only when needed
- **Connection Pooling**: Supabase handles connection management
- **CDN**: Firebase Storage provides global CDN for media files
- **Indexing**: Database indexes on common query patterns

## Monitoring & Alerts

Set up monitoring for:

- Database connection health
- Firebase Storage quota usage
- Redis memory usage
- File upload success rates
- Document synchronization errors
