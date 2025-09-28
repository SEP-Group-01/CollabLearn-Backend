import {
  Controller,
  Inject,
  Post,
  Get,
  Put,
  Query,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('workspaces')
export class WorkspacesController {
  constructor(
    @Inject('WORKSPACES_SERVICE')
    private readonly workspacesService: ClientProxy,
  ) {}

  @Get()
  async getHello(): Promise<string> {
    return await firstValueFrom(
      this.workspacesService.send({ cmd: 'get-hello' }, {}),
    );
  }

  @Get(':id')
  async getWorkspaceById(@Param('id') id: string) {
    try {
      const workspace = await firstValueFrom(
        this.workspacesService.send({ cmd: 'get-workspace-by-id' }, { id }),
      );
      return workspace;
    } catch (error) {
      throw new HttpException(
        'Error fetching workspace',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('get-workspace-by-id')
  async getWorkspaceByIdPost(@Body() body: { id: string }) {
    try {
      const workspace = await firstValueFrom(
        this.workspacesService.send({ cmd: 'get-workspace-by-id' }, body),
      );
      return workspace;
    } catch (error) {
      throw new HttpException(
        'Error fetching workspace',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('get-workspaces-by-user-id')
  async getWorkspacesByUserId(@Body() body: { userId: string }) {
    try {
      const workspaces = await firstValueFrom(
        this.workspacesService.send({ cmd: 'get-workspaces-by-user-id' }, body),
      );
      return workspaces;
    } catch (error) {
      throw new HttpException(
        'Error fetching workspaces by user ID',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('get-workspaces-by-search-term')
  async getWorkspacesBySearchTerm(@Body() body: { searchTerm: string }) {
    try {
      const workspaces = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'get-workspaces-by-search-term' },
          body,
        ),
      );
      return workspaces;
    } catch (error) {
      throw new HttpException(
        'Error fetching workspaces by search term',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('create-workspace')
  async createWorkspace(
    @Body()
    body: {
      title: string;
      description?: string;
      user_id: string;
      tags?: string[];
    },
  ) {
    //Will check with dto in the service
    try {
      const workspace = await firstValueFrom(
        this.workspacesService.send({ cmd: 'create-workspace' }, body),
      );
      return workspace;
    } catch (error) {
      throw new HttpException(
        'Error creating workspace',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('update-workspace')
  async updateWorkspace(
    @Body()
    body: {
      workspace_id: string;
      title?: string;
      description?: string;
      tags?: string[];
    },
  ) {
    //Will check with dto in the service
    try {
      const workspace = await firstValueFrom(
        this.workspacesService.send({ cmd: 'update-workspace' }, body),
      );
      return workspace;
    } catch (error) {
      throw new HttpException(
        'Error updating workspace',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('join-workspace')
  async joinWorkspace(@Body() body: { userId: string; workspaceId: string }) {
    try {
      const result = await firstValueFrom(
        this.workspacesService.send({ cmd: 'join-workspace' }, body),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        'Error joining workspace',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('request-workspace')
  async requestWorkspace(
    @Body() body: { userId: string; workspaceId: string },
  ) {
    try {
      const result = await firstValueFrom(
        this.workspacesService.send({ cmd: 'request-workspace' }, body),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        'Error requesting workspace',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Workspace Forum Routes
  @Get(':workspaceId/forum/messages')
  async getWorkspaceForumMessages(@Param('workspaceId') workspaceId: string) {
    try {
      // For now, we'll use the workspace ID as the group ID
      // Later you can implement proper workspace-to-forum-group mapping
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'get-workspace-forum-messages' },
          { workspaceId },
        ),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        'Error fetching workspace forum messages',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':workspaceId/forum/messages')
  async createWorkspaceForumMessage(
    @Param('workspaceId') workspaceId: string,
    @Body()
    body: { authorId: string; content: string; parentMessageId?: string },
  ) {
    try {
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'create-workspace-forum-message' },
          { workspaceId, ...body },
        ),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        'Error creating workspace forum message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':workspaceId/forum/messages/:messageId/like')
  async toggleWorkspaceForumMessageLike(
    @Param('workspaceId') workspaceId: string,
    @Param('messageId') messageId: string,
    @Body() body: { userId: string },
  ) {
    try {
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'toggle-workspace-forum-message-like' },
          { workspaceId, messageId, ...body },
        ),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        'Error toggling workspace forum message like',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':workspaceId/forum/messages/:messageId/pin')
  async pinWorkspaceForumMessage(
    @Param('workspaceId') workspaceId: string,
    @Param('messageId') messageId: string,
    @Body() body: { userId: string },
  ) {
    try {
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'pin-workspace-forum-message' },
          { workspaceId, messageId, ...body },
        ),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        'Error pinning workspace forum message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
