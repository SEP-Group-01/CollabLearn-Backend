import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { CreateResourceDto } from '../dto/resource.dto';

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

interface FirebaseUploadResult {
  firebase_path: string;
  firebase_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
}

@Injectable()
export class ResourceService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly firebaseAdmin: FirebaseAdminService,
  ) {}

  // This is the method you asked about
  async createResource(resourceData: CreateResourceDto, file?: UploadedFile) {
    console.log('Creating resource:', resourceData);

    // Upload file to Firebase (if file provided)
    let firebaseData: FirebaseUploadResult | null = null;
    if (file) {
      console.log('File upload received, uploading to Firebase...');
      console.log('File details:', {
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
      });
      try {
        firebaseData = await this.uploadToFirebase(file, resourceData);
        console.log('Firebase upload successful:', firebaseData);
      } catch (error) {
        console.error('🔥 Firebase upload failed with error:', error);
        console.error('🔥 Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
        // Continue without Firebase upload - just log the error
        console.log('⚠️ Continuing without Firebase upload...');
      }
    } else {
      console.log('No file provided, skipping Firebase upload');
    }

    // Save metadata to Supabase
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('thread_resources')
      .insert([
        {
          ...resourceData,
          firebase_path: firebaseData?.firebase_path || null,
          firebase_url: firebaseData?.firebase_url || resourceData.url || null,
          file_name: firebaseData?.file_name || null,
          file_size: firebaseData?.file_size || null,
          mime_type: firebaseData?.mime_type || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to create resource: ${error.message}`);
    }

    console.log('Resource created successfully:', data);
    return data;
  }

  private async uploadToFirebase(
    file: UploadedFile,
    resourceData: CreateResourceDto,
  ): Promise<FirebaseUploadResult> {
    try {
      // Get workspace ID from thread
      const thread = await this.getThreadById(resourceData.thread_id);
      const workspaceId = thread.workspace_id;

      // Create unique filename
      const timestamp = Date.now();
      const sanitizedFileName = file.originalname.replace(
        /[^a-zA-Z0-9.-]/g,
        '_',
      );
      const fileName = `${resourceData.user_id}_${timestamp}_${sanitizedFileName}`;

      // Create storage path
      const storagePath = `workspaces/${workspaceId}/threads/${resourceData.thread_id}/${resourceData.resource_type}s/${fileName}`;

      // Upload to Firebase Storage
      const bucket = this.firebaseAdmin.getStorageBucket();
      const fileUpload = bucket.file(storagePath);

      await fileUpload.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
          metadata: {
            uploadedBy: resourceData.user_id,
            workspaceId: workspaceId,
            threadId: resourceData.thread_id,
            originalName: file.originalname,
            uploadTimestamp: new Date().toISOString(),
          },
        },
      });

      // Make file publicly readable (or implement signed URLs for security)
      await fileUpload.makePublic();

      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

      return {
        firebase_path: storagePath,
        firebase_url: publicUrl,
        file_name: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype,
      };
    } catch (error) {
      console.error('Firebase upload error:', error);
      throw new Error(`Failed to upload file to Firebase: ${error.message}`);
    }
  }

  async getResources(threadId: string, resourceType?: string) {
    const supabase = this.supabaseService.getClient();
    try {
      let query = supabase
        .from('thread_resources')
        .select('*')
        .eq('thread_id', threadId);

      // Filter by resource type if provided
      if (resourceType) {
        query = query.eq('resource_type', resourceType);
      }

      const { data, error } = await query.order('created_at', {
        ascending: false,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching resources:', error);
      throw new Error('Failed to fetch resources');
    }
  }

  async deleteResource(resourceId: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    try {
      // Get resource details first
      const { data: resource, error: fetchError } = await supabase
        .from('thread_resources')
        .select('*')
        .eq('id', resourceId)
        .eq('user_id', userId) // Ensure user owns the resource
        .single();

      if (fetchError) throw fetchError;
      if (!resource) throw new Error('Resource not found or unauthorized');

      // Delete from Firebase Storage if it exists
      if (resource.firebase_path) {
        await this.firebaseAdmin.deleteFile(resource.firebase_path);
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('thread_resources')
        .delete()
        .eq('id', resourceId);

      if (deleteError) throw deleteError;

      return { success: true, message: 'Resource deleted successfully' };
    } catch (error) {
      console.error('Error deleting resource:', error);
      throw new Error(`Failed to delete resource: ${error.message}`);
    }
  }

  private async getThreadById(threadId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('threads')
      .select('workspace_id')
      .eq('id', threadId)
      .single();

    if (error) throw new Error('Thread not found');
    return data;
  }
}
