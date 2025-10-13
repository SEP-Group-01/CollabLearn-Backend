import {
  Controller,
  Inject,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpException,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Patch,
  Put,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { FileInterceptor } from '@nestjs/platform-express';
import { firstValueFrom } from 'rxjs';

@Controller('workspaces')
export class ResourceController {
  constructor(
    @Inject('RESOURCE_SERVICE')
    private readonly resourceService: ClientProxy,
  ) {}

  // Resource Management Routes
  @Get(':workspaceId/threads/:threadId/links')
  async getThreadLinks(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
  ) {
    try {
      const result = await firstValueFrom(
        this.resourceService.send(
          { cmd: 'get-thread-links' },
          { workspaceId, threadId },
        ),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        'Error fetching thread links',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':workspaceId/threads/:threadId/links')
  async createThreadLink(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Body()
    body: {
      user_id: string;
      title: string;
      description?: string;
      url: string;
    },
  ) {
    try {
      const result = await firstValueFrom(
        this.resourceService.send(
          { cmd: 'create-thread-link' },
          { workspaceId, threadId, ...body },
        ),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        'Error creating thread link',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':workspaceId/threads/:threadId/documents')
  async getThreadDocuments(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
  ) {
    try {
      const result = await firstValueFrom(
        this.resourceService.send(
          { cmd: 'get-thread-documents' },
          { workspaceId, threadId },
        ),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        'Error fetching thread documents',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':workspaceId/threads/:threadId/documents')
  @UseInterceptors(FileInterceptor('file'))
  async createThreadDocument(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Body() body: { user_id: string; title: string; description?: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    try {
      // Convert file to base64 for TCP transmission
      const fileData = {
        buffer: file.buffer.toString('base64'),
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      };

      const result = await firstValueFrom(
        this.resourceService.send(
          { cmd: 'create-thread-document' },
          { workspaceId, threadId, ...body, file: fileData },
        ),
      );
      return result;
    } catch (error) {
      console.error('Error creating thread document:', error);
      throw new HttpException(
        'Error creating thread document',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':workspaceId/threads/:threadId/videos')
  async getThreadVideos(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
  ) {
    try {
      const result = await firstValueFrom(
        this.resourceService.send(
          { cmd: 'get-thread-videos' },
          { workspaceId, threadId },
        ),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        'Error fetching thread videos',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':workspaceId/threads/:threadId/videos')
  @UseInterceptors(FileInterceptor('file'))
  async createThreadVideo(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Body() body: { user_id: string; title: string; description?: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    try {
      // Convert file to base64 for TCP transmission
      const fileData = {
        buffer: file.buffer.toString('base64'),
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      };

      const result = await firstValueFrom(
        this.resourceService.send(
          { cmd: 'create-thread-video' },
          { workspaceId, threadId, ...body, file: fileData },
        ),
      );
      return result;
    } catch (error) {
      console.error('Error creating thread video:', error);
      throw new HttpException(
        'Error creating thread video',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':workspaceId/threads/:threadId/:resourceType/:resourceId')
  async deleteThreadResource(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
    @Body() body: { user_id: string },
  ) {
    try {
      const result = await firstValueFrom(
        this.resourceService.send(
          { cmd: 'delete-thread-resource' },
          { workspaceId, threadId, resourceType, resourceId, ...body },
        ),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        'Error deleting thread resource',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Review Management Routes
  @Post(':workspaceId/threads/:threadId/resources/:resourceId/reviews')
  async createReview(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Param('resourceId') resourceId: string,
    @Body()
    body: {
      user_id: string;
      review: string;
      ratings: number;
      attachment_url?: string;
    },
  ) {
    try {
      console.log('📝 Creating review with data:', {
        workspaceId,
        threadId,
        resourceId,
        body,
      });

      const reviewData = {
        resource_id: resourceId,
        user_id: body.user_id,
        review: body.review,
        ratings: body.ratings,
        attachment_url: body.attachment_url,
      };

      console.log('📝 Sending review data to service:', reviewData);

      const result = await firstValueFrom(
        this.resourceService.send({ cmd: 'create-review' }, reviewData),
      );

      console.log('✅ Review created successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Error creating review:', error);
      throw new HttpException(
        `Error creating review: ${error.message || error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':workspaceId/threads/:threadId/resources/:resourceId/reviews')
  async getReviewsByResource(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Param('resourceId') resourceId: string,
  ) {
    try {
      const result = await firstValueFrom(
        this.resourceService.send(
          { cmd: 'get-reviews-by-resource' },
          { workspaceId, threadId, resourceId },
        ),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        'Error fetching reviews',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':workspaceId/threads/:threadId/resources/:resourceId/rating')
  async getAverageRating(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Param('resourceId') resourceId: string,
  ) {
    try {
      const result = await firstValueFrom(
        this.resourceService.send(
          { cmd: 'get-average-rating' },
          { workspaceId, threadId, resourceId },
        ),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        'Error fetching average rating',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(
    ':workspaceId/threads/:threadId/resources/:resourceId/reviews/:reviewId',
  )
  async updateReview(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Param('resourceId') resourceId: string,
    @Param('reviewId') reviewId: string,
    @Body()
    body: {
      review?: string;
      ratings?: number;
      attachment_url?: string;
    },
  ) {
    try {
      console.log('📝 Updating review with data:', {
        workspaceId,
        threadId,
        resourceId,
        reviewId,
        body,
      });

      const result = await firstValueFrom(
        this.resourceService.send(
          { cmd: 'update-review' },
          { workspaceId, threadId, resourceId, reviewId, ...body },
        ),
      );

      console.log('✅ Review updated successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Error updating review:', error);
      throw new HttpException(
        `Error updating review: ${error.message || error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(
    ':workspaceId/threads/:threadId/resources/:resourceId/reviews/:reviewId',
  )
  async deleteReview(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Param('resourceId') resourceId: string,
    @Param('reviewId') reviewId: string,
    @Body() body: { userId: string },
  ) {
    try {
      const result = await firstValueFrom(
        this.resourceService.send(
          { cmd: 'delete-review' },
          { workspaceId, threadId, resourceId, reviewId, ...body },
        ),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        'Error deleting review',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(
    ':workspaceId/threads/:threadId/resources/:resourceId/reviews/user/:userId',
  )
  async getUserReview(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Param('resourceId') resourceId: string,
    @Param('userId') userId: string,
  ) {
    try {
      const result = await firstValueFrom(
        this.resourceService.send(
          { cmd: 'get-user-review' },
          { workspaceId, threadId, resourceId, userId },
        ),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        'Error fetching user review',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(
    ':workspaceId/threads/:threadId/resources/:resourceId/reviews/user/:userId',
  )
  async createOrUpdateUserReview(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Param('resourceId') resourceId: string,
    @Param('userId') userId: string,
    @Body()
    body: {
      review: string;
      ratings: number;
      attachment_url?: string;
    },
  ) {
    try {
      console.log('📝 Create or update review with data:', {
        workspaceId,
        threadId,
        resourceId,
        userId,
        body,
      });

      const result = await firstValueFrom(
        this.resourceService.send(
          { cmd: 'create-or-update-user-review' },
          {
            workspaceId,
            threadId,
            resourceId,
            userId,
            review: body.review,
            ratings: body.ratings,
            attachment_url: body.attachment_url,
          },
        ),
      );

      console.log('✅ Review created/updated successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Error creating/updating review:', error);
      throw new HttpException(
        `Error creating/updating review: ${error.message || error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
