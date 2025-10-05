# Firebase Setup Guide for CollabLearn Resources

## 🎯 Overview

This guide will help you set up Firebase Storage for your CollabLearn project to handle document, video, and link resources within workspace threads.

## 📋 Prerequisites

- Google account
- Node.js installed
- Your CollabLearn project running

## 🔥 Step 1: Create Firebase Project

### 1.1 Go to Firebase Console

1. Visit [Firebase Console](https://console.firebase.google.com/)
2. Sign in with your Google account
3. Click **"Create a project"**

### 1.2 Project Configuration

1. **Project name**: `collab-learn-resources` (or your preferred name)
2. **Google Analytics**: Enable (optional but recommended)
3. **Analytics account**: Create new or use existing
4. Click **"Create project"**
5. Wait for project creation (1-2 minutes)

### 1.3 Project Settings

1. Click **⚙️ Project settings** (gear icon)
2. Note down your **Project ID** (you'll need this)

## 🗄️ Step 2: Enable Firebase Storage

### 2.1 Navigate to Storage

1. In Firebase Console sidebar → **Storage**
2. Click **"Get started"**

### 2.2 Security Rules (Initial)

1. Choose **"Start in test mode"** for now
2. We'll update security rules later
3. Click **"Next"**

### 2.3 Storage Location

1. Choose location closest to your users:
   - **us-central1** (Iowa) - Default
   - **europe-west1** (Belgium) - Europe
   - **asia-northeast1** (Tokyo) - Asia
2. Click **"Done"**

### 2.4 Verify Storage Setup

- You should see the Storage dashboard
- Default bucket: `your-project-id.appspot.com`

## 🔐 Step 3: Configure Web App

### 3.1 Add Web App

1. In Project Overview → Click **"+ Add app"**
2. Select **Web** (`</>` icon)
3. **App nickname**: `collab-learn-web`
4. **Firebase Hosting**: Skip for now
5. Click **"Register app"**

### 3.2 Get Configuration

Copy the Firebase configuration object:

```javascript
const firebaseConfig = {
  apiKey: 'AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  authDomain: 'your-project-id.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project-id.appspot.com',
  messagingSenderId: '123456789012',
  appId: '1:123456789012:web:abcdef123456789',
};
```

## 📁 Step 4: Set Up Storage Structure

### 4.1 Storage Organization

Your files will be organized as:

```
/workspaces/{workspaceId}/
  └── threads/{threadId}/
      ├── documents/
      │   ├── user1_timestamp_document.pdf
      │   └── user2_timestamp_presentation.pptx
      ├── videos/
      │   ├── user1_timestamp_lecture.mp4
      │   └── user3_timestamp_demo.webm
      └── other files...
```

### 4.2 Update Storage Security Rules

1. Go to **Storage** → **Rules** tab
2. Replace the default rules with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow workspace members to access resources
    match /workspaces/{workspaceId}/threads/{threadId}/{resourceType}/{fileName} {

      // Read: Any authenticated user can download
      allow read: if request.auth != null;

      // Write: Authenticated users can upload with restrictions
      allow write: if request.auth != null &&
                   request.resource.size < 100 * 1024 * 1024 && // 100MB limit
                   (resourceType in ['documents', 'videos']) &&
                   fileName.matches('.*\\.(pdf|doc|docx|txt|ppt|pptx|mp4|avi|mov|wmv|webm)$');

      // Delete: Only the uploader or admin can delete
      allow delete: if request.auth != null &&
                    (resource.metadata.uploadedBy == request.auth.uid ||
                     request.auth.token.admin == true);
    }

    // Fallback rule for other paths
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

3. Click **"Publish"**

## 💻 Step 5: Frontend Setup

### 5.1 Install Firebase SDK

In your frontend directory:

```bash
npm install firebase
```

### 5.2 Create Firebase Configuration File

Create `src/firebase/config.js`:

```javascript
import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getAuth, signInWithCustomToken } from 'firebase/auth';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: 'your-api-key',
  authDomain: 'your-project-id.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project-id.appspot.com',
  messagingSenderId: 'your-sender-id',
  appId: 'your-app-id',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const storage = getStorage(app);
export const auth = getAuth(app);

// Function to authenticate with custom token
export const authenticateWithSupabase = async (supabaseToken) => {
  try {
    // You'll need to create custom tokens on your backend
    // This is a placeholder for the authentication flow
    console.log('Firebase authentication setup needed');
  } catch (error) {
    console.error('Firebase auth error:', error);
  }
};

export default app;
```

### 5.3 Create Environment Variables

Create `.env.local` in your frontend root:

```bash
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id

# Backend API
REACT_APP_API_URL=http://localhost:3000
```

### 5.4 Update Firebase Config to Use Environment Variables

Update `src/firebase/config.js`:

```javascript
import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
export default app;
```

## 🛠️ Step 6: Create Upload Service

Create `src/services/uploadService.js`:

```javascript
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  getMetadata,
} from 'firebase/storage';
import { storage } from '../firebase/config';

export class UploadService {
  /**
   * Upload file to Firebase Storage
   * @param {File} file - File to upload
   * @param {string} workspaceId - Workspace ID
   * @param {string} threadId - Thread ID
   * @param {string} userId - User ID
   * @param {string} resourceType - 'document' or 'video'
   * @param {function} onProgress - Progress callback
   * @returns {Promise} Upload result
   */
  static uploadFile(
    file,
    workspaceId,
    threadId,
    userId,
    resourceType,
    onProgress,
  ) {
    return new Promise((resolve, reject) => {
      // Validate file type
      const allowedTypes = {
        document: ['pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx', 'xls', 'xlsx'],
        video: ['mp4', 'avi', 'mov', 'wmv', 'webm', 'mkv'],
      };

      const fileExtension = file.name.split('.').pop().toLowerCase();
      if (!allowedTypes[resourceType]?.includes(fileExtension)) {
        reject(new Error(`Invalid file type for ${resourceType}`));
        return;
      }

      // Check file size (100MB limit)
      if (file.size > 100 * 1024 * 1024) {
        reject(new Error('File size must be less than 100MB'));
        return;
      }

      // Create unique filename
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${userId}_${timestamp}_${sanitizedFileName}`;

      // Create storage path
      const storagePath = `workspaces/${workspaceId}/threads/${threadId}/${resourceType}s/${fileName}`;
      const storageRef = ref(storage, storagePath);

      // Create upload task
      const uploadTask = uploadBytesResumable(storageRef, file, {
        customMetadata: {
          uploadedBy: userId,
          workspaceId: workspaceId,
          threadId: threadId,
          originalName: file.name,
          uploadTimestamp: new Date().toISOString(),
        },
      });

      // Handle upload progress and completion
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) {
            onProgress(Math.round(progress));
          }
        },
        (error) => {
          console.error('Upload error:', error);
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({
              firebase_path: storagePath,
              firebase_url: downloadURL,
              file_name: file.name,
              file_size: file.size,
              mime_type: file.type,
              storage_ref: storagePath,
            });
          } catch (error) {
            reject(error);
          }
        },
      );
    });
  }

  /**
   * Delete file from Firebase Storage
   * @param {string} firebasePath - Path to file in storage
   * @returns {Promise} Deletion result
   */
  static async deleteFile(firebasePath) {
    try {
      const storageRef = ref(storage, firebasePath);
      await deleteObject(storageRef);
      return { success: true };
    } catch (error) {
      console.error('Delete error:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   * @param {string} firebasePath - Path to file in storage
   * @returns {Promise} File metadata
   */
  static async getFileInfo(firebasePath) {
    try {
      const storageRef = ref(storage, firebasePath);
      const metadata = await getMetadata(storageRef);
      return metadata;
    } catch (error) {
      console.error('Metadata error:', error);
      throw error;
    }
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
```

## 🧪 Step 7: Test Firebase Setup

### 7.1 Create Test Component

Create `src/components/FirebaseTest.jsx`:

```jsx
import React, { useState } from 'react';
import { UploadService } from '../services/uploadService';

const FirebaseTest = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  const handleFileSelect = (e) => {
    setFile(e.target.files[0]);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);

    try {
      const result = await UploadService.uploadFile(
        file,
        'test-workspace',
        'test-thread',
        'test-user',
        'document',
        setProgress,
      );

      setResult(result);
      console.log('Upload successful:', result);
    } catch (error) {
      console.error('Upload failed:', error);
      setResult({ error: error.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h3>Firebase Upload Test</h3>

      <input
        type="file"
        onChange={handleFileSelect}
        accept=".pdf,.doc,.docx,.txt,.ppt,.pptx"
      />

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        style={{ marginLeft: '10px' }}
      >
        {uploading ? 'Uploading...' : 'Upload'}
      </button>

      {uploading && (
        <div style={{ marginTop: '10px' }}>
          <div>Progress: {progress}%</div>
          <div
            style={{
              width: '300px',
              height: '10px',
              background: '#ddd',
              borderRadius: '5px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: '#4CAF50',
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: '20px' }}>
          <h4>Result:</h4>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default FirebaseTest;
```

### 7.2 Test the Setup

1. Add the test component to your app
2. Try uploading a small file
3. Check Firebase Console → Storage to see the file
4. Verify the file structure matches your organization

## 🔒 Step 8: Security Configuration

### 8.1 Production Security Rules

For production, update your storage rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /workspaces/{workspaceId}/threads/{threadId}/{resourceType}/{fileName} {

      // Read: Check workspace membership via custom claims or function
      allow read: if request.auth != null &&
                 validateWorkspaceAccess(workspaceId, request.auth.uid);

      // Write: Authenticated workspace members with file validation
      allow write: if request.auth != null &&
                   validateWorkspaceAccess(workspaceId, request.auth.uid) &&
                   request.resource.size < 100 * 1024 * 1024 &&
                   resourceType in ['documents', 'videos'] &&
                   validateFileType(fileName, resourceType);

      // Delete: File owner or workspace admin
      allow delete: if request.auth != null &&
                    (resource.metadata.uploadedBy == request.auth.uid ||
                     hasAdminAccess(workspaceId, request.auth.uid));
    }
  }

  // Helper function to validate workspace access
  function validateWorkspaceAccess(workspaceId, userId) {
    // This would typically check against your user's custom claims
    // or make a call to your backend service
    return request.auth.token.workspaces != null &&
           workspaceId in request.auth.token.workspaces;
  }

  // Helper function to validate file types
  function validateFileType(fileName, resourceType) {
    return (resourceType == 'documents' &&
            fileName.matches('.*\\.(pdf|doc|docx|txt|ppt|pptx|xls|xlsx)$')) ||
           (resourceType == 'videos' &&
            fileName.matches('.*\\.(mp4|avi|mov|wmv|webm|mkv)$'));
  }

  // Helper function to check admin access
  function hasAdminAccess(workspaceId, userId) {
    return request.auth.token.admin == true ||
           request.auth.token.workspace_admins != null &&
           workspaceId in request.auth.token.workspace_admins;
  }
}
```

## 📊 Step 9: Monitoring and Analytics

### 9.1 Enable Firebase Analytics

1. Go to **Analytics** in Firebase Console
2. Review usage and storage metrics
3. Set up alerts for storage usage

### 9.2 Storage Quotas

- **Free tier**: 5GB storage, 1GB/day downloads
- **Paid tier**: $0.026/GB/month storage, $0.12/GB downloads
- Monitor usage in Firebase Console

## 🚀 Step 10: Integration with CollabLearn

### 10.1 Update Your Backend

Add Firebase admin SDK to your backend for server-side operations:

```bash
npm install firebase-admin
```

### 10.2 Backend Firebase Configuration

#### **Step 1: Create Service Account Key**

1. **Access Project Settings**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your `collab-learn-resources` project
   - Click **⚙️ Project settings** (gear icon in left sidebar)

2. **Navigate to Service Accounts**:
   - Click the **"Service accounts"** tab at the top
   - You'll see "Firebase Admin SDK" section

3. **Generate Private Key**:
   - Scroll down to **"Generate a private key"** section
   - Click **"Generate new private key"** button
   - A popup will appear with a warning

4. **Download and Secure the Key**:
   - Click **"Generate key"** in the popup
   - A JSON file will download automatically (e.g., `collab-learn-resources-firebase-adminsdk-abc123.json`)
   - **IMPORTANT**: This file contains sensitive credentials!

#### **Step 2: Secure the JSON File**

1. **Move to Secure Location**:

   ```bash
   # Create a secure directory in your backend project
   mkdir -p config/firebase

   # Move the downloaded file
   mv ~/Downloads/your-project-firebase-adminsdk-*.json config/firebase/service-account.json
   ```

2. **Add to .gitignore**:
   ```bash
   # Add to your .gitignore file
   config/firebase/
   *.json
   service-account*.json
   ```

#### **Step 3: Backend Environment Setup**

1. **Install Firebase Admin SDK** in your backend:

   ```bash
   cd apps/api-gateway  # or your main backend service
   npm install firebase-admin
   ```

2. **Create Environment Variables**:
   Add to your backend `.env` file:

   ```bash
   # Firebase Admin Configuration
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY_ID=your-private-key-id
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key-here\n-----END PRIVATE KEY-----"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-abc123@your-project.iam.gserviceaccount.com
   FIREBASE_CLIENT_ID=your-client-id
   FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
   FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
   FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-abc123%40your-project.iam.gserviceaccount.com

   # OR use the JSON file path (easier for development)
   FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase/service-account.json
   ```

#### **Step 4: Create Firebase Admin Service**

Create `src/services/firebase-admin.service.ts` in your backend:

```typescript
import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirebaseAdminService {
  private app: admin.app.App;

  constructor(private configService: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    if (!admin.apps.length) {
      // Option 1: Using JSON file path (easier for development)
      const serviceAccountPath = this.configService.get(
        'FIREBASE_SERVICE_ACCOUNT_PATH',
      );

      if (serviceAccountPath) {
        const serviceAccount = require(`../../${serviceAccountPath}`);
        this.app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: `${this.configService.get('FIREBASE_PROJECT_ID')}.appspot.com`,
        });
      } else {
        // Option 2: Using environment variables (better for production)
        const serviceAccount = {
          type: 'service_account',
          project_id: this.configService.get('FIREBASE_PROJECT_ID'),
          private_key_id: this.configService.get('FIREBASE_PRIVATE_KEY_ID'),
          private_key: this.configService
            .get('FIREBASE_PRIVATE_KEY')
            ?.replace(/\\n/g, '\n'),
          client_email: this.configService.get('FIREBASE_CLIENT_EMAIL'),
          client_id: this.configService.get('FIREBASE_CLIENT_ID'),
          auth_uri: this.configService.get('FIREBASE_AUTH_URI'),
          token_uri: this.configService.get('FIREBASE_TOKEN_URI'),
          auth_provider_x509_cert_url:
            'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url: this.configService.get(
            'FIREBASE_CLIENT_CERT_URL',
          ),
        };

        this.app = admin.initializeApp({
          credential: admin.credential.cert(
            serviceAccount as admin.ServiceAccount,
          ),
          storageBucket: `${serviceAccount.project_id}.appspot.com`,
        });
      }
    } else {
      this.app = admin.app();
    }
  }

  // Get Firebase Storage bucket
  getStorageBucket() {
    return this.app.storage().bucket();
  }

  // Create custom token for user authentication
  async createCustomToken(uid: string, claims?: object): Promise<string> {
    return this.app.auth().createCustomToken(uid, claims);
  }

  // Verify ID token
  async verifyIdToken(idToken: string) {
    return this.app.auth().verifyIdToken(idToken);
  }

  // Delete file from storage (server-side)
  async deleteFile(filePath: string): Promise<void> {
    const bucket = this.getStorageBucket();
    await bucket.file(filePath).delete();
  }

  // Get file metadata
  async getFileMetadata(filePath: string) {
    const bucket = this.getStorageBucket();
    const [metadata] = await bucket.file(filePath).getMetadata();
    return metadata;
  }
}
```

#### **Step 5: Extract Environment Variables from JSON**

To extract values from your downloaded JSON file for environment variables:

```javascript
// Quick script to extract values from service account JSON
const serviceAccount = require('./path/to/your/service-account.json');

console.log('Add these to your .env file:');
console.log(`FIREBASE_PROJECT_ID=${serviceAccount.project_id}`);
console.log(`FIREBASE_PRIVATE_KEY_ID=${serviceAccount.private_key_id}`);
console.log(`FIREBASE_PRIVATE_KEY="${serviceAccount.private_key}"`);
console.log(`FIREBASE_CLIENT_EMAIL=${serviceAccount.client_email}`);
console.log(`FIREBASE_CLIENT_ID=${serviceAccount.client_id}`);
console.log(`FIREBASE_AUTH_URI=${serviceAccount.auth_uri}`);
console.log(`FIREBASE_TOKEN_URI=${serviceAccount.token_uri}`);
console.log(`FIREBASE_CLIENT_CERT_URL=${serviceAccount.client_x509_cert_url}`);
```

#### **Step 6: Update Your Module**

Add to your main module (e.g., `app.module.ts`):

```typescript
import { FirebaseAdminService } from './services/firebase-admin.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // ... other imports
  ],
  providers: [
    FirebaseAdminService,
    // ... other providers
  ],
})
export class AppModule {}
```

#### **Step 7: Use in Your Services**

Now you can use Firebase Admin in your resource service:

```typescript
import { FirebaseAdminService } from './firebase-admin.service';

@Injectable()
export class ResourceService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly firebaseAdmin: FirebaseAdminService,
  ) {}

  async deleteResourceWithFile(resourceId: string, userId: string) {
    // Get resource from database
    const resource = await this.getResource(resourceId);

    // Delete from Firebase Storage (server-side)
    if (resource.firebase_path) {
      await this.firebaseAdmin.deleteFile(resource.firebase_path);
    }

    // Delete from database
    await this.deleteResource(resourceId, userId);
  }
}
```

#### **🔒 Security Best Practices**

1. **Never commit the JSON file** to version control
2. **Use environment variables** in production
3. **Restrict service account permissions** in Google Cloud Console
4. **Rotate keys regularly** (every 90 days recommended)
5. **Monitor usage** in Firebase Console

#### **📁 File Structure**

```
your-backend/
├── config/
│   └── firebase/
│       └── service-account.json  ← Keep this secure!
├── src/
│   └── services/
│       └── firebase-admin.service.ts
├── .env                          ← Environment variables
├── .gitignore                    ← Exclude service account
└── package.json
```

## 🚨 Common Startup Issues

### Error: "Cannot find module 'dist/main'"

**Problem**: Trying to run the main application instead of the specific service.

**Solution**: Run the workspaces-service specifically:

```bash
# Navigate to workspaces-service
cd apps\workspaces-service

# Start the service
npm run start:dev
```

**Alternative from root directory**:

```bash
npx nest start workspaces-service --watch
```

**Expected Output**:

```
[Nest] 12345  - 10/02/2025, 8:45:00 PM     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 10/02/2025, 8:45:00 PM     LOG [InstanceLoader] WorkspacesServiceModule dependencies initialized
[Nest] 12345  - 10/02/2025, 8:45:00 PM     LOG [NestApplication] Nest application successfully started
```

### Service Ports:

- **Workspaces Service**: `http://localhost:3005` ✅ **RUNNING**
- **Auth Service**: `http://localhost:3002`
- **Forum Service**: `http://localhost:3004`

## 🧪 Complete Postman Testing Guide

### 🎯 **Testing Methods**

#### **Method A: Direct Service Testing** (Recommended for setup)

- **Base URL**: `http://localhost:3005`
- **Simpler setup** - just start workspaces-service
- **Direct access** to resource endpoints

#### **Method B: Via API Gateway** (Production-like)

- **Base URL**: `http://localhost:3000/api/workspaces`
- **Full microservices** architecture
- **Requires Kafka** (more complex)

---

### 🔗 **Test 1: Create Link Resource** (Easiest - No file upload)

#### **Method A - Direct Service:**

```
POST http://localhost:3005/workspace/123e4567-e89b-12d3-a456-426614174000/threads/987fcdeb-51a2-43d1-9f12-123456789abc/links

Headers:
Content-Type: application/json

Body (raw JSON):
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "React Official Documentation",
  "description": "Complete guide to React development",
  "url": "https://react.dev"
}
```

#### **Method B - Via API Gateway:**

```
POST http://localhost:3000/api/workspaces/123e4567-e89b-12d3-a456-426614174000/threads/987fcdeb-51a2-43d1-9f12-123456789abc/links

Headers:
Content-Type: application/json

Body (raw JSON):
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "React Official Documentation",
  "description": "Complete guide to React development",
  "url": "https://react.dev"
}
```

**Expected Response:**

```json
{
  "id": "uuid-here",
  "thread_id": "987fcdeb-51a2-43d1-9f12-123456789abc",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "resource_type": "link",
  "title": "React Official Documentation",
  "description": "Complete guide to React development",
  "firebase_path": null,
  "firebase_url": "https://react.dev",
  "file_name": null,
  "file_size": null,
  "mime_type": null,
  "created_at": "2025-10-02T20:30:00.000Z",
  "updated_at": "2025-10-02T20:30:00.000Z"
}
```

---

### 📄 **Test 2: Upload Document** (With file upload)

**Request:**

```
POST http://localhost:3005/workspace/123e4567-e89b-12d3-a456-426614174000/threads/987fcdeb-51a2-43d1-9f12-123456789abc/documents

Headers:
Content-Type: multipart/form-data

Body (form-data):
- user_id: 550e8400-e29b-41d4-a716-446655440000
- title: Sample PDF Document
- description: Test document for resource management
- file: [Select a PDF file from your computer]
```

**Expected Response:**

```json
{
  "id": "uuid-here",
  "thread_id": "987fcdeb-51a2-43d1-9f12-123456789abc",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "resource_type": "document",
  "title": "Sample PDF Document",
  "description": "Test document for resource management",
  "firebase_path": "workspaces/123e4567.../threads/987fcdeb.../documents/user_timestamp_filename.pdf",
  "firebase_url": "https://firebasestorage.googleapis.com/...",
  "file_name": "sample.pdf",
  "file_size": 1024567,
  "mime_type": "application/pdf",
  "created_at": "2025-10-02T20:35:00.000Z",
  "updated_at": "2025-10-02T20:35:00.000Z"
}
```

---

### 🎥 **Test 3: Upload Video** (With file upload)

**Request:**

```
POST http://localhost:3005/workspace/123e4567-e89b-12d3-a456-426614174000/threads/987fcdeb-51a2-43d1-9f12-123456789abc/videos

Headers:
Content-Type: multipart/form-data

Body (form-data):
- user_id: 550e8400-e29b-41d4-a716-446655440000
- title: Tutorial Video
- description: Educational video content
- file: [Select an MP4 file from your computer]
```

---

### 📋 **Test 4: Get All Resources by Type**

**Get All Links:**

```
GET http://localhost:3005/workspace/123e4567-e89b-12d3-a456-426614174000/threads/987fcdeb-51a2-43d1-9f12-123456789abc/links
```

**Get All Documents:**

```
GET http://localhost:3005/workspace/123e4567-e89b-12d3-a456-426614174000/threads/987fcdeb-51a2-43d1-9f12-123456789abc/documents
```

**Get All Videos:**

```
GET http://localhost:3005/workspace/123e4567-e89b-12d3-a456-426614174000/threads/987fcdeb-51a2-43d1-9f12-123456789abc/videos
```

---

### 🗑️ **Test 5: Delete Resource**

**Request:**

```
DELETE http://localhost:3005/workspace/123e4567-e89b-12d3-a456-426614174000/threads/987fcdeb-51a2-43d1-9f12-123456789abc/links/[RESOURCE-ID]

Headers:
Content-Type: application/json

Body (raw JSON):
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 🛠️ Postman Setup Instructions

### 1. **Create New Collection**

- Name: "CollabLearn Resource Management"
- Base URL Variable: `{{base_url}}` = `http://localhost:3005`

### 2. **Add Environment Variables**

Create a new environment with these variables:

```
base_url: http://localhost:3005
workspace_id: 123e4567-e89b-12d3-a456-426614174000
thread_id: 987fcdeb-51a2-43d1-9f12-123456789abc
user_id: 550e8400-e29b-41d4-a716-446655440000
```

### 3. **Sample Request Templates**

**Create Link (Template):**

```
POST {{base_url}}/workspace/{{workspace_id}}/threads/{{thread_id}}/links

{
  "user_id": "{{user_id}}",
  "title": "Sample Link",
  "description": "Link description",
  "url": "https://example.com"
}
```

**Upload Document (Template):**

```
POST {{base_url}}/workspace/{{workspace_id}}/threads/{{thread_id}}/documents

Form Data:
- user_id: {{user_id}}
- title: Sample Document
- description: Document description
- file: [Select file]
```

---

## ⚠️ Troubleshooting Common Issues

### Issue: Service not responding

**Solution:** Check if service is running:

```bash
curl http://localhost:3005
# Should return some response, not connection refused
```

### Issue: Database connection error

**Solution:** Verify Supabase environment variables in `.env`:

```bash
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key
```

### Issue: Firebase upload fails

**Solution:**

1. Check Firebase service account file exists
2. Verify Firebase project configuration
3. Check Firebase Storage rules allow uploads

### Issue: "thread_resources table doesn't exist"

**Solution:** Run the CREATE TABLE SQL in your Supabase SQL editor

---

## 📊 Testing Sequence (Recommended Order)

1. **Start with Links** (no file upload complexity)
2. **Test Document Upload** (PDF files work best)
3. **Test Video Upload** (small MP4 files)
4. **Test GET endpoints** (verify data retrieval)
5. **Test DELETE endpoints** (cleanup and Firebase integration)

---

## 🎯 Expected Success Indicators

✅ **Link Creation**: Returns JSON with `resource_type: "link"`  
✅ **File Upload**: Returns `firebase_path` and `firebase_url`  
✅ **GET Requests**: Returns arrays of resources  
✅ **DELETE Requests**: Returns success message + removes from Firebase  
✅ **Database**: Records visible in Supabase `thread_resources` table

## 📋 Pre-Testing Checklist:

1. ✅ **Database Table Created**: Run this SQL in Supabase:

   ```sql
   CREATE TABLE thread_resources (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     thread_id UUID REFERENCES threads(id),
     user_id UUID REFERENCES users(id),
     resource_type VARCHAR(20) CHECK (resource_type IN ('document', 'video', 'link')),
     title VARCHAR(255) NOT NULL,
     description TEXT,

     -- Firebase Storage fields
     firebase_path VARCHAR(500),
     firebase_url VARCHAR(1000),
     file_name VARCHAR(255),
     file_size BIGINT,
     mime_type VARCHAR(100),

     -- Standard fields
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );
   ```

2. ✅ **Services Running**:
   - Start Workspaces Service: `npx nest start workspaces-service --watch`
   - Service accessible at: `http://localhost:3005`

3. ✅ **Firebase Config**: Service account JSON file configured
4. ✅ **Environment Variables**: `.env` file with database and Firebase settings

## 🚀 Service Startup Commands

### Option 1: Direct Service Testing (Resource endpoints only)

```bash
# Start workspaces service directly
npx nest start workspaces-service --watch
```

**Test URLs:** `http://localhost:3005/workspace/.../threads/.../links`

### Option 2: Full Microservices Architecture (API Gateway + Services)

```bash
# 1. Start Docker services (if using Kafka)
docker-compose up -d zookeeper kafka

# 2. Start API Gateway (port 3000)
npx nest start api-gateway --watch

# 3. Start Workspaces Service (port 3005)
npx nest start workspaces-service --watch
```

**Test URLs:** `http://localhost:3000/api/workspaces/.../threads/.../links`

### Option 3: Quick Testing (Skip Docker/Kafka for now)

```bash
# Just start workspaces service for resource testing
npx nest start workspaces-service --watch
```

**Recommended for first-time testing!**
