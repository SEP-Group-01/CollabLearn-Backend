# Firebase Configuration for CollabLearn Document Editor

## Firebase Project Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project: `collablearn-production`
3. Enable Google Analytics (optional)

### 2. Enable Firebase Storage

1. In Firebase Console → Storage
2. Get started with Cloud Storage
3. Choose production mode for security rules
4. Select storage location (prefer same region as your backend)

### 3. Storage Rules Configuration

```javascript
// storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Thread-based document media files
    match /threads/{threadId}/documents/{documentId}/media/{fileName} {
      // Allow read if user has read permission to document
      allow read: if hasDocumentPermission(documentId, 'read');

      // Allow write if user has write permission to document
      allow write: if hasDocumentPermission(documentId, 'write')
                   && isValidMediaFile(resource);

      // Allow delete if user has admin permission or is file owner
      allow delete: if hasDocumentPermission(documentId, 'admin')
                    || isFileOwner(documentId, fileName);
    }

    // Thread attachments (general files not tied to specific documents)
    match /threads/{threadId}/attachments/{fileName} {
      allow read: if hasThreadPermission(threadId, 'read');
      allow write: if hasThreadPermission(threadId, 'write') && isValidFile(resource);
      allow delete: if hasThreadPermission(threadId, 'admin') || isUploader(fileName);
    }

    // Document backups (admin only)
    match /threads/{threadId}/documents/{documentId}/backups/{fileName} {
      allow read, write: if hasDocumentPermission(documentId, 'admin');
    }

    // Workspace-level templates and exports
    match /workspaces/{workspaceId}/templates/{fileName} {
      allow read: if hasWorkspacePermission(workspaceId, 'read');
      allow write: if hasWorkspacePermission(workspaceId, 'admin');
    }

    // User avatars/profile images
    match /users/{userId}/avatar/{fileName} {
      allow read: if true; // Public read
      allow write: if isAuthenticated() && request.auth.uid == userId;
    }

    // Temporary uploads (for processing)
    match /users/{userId}/temp/{fileName} {
      allow read, write: if isAuthenticated() && request.auth.uid == userId;
    }
  }
}

// Helper functions
function isAuthenticated() {
  return request.auth != null;
}

function hasDocumentPermission(documentId, level) {
  // This would need to be implemented with custom claims or Firestore
  // For now, we'll validate on the backend
  return isAuthenticated();
}

function hasThreadPermission(threadId, level) {
  // Check if user has permission to access the thread
  return isAuthenticated();
}

function hasWorkspacePermission(workspaceId, level) {
  // Check if user has permission to access the workspace
  return isAuthenticated();
}

function isValidMediaFile(resource) {
  return resource.size < 50 * 1024 * 1024 // 50MB limit
      && resource.contentType.matches('image/.*|video/.*|application/pdf|text/.*|application/msword|application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

function isValidFile(resource) {
  return resource.size < 100 * 1024 * 1024; // 100MB limit for general attachments
}

function isFileOwner(documentId, fileName) {
  // Check if the current user uploaded this file
  return isAuthenticated();
}

function isUploader(fileName) {
  // Check if the current user uploaded this attachment
  return isAuthenticated();
}
```

### 4. Storage Bucket Structure

```
/threads/{threadId}/
  ├── documents/{documentId}/
  │   ├── media/
  │   │   ├── images/
  │   │   │   ├── {fileId}.jpg
  │   │   │   ├── {fileId}.png
  │   │   │   └── thumbnails/
  │   │   │       ├── {fileId}_thumb.jpg
  │   │   │       └── {fileId}_thumb.png
  │   │   ├── videos/
  │   │   │   ├── {fileId}.mp4
  │   │   │   └── thumbnails/
  │   │   │       └── {fileId}_thumb.jpg
  │   │   ├── documents/
  │   │   │   ├── {fileId}.pdf
  │   │   │   ├── {fileId}.docx
  │   │   │   └── {fileId}.txt
  │   │   └── other/
  │   │       └── {fileId}.{ext}
  │   ├── exports/
  │   │   ├── {timestamp}_export.pdf
  │   │   ├── {timestamp}_export.docx
  │   │   └── {timestamp}_export.html
  │   └── backups/
  │       ├── {timestamp}_full_backup.zip
  │       └── versions/
  │           └── {versionId}_backup.json
  └── attachments/
      ├── images/
      └── files/

/workspaces/{workspaceId}/
  ├── templates/
  │   ├── document_templates/
  │   └── previews/
  └── exports/
      └── workspace_reports/

/users/{userId}/
  ├── avatar/
  │   └── profile.jpg
  └── temp/
      └── {uploadId}.{ext}
```

### 5. Environment Variables

Add to your `.env` file:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=collablearn-production
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@collablearn-production.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nXXXXXXXXXXXXXXXX\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=collablearn-production.appspot.com

# Firebase Storage URLs
FIREBASE_STORAGE_URL=https://firebasestorage.googleapis.com/v0/b/collablearn-production.appspot.com/o
```

### 6. Service Account Setup

1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate new private key
3. Download the JSON file
4. Extract the required fields for environment variables:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`

### 7. File Naming Convention

```typescript
// Document media file naming
const mediaPath = `threads/${threadId}/documents/${documentId}/media/${mediaType}/${fileId}.${extension}`;

// Examples:
// threads/thread_123/documents/doc_456/media/images/img_789.jpg
// threads/thread_123/documents/doc_456/media/videos/vid_012.mp4
// threads/thread_123/documents/doc_456/media/documents/pdf_345.pdf

// Thread attachment naming
const attachmentPath = `threads/${threadId}/attachments/${category}/${fileId}.${extension}`;

// Examples:
// threads/thread_123/attachments/images/img_678.jpg
// threads/thread_123/attachments/files/doc_901.pdf

// Thumbnail naming
const thumbnailPath = `threads/${threadId}/documents/${documentId}/media/${mediaType}/thumbnails/${fileId}_thumb.jpg`;

// Export naming
const exportPath = `threads/${threadId}/documents/${documentId}/exports/${timestamp}_${format}.${extension}`;

// Backup naming
const backupPath = `threads/${threadId}/documents/${documentId}/backups/${timestamp}_full_backup.zip`;

// Workspace template naming
const templatePath = `workspaces/${workspaceId}/templates/${category}/${templateId}.${extension}`;
```

### 8. Security Considerations

1. **File Size Limits**:
   - Images: 10MB max
   - Videos: 100MB max
   - Documents: 25MB max
   - Total per document: 500MB max

2. **File Type Restrictions**:
   - Images: jpg, jpeg, png, gif, webp
   - Videos: mp4, webm, mov
   - Documents: pdf, doc, docx, txt, rtf
   - Archives: zip (for backups only)

3. **Access Control**:
   - All file access goes through backend API
   - No direct Firebase Storage access from frontend
   - Files are served with temporary signed URLs
   - URLs expire after 1 hour

4. **Content Scanning**:
   - Virus scanning for uploaded files
   - Content moderation for images
   - File type validation
   - Size validation

### 9. CDN and Performance

```typescript
// Firebase Storage CDN URLs
const cdnUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(filePath)}?alt=media`;

// Optimized image URLs with transforms
const optimizedImageUrl = `${cdnUrl}&token=${token}&w=800&h=600&fit=crop`;
```

### 10. Monitoring and Analytics

1. Enable Firebase Storage monitoring
2. Set up alerts for:
   - Storage quota usage (>80%)
   - High error rates
   - Unusual download patterns
   - Large file uploads

3. Track metrics:
   - File upload success rate
   - Average file size
   - Storage usage per document
   - Download bandwidth usage
