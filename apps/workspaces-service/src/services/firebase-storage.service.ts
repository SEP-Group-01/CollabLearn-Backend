import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FirebaseStorageService {
  private readonly logger = new Logger(FirebaseStorageService.name);
  private storage: admin.storage.Storage;
  private bucket: any;

  constructor(private configService: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    try {
      // Initialize Firebase Admin SDK if not already initialized
      if (!admin.apps.length) {
        const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
        const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
        const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

        if (!projectId || !clientEmail || !privateKey) {
          throw new Error('Missing Firebase configuration in environment variables');
        }

        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
          }),
          storageBucket: this.configService.get<string>('FIREBASE_STORAGE_BUCKET'),
        });
      }

      this.storage = admin.storage();
      this.bucket = this.storage.bucket();
      this.logger.log('Firebase Storage initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Storage:', error);
      throw error;
    }
  }

  /**
   * Upload a workspace image to Firebase Storage
   * @param workspaceId - The workspace ID
   * @param imageBuffer - The image file buffer
   * @param originalName - Original filename
   * @param mimeType - MIME type of the file
   * @returns The download URL and storage path
   */
  async uploadWorkspaceImage(
    workspaceId: string,
    imageBuffer: Buffer | any,
    originalName: string,
    mimeType: string,
  ): Promise<{ downloadUrl: string; storagePath: string }> {
    try {
      this.logger.log(`Uploading workspace image for workspace: ${workspaceId}`);

      // Convert serialized buffer back to Buffer if needed
      let bufferData: Buffer;
      if (Buffer.isBuffer(imageBuffer)) {
        bufferData = imageBuffer;
        this.logger.log('Image buffer is already a proper Buffer');
      } else if (imageBuffer && imageBuffer.type === 'Buffer' && Array.isArray(imageBuffer.data)) {
        // Handle serialized buffer from microservice
        bufferData = Buffer.from(imageBuffer.data);
        this.logger.log('Converted serialized buffer (type: Buffer, data: Array) to Buffer');
      } else if (imageBuffer && typeof imageBuffer === 'object' && imageBuffer.data) {
        // Another possible serialization format
        bufferData = Buffer.from(imageBuffer.data);
        this.logger.log('Converted object with data property to Buffer');
      } else {
        this.logger.error('Invalid image buffer format:', {
          type: typeof imageBuffer,
          isBuffer: Buffer.isBuffer(imageBuffer),
          hasData: !!(imageBuffer && imageBuffer.data),
          keys: imageBuffer ? Object.keys(imageBuffer) : 'N/A'
        });
        throw new Error('Invalid image buffer format received');
      }

      if (!Buffer.isBuffer(bufferData) || bufferData.length === 0) {
        throw new Error('Failed to create valid buffer from image data');
      }

      this.logger.log(`Image buffer size: ${bufferData.length} bytes`);

      // Extract file extension from original name or mime type
      const fileExtension = this.getFileExtension(originalName, mimeType);
      
      // Create storage path: workspaces/{workspace_id}/image.{extension}
      const storagePath = `workspaces/${workspaceId}/image.${fileExtension}`;
      
      // Create file reference
      const file = this.bucket.file(storagePath);
      
      // Upload the file
      await file.save(bufferData, {
        metadata: {
          contentType: mimeType,
          metadata: {
            firebaseStorageDownloadTokens: uuidv4(), // Generate download token
            uploadedAt: new Date().toISOString(),
            workspaceId: workspaceId,
          },
        },
        resumable: false, // For smaller files, direct upload is faster
      });

      // Make the file publicly readable
      await file.makePublic();

      // Get download URL
      const downloadUrl = `https://storage.googleapis.com/${this.bucket.name}/${storagePath}`;

      this.logger.log(`Successfully uploaded workspace image: ${downloadUrl}`);
      
      return {
        downloadUrl,
        storagePath: `gs://${this.bucket.name}/${storagePath}`,
      };
    } catch (error) {
      this.logger.error(`Failed to upload workspace image for ${workspaceId}:`, error);
      throw new Error(`Failed to upload workspace image: ${error.message}`);
    }
  }

  /**
   * Upload an attachment for document editor
   * @param threadId - The thread ID
   * @param attachmentBuffer - The attachment file buffer
   * @param originalName - Original filename
   * @param mimeType - MIME type of the file
   * @returns The download URL and storage path
   */
  async uploadDocumentAttachment(
    threadId: string,
    attachmentBuffer: Buffer | any,
    originalName: string,
    mimeType: string,
  ): Promise<{ downloadUrl: string; storagePath: string }> {
    try {
      this.logger.log(`Uploading document attachment for thread: ${threadId}`);

      // Convert serialized buffer back to Buffer if needed
      let bufferData: Buffer;
      if (Buffer.isBuffer(attachmentBuffer)) {
        bufferData = attachmentBuffer;
      } else if (attachmentBuffer && attachmentBuffer.type === 'Buffer' && Array.isArray(attachmentBuffer.data)) {
        bufferData = Buffer.from(attachmentBuffer.data);
      } else if (attachmentBuffer && typeof attachmentBuffer === 'object' && attachmentBuffer.data) {
        bufferData = Buffer.from(attachmentBuffer.data);
      } else {
        throw new Error('Invalid attachment buffer format received');
      }

      const fileExtension = this.getFileExtension(originalName, mimeType);
      const fileName = `${uuidv4()}.${fileExtension}`; // Use UUID for unique naming
      
      // Create storage path: threads/{thread_id}/attachments/{unique_filename}
      const storagePath = `threads/${threadId}/attachments/${fileName}`;
      
      const file = this.bucket.file(storagePath);
      
      await file.save(bufferData, {
        metadata: {
          contentType: mimeType,
          metadata: {
            firebaseStorageDownloadTokens: uuidv4(),
            uploadedAt: new Date().toISOString(),
            threadId: threadId,
            originalName: originalName,
          },
        },
        resumable: false,
      });

      await file.makePublic();
      const downloadUrl = `https://storage.googleapis.com/${this.bucket.name}/${storagePath}`;

      this.logger.log(`Successfully uploaded document attachment: ${downloadUrl}`);
      
      return {
        downloadUrl,
        storagePath: `gs://${this.bucket.name}/${storagePath}`,
      };
    } catch (error) {
      this.logger.error(`Failed to upload document attachment for ${threadId}:`, error);
      throw new Error(`Failed to upload document attachment: ${error.message}`);
    }
  }

  /**
   * Upload a quiz image
   * @param quizId - The quiz ID
   * @param imageBuffer - The image file buffer
   * @param originalName - Original filename
   * @param mimeType - MIME type of the file
   * @returns The download URL and storage path
   */
  async uploadQuizImage(
    quizId: string,
    imageBuffer: Buffer | any,
    originalName: string,
    mimeType: string,
  ): Promise<{ downloadUrl: string; storagePath: string }> {
    try {
      this.logger.log(`Uploading quiz image for quiz: ${quizId}`);

      // Convert serialized buffer back to Buffer if needed
      let bufferData: Buffer;
      if (Buffer.isBuffer(imageBuffer)) {
        bufferData = imageBuffer;
      } else if (imageBuffer && imageBuffer.type === 'Buffer' && Array.isArray(imageBuffer.data)) {
        bufferData = Buffer.from(imageBuffer.data);
      } else if (imageBuffer && typeof imageBuffer === 'object' && imageBuffer.data) {
        bufferData = Buffer.from(imageBuffer.data);
      } else {
        throw new Error('Invalid image buffer format received');
      }

      const fileExtension = this.getFileExtension(originalName, mimeType);
      const fileName = `${uuidv4()}.${fileExtension}`;
      
      // Create storage path: quizzes/{quiz_id}/images/{unique_filename}
      const storagePath = `quizzes/${quizId}/images/${fileName}`;
      
      const file = this.bucket.file(storagePath);
      
      await file.save(bufferData, {
        metadata: {
          contentType: mimeType,
          metadata: {
            firebaseStorageDownloadTokens: uuidv4(),
            uploadedAt: new Date().toISOString(),
            quizId: quizId,
            originalName: originalName,
          },
        },
        resumable: false,
      });

      await file.makePublic();
      const downloadUrl = `https://storage.googleapis.com/${this.bucket.name}/${storagePath}`;

      this.logger.log(`Successfully uploaded quiz image: ${downloadUrl}`);
      
      return {
        downloadUrl,
        storagePath: `gs://${this.bucket.name}/${storagePath}`,
      };
    } catch (error) {
      this.logger.error(`Failed to upload quiz image for ${quizId}:`, error);
      throw new Error(`Failed to upload quiz image: ${error.message}`);
    }
  }

  /**
   * Delete a file from Firebase Storage
   * @param storagePath - The full storage path (gs://bucket/path/to/file)
   */
  async deleteFile(storagePath: string): Promise<void> {
    try {
      this.logger.log(`Deleting file: ${storagePath}`);

      // Extract path from gs:// URL
      const path = storagePath.replace(`gs://${this.bucket.name}/`, '');
      const file = this.bucket.file(path);
      
      await file.delete();
      this.logger.log(`Successfully deleted file: ${storagePath}`);
    } catch (error) {
      if (error.code === 404) {
        this.logger.warn(`File not found (already deleted?): ${storagePath}`);
        return; // Don't throw error for already deleted files
      }
      
      this.logger.error(`Failed to delete file ${storagePath}:`, error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Get file extension from filename or mime type
   * @param originalName - Original filename
   * @param mimeType - MIME type
   * @returns File extension
   */
  private getFileExtension(originalName: string, mimeType: string): string {
    // Try to get extension from filename first
    if (originalName) {
      const match = originalName.match(/\.([^.]+)$/);
      if (match) {
        return match[1].toLowerCase();
      }
    }

    // Fallback to mime type mapping
    const mimeTypeMap: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'application/pdf': 'pdf',
      'text/plain': 'txt',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    };

    return mimeTypeMap[mimeType] || 'bin';
  }

  /**
   * Validate if file is an image
   * @param mimeType - MIME type to validate
   * @returns True if file is an image
   */
  isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * Validate file size (in bytes)
   * @param fileSize - File size in bytes
   * @param maxSize - Maximum allowed size in bytes (default: 5MB)
   * @returns True if file size is valid
   */
  isValidFileSize(fileSize: number, maxSize: number = 5 * 1024 * 1024): boolean {
    return fileSize <= maxSize;
  }
}