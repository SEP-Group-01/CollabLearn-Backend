import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FirebaseStorageService {
  private readonly logger = new Logger(FirebaseStorageService.name);
  private readonly storage: admin.storage.Storage;
  private readonly bucket: any;

  constructor(private readonly configService: ConfigService) {
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
    }
  }

  async uploadUserImage(
    imageBuffer: Buffer,
    userId: string,
    mimeType: string,
  ): Promise<{ downloadUrl: string; filePath: string }> {
    try {
      const fileId = uuidv4();
      const fileExtension = this.getFileExtension(mimeType);
      const fileName = `image_${fileId}${fileExtension}`;
      const filePath = `users/${userId}/${fileName}`;

      this.logger.log(`Uploading user image to: ${filePath}`);

      const file = this.bucket.file(filePath);
      
      await file.save(imageBuffer, {
        metadata: {
          contentType: mimeType,
          metadata: {
            userId,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      // Make the file publicly accessible
      await file.makePublic();

      const downloadUrl = `https://storage.googleapis.com/${this.bucket.name}/${filePath}`;

      this.logger.log(`User image uploaded successfully: ${downloadUrl}`);

      return {
        downloadUrl,
        filePath,
      };
    } catch (error) {
      this.logger.error('Failed to upload user image:', error);
      throw new Error('Failed to upload image');
    }
  }

  async deleteUserImage(filePath: string): Promise<boolean> {
    try {
      const file = this.bucket.file(filePath);
      await file.delete();
      this.logger.log(`User image deleted successfully: ${filePath}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to delete user image:', error);
      return false;
    }
  }

  private getFileExtension(mimeType: string): string {
    const extensions: { [key: string]: string } = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
    };
    return extensions[mimeType] || '.jpg';
  }

  private isValidImageType(mimeType: string): boolean {
    const validTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
    ];
    return validTypes.includes(mimeType);
  }
}