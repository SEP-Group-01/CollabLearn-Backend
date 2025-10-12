import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { Bucket } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { DatabaseService } from './database.service';

export interface MediaUploadResult {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  firebasePath: string;
  downloadUrl: string;
  documentId: string;
  workspaceId?: string;
  threadId?: string;
  uploadedBy: string;
  uploadedAt: Date;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    thumbnailPath?: string;
  };
}

@Injectable()
export class FirebaseStorageService {
  private readonly logger = new Logger(FirebaseStorageService.name);
  private readonly storage: admin.storage.Storage;
  private readonly bucket: Bucket;
  
  private readonly maxFileSize = 50 * 1024 * 1024; // 50MB
  private readonly allowedMimeTypes = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    // Videos
    'video/mp4', 'video/webm', 'video/mov', 'video/avi',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'text/html', 'text/css', 'text/javascript',
    // Archives (for backups)
    'application/zip', 'application/x-zip-compressed',
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    this.initializeFirebase();
    this.storage = admin.storage();
    this.bucket = this.storage.bucket();
  }

  private initializeFirebase(): void {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Firebase configuration is missing');
    }

    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        storageBucket: this.configService.get<string>('FIREBASE_STORAGE_BUCKET'),
      });

      this.logger.log('✅ Firebase Admin SDK initialized');
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    documentId: string,
    userId: string,
    threadId?: string,
    workspaceId?: string,
    imagePosition?: number,
  ): Promise<MediaUploadResult> {
    this.logger.log(`🔥 [Firebase] Uploading file: ${file.originalname} for document: ${documentId}`);
    this.logger.log(`🔥 [Firebase] File details:`, {
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      bufferType: typeof file.buffer,
      isBuffer: Buffer.isBuffer(file.buffer),
      hasData: !!file.buffer
    });

    // Validate file
    this.validateFile(file);

    const fileId = uuidv4();
    const fileExtension = path.extname(file.originalname);
    const filename = `${fileId}${fileExtension}`;
    
    // Determine file category and path
    const category = this.getFileCategory(file.mimetype);
    
    // Use the new workspace/thread structure for editor images
    let firebasePath: string;
    if (workspaceId && threadId) {
      // Editor image path: workspaces/{workspace_id}/threads/{thread_id}/editor/{document_id}/images/{image_id}/{filename}
      firebasePath = `workspaces/${workspaceId}/threads/${threadId}/editor/${documentId}/images/${fileId}/${filename}`;
    } else if (threadId) {
      // Legacy thread-based structure for backward compatibility
      firebasePath = `threads/${threadId}/documents/${documentId}/media/${category}/${filename}`;
    } else {
      // Legacy document-based structure for backward compatibility
      firebasePath = `documents/${documentId}/media/${category}/${filename}`;
    }

    this.logger.log(`🔥 [Firebase] Target path: ${firebasePath}`);

    try {
      // Upload to Firebase Storage
      const fileUpload = this.bucket.file(firebasePath);
      
      // Convert file.buffer to proper Buffer if it's not already
      let fileBuffer: Buffer;
      if (Buffer.isBuffer(file.buffer)) {
        fileBuffer = file.buffer;
      } else if (file.buffer && typeof file.buffer === 'object') {
        // Handle serialized buffer from microservice
        const bufferData = file.buffer as any;
        if (bufferData.type === 'Buffer' && Array.isArray(bufferData.data)) {
          fileBuffer = Buffer.from(bufferData.data);
        } else {
          throw new Error('Invalid buffer format received from microservice');
        }
      } else {
        throw new Error('No valid file buffer found');
      }

      this.logger.log(`🔥 [Firebase] Buffer prepared, size: ${fileBuffer.length} bytes`);
      
      const stream = fileUpload.createWriteStream({
        metadata: {
          contentType: file.mimetype,
          metadata: {
            originalName: file.originalname,
            uploadedBy: userId,
            documentId: documentId,
            threadId: threadId,
            workspaceId: workspaceId,
            fileId: fileId,
            ...(imagePosition !== undefined && { imagePosition: imagePosition.toString() }),
            category: category,
          },
        },
      });

      await new Promise((resolve, reject) => {
        stream.on('error', (error) => {
          this.logger.error(`🔥 [Firebase] Stream error:`, error);
          reject(error);
        });
        stream.on('finish', () => {
          this.logger.log(`🔥 [Firebase] Stream finished successfully`);
          resolve(undefined);
        });
        
        this.logger.log(`🔥 [Firebase] Starting stream write...`);
        stream.end(fileBuffer);
      });

      this.logger.log(`🔥 [Firebase] File uploaded, generating download URL...`);

      // Generate download URL
      const [downloadUrl] = await fileUpload.getSignedUrl({
        action: 'read',
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
      });

      this.logger.log(`🔥 [Firebase] Download URL generated: ${downloadUrl.substring(0, 100)}...`);

      // Process metadata (dimensions, duration, etc.)
      this.logger.log(`🔥 [Firebase] Extracting metadata...`);
      const metadata = await this.extractMetadata(file, fileId, documentId, category, threadId, workspaceId);
      this.logger.log(`🔥 [Firebase] Metadata extracted:`, metadata);

      // Save metadata to database
      this.logger.log(`🔥 [Firebase] Saving to database...`);
      const mediaRecord = await this.databaseService.saveMediaMetadata({
        document_id: documentId,
        filename: filename,
        original_name: file.originalname,
        mime_type: file.mimetype,
        size_bytes: file.size,
        firebase_path: firebasePath,
        firebase_url: downloadUrl,
        uploaded_by: userId,
        ...metadata,
      });
      this.logger.log(`🔥 [Firebase] Database record saved:`, mediaRecord.id);

      // Log audit entry
      this.logger.log(`🔥 [Firebase] Creating audit log entry...`);
      await this.databaseService.logAuditEntry({
        document_id: documentId,
        user_id: userId,
        action: 'media_uploaded',
        details: {
          fileId: mediaRecord.id,
          filename: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          threadId: threadId,
          workspaceId: workspaceId,
          ...(imagePosition !== undefined && { imagePosition }),
        },
      });

      const result: MediaUploadResult = {
        id: mediaRecord.id,
        filename: filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        firebasePath: firebasePath,
        downloadUrl: downloadUrl,
        documentId: documentId,
        workspaceId: workspaceId,
        threadId: threadId,
        uploadedBy: userId,
        uploadedAt: new Date(),
        metadata: {
          width: metadata.width,
          height: metadata.height,
          duration: metadata.duration_seconds,
          thumbnailPath: metadata.thumbnail_firebase_path,
        },
      };

      this.logger.log(`✅ [Firebase] Upload completed successfully: ${firebasePath}`);
      return result;

    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`);
      throw new BadRequestException(`Failed to upload file: ${error.message}`);
    }
  }

  async getFile(fileId: string): Promise<{ downloadUrl: string; metadata: any } | null> {
    try {
      // Get file metadata from database
      const media = await this.databaseService.getSupabaseClient()
        .from('document_media')
        .select('*')
        .eq('id', fileId)
        .eq('is_deleted', false)
        .single();

      if (media.error || !media.data) {
        return null;
      }

      const file = this.bucket.file(media.data.firebase_path);
      
      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        this.logger.warn(`File not found in Firebase: ${media.data.firebase_path}`);
        return null;
      }

      // Generate a temporary download URL (1 hour expiry)
      const [downloadUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000, // 1 hour
      });

      return {
        downloadUrl,
        metadata: media.data,
      };

    } catch (error) {
      this.logger.error(`Failed to get file: ${error.message}`);
      return null;
    }
  }

  async deleteFile(fileId: string, userId: string): Promise<boolean> {
    try {
      // Get file metadata from database
      const media = await this.databaseService.getSupabaseClient()
        .from('document_media')
        .select('*')
        .eq('id', fileId)
        .eq('is_deleted', false)
        .single();

      if (media.error || !media.data) {
        return false;
      }

      // Check permissions (file owner or document admin)
      const hasPermission = media.data.uploaded_by === userId ||
        await this.databaseService.checkPermission(media.data.document_id, userId, 'admin');

      if (!hasPermission) {
        throw new BadRequestException('Insufficient permissions to delete file');
      }

      // Delete from Firebase Storage
      const file = this.bucket.file(media.data.firebase_path);
      await file.delete();

      // Delete thumbnail if exists
      if (media.data.thumbnail_firebase_path) {
        const thumbnailFile = this.bucket.file(media.data.thumbnail_firebase_path);
        await thumbnailFile.delete().catch(() => {
          // Ignore thumbnail deletion errors
        });
      }

      // Mark as deleted in database
      await this.databaseService.deleteMediaMetadata(fileId);

      // Log audit entry
      await this.databaseService.logAuditEntry({
        document_id: media.data.document_id,
        user_id: userId,
        action: 'media_deleted',
        details: {
          fileId: fileId,
          filename: media.data.original_name,
        },
      });

      this.logger.log(`File deleted: ${media.data.firebase_path}`);
      return true;

    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`);
      return false;
    }
  }

  async getDocumentMedia(documentId: string): Promise<MediaUploadResult[]> {
    const mediaList = await this.databaseService.getDocumentMedia(documentId);
    
    return mediaList.map(media => ({
      id: media.id,
      filename: media.filename,
      originalName: media.original_name,
      mimeType: media.mime_type,
      size: media.size_bytes,
      firebasePath: media.firebase_path,
      downloadUrl: media.firebase_url,
      documentId: media.document_id,
      uploadedBy: media.uploaded_by,
      uploadedAt: new Date(media.uploaded_at),
      metadata: {
        width: media.width,
        height: media.height,
        duration: media.duration_seconds,
        thumbnailPath: media.thumbnail_firebase_path,
      },
    }));
  }

  async createDocumentBackup(
    documentId: string,
    content: string,
    versions: any[],
    permissions: any[],
    auditLog: any[],
    threadId?: string,
  ): Promise<string> {
    const backupId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = threadId 
      ? `threads/${threadId}/documents/${documentId}/backups/${timestamp}_backup_${backupId}.json`
      : `documents/${documentId}/backups/${timestamp}_backup_${backupId}.json`;

    const backupData = {
      documentId,
      threadId,
      exportedAt: new Date().toISOString(),
      content,
      versions,
      permissions,
      auditLog,
      metadata: {
        versionCount: versions.length,
        collaboratorCount: permissions.length,
        auditLogEntries: auditLog.length,
      },
    };

    try {
      const file = this.bucket.file(backupPath);
      
      const stream = file.createWriteStream({
        metadata: {
          contentType: 'application/json',
          metadata: {
            documentId,
            threadId,
            backupId,
            type: 'document_backup',
          },
        },
      });

      await new Promise((resolve, reject) => {
        stream.on('error', reject);
        stream.on('finish', resolve);
        stream.end(JSON.stringify(backupData, null, 2));
      });

      // Generate download URL
      const [downloadUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      this.logger.log(`Backup created: ${backupPath}`);
      return downloadUrl;

    } catch (error) {
      this.logger.error(`Failed to create backup: ${error.message}`);
      throw new BadRequestException(`Failed to create backup: ${error.message}`);
    }
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds limit of ${this.maxFileSize / 1024 / 1024}MB`
      );
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed`
      );
    }
  }

  private getFileCategory(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'images';
    if (mimeType.startsWith('video/')) return 'videos';
    if (mimeType.includes('pdf') || 
        mimeType.includes('word') || 
        mimeType.includes('text/')) return 'documents';
    return 'other';
  }

  private async extractMetadata(
    file: Express.Multer.File,
    fileId: string,
    documentId: string,
    category: string,
    threadId?: string,
    workspaceId?: string,
  ): Promise<{
    width?: number;
    height?: number;
    duration_seconds?: number;
    thumbnail_firebase_path?: string;
  }> {
    const metadata: any = {};

    try {
      // Convert file.buffer to proper Buffer for metadata extraction
      let fileBuffer: Buffer;
      if (Buffer.isBuffer(file.buffer)) {
        fileBuffer = file.buffer;
      } else if (file.buffer && typeof file.buffer === 'object') {
        const bufferData = file.buffer as any;
        if (bufferData.type === 'Buffer' && Array.isArray(bufferData.data)) {
          fileBuffer = Buffer.from(bufferData.data);
        } else {
          this.logger.warn('Invalid buffer format for metadata extraction');
          return metadata;
        }
      } else {
        this.logger.warn('No valid file buffer for metadata extraction');
        return metadata;
      }

      if (category === 'images') {
        // For production, you would use a library like 'sharp' to extract image metadata
        // and generate thumbnails
        const imageInfo = await this.getImageInfo(fileBuffer);
        metadata.width = imageInfo.width;
        metadata.height = imageInfo.height;

        // Generate thumbnail
        const thumbnailPath = await this.generateImageThumbnail(file, fileId, documentId, threadId, workspaceId);
        metadata.thumbnail_firebase_path = thumbnailPath;
      }

      if (category === 'videos') {
        // For production, you would use a library like 'ffmpeg' to extract video metadata
        // and generate thumbnails
        const videoInfo = await this.getVideoInfo(fileBuffer);
        metadata.width = videoInfo.width;
        metadata.height = videoInfo.height;
        metadata.duration_seconds = videoInfo.duration;

        // Generate video thumbnail
        const thumbnailPath = await this.generateVideoThumbnail(file, fileId, documentId, threadId, workspaceId);
        metadata.thumbnail_firebase_path = thumbnailPath;
      }
    } catch (error) {
      this.logger.warn(`Failed to extract metadata: ${error.message}`);
    }

    return metadata;
  }

  private async getImageInfo(buffer: Buffer): Promise<{ width: number; height: number }> {
    // Placeholder implementation
    // In production, use sharp: const sharp = require('sharp'); const metadata = await sharp(buffer).metadata();
    return { width: 800, height: 600 };
  }

  private async getVideoInfo(buffer: Buffer): Promise<{ width: number; height: number; duration: number }> {
    // Placeholder implementation
    // In production, use ffprobe or similar to extract video metadata
    return { width: 1920, height: 1080, duration: 60 };
  }

  private async generateImageThumbnail(
    file: Express.Multer.File,
    fileId: string,
    documentId: string,
    threadId?: string,
    workspaceId?: string,
  ): Promise<string> {
    // Placeholder implementation
    // In production, use sharp to generate thumbnail:
    // const thumbnail = await sharp(file.buffer).resize(200, 200).jpeg().toBuffer();
    
    let thumbnailPath: string;
    if (workspaceId && threadId) {
      // Use workspace/thread structure for editor images
      thumbnailPath = `workspaces/${workspaceId}/threads/${threadId}/editor/${documentId}/images/${fileId}/thumbnails/${fileId}_thumb.jpg`;
    } else if (threadId) {
      // Legacy thread-based structure
      thumbnailPath = `threads/${threadId}/documents/${documentId}/media/images/thumbnails/${fileId}_thumb.jpg`;
    } else {
      // Legacy document-based structure
      thumbnailPath = `documents/${documentId}/media/images/thumbnails/${fileId}_thumb.jpg`;
    }
    
    try {
      const thumbnailFile = this.bucket.file(thumbnailPath);
      const stream = thumbnailFile.createWriteStream({
        metadata: {
          contentType: 'image/jpeg',
          metadata: {
            type: 'thumbnail',
            originalFileId: fileId,
            documentId: documentId,
            threadId: threadId,
            workspaceId: workspaceId,
          },
        },
      });

      // For demo, we'll just upload a placeholder
      const placeholderThumbnail = Buffer.from('placeholder-thumbnail-data');
      
      await new Promise((resolve, reject) => {
        stream.on('error', reject);
        stream.on('finish', resolve);
        stream.end(placeholderThumbnail);
      });

      return thumbnailPath;
    } catch (error) {
      this.logger.warn(`Failed to generate image thumbnail: ${error.message}`);
      return '';
    }
  }

  private async generateVideoThumbnail(
    file: Express.Multer.File,
    fileId: string,
    documentId: string,
    threadId?: string,
    workspaceId?: string,
  ): Promise<string> {
    // Placeholder implementation
    // In production, use ffmpeg to extract frame and sharp to process:
    
    let thumbnailPath: string;
    if (workspaceId && threadId) {
      // Use workspace/thread structure for editor videos
      thumbnailPath = `workspaces/${workspaceId}/threads/${threadId}/editor/${documentId}/images/${fileId}/thumbnails/${fileId}_thumb.jpg`;
    } else if (threadId) {
      // Legacy thread-based structure
      thumbnailPath = `threads/${threadId}/documents/${documentId}/media/videos/thumbnails/${fileId}_thumb.jpg`;
    } else {
      // Legacy document-based structure
      thumbnailPath = `documents/${documentId}/media/videos/thumbnails/${fileId}_thumb.jpg`;
    }
    
    try {
      const thumbnailFile = this.bucket.file(thumbnailPath);
      const stream = thumbnailFile.createWriteStream({
        metadata: {
          contentType: 'image/jpeg',
          metadata: {
            type: 'video_thumbnail',
            originalFileId: fileId,
            documentId: documentId,
            threadId: threadId,
            workspaceId: workspaceId,
          },
        },
      });

      // For demo, we'll just upload a placeholder
      const placeholderThumbnail = Buffer.from('placeholder-video-thumbnail-data');
      
      await new Promise((resolve, reject) => {
        stream.on('error', reject);
        stream.on('finish', resolve);
        stream.end(placeholderThumbnail);
      });

      return thumbnailPath;
    } catch (error) {
      this.logger.warn(`Failed to generate video thumbnail: ${error.message}`);
      return '';
    }
  }

  // Utility methods
  isImageType(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  isVideoType(mimeType: string): boolean {
    return mimeType.startsWith('video/');
  }

  isDocumentType(mimeType: string): boolean {
    return mimeType.includes('pdf') || 
           mimeType.includes('word') || 
           mimeType.includes('text/');
  }

  getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      html: 'text/html',
      txt: 'text/plain',
      zip: 'application/zip',
      jpg: 'image/jpeg',
      png: 'image/png',
      mp4: 'video/mp4',
    };

    return mimeTypes[format] || 'application/octet-stream';
  }
}