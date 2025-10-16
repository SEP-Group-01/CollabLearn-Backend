import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface MediaUploadResult {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  documentId: string;
  uploadedBy: string;
  uploadedAt: Date;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly uploadDir = process.env.UPLOAD_DIR || './uploads';
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];

  // In-memory storage - replace with actual database
  private uploads = new Map<string, MediaUploadResult>();

  constructor() {
    this.ensureUploadDir();
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    documentId: string,
    userId: string
  ): Promise<MediaUploadResult> {
    this.logger.log(`Uploading file: ${file.originalname} for document: ${documentId}`);

    // Validate file
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(`File size exceeds limit of ${this.maxFileSize / 1024 / 1024}MB`);
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed`);
    }

    // Generate unique filename
    const fileId = uuidv4();
    const fileExtension = path.extname(file.originalname);
    const fileName = `${fileId}${fileExtension}`;
    const filePath = path.join(this.uploadDir, fileName);

    try {
      // Save file to disk
      await fs.writeFile(filePath, file.buffer);

      // Create upload record
      const uploadResult: MediaUploadResult = {
        id: fileId,
        url: `/api/media/${fileName}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        documentId,
        uploadedBy: userId,
        uploadedAt: new Date(),
      };

      this.uploads.set(fileId, uploadResult);

      this.logger.log(`File uploaded successfully: ${fileName}`);
      return uploadResult;
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`);
      throw new BadRequestException('Failed to upload file');
    }
  }

  async getFile(fileName: string): Promise<{ filePath: string; mimeType: string } | null> {
    const filePath = path.join(this.uploadDir, fileName);
    
    try {
      await fs.access(filePath);
      
      // Find upload record to get mime type
      const upload = Array.from(this.uploads.values()).find(
        u => u.url.endsWith(fileName)
      );

      return {
        filePath,
        mimeType: upload?.mimeType || 'application/octet-stream',
      };
    } catch {
      return null;
    }
  }

  async deleteFile(fileId: string, userId: string): Promise<boolean> {
    const upload = this.uploads.get(fileId);
    if (!upload) {
      return false;
    }

    // Check if user has permission to delete (owner or admin)
    if (upload.uploadedBy !== userId) {
      throw new BadRequestException('Insufficient permissions to delete file');
    }

    try {
      const fileName = path.basename(upload.url);
      const filePath = path.join(this.uploadDir, fileName);
      
      await fs.unlink(filePath);
      this.uploads.delete(fileId);
      
      this.logger.log(`File deleted: ${fileName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`);
      return false;
    }
  }

  async getDocumentMedia(documentId: string): Promise<MediaUploadResult[]> {
    return Array.from(this.uploads.values()).filter(
      upload => upload.documentId === documentId
    );
  }

  async getUserUploads(userId: string): Promise<MediaUploadResult[]> {
    return Array.from(this.uploads.values()).filter(
      upload => upload.uploadedBy === userId
    );
  }

  getMediaType(mimeType: string): 'image' | 'video' | 'document' | 'other' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('text')) {
      return 'document';
    }
    return 'other';
  }

  isImageType(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  isVideoType(mimeType: string): boolean {
    return mimeType.startsWith('video/');
  }

  generateThumbnail(filePath: string): Promise<Buffer> {
    // For production, you would use libraries like 'sharp' for images or 'ffmpeg' for videos
    // This is a placeholder implementation
    return Promise.resolve(Buffer.from('thumbnail-placeholder'));
  }

  async getFileStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    byType: Record<string, { count: number; size: number }>;
  }> {
    const uploads = Array.from(this.uploads.values());
    const stats = {
      totalFiles: uploads.length,
      totalSize: uploads.reduce((sum, upload) => sum + upload.size, 0),
      byType: {} as Record<string, { count: number; size: number }>,
    };

    uploads.forEach(upload => {
      const type = this.getMediaType(upload.mimeType);
      if (!stats.byType[type]) {
        stats.byType[type] = { count: 0, size: 0 };
      }
      stats.byType[type].count++;
      stats.byType[type].size += upload.size;
    });

    return stats;
  }
}