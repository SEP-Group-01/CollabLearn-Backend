import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';

// Temporarily use require for firebase-admin to avoid TypeScript errors
const admin = require('firebase-admin');

interface ServiceAccountInterface {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
}

@Injectable()
export class FirebaseAdminService {
  private app: any;

  constructor(private configService: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    try {
      if (!admin.apps.length) {
        // Option 1: Using JSON file path (easier for development)
        const serviceAccountPath = this.configService.get<string>(
          'FIREBASE_SERVICE_ACCOUNT_PATH',
        );

        if (serviceAccountPath) {
          try {
            const serviceAccountFile = readFileSync(
              join(process.cwd(), serviceAccountPath),
              'utf8',
            );
            const serviceAccount = JSON.parse(
              serviceAccountFile,
            ) as ServiceAccountInterface;

            this.app = admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              storageBucket: 'collablearn-files.firebasestorage.app',
            });
            console.log('Firebase initialized with service account file');
          } catch (error) {
            console.error(
              'Failed to initialize Firebase with service account file:',
              error,
            );
            this.fallbackToEnvVars();
          }
        } else {
          this.fallbackToEnvVars();
        }
      } else {
        this.app = admin.app();
      }
    } catch (error) {
      console.error('Firebase initialization failed completely:', error);
      // Set app to null so we can handle Firebase being unavailable
      this.app = null;
    }
  }
  private fallbackToEnvVars() {
    // Option 2: Using environment variables (better for production)
    const serviceAccount: ServiceAccountInterface = {
      type: 'service_account',
      project_id: this.configService.get<string>('FIREBASE_PROJECT_ID') || '',
      private_key_id:
        this.configService.get<string>('FIREBASE_PRIVATE_KEY_ID') || '',
      private_key:
        this.configService
          .get<string>('FIREBASE_PRIVATE_KEY')
          ?.replace(/\\n/g, '\n') || '',
      client_email:
        this.configService.get<string>('FIREBASE_CLIENT_EMAIL') || '',
      client_id: this.configService.get<string>('FIREBASE_CLIENT_ID') || '',
      auth_uri:
        this.configService.get<string>('FIREBASE_AUTH_URI') ||
        'https://accounts.google.com/o/oauth2/auth',
      token_uri:
        this.configService.get<string>('FIREBASE_TOKEN_URI') ||
        'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url:
        this.configService.get<string>('FIREBASE_CLIENT_CERT_URL') || '',
      universe_domain: 'googleapis.com',
    };

    this.app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'collablearn-files.firebasestorage.app',
    });
    console.log('Firebase initialized with environment variables');
  }

  // Get Firebase Storage bucket
  getStorageBucket() {
    if (!this.app) {
      throw new Error('Firebase not initialized');
    }

    const bucket = this.app.storage().bucket();
    console.log('🪣 Using Firebase bucket:', bucket.name);
    return bucket;
  }

  // Create custom token for user authentication
  async createCustomToken(uid: string, claims?: object): Promise<string> {
    try {
      return await this.app.auth().createCustomToken(uid, claims);
    } catch (error) {
      console.error('Error creating custom token:', error);
      throw error;
    }
  }

  // Verify ID token
  async verifyIdToken(idToken: string) {
    try {
      return await this.app.auth().verifyIdToken(idToken);
    } catch (error) {
      console.error('Error verifying ID token:', error);
      throw error;
    }
  }

  // Delete file from storage (server-side)
  async deleteFile(filePath: string): Promise<void> {
    try {
      const bucket = this.getStorageBucket();
      await bucket.file(filePath).delete();
      console.log(`Successfully deleted file: ${filePath}`);
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error);
      throw error;
    }
  }

  // Get file metadata
  async getFileMetadata(filePath: string) {
    try {
      const bucket = this.getStorageBucket();
      const [metadata] = await bucket.file(filePath).getMetadata();
      return metadata;
    } catch (error) {
      console.error(`Error getting metadata for ${filePath}:`, error);
      throw error;
    }
  }

  // Check if file exists
  async fileExists(filePath: string): Promise<boolean> {
    try {
      const bucket = this.getStorageBucket();
      const [exists] = await bucket.file(filePath).exists();
      return exists;
    } catch (error) {
      console.error(`Error checking if file exists ${filePath}:`, error);
      return false;
    }
  }

  // Get download URL for a file
  async getDownloadUrl(filePath: string): Promise<string> {
    try {
      const bucket = this.getStorageBucket();
      const [url] = await bucket.file(filePath).getSignedUrl({
        action: 'read',
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
      });
      return url;
    } catch (error) {
      console.error(`Error getting download URL for ${filePath}:`, error);
      throw error;
    }
  }
}
