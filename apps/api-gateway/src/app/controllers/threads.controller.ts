import {
  Controller,
  Inject,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpException,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('threads')
export class ThreadsController {
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

  @Get(':threadId/role')
  async getUserRoleInThread(
    @Param('threadId') threadId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'get-user-role-in-thread' },
          { userId: tokenValidation.user.id, threadId },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error getting user role in thread',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':workspaceId/create')
  async createThread(
    @Param('workspaceId') workspaceId: string,
    @Body() threadData: { name: string; description: string },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      console.log(
        '🌐 [Gateway] createThread called for workspace:',
        workspaceId,
      );
      const tokenValidation = await this.validateAuthToken(authHeader);
      console.log(
        '🔐 [Gateway] Token validated for user:',
        tokenValidation.user.id,
      );

      console.log('📤 [Gateway] Sending create-thread message to service...');
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'create-thread' },
          {
            workspaceId,
            threadData,
            createdBy: tokenValidation.user.id,
          },
        ),
      );
      console.log(
        '✅ [Gateway] Received response from workspace service:',
        result,
      );
      return result;
    } catch (error) {
      console.error('❌ [Gateway] Error in createThread:', error);
      console.error('❌ [Gateway] Error details:', error.message);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error creating thread',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':threadId')
  async getThread(
    @Param('threadId') threadId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'get-thread' },
          { threadId, userId: tokenValidation.user.id },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error getting thread',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':threadId')
  async updateThread(
    @Param('threadId') threadId: string,
    @Body() threadData: { name?: string; description?: string },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'update-thread' },
          { threadId, threadData, userId: tokenValidation.user.id },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error updating thread',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':threadId')
  async deleteThread(
    @Param('threadId') threadId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'delete-thread' },
          { threadId, userId: tokenValidation.user.id },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error deleting thread',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':threadId/subscribe')
  async subscribeToThread(
    @Param('threadId') threadId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'subscribe-to-thread' },
          { threadId, userId: tokenValidation.user.id },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error subscribing to thread',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':threadId/unsubscribe')
  async unsubscribeFromThread(
    @Param('threadId') threadId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'unsubscribe-from-thread' },
          { threadId, userId: tokenValidation.user.id },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error unsubscribing from thread',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':threadId/subscribers')
  async getThreadSubscribers(
    @Param('threadId') threadId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'get-thread-subscribers' },
          { threadId, userId: tokenValidation.user.id },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error getting thread subscribers',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':threadId/moderators')
  async assignModerators(
    @Param('threadId') threadId: string,
    @Body() data: { userIds: string[] },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'assign-thread-moderators' },
          { threadId, userIds: data.userIds, userId: tokenValidation.user.id },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error assigning moderators',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':threadId/moderators')
  async removeModerators(
    @Param('threadId') threadId: string,
    @Body() data: { userIds: string[] },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'remove-thread-moderators' },
          { threadId, userIds: data.userIds, userId: tokenValidation.user.id },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error removing moderators',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':threadId/stats')
  async getThreadStats(
    @Param('threadId') threadId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'get-thread-stats' },
          { threadId, userId: tokenValidation.user.id },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error getting thread stats',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':threadId/resources')
  async getThreadResources(
    @Param('threadId') threadId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'get-thread-resources' },
          { threadId, userId: tokenValidation.user.id },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error getting thread resources',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':threadId/quizzes')
  async getThreadQuizzes(
    @Param('threadId') threadId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'get-thread-quizzes' },
          { threadId, userId: tokenValidation.user.id },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error getting thread quizzes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('quizzes/:quizId/attempts')
  async getQuizAttempts(
    @Param('quizId') quizId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const tokenValidation = await this.validateAuthToken(authHeader);
      const result = await firstValueFrom(
        this.workspacesService.send(
          { cmd: 'get-quiz-attempts' },
          { quizId, userId: tokenValidation.user.id },
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error getting quiz attempts',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}