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
  Patch,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ResourceService,
  UploadedFile as CustomUploadedFile,
} from '../services/resource.service';
import { CreateResourceDto } from '../dto/resource.dto';
import { CreateReviewDto, UpdateReviewDto } from '../dto/review.dto';

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

  // =============== REVIEW ENDPOINTS ===============

  // POST /workspace/:workspaceId/threads/:threadId/resources/:resourceId/reviews
  @Post('resources/:resourceId/reviews')
  async createReview(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Body() reviewData: CreateReviewDto,
  ) {
    // Add resource_id to the review data from the URL parameter
    const reviewWithResourceId = {
      ...reviewData,
      resource_id: resourceId,
    };
    return this.resourceService.createReview(reviewWithResourceId);
  }

  // GET /workspace/:workspaceId/threads/:threadId/resources/:resourceId/reviews
  @Get('resources/:resourceId/reviews')
  async getReviewsByResource(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
  ) {
    return this.resourceService.getReviewsByResource(resourceId);
  }

  // GET /workspace/:workspaceId/threads/:threadId/resources/:resourceId/rating
  @Get('resources/:resourceId/rating')
  async getAverageRating(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
  ) {
    return this.resourceService.getAverageRating(resourceId);
  }

  // PATCH /workspace/:workspaceId/threads/:threadId/resources/:resourceId/reviews/:reviewId
  @Patch('resources/:resourceId/reviews/:reviewId')
  async updateReview(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() updateData: UpdateReviewDto,
  ) {
    return this.resourceService.updateReview(reviewId, updateData);
  }

  // DELETE /workspace/:workspaceId/threads/:threadId/resources/:resourceId/reviews/:reviewId
  @Delete('resources/:resourceId/reviews/:reviewId')
  async deleteReview(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body('userId') userId: string, // In a real app, get this from auth token
  ) {
    return this.resourceService.deleteReview(reviewId, userId);
  }
}
