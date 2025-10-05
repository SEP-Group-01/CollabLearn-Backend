import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ResourceService,
  UploadedFile as CustomUploadedFile,
} from '../services/resource.service';
import { CreateResourceDto } from '../dto/resource.dto';

@Controller('workspace/:workspaceId/threads/:threadId')
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  // GET /workspace/:workspaceId/threads/:threadId/documents
  @Get('documents')
  async getDocuments(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('threadId', ParseUUIDPipe) threadId: string,
  ) {
    return this.resourceService.getResources(threadId, 'document');
  }

  // GET /workspace/:workspaceId/threads/:threadId/videos
  @Get('videos')
  async getVideos(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('threadId', ParseUUIDPipe) threadId: string,
  ) {
    return this.resourceService.getResources(threadId, 'video');
  }

  // GET /workspace/:workspaceId/threads/:threadId/links
  @Get('links')
  async getLinks(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('threadId', ParseUUIDPipe) threadId: string,
  ) {
    return this.resourceService.getResources(threadId, 'link');
  }

  // POST /workspace/:workspaceId/threads/:threadId/documents
  @Post('documents')
  @UseInterceptors(FileInterceptor('file'))
  async createDocument(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Body()
    createResourceDto: Omit<CreateResourceDto, 'thread_id' | 'resource_type'>,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const customFile: CustomUploadedFile = {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };

    const resourceData: CreateResourceDto = {
      ...createResourceDto,
      thread_id: threadId,
      resource_type: 'document',
    };

    return this.resourceService.createResource(resourceData, customFile);
  }

  // POST /workspace/:workspaceId/threads/:threadId/videos
  @Post('videos')
  @UseInterceptors(FileInterceptor('file'))
  async createVideo(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Body()
    createResourceDto: Omit<CreateResourceDto, 'thread_id' | 'resource_type'>,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const customFile: CustomUploadedFile = {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };

    const resourceData: CreateResourceDto = {
      ...createResourceDto,
      thread_id: threadId,
      resource_type: 'video',
    };

    return this.resourceService.createResource(resourceData, customFile);
  }

  // POST /workspace/:workspaceId/threads/:threadId/links
  @Post('links')
  async createLink(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Body()
    createResourceDto: Omit<CreateResourceDto, 'thread_id' | 'resource_type'>,
  ) {
    const resourceData: CreateResourceDto = {
      ...createResourceDto,
      thread_id: threadId,
      resource_type: 'link',
    };

    return this.resourceService.createResource(resourceData);
  }

  // DELETE /workspace/:workspaceId/threads/:threadId/:resourceType/:id
  @Delete(':resourceType/:id')
  async deleteResource(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Param('resourceType') resourceType: string,
    @Param('id', ParseUUIDPipe) resourceId: string,
    @Body('userId') userId: string, // In a real app, get this from auth token
  ) {
    return this.resourceService.deleteResource(resourceId, userId);
  }
}
