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
}
