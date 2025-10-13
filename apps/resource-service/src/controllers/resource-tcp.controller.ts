import { Controller, UseFilters } from '@nestjs/common';
import { ResourceService } from '../services/resource.service';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class ResourceTcpController {
  constructor(private readonly resourceService: ResourceService) {}

  // Resource management message patterns
  @MessagePattern({ cmd: 'get-thread-links' })
  getThreadLinks(data: { workspaceId: string; threadId: string }) {
    return this.resourceService.getResources(data.threadId, 'link');
  }

  @MessagePattern({ cmd: 'create-thread-link' })
  createThreadLink(data: {
    workspaceId: string;
    threadId: string;
    user_id: string;
    title: string;
    description?: string;
    url: string;
  }) {
    const resourceData = {
      thread_id: data.threadId,
      user_id: data.user_id,
      resource_type: 'link' as const,
      title: data.title,
      description: data.description,
      url: data.url,
    };
    return this.resourceService.createResource(resourceData);
  }

  @MessagePattern({ cmd: 'get-thread-documents' })
  getThreadDocuments(data: { workspaceId: string; threadId: string }) {
    return this.resourceService.getResources(data.threadId, 'document');
  }

  @MessagePattern({ cmd: 'create-thread-document' })
  createThreadDocument(data: {
    workspaceId: string;
    threadId: string;
    user_id: string;
    title: string;
    description?: string;
    file: any; // File buffer from multipart
  }) {
    const resourceData = {
      thread_id: data.threadId,
      user_id: data.user_id,
      resource_type: 'document' as const,
      title: data.title,
      description: data.description,
    };
    return this.resourceService.createResource(resourceData, data.file);
  }

  @MessagePattern({ cmd: 'get-thread-videos' })
  getThreadVideos(data: { workspaceId: string; threadId: string }) {
    return this.resourceService.getResources(data.threadId, 'video');
  }

  @MessagePattern({ cmd: 'create-thread-video' })
  createThreadVideo(data: {
    workspaceId: string;
    threadId: string;
    user_id: string;
    title: string;
    description?: string;
    file: any; // File buffer from multipart
  }) {
    const resourceData = {
      thread_id: data.threadId,
      user_id: data.user_id,
      resource_type: 'video' as const,
      title: data.title,
      description: data.description,
    };
    return this.resourceService.createResource(resourceData, data.file);
  }

  @MessagePattern({ cmd: 'delete-thread-resource' })
  deleteThreadResource(data: {
    workspaceId: string;
    threadId: string;
    resourceType: string;
    resourceId: string;
    user_id: string;
  }) {
    return this.resourceService.deleteResource(data.resourceId, data.user_id);
  }

  // Review message patterns
  @MessagePattern({ cmd: 'create-review' })
  createReview(data: {
    resource_id: string;
    user_id: string;
    review: string;
    ratings: number;
    attachment_url?: string;
  }) {
    // Data is already in the correct DTO structure from API Gateway
    console.log('🔍 TCP received review data:', data);
    return this.resourceService.createReview(data);
  }

  @MessagePattern({ cmd: 'get-reviews-by-resource' })
  getReviewsByResource(data: {
    workspaceId: string;
    threadId: string;
    resourceId: string;
  }) {
    return this.resourceService.getReviewsByResource(data.resourceId);
  }

  @MessagePattern({ cmd: 'update-review' })
  updateReview(data: {
    workspaceId: string;
    threadId: string;
    resourceId: string;
    reviewId: string;
    review?: string;
    ratings?: number;
    attachment_url?: string;
  }) {
    const { reviewId, review, ratings, attachment_url } = data;
    const updateData = { review, ratings, attachment_url };
    return this.resourceService.updateReview(reviewId, updateData);
  }

  @MessagePattern({ cmd: 'delete-review' })
  deleteReview(data: {
    workspaceId: string;
    threadId: string;
    resourceId: string;
    reviewId: string;
    userId: string;
  }) {
    return this.resourceService.deleteReview(data.reviewId, data.userId);
  }

  @MessagePattern({ cmd: 'get-average-rating' })
  getAverageRating(data: {
    workspaceId: string;
    threadId: string;
    resourceId: string;
  }) {
    return this.resourceService.getAverageRating(data.resourceId);
  }

  @MessagePattern({ cmd: 'get-user-review' })
  getUserReview(data: {
    workspaceId: string;
    threadId: string;
    resourceId: string;
    userId: string;
  }) {
    return this.resourceService.getUserReview(data.resourceId, data.userId);
  }

  @MessagePattern({ cmd: 'create-or-update-user-review' })
  createOrUpdateUserReview(data: {
    workspaceId: string;
    threadId: string;
    resourceId: string;
    userId: string;
    review: string;
    ratings: number;
    attachment_url?: string;
  }) {
    return this.resourceService.createOrUpdateUserReview(
      data.resourceId,
      data.userId,
      {
        review: data.review,
        ratings: data.ratings,
        attachment_url: data.attachment_url,
      },
    );
  }
}
