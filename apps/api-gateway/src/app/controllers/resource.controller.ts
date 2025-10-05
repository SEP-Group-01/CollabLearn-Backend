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
      const result = await firstValueFrom(
        this.resourceService.send(
          { cmd: 'create-thread-document' },
          { workspaceId, threadId, ...body, file },
        ),
      );
      return result;
    } catch (error) {
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
      const result = await firstValueFrom(
        this.resourceService.send(
          { cmd: 'create-thread-video' },
          { workspaceId, threadId, ...body, file },
        ),
      );
      return result;
    } catch (error) {
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
}
