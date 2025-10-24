import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private storage: admin.storage.Storage;
  private bucket: any;

  constructor() {
    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined;

      if (!privateKey || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
        this.logger.error('Firebase credentials are not properly configured in environment variables');
        throw new Error('Firebase credentials missing');
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      });

      this.logger.log('Firebase Admin SDK initialized successfully');
    }

    this.storage = admin.storage();
    this.bucket = this.storage.bucket();
  }

  /**
   * Upload a question image to Firebase Storage
   * Path: workspaces/{workspace_id}/threads/{thread_id}/quiz/{quiz_id}/question/{question_id}/image
   */
  async uploadQuestionImage(
    workspaceId: string,
    threadId: string,
    quizId: string,
    questionId: string,
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    try {
      const extension = this.getExtensionFromMimeType(mimeType);
      const filePath = `workspaces/${workspaceId}/threads/${threadId}/quiz/${quizId}/question/${questionId}/image${extension}`;

      const file = this.bucket.file(filePath);

      await file.save(imageBuffer, {
        metadata: {
          contentType: mimeType,
        },
        public: true,
        validation: 'md5',
      });

      // Make the file publicly accessible
      await file.makePublic();

      // Get the public URL
      const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${filePath}`;

      this.logger.log(`Question image uploaded successfully: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      this.logger.error(`Failed to upload question image: ${error.message}`, error.stack);
      throw new Error(`Failed to upload question image: ${error.message}`);
    }
  }

  /**
   * Upload an option image to Firebase Storage
   * Path: workspaces/{workspace_id}/threads/{thread_id}/quiz/{quiz_id}/question/{question_id}/option/{option_id}/image
   */
  async uploadOptionImage(
    workspaceId: string,
    threadId: string,
    quizId: string,
    questionId: string,
    optionId: string,
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    try {
      const extension = this.getExtensionFromMimeType(mimeType);
      const filePath = `workspaces/${workspaceId}/threads/${threadId}/quiz/${quizId}/question/${questionId}/option/${optionId}/image${extension}`;

      const file = this.bucket.file(filePath);

      await file.save(imageBuffer, {
        metadata: {
          contentType: mimeType,
        },
        public: true,
        validation: 'md5',
      });

      // Make the file publicly accessible
      await file.makePublic();

      // Get the public URL
      const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${filePath}`;

      this.logger.log(`Option image uploaded successfully: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      this.logger.error(`Failed to upload option image: ${error.message}`, error.stack);
      throw new Error(`Failed to upload option image: ${error.message}`);
    }
  }

  /**
   * Delete a question image from Firebase Storage
   */
  async deleteQuestionImage(
    workspaceId: string,
    threadId: string,
    quizId: string,
    questionId: string,
  ): Promise<void> {
    try {
      // Try common image extensions
      const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      
      for (const ext of extensions) {
        const filePath = `workspaces/${workspaceId}/threads/${threadId}/quiz/${quizId}/question/${questionId}/image${ext}`;
        const file = this.bucket.file(filePath);
        
        const [exists] = await file.exists();
        if (exists) {
          await file.delete();
          this.logger.log(`Question image deleted: ${filePath}`);
          return;
        }
      }
      
      this.logger.warn(`No question image found to delete for question ${questionId}`);
    } catch (error) {
      this.logger.error(`Failed to delete question image: ${error.message}`, error.stack);
      // Don't throw error for delete operations
    }
  }

  /**
   * Delete an option image from Firebase Storage
   */
  async deleteOptionImage(
    workspaceId: string,
    threadId: string,
    quizId: string,
    questionId: string,
    optionId: string,
  ): Promise<void> {
    try {
      // Try common image extensions
      const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      
      for (const ext of extensions) {
        const filePath = `workspaces/${workspaceId}/threads/${threadId}/quiz/${quizId}/question/${questionId}/option/${optionId}/image${ext}`;
        const file = this.bucket.file(filePath);
        
        const [exists] = await file.exists();
        if (exists) {
          await file.delete();
          this.logger.log(`Option image deleted: ${filePath}`);
          return;
        }
      }
      
      this.logger.warn(`No option image found to delete for option ${optionId}`);
    } catch (error) {
      this.logger.error(`Failed to delete option image: ${error.message}`, error.stack);
      // Don't throw error for delete operations
    }
  }

  /**
   * Delete all images for a quiz
   */
  async deleteQuizImages(
    workspaceId: string,
    threadId: string,
    quizId: string,
  ): Promise<void> {
    try {
      const prefix = `workspaces/${workspaceId}/threads/${threadId}/quiz/${quizId}/`;
      
      const [files] = await this.bucket.getFiles({ prefix });
      
      const deletePromises = files.map((file) => file.delete());
      await Promise.all(deletePromises);
      
      this.logger.log(`All images deleted for quiz ${quizId}`);
    } catch (error) {
      this.logger.error(`Failed to delete quiz images: ${error.message}`, error.stack);
      // Don't throw error for delete operations
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
    };

    return mimeToExt[mimeType] || '.jpg';
  }

  /**
   * Validate image file
   */
  validateImageFile(mimeType: string, size: number): void {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    if (!allowedMimeTypes.includes(mimeType)) {
      throw new Error(`Invalid file type: ${mimeType}. Only images are allowed.`);
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (size > maxSize) {
      throw new Error(`File size exceeds maximum allowed size of 5MB`);
    }
  }
}
