// resourceService.ts - Frontend API integration with TypeScript
export interface ResourceMetadata {
  userId: string;
  title: string;
  description?: string;
}

export interface LinkData {
  userId: string;
  title: string;
  url: string;
  description?: string;
}

export interface Document {
  id: string;
  title: string;
  description?: string;
  file_size?: number;
  mime_type?: string;
  firebase_url?: string;
  created_at?: string;
  user_id?: string;
}

export interface Video {
  id: string;
  title: string;
  description?: string;
  file_size?: number;
  mime_type?: string;
  firebase_url?: string;
  created_at?: string;
  user_id?: string;
}

export interface Link {
  id: string;
  title: string;
  description?: string;
  url: string;
  created_at?: string;
  user_id?: string;
}

export interface AllResources {
  documents: Document[];
  videos: Video[];
  links: Link[];
}

export interface Review {
  id: string;
  resource_id: string;
  user_id: string;
  review: string;
  ratings: number;
  attachment_url?: string;
  created_at: string;
  updated_at?: string;
  users?: {
    id: string;
    username: string;
    email: string;
  };
}

export interface CreateReviewData {
  user_id: string;
  review: string;
  ratings: number;
  attachment_url?: string;
}

export interface UpdateReviewData {
  review?: string;
  ratings?: number;
  attachment_url?: string;
}

export interface AverageRating {
  averageRating: number;
  totalReviews: number;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  message?: string;
}

const RESOURCE_SERVICE_URL = 'http://localhost:3007';
const API_GATEWAY_URL = 'http://localhost:3000/api'; // Note: API Gateway runs on port 3000 with /api prefix

class ResourceService {
  // ===== FILE UPLOADS (Direct to Resource Service) =====

  async uploadDocument(
    workspaceId: string,
    threadId: string,
    file: File,
    metadata: ResourceMetadata,
  ): Promise<ApiResponse<Document>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', metadata.userId);
    formData.append('title', metadata.title);
    formData.append('description', metadata.description || '');

