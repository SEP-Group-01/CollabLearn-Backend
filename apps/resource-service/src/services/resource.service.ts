import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { CreateResourceDto } from '../dto/resource.dto';
import { CreateReviewDto, UpdateReviewDto } from '../dto/review.dto';

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
    file: UploadedFile | any,
    resourceData: CreateResourceDto,
  ): Promise<FirebaseUploadResult> {
    try {
      // Get workspace ID from thread
      const thread = await this.getThreadById(resourceData.thread_id);
      const workspaceId = thread.workspace_id;

      // Handle both regular files and base64 encoded files from TCP
      let fileBuffer: Buffer;
      let originalName: string;
      let mimeType: string;
      let fileSize: number;

      if (file.buffer && typeof file.buffer === 'string') {
        // Base64 encoded file from TCP
        fileBuffer = Buffer.from(file.buffer, 'base64');
        originalName = file.originalname;
        mimeType = file.mimetype;
        fileSize = file.size;
      } else {
        // Regular file from HTTP
        fileBuffer = file.buffer;
        originalName = file.originalname;
        mimeType = file.mimetype;
        fileSize = file.size;
      }

      // Create unique filename
      const timestamp = Date.now();
      const sanitizedFileName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${resourceData.user_id}_${timestamp}_${sanitizedFileName}`;

      // Create storage path
      const storagePath = `workspaces/${workspaceId}/threads/${resourceData.thread_id}/${resourceData.resource_type}s/${fileName}`;

      // Upload to Firebase Storage
      const bucket = this.firebaseAdmin.getStorageBucket();
      const fileUpload = bucket.file(storagePath);

      await fileUpload.save(fileBuffer, {
        metadata: {
          contentType: mimeType,
          metadata: {
            uploadedBy: resourceData.user_id,
            workspaceId: workspaceId,
            threadId: resourceData.thread_id,
            originalName: originalName,
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
        file_name: originalName,
        file_size: fileSize,
        mime_type: mimeType,
      };
    } catch (error) {
      console.error('Firebase upload error:', error);
      throw new Error(`Failed to upload file to Firebase: ${error.message}`);
    }
  }

  async getResources(threadId: string, resourceType?: string) {
    console.log('🔍 [Resource Service] getResources called');
    console.log('📋 [Resource Service] Parameters:', { threadId, resourceType });
    
    const supabase = this.supabaseService.getClient();
    console.log('✅ [Resource Service] Supabase client obtained');
    
    try {
      let query = supabase
        .from('thread_resources')
        .select('*')
        .eq('thread_id', threadId);

      console.log('🔍 [Resource Service] Building query for thread_id:', threadId);

      // Filter by resource type if provided
      if (resourceType) {
        console.log('🔍 [Resource Service] Filtering by resource_type:', resourceType);
        query = query.eq('resource_type', resourceType);
      }

      console.log('📤 [Resource Service] Executing Supabase query...');
      const { data, error } = await query.order('created_at', {
        ascending: false,
      });

      if (error) {
        console.error('❌ [Resource Service] Supabase error:', error);
        throw error;
      }
      
      console.log('✅ [Resource Service] Query successful');
      console.log('📦 [Resource Service] Results count:', data?.length || 0);
      console.log('📦 [Resource Service] Data:', data);
      
      return data;
    } catch (error) {
      console.error('❌ [Resource Service] Error fetching resources:', error);
      console.error('📋 [Resource Service] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
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

      return { message: 'Resource deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete resource: ${error}`);
    }
  }

  // Review Methods
  async createReview(reviewData: CreateReviewDto) {
    try {
      console.log('🔍 Creating review with data:', reviewData);

      // Validate required fields with better error handling
      if (
        !reviewData.review ||
        typeof reviewData.review !== 'string' ||
        reviewData.review.trim() === ''
      ) {
        throw new Error('Review text is required and cannot be empty');
      }

      if (
        !reviewData.ratings ||
        typeof reviewData.ratings !== 'number' ||
        reviewData.ratings < 1 ||
        reviewData.ratings > 5
      ) {
        throw new Error(
          'Rating is required and must be a number between 1 and 5',
        );
      }

      const supabase = this.supabaseService.getClient();

      // First, check if the resource exists
      const { data: resourceCheck, error: resourceError } = await supabase
        .from('thread_resources')
        .select('id')
        .eq('id', reviewData.resource_id)
        .single();

      if (resourceError || !resourceCheck) {
        console.error('❌ Resource not found:', reviewData.resource_id);
        throw new Error(`Resource not found: ${reviewData.resource_id}`);
      }

      console.log('✅ Resource exists:', resourceCheck);

      // Check if user already has a review for this resource
      const { data: existingReview } = await supabase
        .from('resource_reviews')
        .select('id')
        .eq('resource_id', reviewData.resource_id)
        .eq('user_id', reviewData.user_id)
        .single();

      if (existingReview) {
        console.error('❌ User already has a review for this resource');
        throw new Error(
          'You have already reviewed this resource. Please update your existing review instead.',
        );
      }

      console.log('✅ No existing review found, proceeding with creation');

      const { data, error } = await supabase
        .from('resource_reviews')
        .insert(reviewData)
        .select('*')
        .single();

      if (error) {
        console.error('❌ Database error creating review:', error);
        throw new Error(`Failed to create review: ${error.message}`);
      }

      console.log('✅ Review created successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error in createReview:', error);
      throw new Error(`Failed to create review: ${error}`);
    }
  }

  async getReviewsByResource(resourceId: string) {
    try {
      const supabase = this.supabaseService.getClient();

      // Get reviews ordered by creation date (newest first)
      const { data, error } = await supabase
        .from('resource_reviews')
        .select('*')
        .eq('resource_id', resourceId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching reviews:', error);
        throw new Error(`Failed to fetch reviews: ${error.message}`);
      }

      console.log('✅ Reviews fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error in getReviewsByResource:', error);
      throw new Error(`Failed to fetch reviews: ${error}`);
    }
  }

  async updateReview(reviewId: string, updateData: UpdateReviewDto) {
    try {
      const supabase = this.supabaseService.getClient();

      const { data, error } = await supabase
        .from('resource_reviews')
        .update(updateData)
        .eq('id', reviewId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to update review: ${error.message}`);
      }

      return data;
    } catch (error) {
      throw new Error(`Failed to update review: ${error}`);
    }
  }

  async deleteReview(reviewId: string, userId: string) {
    try {
      const supabase = this.supabaseService.getClient();

      // First verify the review belongs to the user
      const { data: reviewCheck, error: checkError } = await supabase
        .from('resource_reviews')
        .select('user_id')
        .eq('id', reviewId)
        .single();

      if (checkError || !reviewCheck) {
        throw new Error('Review not found');
      }

      if (reviewCheck.user_id !== userId) {
        throw new Error('Unauthorized: You can only delete your own reviews');
      }

      const { error } = await supabase
        .from('resource_reviews')
        .delete()
        .eq('id', reviewId);

      if (error) {
        throw new Error(`Failed to delete review: ${error.message}`);
      }

      return { message: 'Review deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete review: ${error}`);
    }
  }

  async getAverageRating(resourceId: string) {
    try {
      const supabase = this.supabaseService.getClient();

      const { data, error } = await supabase
        .from('resource_reviews')
        .select('ratings')
        .eq('resource_id', resourceId);

      if (error) {
        console.error('❌ Error fetching ratings:', error);
        throw new Error(`Failed to calculate average rating: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return { averageRating: 0, totalReviews: 0 };
      }

      const totalRating = data.reduce((sum, review) => sum + review.ratings, 0);
      const averageRating = parseFloat((totalRating / data.length).toFixed(1));

      console.log('✅ Average rating calculated:', {
        averageRating,
        totalReviews: data.length,
      });

      return {
        averageRating,
        totalReviews: data.length,
      };
    } catch (error) {
      console.error('❌ Error in getAverageRating:', error);
      throw new Error(`Failed to calculate average rating: ${error}`);
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

  async getUserReview(resourceId: string, userId: string) {
    try {
      const supabase = this.supabaseService.getClient();

      const { data, error } = await supabase
        .from('resource_reviews')
        .select('*')
        .eq('resource_id', resourceId)
        .eq('user_id', userId)
        .single();

      if (error) {
        // If no review found, return null instead of throwing error
        if (error.code === 'PGRST116') {
          console.log('✅ No review found for user:', { resourceId, userId });
          return null;
        }
        console.error('❌ Error fetching user review:', error);
        throw new Error(`Failed to fetch user review: ${error.message}`);
      }

      console.log('✅ User review fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error in getUserReview:', error);
      throw new Error(`Failed to fetch user review: ${error}`);
    }
  }

  async createOrUpdateUserReview(
    resourceId: string,
    userId: string,
    reviewData: {
      review: string;
      ratings: number;
      attachment_url?: string;
    },
  ) {
    try {
      console.log('🔍 Create or update review for user:', {
        resourceId,
        userId,
        reviewData,
      });

      // First, check if user already has a review
      const existingReview = await this.getUserReview(resourceId, userId);

      if (existingReview) {
        // Update existing review
        console.log('✅ Found existing review, updating:', existingReview.id);
        return await this.updateReview(existingReview.id, reviewData);
      } else {
        // Create new review
        console.log('✅ No existing review, creating new one');
        const createData = {
          resource_id: resourceId,
          user_id: userId,
          review: reviewData.review,
          ratings: reviewData.ratings,
          attachment_url: reviewData.attachment_url,
        };
        return await this.createReview(createData);
      }
    } catch (error) {
      console.error('❌ Error in createOrUpdateUserReview:', error);
      throw new Error(`Failed to create or update review: ${error}`);
    }
  }

  // User Progress Methods
  async getUserProgress(userId: string, resourceId: string) {
    try {
      console.log('🔍 Getting user progress:', { userId, resourceId });
      const supabase = this.supabaseService.getClient();

      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('resource_id', resourceId)
        .single();

      if (error) {
        // If no progress found, return null instead of throwing error
        if (error.code === 'PGRST116') {
          console.log('✅ No progress found for user:', { userId, resourceId });
          return null;
        }
        console.error('❌ Error fetching user progress:', error);
        throw new Error(`Failed to fetch user progress: ${error.message}`);
      }

      console.log('✅ User progress fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error in getUserProgress:', error);
      throw new Error(`Failed to fetch user progress: ${error}`);
    }
  }

  async updateUserProgress(
    userId: string,
    resourceId: string,
    progressData: {
      completion_status: 'not_started' | 'in_progress' | 'completed' | 'needs_revision';
      progress_percentage?: number;
    },
  ) {
    try {
      console.log('🔍 Updating user progress:', { userId, resourceId, progressData });
      const supabase = this.supabaseService.getClient();

      // Check if progress record exists
      const existingProgress = await this.getUserProgress(userId, resourceId);

      if (existingProgress) {
        // Update existing progress
        console.log('✅ Found existing progress, updating:', existingProgress.id);
        const { data, error } = await supabase
          .from('user_progress')
          .update({
            ...progressData,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('resource_id', resourceId)
          .select('*')
          .single();

        if (error) {
          console.error('❌ Error updating user progress:', error);
          throw new Error(`Failed to update user progress: ${error.message}`);
        }

        console.log('✅ User progress updated successfully:', data);
        return data;
      } else {
        // Create new progress record
        console.log('✅ No existing progress, creating new one');
        const { data, error } = await supabase
          .from('user_progress')
          .insert({
            user_id: userId,
            resource_id: resourceId,
            ...progressData,
          })
          .select('*')
          .single();

        if (error) {
          console.error('❌ Error creating user progress:', error);
          throw new Error(`Failed to create user progress: ${error.message}`);
        }

        console.log('✅ User progress created successfully:', data);
        return data;
      }
    } catch (error) {
      console.error('❌ Error in updateUserProgress:', error);
      throw new Error(`Failed to update user progress: ${error}`);
    }
  }
}
