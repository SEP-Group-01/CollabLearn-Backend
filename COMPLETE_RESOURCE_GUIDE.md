# CollabLearn Resource Management with Firebase Storage

## 📋 Project Overview

Your CollabLearn project structure:

```
Workspace → Threads → Resources (Documents, Links, Videos)
    ↓         ↓         ↓
   ID      Thread_ID   3 separate pages with upload/view capabilities
```

## 🗄️ Step 1: Database Schema (Supabase)

### 1.1 Create Database Tables

Execute this SQL in your Supabase SQL Editor:

```sql
-- Create threads table for workspace organization
CREATE TABLE IF NOT EXISTS threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Create resources table for documents, videos, and links
CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN ('document', 'video', 'link')),

    -- Firebase Storage fields (for documents and videos)
    firebase_path VARCHAR(500),
    firebase_url VARCHAR(1000),
    file_name VARCHAR(255),
    file_size BIGINT,
    mime_type VARCHAR(100),

    -- Link fields
    external_url VARCHAR(1000),

    -- Metadata
    uploaded_by UUID NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    download_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT false,

    -- Ensure either firebase_path or external_url is provided based on type
    CONSTRAINT check_resource_data CHECK (
        (resource_type = 'link' AND external_url IS NOT NULL) OR
        (resource_type IN ('document', 'video') AND firebase_path IS NOT NULL)
    )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_threads_workspace_id ON threads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_resources_thread_id ON resources(thread_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_uploaded_by ON resources(uploaded_by);

-- Enable Row Level Security
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- RLS Policies for threads
CREATE POLICY "Users can view threads in their workspaces" ON threads
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create threads in their workspaces" ON threads
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for resources
CREATE POLICY "Users can view resources in their workspaces" ON resources
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        ) OR is_public = true
    );

CREATE POLICY "Users can upload resources to their workspaces" ON resources
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own resources" ON resources
    FOR UPDATE USING (uploaded_by = auth.uid());

CREATE POLICY "Users can delete their own resources" ON resources
    FOR DELETE USING (uploaded_by = auth.uid());
```

## 🔥 Step 2: Firebase Setup

### 2.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"**
3. Enter project name: `collab-learn-resources`
4. Enable Google Analytics (optional)
5. Click **"Create project"**

### 2.2 Enable Firebase Storage

1. In Firebase Console → **Storage**
2. Click **"Get started"**
3. Choose **"Start in test mode"**
4. Select storage location (closest to your users)
5. Click **"Done"**

### 2.3 Get Firebase Configuration

1. Go to **Project Settings** → **General** tab
2. Scroll to **"Your apps"** → Click web icon `</>`
3. Register app: `collab-learn-web`
4. Copy the configuration object

### 2.4 Set Firebase Security Rules

Go to **Storage** → **Rules** tab and replace with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow workspace members to access resources
    match /workspaces/{workspaceId}/threads/{threadId}/{resourceType}/{fileName} {
      // Read: Any authenticated user can download
      allow read: if request.auth != null;

      // Write: Authenticated users can upload with size limits
      allow write: if request.auth != null &&
                   request.resource.size < 100 * 1024 * 1024 && // 100MB limit
                   (resourceType == 'documents' || resourceType == 'videos');

      // Delete: Only the uploader can delete
      allow delete: if request.auth != null &&
                    resource.metadata.uploadedBy == request.auth.uid;
    }
  }
}
```

## 🏗️ Step 3: Backend Implementation

### 3.1 Create Resource Service

Create `apps/workspaces-service/src/services/resource.service.ts`:

```typescript
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from './supabase.service';

export interface Thread {
  id: string;
  workspace_id: string;
  title: string;
  description?: string;
  created_by: string;
  created_at: string;
  is_active: boolean;
}

export interface Resource {
  id: string;
  thread_id: string;
  workspace_id: string;
  title: string;
  description?: string;
  resource_type: 'document' | 'video' | 'link';
  firebase_path?: string;
  firebase_url?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  external_url?: string;
  uploaded_by: string;
  uploaded_at: string;
  download_count: number;
  uploader?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

@Injectable()
export class ResourceService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // Get threads for a workspace
  async getWorkspaceThreads(workspaceId: string): Promise<Thread[]> {
    const supabase = this.supabaseService.getClient();

    const { data: threads, error } = await supabase
      .from('threads')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(
        'Failed to fetch threads: ' + error.message,
      );
    }

