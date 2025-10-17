import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import type { Bucket } from '@google-cloud/storage';

@Injectable()
export class FirebaseStorageService {
  private readonly logger = new Logger(FirebaseStorageService.name);
  private storage: admin.storage.Storage;
  private bucket: Bucket;

  constructor() {
    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
      try {
        // Check if running in production with service account
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
        const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
        
        if (!storageBucket) {
          this.logger.warn('⚠️ FIREBASE_STORAGE_BUCKET not set - image uploads will be disabled');
          this.logger.warn('💡 To enable image uploads:');
          this.logger.warn('   1. Set FIREBASE_STORAGE_BUCKET in .env');
          this.logger.warn('   2. Set FIREBASE_SERVICE_ACCOUNT_PATH in .env');
          this.logger.warn('   3. Add Firebase service account JSON file');
          return; // Don't initialize, but don't crash either
        }

        this.logger.log(`🔧 Initializing Firebase with bucket: ${storageBucket}`);
        
        if (serviceAccountPath) {
          // Load service account from file
          this.logger.log(`📄 Loading service account from: ${serviceAccountPath}`);
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const serviceAccount = require(`../../../../../${serviceAccountPath}`);
          
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: storageBucket,
          });
        } else {
          // Development: use application default credentials or env vars
          this.logger.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_PATH not set, using default credentials');
          admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            storageBucket: storageBucket,
          });
        }
        
        this.logger.log('✅ Firebase Admin initialized successfully');
        this.storage = admin.storage();
        this.bucket = this.storage.bucket();
        this.logger.log(`📦 Firebase Storage bucket ready: ${this.bucket.name}`);
      } catch (error) {
        this.logger.error('❌ Firebase Admin initialization failed:', error);
        this.logger.warn('⚠️ Image uploads will be disabled');
        this.logger.warn('💡 To fix: Check FIREBASE_STORAGE_BUCKET and FIREBASE_SERVICE_ACCOUNT_PATH in .env');
        // Don't throw - allow service to start without Firebase
      }
    } else {
      // Firebase already initialized
      this.storage = admin.storage();
      this.bucket = this.storage.bucket();
      this.logger.log(`📦 Firebase Storage bucket ready: ${this.bucket.name}`);
    }
  }

  /**
   * Upload a base64 encoded image to Firebase Storage
   * @param base64Data - Base64 encoded image data (without data:image/... prefix)
   * @param mimeType - Image MIME type (e.g., 'image/jpeg', 'image/png')
   * @param workspaceId - Workspace ID for organizing files
   * @returns Public URL of the uploaded image
   */
  async uploadMessageImage(
    base64Data: string,
    mimeType: string,
    workspaceId: string,
  ): Promise<string> {
    // Check if Firebase is initialized
    if (!this.bucket) {
      this.logger.error('❌ Firebase Storage not initialized - cannot upload image');
      throw new Error('Firebase Storage is not configured. Please set FIREBASE_STORAGE_BUCKET and FIREBASE_SERVICE_ACCOUNT_PATH in .env');
    }

    try {
      this.logger.log(`📤 Uploading image for workspace: ${workspaceId}`);
      this.logger.log(`📝 MIME type: ${mimeType}`);
      
      // Generate unique filename
      const fileExtension = mimeType.split('/')[1] || 'jpg';
      const fileName = `forum/${workspaceId}/${uuidv4()}.${fileExtension}`;
      this.logger.log(`📁 Target file path: ${fileName}`);

      // Convert base64 to buffer
      const imageBuffer = Buffer.from(base64Data, 'base64');
      this.logger.log(`💾 Image buffer size: ${imageBuffer.length} bytes (${(imageBuffer.length / 1024).toFixed(2)} KB)`);

      // Create file reference
      const file = this.bucket.file(fileName);

      // Upload the file with public access
      this.logger.log('⬆️ Starting upload to Firebase Storage...');
      await file.save(imageBuffer, {
        metadata: {
          contentType: mimeType,
          metadata: {
            firebaseStorageDownloadTokens: uuidv4(), // For public access
            workspaceId: workspaceId,
            uploadedAt: new Date().toISOString(),
          },
        },
        public: true, // Make the file publicly accessible
        validation: false, // Skip MD5 validation for faster uploads
      });

      // Make the file public (redundant but ensures public access)
      this.logger.log('🔓 Making file public...');
      await file.makePublic();

      // Get the public URL
      const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${fileName}`;
      
      this.logger.log(`✅ Image uploaded successfully!`);
      this.logger.log(`🔗 Public URL: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      this.logger.error('❌ Error uploading image to Firebase:', error);
      this.logger.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  /**
   * Upload an image buffer to Firebase Storage
   * @param buffer - Image buffer
   * @param mimeType - Image MIME type
   * @param workspaceId - Workspace ID
   * @returns Public URL of the uploaded image
   */
  async uploadImageBuffer(
    buffer: Buffer,
    mimeType: string,
    workspaceId: string,
  ): Promise<string> {
    try {
      const fileExtension = mimeType.split('/')[1] || 'jpg';
      const fileName = `forum/${workspaceId}/${uuidv4()}.${fileExtension}`;

      const file = this.bucket.file(fileName);

      await file.save(buffer, {
        metadata: {
          contentType: mimeType,
          metadata: {
            firebaseStorageDownloadTokens: uuidv4(),
          },
        },
        public: true,
      });

      await file.makePublic();

      const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${fileName}`;
      
      this.logger.log(`✅ Image uploaded successfully: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      this.logger.error('❌ Error uploading image buffer:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  /**
   * Delete an image from Firebase Storage
   * @param imageUrl - Full URL of the image to delete
   */
  async deleteImage(imageUrl: string): Promise<void> {
    try {
      // Extract file path from URL
      const bucketName = this.bucket.name;
      const urlPattern = new RegExp(`https://storage\\.googleapis\\.com/${bucketName}/(.+)`);
      const match = imageUrl.match(urlPattern);

      if (!match || !match[1]) {
        this.logger.warn(`Invalid image URL format: ${imageUrl}`);
        return;
      }

      const filePath = decodeURIComponent(match[1]);
      const file = this.bucket.file(filePath);

      await file.delete();
      this.logger.log(`✅ Image deleted successfully: ${filePath}`);
    } catch (error) {
      this.logger.error(`❌ Error deleting image: ${error.message}`);
      // Don't throw error, just log it (file might already be deleted)
    }
  }
}
