import {
  Controller,
  Inject,
  Post,
  Get,
  Put,
  Delete,
  Query,
  Body,
  Param,
  HttpException,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  Headers,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { FileInterceptor } from '@nestjs/platform-express/multer';

@Controller('workspaces')
export class WorkspacesController {
  constructor(
    @Inject('WORKSPACES_SERVICE')
    private readonly workspacesService: ClientProxy,
    @Inject('AUTH_SERVICE') private readonly authService: ClientProxy,
  ) {}

  // Helper method to validate token
  private async validateAuthToken(authHeader: string) {
    if (!authHeader) {
      throw new HttpException(
        'Authorization header is required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    try {
      return await firstValueFrom(
        this.authService.send({ cmd: 'validate_token' }, { token }),
      );
    } catch (error) {
      throw new HttpException(
        'Invalid or expired token',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  @Get()
  async getHello(): Promise<string> {
    console.log('🌐 [Gateway] Testing connection to workspace service...');
    try {
      const result = await firstValueFrom(
        this.workspacesService.send({ cmd: 'get-hello' }, {}).pipe(
          timeout(5000), // 5 second timeout to detect if service is not responding
        ),
      );
      console.log(
        '✅ [Gateway] Successfully received response from workspace service:',
        result,
      );
      return result;
    } catch (error) {
      console.error(
        '❌ [Gateway] Error connecting to workspace service:',
        error,
      );
      console.error('❌ [Gateway] Error details:', error.message);
      throw new HttpException(
        `Workspace service unavailable: ${error.message}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // Debug endpoint to test token validation
  @Get('debug/token')
  async debugToken(@Headers('authorization') authHeader: string) {
    try {
      console.log(
        '🔍 [Gateway] Debug token called with header:',
        authHeader ? 'Present' : 'Missing',
      );
      const tokenValidation = await this.validateAuthToken(authHeader);
      console.log('✅ [Gateway] Token validation successful:', tokenValidation);
      return {
        success: true,
        user: tokenValidation.user,
        message: 'Token is valid',
      };
    } catch (error) {
      console.error('❌ [Gateway] Token validation failed:', error);
      throw error;
    }
  }

  // Check if user is admin or moderator for a thread
  @Get('check-admin-moderator/:threadId')
  async checkAdminOrModerator(
    @Param('threadId') threadId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      console.log('🔍 [Gateway] Checking admin/moderator status for thread:', threadId);
      
      // Validate token and get user information
      const tokenValidation = await this.validateAuthToken(authHeader);
      const userId = tokenValidation.user?.id || tokenValidation.user?.userId;

      if (!userId) {
        throw new HttpException(
          'Unable to extract user ID from token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      console.log('📋 [Gateway] Sending admin check request for user:', userId, 'thread:', threadId);

      // Call workspaces service to check admin/moderator status
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'check-admin-or-moderator' },
          { threadId, userId }
        ).pipe(timeout(10000))
      );

      console.log('✅ [Gateway] Admin check result:', result);

      return {
        isAdminOrModerator: result.isAdminOrModerator || false
      };
    } catch (error) {
      console.error('❌ [Gateway] Error checking admin/moderator status:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Error checking admin/moderator status',
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

  @Get('search/:searchTerm')
  async getWorkspacesBySearchTerm(
    @Param('searchTerm') searchTerm: string,
    @Headers('authorization') authHeader?: string,
  ) {
    try {
      let userId: string | undefined;

      // Try to validate token if provided, but don't require it for search
      if (authHeader) {
        try {
          const tokenValidation = await this.validateAuthToken(authHeader);
          userId = tokenValidation.user.id;
        } catch (error) {
          // If token validation fails, continue without user context
          console.log(
            '🔍 [Gateway] Token validation failed, continuing as guest:',
            error.message,
          );
        }
      }

      const workspaces = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'get-workspaces-by-search-term' },
          { searchTerm, userId },
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

  @Post('create')
  @UseInterceptors(FileInterceptor('image')) // match field name "image"
  async createWorkspace(
    @UploadedFile() file: any,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ) {
    //Will check with dto in the service
    try {
      console.log('🔐 [Gateway] Starting token validation...');
      // Validate the token and get user information
      const tokenValidation = await this.validateAuthToken(authHeader);

      console.log('🌐 [Gateway] Creating workspace with body:', body);
      console.log('🌐 [Gateway] Received file:', file ? file : 'No file');
      console.log('🌐 [Gateway] Authenticated user:', tokenValidation.user);

      // Parse tags if they come as a string
      let parsedTags = [];
      if (body.tags) {
        try {
          parsedTags =
            typeof body.tags === 'string' ? JSON.parse(body.tags) : body.tags;
        } catch (error) {
          console.warn(
            '⚠️ [Gateway] Failed to parse tags, using empty array:',
            error,
          );
          parsedTags = [];
        }
      }

      // Map joinPolicy to join_policy and normalize the value
      let joinPolicy = 'request'; // default value
      if (body.joinPolicy) {
        // Map "requests" to "request", "invite_only" stays the same, etc.
        switch (body.joinPolicy.toLowerCase()) {
          case 'requests':
          case 'request':
            joinPolicy = 'request';
            break;
          case 'open':
            joinPolicy = 'open';
            break;
          case 'invite_only':
          case 'invite-only':
            joinPolicy = 'invite_only';
            break;
          default:
            joinPolicy = 'request';
        }
      }

      // Add the authenticated user ID to the body for workspace creation
      const workspaceData = {
        title: body.title,
        description: body.description,
        tags: parsedTags,
        join_policy: joinPolicy, // Use join_policy instead of joinPolicy
        user_id: tokenValidation.user.id,
        // image: file ? file.originalname : undefined, // TODO: Implement proper file storage
      };

      console.log(
        '📤 [Gateway] Sending message to workspace service with data:',
        JSON.stringify(workspaceData, null, 2),
      );

      const workspace = await firstValueFrom(
        this.workspacesService
          .send({ cmd: 'create-workspace' }, workspaceData)
          .pipe(
            timeout(10000), // 10 second timeout for create operation
          ),
      );

      console.log(
        '✅ [Gateway] Successfully received response from workspace service:',
        workspace,
      );
      return workspace;
    } catch (error) {
      console.error('❌ [Gateway] Error in createWorkspace:', error);
      if (error instanceof HttpException) {
        throw error;
      }
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

  @Post('join')
  async joinWorkspace(
    @Body() body: { workspaceId: string },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'join-workspace' },
          { userId: tokenValidation.user.id, workspaceId: body.workspaceId },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error joining workspace',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('leave')
  async leaveWorkspace(
    @Body() body: { workspaceId: string },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'leave-workspace' },
          { userId: tokenValidation.user.id, workspaceId: body.workspaceId },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error leaving workspace',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('request')
  async sendJoinRequest(
    @Body() body: { workspaceId: string },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'send-join-request' },
          { userId: tokenValidation.user.id, workspaceId: body.workspaceId },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error sending join request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('cancel-request')
  async cancelJoinRequest(
    @Body() body: { workspaceId: string },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'cancel-join-request' },
          { userId: tokenValidation.user.id, workspaceId: body.workspaceId },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error canceling join request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('validate-email')
  async validateEmail(
    @Body() body: { workspaceId: string; email: string },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'validate-email' },
          {
            userId: tokenValidation.user.id,
            workspaceId: body.workspaceId,
            email: body.email,
          },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error validating email',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('bulk-invite')
  async sendBulkInvites(
    @Body() body: { workspaceId: string; emails: string[] },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'bulk-invite' },
          {
            userId: tokenValidation.user.id,
            workspaceId: body.workspaceId,
            emails: body.emails,
          },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error sending bulk invites',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('accept-invite')
  async acceptInvite(
    @Body() body: { workspaceId: string },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'accept-invite' },
          { userId: tokenValidation.user.id, workspaceId: body.workspaceId },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error accepting invite',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('decline-invite')
  async declineInvite(
    @Body() body: { workspaceId: string },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'decline-invite' },
          { userId: tokenValidation.user.id, workspaceId: body.workspaceId },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error declining invite',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':workspaceId/invites')
  async getWorkspaceInvites(
    @Param('workspaceId') workspaceId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'get-workspace-invites' },
          { userId: tokenValidation.user.id, workspaceId },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error getting workspace invites',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':workspaceId/members')
  async getWorkspaceMembers(
    @Param('workspaceId') workspaceId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      console.log(
        '🌐 [Gateway] getWorkspaceMembers called for workspace:',
        workspaceId,
      );
      const tokenValidation = await this.validateAuthToken(authHeader);
      console.log(
        '🔐 [Gateway] Token validated for user:',
        tokenValidation.user.id,
      );

      console.log(
        '📤 [Gateway] Sending get-workspace-members message to service...',
      );
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'get-workspace-members' },
          { workspaceId, userId: tokenValidation.user.id },
        ),
      );
      console.log(
        '✅ [Gateway] Received response from workspace service:',
        result,
      );
      return result;
    } catch (error) {
      console.error('❌ [Gateway] Error in getWorkspaceMembers:', error);
      console.error('❌ [Gateway] Error details:', error.message);
      console.error('❌ [Gateway] Error stack:', error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error getting workspace members',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('invites/:inviteId')
  async deleteInvite(
    @Param('inviteId') inviteId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'delete-invite' },
          { userId: tokenValidation.user.id, inviteId },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error deleting invite',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':workspaceId/user-role')
  async getUserRoleInWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'get-user-role-in-workspace' },
          { userId: tokenValidation.user.id, workspaceId },
        ),
      );
      console.log('🌐 [Gateway] User role in workspace:', result);
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error getting user role in workspace',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':workspaceId/threads')
  async getThreadsByWorkspaceId(@Param('workspaceId') workspaceId: string) {
    try {
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'get-threads-by-workspace-id' },
          { workspaceId },
        ),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        'Error fetching threads',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':workspaceId/threads/create')
  async createThreadInWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Body() body: { title: string; description: string },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'create-thread-in-workspace' },
          {
            workspaceId,
            userId: tokenValidation.user.id,
            title: body.title,
            description: body.description,
          },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error creating thread',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('join-requests/user')
  async getUserJoinRequests(@Headers('authorization') authHeader: string) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'get-user-join-requests' },
          { userId: tokenValidation.user.id },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error getting user join requests',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':workspaceId/join-requests')
  async getWorkspaceJoinRequests(
    @Param('workspaceId') workspaceId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'get-workspace-join-requests' },
          { workspaceId, userId: tokenValidation.user.id },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error getting workspace join requests',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':workspaceId/join-requests/:requestId/approve')
  async approveJoinRequest(
    @Param('workspaceId') workspaceId: string,
    @Param('requestId') requestId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'approve-join-request' },
          { workspaceId, requestId, userId: tokenValidation.user.id },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error approving join request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':workspaceId/join-requests/:requestId')
  async rejectJoinRequest(
    @Param('workspaceId') workspaceId: string,
    @Param('requestId') requestId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'reject-join-request' },
          { workspaceId, requestId, userId: tokenValidation.user.id },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error rejecting join request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Keep this route last since :workspaceId is a catch-all parameter
  @Get(':workspaceId')
  async getWorkspaceById(
    @Param('workspaceId') workspaceId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    try {
      let userId: string | undefined;

      // Try to validate token if provided, but don't require it
      if (authHeader) {
        try {
          const tokenValidation = await this.validateAuthToken(authHeader);
          userId = tokenValidation.user.id;
        } catch (error) {
          // If token validation fails, proceed without user context
          console.warn(
            '🔐 [Gateway] Token validation failed, proceeding without auth:',
            error.message,
          );
        }
      }

      const workspace = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'get-workspace-by-id' },
          { id: workspaceId, userId },
        ),
      );
      console.log('🌐 [Gateway] Fetched workspace:', workspace);
      return workspace;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error fetching workspace',
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