    return threads || [];
  }

  // Create a new thread
  async createThread(
    workspaceId: string,
    title: string,
    description: string,
    userId: string,
  ): Promise<Thread> {
    const supabase = this.supabaseService.getClient();

    const { data: thread, error } = await supabase
      .from('threads')
      .insert({
        workspace_id: workspaceId,
        title,
        description,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        'Failed to create thread: ' + error.message,
      );
    }

    return thread;
  }

  // Get resources by thread and type
  async getResourcesByType(
    threadId: string,
    resourceType: 'document' | 'video' | 'link',
  ): Promise<Resource[]> {
    const supabase = this.supabaseService.getClient();

    const { data: resources, error } = await supabase
      .from('resources')
      .select(
        `
        *,
        users!resources_uploaded_by_fkey(id, first_name, last_name, email)
      `,
      )
      .eq('thread_id', threadId)
      .eq('resource_type', resourceType)
      .order('uploaded_at', { ascending: false });

    if (error) {
      throw new BadRequestException(
        'Failed to fetch resources: ' + error.message,
      );
    }

    // Get user profiles
    const userIds = resources?.map((resource) => resource.uploaded_by) || [];
    const { data: userProfiles } = await supabase
      .from('user_profiles')
      .select('id, display_name, avatar')
      .in('id', userIds);

    const userProfileMap = new Map();
    userProfiles?.forEach((profile) => {
      userProfileMap.set(profile.id, profile);
    });

    return (
      resources?.map((resource) => {
        const userAuth = resource.users;
        const userProfile = userProfileMap.get(resource.uploaded_by);

        return {
          id: resource.id,
          thread_id: resource.thread_id,
          workspace_id: resource.workspace_id,
          title: resource.title,
          description: resource.description,
          resource_type: resource.resource_type,
          firebase_path: resource.firebase_path,
          firebase_url: resource.firebase_url,
          file_name: resource.file_name,
          file_size: resource.file_size,
          mime_type: resource.mime_type,
          external_url: resource.external_url,
          uploaded_by: resource.uploaded_by,
          uploaded_at: resource.uploaded_at,
          download_count: resource.download_count,
          uploader: {
            id: userAuth?.id || resource.uploaded_by,
            name:
              userProfile?.display_name ||
              `${userAuth?.first_name || ''} ${userAuth?.last_name || ''}`.trim() ||
              'Unknown User',
            avatar: userProfile?.avatar,
          },
        };
      }) || []
    );
  }

  // Create a new resource
  async createResource(resourceData: {
    thread_id: string;
    workspace_id: string;
    title: string;
    description?: string;
    resource_type: 'document' | 'video' | 'link';
    firebase_path?: string;
    firebase_url?: string;
    file_name?: string;
    file_size?: number;
    mime_type?: string;
    external_url?: string;
    uploaded_by: string;
  }): Promise<Resource> {
    const supabase = this.supabaseService.getClient();

    const { data: resource, error } = await supabase
      .from('resources')
      .insert(resourceData)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        'Failed to create resource: ' + error.message,
      );
    }

    return {
      id: resource.id,
      thread_id: resource.thread_id,
      workspace_id: resource.workspace_id,
      title: resource.title,
      description: resource.description,
      resource_type: resource.resource_type,
      firebase_path: resource.firebase_path,
      firebase_url: resource.firebase_url,
      file_name: resource.file_name,
      file_size: resource.file_size,
      mime_type: resource.mime_type,
      external_url: resource.external_url,
      uploaded_by: resource.uploaded_by,
      uploaded_at: resource.uploaded_at,
      download_count: resource.download_count,
    };
  }

  // Delete a resource
  async deleteResource(
    resourceId: string,
    userId: string,
  ): Promise<string | null> {
    const supabase = this.supabaseService.getClient();

    const { data: resource } = await supabase
      .from('resources')
      .select('uploaded_by, firebase_path')
      .eq('id', resourceId)
      .single();

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    if (resource.uploaded_by !== userId) {
      throw new BadRequestException('You can only delete your own resources');
    }

    const { error } = await supabase
      .from('resources')
      .delete()
      .eq('id', resourceId);

    if (error) {
      throw new BadRequestException(
        'Failed to delete resource: ' + error.message,
      );
    }

    return resource.firebase_path; // Return for Firebase deletion
  }

  // Increment download count
  async incrementDownloadCount(resourceId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    await supabase
      .from('resources')
      .update({
        download_count: supabase.sql`download_count + 1`,
      })
      .eq('id', resourceId);
  }
}
```

### 3.2 Create Resource Controller

Create `apps/workspaces-service/src/controllers/resource.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ResourceService } from '../services/resource.service';