    try {
      const response = await fetch(
        `${RESOURCE_SERVICE_URL}/workspace/${workspaceId}/threads/${threadId}/documents`,
        {
          method: 'POST',
          body: formData,
          // Don't set Content-Type - browser will set it with boundary for multipart
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Document upload failed:', error);
      throw error;
    }
  }

  async uploadVideo(
    workspaceId: string,
    threadId: string,
    file: File,
    metadata: ResourceMetadata,
  ): Promise<ApiResponse<Video>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', metadata.userId);
    formData.append('title', metadata.title);
    formData.append('description', metadata.description || '');

    try {
      const response = await fetch(
        `${RESOURCE_SERVICE_URL}/workspace/${workspaceId}/threads/${threadId}/videos`,
        {
          method: 'POST',
          body: formData,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Video upload failed:', error);
      throw error;
    }
  }

  // ===== OTHER OPERATIONS (Through API Gateway with TCP) =====

  async createLink(
    workspaceId: string,
    threadId: string,
    linkData: LinkData,
  ): Promise<ApiResponse<Link>> {
    try {
      const response = await fetch(
        `${API_GATEWAY_URL}/workspaces/${workspaceId}/threads/${threadId}/links`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: linkData.userId,
            title: linkData.title,
            description: linkData.description,
            url: linkData.url,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Link creation failed:', error);
      throw error;
    }
  }

  async getAllResources(
    workspaceId: string,
    threadId: string,
  ): Promise<AllResources> {
    try {
      // Get all resource types separately since there's no combined endpoint
      const [documents, videos, links] = await Promise.all([
        this.getDocuments(workspaceId, threadId),
        this.getVideos(workspaceId, threadId),
        this.getLinks(workspaceId, threadId),
      ]);

      return { documents, videos, links };
    } catch (error) {
      console.error('Failed to fetch resources:', error);
      throw error;
    }
  }

  async deleteResource(
    workspaceId: string,
    threadId: string,
    resourceType: 'documents' | 'videos' | 'links',
    resourceId: string,
    userId: string,
  ): Promise<ApiResponse> {
    try {
      const response = await fetch(
        `${API_GATEWAY_URL}/workspaces/${workspaceId}/threads/${threadId}/${resourceType}/${resourceId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Resource deletion failed:', error);
      throw error;
    }
  }

  // ===== INDIVIDUAL RESOURCE GETTERS =====

  async getDocuments(
    workspaceId: string,
    threadId: string,
  ): Promise<Document[]> {
    try {
      const response = await fetch(
        `${API_GATEWAY_URL}/workspaces/${workspaceId}/threads/${threadId}/documents`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      throw error;
    }
  }

  async getVideos(workspaceId: string, threadId: string): Promise<Video[]> {
    try {
      const response = await fetch(
        `${API_GATEWAY_URL}/workspaces/${workspaceId}/threads/${threadId}/videos`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Failed to fetch videos:', error);
      throw error;
    }
  }

  async getLinks(workspaceId: string, threadId: string): Promise<Link[]> {
    try {
      const response = await fetch(
        `${API_GATEWAY_URL}/workspaces/${workspaceId}/threads/${threadId}/links`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Failed to fetch links:', error);
      throw error;
    }
  }

  // ===== HEALTH CHECK =====

  async checkConnection(): Promise<{
    resourceService: boolean;
    apiGateway: boolean;
  }> {
    const results = {
      resourceService: false,
      apiGateway: false,
    };

    // Check Resource Service
    try {
      const response = await fetch(`${RESOURCE_SERVICE_URL}/health`, {
        method: 'GET',
      });
      results.resourceService = response.ok;
    } catch (error) {
      console.warn('Resource Service health check failed:', error);
    }

    // Check API Gateway
    try {
      const response = await fetch(`${API_GATEWAY_URL}/health`, {
        method: 'GET',
      });
      results.apiGateway = response.ok;
    } catch (error) {
      console.warn('API Gateway health check failed:', error);
    }

    return results;
  }

  // =============== REVIEW METHODS ===============

  /**
   * Create a new review for a resource
   */
  async createReview(
    workspaceId: string,
    threadId: string,
    resourceId: string,
    reviewData: CreateReviewData,
  ): Promise<Review> {
    try {
      const response = await fetch(
        `${API_GATEWAY_URL}/api/workspaces/${workspaceId}/threads/${threadId}/resources/${resourceId}/reviews`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(reviewData),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to create review: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating review:', error);
      throw error;
    }
  }

  /**
   * Get all reviews for a specific resource
   */
  async getReviewsByResource(
    workspaceId: string,
    threadId: string,
    resourceId: string,
  ): Promise<Review[]> {
    try {
      const response = await fetch(
        `${API_GATEWAY_URL}/api/workspaces/${workspaceId}/threads/${threadId}/resources/${resourceId}/reviews`,
        {
          method: 'GET',
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch reviews: ${response.statusText}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching reviews:', error);
      return [];
    }
  }

  /**
   * Get average rating for a resource
   */
  async getAverageRating(
    workspaceId: string,
    threadId: string,
    resourceId: string,
  ): Promise<AverageRating> {
    try {
      const response = await fetch(
        `${API_GATEWAY_URL}/api/workspaces/${workspaceId}/threads/${threadId}/resources/${resourceId}/rating`,
        {
          method: 'GET',
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch rating: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching rating:', error);
      return { averageRating: 0, totalReviews: 0 };
    }
  }

  /**
   * Update an existing review
   */
  async updateReview(
    workspaceId: string,
    threadId: string,
    resourceId: string,
    reviewId: string,
    updateData: UpdateReviewData,
  ): Promise<Review> {
    try {
      const response = await fetch(
        `${API_GATEWAY_URL}/api/workspaces/${workspaceId}/threads/${threadId}/resources/${resourceId}/reviews/${reviewId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to update review: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating review:', error);
      throw error;
    }
  }

  /**
   * Delete a review
   */
  async deleteReview(
    workspaceId: string,
    threadId: string,
    resourceId: string,
    reviewId: string,
    userId: string,
  ): Promise<{ message: string }> {
    try {
      const response = await fetch(
        `${API_GATEWAY_URL}/api/workspaces/${workspaceId}/threads/${threadId}/resources/${resourceId}/reviews/${reviewId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to delete review: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting review:', error);
      throw error;
    }
  }
}

// Export singleton instance
const resourceService = new ResourceService();
export default resourceService;

// Also export the class for advanced usage
export { ResourceService };