@Controller('resources')
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  // Get threads for workspace
  @Get('workspaces/:workspaceId/threads')
  async getWorkspaceThreads(@Param('workspaceId') workspaceId: string) {
    return this.resourceService.getWorkspaceThreads(workspaceId);
  }

  // Create thread
  @Post('threads')
  async createThread(
    @Body()
    data: {
      workspace_id: string;
      title: string;
      description?: string;
      created_by: string;
    },
  ) {
    return this.resourceService.createThread(
      data.workspace_id,
      data.title,
      data.description || '',
      data.created_by,
    );
  }

  // Get resources by type
  @Get('threads/:threadId/:resourceType')
  async getResourcesByType(
    @Param('threadId') threadId: string,
    @Param('resourceType') resourceType: 'document' | 'video' | 'link',
  ) {
    return this.resourceService.getResourcesByType(threadId, resourceType);
  }

  // Create resource
  @Post('create')
  async createResource(
    @Body()
    resourceData: {
      thread_id: string;
      workspace_id: string;
      title: string;
      description?: string;
      resource_type: 'document' | 'video' | 'link';
      firebase_path?: string;
      firebase_url?: string;
      file_name?: string;
      file_size?: number;
      mime_type?: string;
      external_url?: string;
      uploaded_by: string;
    },
  ) {
    return this.resourceService.createResource(resourceData);
  }

  // Delete resource
  @Delete(':resourceId')
  async deleteResource(
    @Param('resourceId') resourceId: string,
    @Query('userId') userId: string,
  ) {
    const firebasePath = await this.resourceService.deleteResource(
      resourceId,
      userId,
    );
    return { success: true, firebasePath };
  }

  // Increment download count
  @Post(':resourceId/download')
  async incrementDownloadCount(@Param('resourceId') resourceId: string) {
    await this.resourceService.incrementDownloadCount(resourceId);
    return { success: true };
  }
}
```

### 3.3 Update Module

Update `apps/workspaces-service/src/workspaces-service.module.ts`:

```typescript
import { ResourceService } from './services/resource.service';
import { ResourceController } from './controllers/resource.controller';

@Module({
  controllers: [WorkspacesController, ResourceController],
  providers: [WorkspacesService, SupabaseService, ResourceService],
})
```

## 💻 Step 4: Frontend Implementation

### 4.1 Install Firebase

```bash
cd your-frontend-directory
npm install firebase
```

### 4.2 Firebase Configuration

Create `src/firebase/config.js`:

```javascript
import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'your-api-key',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project-id.appspot.com',
  messagingSenderId: '123456789',
  appId: 'your-app-id',
};

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
export default app;
```

### 4.3 Upload Service

Create `src/services/uploadService.js`:

```javascript
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from '../firebase/config';

export class UploadService {
  static uploadFile(
    file,
    workspaceId,
    threadId,
    userId,
    resourceType,
    onProgress,
  ) {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const fileName = `${userId}_${timestamp}_${file.name}`;
      const storagePath = `workspaces/${workspaceId}/threads/${threadId}/${resourceType}s/${fileName}`;

      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file, {
        customMetadata: {
          uploadedBy: userId,
          workspaceId: workspaceId,
          threadId: threadId,
        },
      });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => reject(error),
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({
              firebase_path: storagePath,
              firebase_url: downloadURL,
              file_name: file.name,
              file_size: file.size,
              mime_type: file.type,
            });
          } catch (error) {
            reject(error);
          }
        },
      );
    });
  }

  static async deleteFile(firebasePath) {
    const storageRef = ref(storage, firebasePath);
    await deleteObject(storageRef);
  }
}
```

### 4.4 Document Page Component

Create `src/pages/DocumentsPage.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import { UploadService } from '../services/uploadService';

const DocumentsPage = ({ threadId, workspaceId, userId }) => {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadDocuments();
  }, [threadId]);

  const loadDocuments = async () => {
    try {
      const response = await fetch(
        `/api/resources/threads/${threadId}/document`,
      );
      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file || !title.trim()) {
      alert('Please provide a title and select a file');
      return;
    }

    setUploading(true);

    try {
      const uploadResult = await UploadService.uploadFile(
        file,
        workspaceId,
        threadId,
        userId,
        'document',
        setProgress,
      );

      const resourceData = {
        thread_id: threadId,
        workspace_id: workspaceId,
        title: title.trim(),
        description: description.trim(),
        resource_type: 'document',
        uploaded_by: userId,
        ...uploadResult,
      };

      const response = await fetch('/api/resources/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(resourceData),
      });

      if (response.ok) {
        setTitle('');
        setDescription('');
        loadDocuments();
        alert('Document uploaded successfully!');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDelete = async (document) => {
    if (!confirm('Delete this document?')) return;

    try {
      const response = await fetch(
        `/api/resources/${document.id}?userId=${userId}`,
        {
          method: 'DELETE',
        },
      );

      if (response.ok) {
        const { firebasePath } = await response.json();
        if (firebasePath) {
          await UploadService.deleteFile(firebasePath);
        }
        loadDocuments();
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleDownload = async (document) => {
    await fetch(`/api/resources/${document.id}/download`, { method: 'POST' });
    window.open(document.firebase_url, '_blank');
  };

  return (
    <div className="documents-page">
      <h2>Documents</h2>

      {/* Upload Form */}
      <div className="upload-section">
        <h3>Upload New Document</h3>
        <input
          type="text"
          placeholder="Document Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt,.ppt,.pptx"
          onChange={(e) => handleFileUpload(e.target.files[0])}
          disabled={uploading}
        />

        {uploading && (
          <div className="progress">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
            <span>{Math.round(progress)}%</span>
          </div>
        )}
      </div>

      {/* Documents List */}
      <div className="documents-list">
        {documents.map((doc) => (
          <div key={doc.id} className="document-card">
            <div className="doc-info">
              <h4>{doc.title}</h4>
              <p>{doc.description}</p>
              <span>
                By {doc.uploader?.name} •{' '}
                {new Date(doc.uploaded_at).toLocaleDateString()}
              </span>
              <span>Downloads: {doc.download_count}</span>
            </div>
            <div className="doc-actions">
              <button onClick={() => handleDownload(doc)}>Download</button>
              {doc.uploaded_by === userId && (
                <button onClick={() => handleDelete(doc)}>Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentsPage;
```

### 4.5 Videos Page Component

Create `src/pages/VideosPage.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import { UploadService } from '../services/uploadService';

const VideosPage = ({ threadId, workspaceId, userId }) => {
  const [videos, setVideos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadVideos();
  }, [threadId]);

  const loadVideos = async () => {
    try {
      const response = await fetch(`/api/resources/threads/${threadId}/video`);
      const data = await response.json();
      setVideos(data);
    } catch (error) {
      console.error('Error loading videos:', error);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file || !title.trim()) {
      alert('Please provide a title and select a video file');
      return;
    }

    // Check file size (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
      alert('File size must be less than 100MB');
      return;
    }

    setUploading(true);

    try {
      const uploadResult = await UploadService.uploadFile(
        file,
        workspaceId,
        threadId,
        userId,
        'video',
        setProgress,
      );

      const resourceData = {
        thread_id: threadId,
        workspace_id: workspaceId,
        title: title.trim(),
        description: description.trim(),
        resource_type: 'video',
        uploaded_by: userId,
        ...uploadResult,
      };

      const response = await fetch('/api/resources/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(resourceData),
      });

      if (response.ok) {
        setTitle('');
        setDescription('');
        loadVideos();
        alert('Video uploaded successfully!');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDelete = async (video) => {
    if (!confirm('Delete this video?')) return;

    try {
      const response = await fetch(
        `/api/resources/${video.id}?userId=${userId}`,
        {
          method: 'DELETE',
        },
      );

      if (response.ok) {
        const { firebasePath } = await response.json();
        if (firebasePath) {
          await UploadService.deleteFile(firebasePath);
        }
        loadVideos();
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handlePlay = async (video) => {
    await fetch(`/api/resources/${video.id}/download`, { method: 'POST' });
    window.open(video.firebase_url, '_blank');
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="videos-page">
      <h2>Videos</h2>

      {/* Upload Form */}
      <div className="upload-section">
        <h3>Upload New Video</h3>
        <input
          type="text"
          placeholder="Video Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          type="file"
          accept=".mp4,.avi,.mov,.wmv,.webm"
          onChange={(e) => handleFileUpload(e.target.files[0])}
          disabled={uploading}
        />
        <small>Maximum file size: 100MB</small>

        {uploading && (
          <div className="progress">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
            <span>{Math.round(progress)}%</span>
          </div>
        )}
      </div>

      {/* Videos List */}
      <div className="videos-list">
        {videos.map((video) => (
          <div key={video.id} className="video-card">
            <div className="video-thumbnail">🎥</div>
            <div className="video-info">
              <h4>{video.title}</h4>
              <p>{video.description}</p>
              <span>
                By {video.uploader?.name} •{' '}
                {new Date(video.uploaded_at).toLocaleDateString()}
              </span>
              <span>
                Size: {formatFileSize(video.file_size)} • Views:{' '}
                {video.download_count}
              </span>
            </div>
            <div className="video-actions">
              <button onClick={() => handlePlay(video)}>Play</button>
              {video.uploaded_by === userId && (
                <button onClick={() => handleDelete(video)}>Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideosPage;
```

### 4.6 Links Page Component

Create `src/pages/LinksPage.jsx`:

```jsx
import React, { useState, useEffect } from 'react';

const LinksPage = ({ threadId, workspaceId, userId }) => {
  const [links, setLinks] = useState([]);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadLinks();
  }, [threadId]);

  const loadLinks = async () => {
    try {
      const response = await fetch(`/api/resources/threads/${threadId}/link`);
      const data = await response.json();
      setLinks(data);
    } catch (error) {
      console.error('Error loading links:', error);
    }
  };

  const handleAddLink = async (e) => {
    e.preventDefault();

    if (!title.trim() || !url.trim()) {
      alert('Please provide both title and URL');
      return;
    }

    try {
      const resourceData = {
        thread_id: threadId,
        workspace_id: workspaceId,
        title: title.trim(),
        description: description.trim(),
        resource_type: 'link',
        external_url: url.trim(),
        uploaded_by: userId,
      };

      const response = await fetch('/api/resources/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(resourceData),
      });

      if (response.ok) {
        setTitle('');
        setUrl('');
        setDescription('');
        loadLinks();
        alert('Link added successfully!');
      }
    } catch (error) {
      console.error('Error adding link:', error);
      alert('Failed to add link');
    }
  };

  const handleDelete = async (link) => {
    if (!confirm('Delete this link?')) return;

    try {
      const response = await fetch(
        `/api/resources/${link.id}?userId=${userId}`,
        {
          method: 'DELETE',
        },
      );

      if (response.ok) {
        loadLinks();
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleVisit = async (link) => {
    await fetch(`/api/resources/${link.id}/download`, { method: 'POST' });
    window.open(link.external_url, '_blank');
  };

  return (
    <div className="links-page">
      <h2>Links</h2>

      {/* Add Link Form */}
      <div className="add-link-section">
        <h3>Add New Link</h3>
        <form onSubmit={handleAddLink}>
          <input
            type="text"
            placeholder="Link Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <input
            type="url"
            placeholder="URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button type="submit">Add Link</button>
        </form>
      </div>

      {/* Links List */}
      <div className="links-list">
        {links.map((link) => (
          <div key={link.id} className="link-card">
            <div className="link-icon">🔗</div>
            <div className="link-info">
              <h4>{link.title}</h4>
              <p>{link.description}</p>
              <span className="link-url">{link.external_url}</span>
              <span>
                Added by {link.uploader?.name} •{' '}
                {new Date(link.uploaded_at).toLocaleDateString()}
              </span>
              <span>Visits: {link.download_count}</span>
            </div>
            <div className="link-actions">
              <button onClick={() => handleVisit(link)}>Visit</button>
              {link.uploaded_by === userId && (
                <button onClick={() => handleDelete(link)}>Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LinksPage;
```

## 🎨 Step 5: CSS Styling

Create `src/styles/resources.css`:

```css
/* Resource Pages Styling */
.documents-page,
.videos-page,
.links-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.upload-section,
.add-link-section {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 30px;
}

.upload-section h3,
.add-link-section h3 {
  margin-bottom: 15px;
  color: #333;
}

.upload-section input,
.upload-section textarea,
.add-link-section input,
.add-link-section textarea {
  width: 100%;
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.upload-section button,
.add-link-section button {
  background: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.upload-section button:hover,
.add-link-section button:hover {
  background: #0056b3;
}

.progress {
  margin-top: 10px;
}

.progress-bar {
  height: 10px;
  background: #007bff;
  border-radius: 5px;
  transition: width 0.3s ease;
}

/* Resource Cards */
.documents-list,
.videos-list,
.links-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.document-card,
.video-card,
.link-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s ease;
}

.document-card:hover,
.video-card:hover,
.link-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.doc-info h4,
.video-info h4,
.link-info h4 {
  margin: 0 0 10px 0;
  color: #333;
}

.doc-info p,
.video-info p,
.link-info p {
  color: #666;
  margin-bottom: 10px;
  font-size: 14px;
}

.doc-info span,
.video-info span,
.link-info span {
  display: block;
  color: #888;
  font-size: 12px;
  margin-bottom: 5px;
}

.doc-actions,
.video-actions,
.link-actions {
  margin-top: 15px;
  display: flex;
  gap: 10px;
}

.doc-actions button,
.video-actions button,
.link-actions button {
  padding: 8px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.doc-actions button:first-child,
.video-actions button:first-child,
.link-actions button:first-child {
  background: #28a745;
  color: white;
}

.doc-actions button:last-child,
.video-actions button:last-child,
.link-actions button:last-child {
  background: #dc3545;
  color: white;
}

.video-thumbnail {
  font-size: 48px;
  text-align: center;
  margin-bottom: 15px;
}

.link-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.link-url {
  color: #007bff !important;
  word-break: break-all;
}

@media (max-width: 768px) {
  .documents-list,
  .videos-list,
  .links-list {
    grid-template-columns: 1fr;
  }

  .documents-page,
  .videos-page,
  .links-page {
    padding: 10px;
  }
}
```

## 🚀 Step 6: Integration Steps

### 6.1 Environment Variables

Create `.env.local` in your frontend:

```bash
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=your-app-id
```

### 6.2 Update API Gateway Routes

Add these routes to your API Gateway:

```typescript
// In API Gateway controller
@Get('workspaces/:id/threads')
@Get('resources/threads/:threadId/:resourceType')
@Post('resources/create')
@Delete('resources/:resourceId')
@Post('resources/:resourceId/download')
```

### 6.3 Run Database Migration

Execute the SQL schema in your Supabase dashboard.

### 6.4 Test Everything

1. Create a thread in your workspace
2. Upload documents, videos, and links
3. Verify files appear in Firebase Storage
4. Test download functionality
5. Test delete functionality

## ✅ Complete Implementation Checklist

- [ ] Database tables created in Supabase
- [ ] Firebase project configured
- [ ] Backend services implemented
- [ ] Frontend pages created
- [ ] Upload functionality working
- [ ] Download tracking implemented
- [ ] Delete functionality working
- [ ] File size limits enforced
- [ ] Security rules configured
- [ ] Styling applied

Your complete resource management system is now ready! 🎉

Students can now upload and share documents, videos, and links within workspace threads, with all files securely stored in Firebase and metadata in Supabase.
