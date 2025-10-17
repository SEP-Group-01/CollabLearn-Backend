import {
  Controller,
  Inject,
  Post,
  Get,
  Body,
  Param,
  Query,
  Put,
  Delete,
  HttpException,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

interface CreateMessageDto {
  groupId: number;
  authorId: string;
  content: string;
}

interface CreateReplyDto {
  messageId: number;
  authorId: string;
  content: string;
}

interface ToggleLikeDto {
  messageId: number;
  userId: string;
}

@Controller('forum')
export class ForumController {
  constructor(
    @Inject('FORUM_SERVICE') private readonly forumService: ClientProxy,
  ) {}

  private handleServiceResponse(result: any, errorMessage: string): any {
    // Type guard to check if result has the expected structure
    if (!result || typeof result !== 'object') {
      throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // ESLint disable for microservice response handling
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const success = result['success'];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const error = result['error'];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const data = result['data'];

    if (!success) {
      const errorMsg =
        error && typeof error === 'string' ? error : errorMessage;
      throw new HttpException(errorMsg, HttpStatus.BAD_REQUEST);
    }

    return data;
  }

  private handleError(error: unknown, defaultMessage: string): never {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(defaultMessage, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  // Health check endpoint
  @Get('health')
  async health(): Promise<{ status: string; timestamp: string }> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await firstValueFrom(
        this.forumService.send({ cmd: 'health_check' }, {}),
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return this.handleServiceResponse(result, 'Health check failed');
    } catch (error) {
      this.handleError(error, 'Forum service unavailable');
    }
  }

  // Get group messages (legacy endpoint)
  @Get('groups/:groupId/messages')
  async getGroupMessages(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Query('userId') userId: string,
  ): Promise<any> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await firstValueFrom(
        this.forumService.send(
          { cmd: 'get_group_messages' },
          { groupId, userId },
        ),
      );

      return this.handleServiceResponse(result, 'Failed to fetch messages');
    } catch (error) {
      this.handleError(error, 'Failed to fetch messages');
    }
  }

  // Get workspace forum messages (new endpoint for workspace-based forums)
  @Get('workspaces/:workspaceId/forum/messages')
  async getWorkspaceForumMessages(
    @Param('workspaceId') workspaceId: string,
    @Query('userId') userId?: string,
  ): Promise<any> {
    try {
      console.log(`📥 Gateway: Getting forum messages for workspace ${workspaceId}`);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await firstValueFrom(
        this.forumService.send(
          { cmd: 'get-group-messages' },
          { workspaceId, userId },
        ),
      );

      return this.handleServiceResponse(result, 'Error fetching workspace forum messages');
    } catch (error) {
      console.error(`❌ Gateway: Error fetching workspace forum messages:`, error);
      this.handleError(error, 'Error fetching workspace forum messages');
    }
  }

  // Create message
  @Post('workspaces/:workspaceId/forum/messages')
  async createMessage(
    @Body() message: { content: string; authorId: string },
    @Param('workspaceId') workspaceId: string,
  ): Promise<any> {
    try {
      // Create proper DTO
      const createMessageDto = {
        workspaceId,
        authorId: message.authorId,
        content: message.content,
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await firstValueFrom(
        this.forumService.send({ cmd: 'create-workspace-forum-message' }, createMessageDto),
      );

      return this.handleServiceResponse(result, 'Failed to create message');
    } catch (error) {
      this.handleError(error, 'Failed to create message');
    }
  }

  // Create reply
  @Post('replies')
  async createReply(@Body() createReplyDto: CreateReplyDto): Promise<any> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await firstValueFrom(
        this.forumService.send({ cmd: 'create_reply' }, createReplyDto),
      );

      return this.handleServiceResponse(result, 'Failed to create reply');
    } catch (error) {
      this.handleError(error, 'Failed to create reply');
    }
  }

  // Toggle message like
  @Post('messages/like')
  async toggleMessageLike(@Body() toggleLikeDto: ToggleLikeDto): Promise<any> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await firstValueFrom(
        this.forumService.send({ cmd: 'toggle_message_like' }, toggleLikeDto),
      );

      return this.handleServiceResponse(result, 'Failed to toggle like');
    } catch (error) {
      this.handleError(error, 'Failed to toggle like');
    }
  }

  // Toggle reply like
  @Post('replies/like')
  async toggleReplyLike(
    @Body() body: { messageId: number; replyId: number; userId: string },
  ): Promise<any> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await firstValueFrom(
        this.forumService.send({ cmd: 'toggle_reply_like' }, body),
      );

      return this.handleServiceResponse(result, 'Failed to toggle reply like');
    } catch (error) {
      this.handleError(error, 'Failed to toggle reply like');
    }
  }

  // Pin message
  @Put('messages/:messageId/pin')
  async pinMessage(
    @Param('messageId', ParseIntPipe) messageId: number,
    @Query('userId') userId: string,
  ): Promise<any> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await firstValueFrom(
        this.forumService.send({ cmd: 'pin_message' }, { messageId, userId }),
      );

      return this.handleServiceResponse(result, 'Failed to pin message');
    } catch (error) {
      this.handleError(error, 'Failed to pin message');
    }
  }

  // Unpin message
  @Put('messages/:messageId/unpin')
  async unpinMessage(
    @Param('messageId', ParseIntPipe) messageId: number,
    @Query('userId') userId: string,
  ): Promise<any> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await firstValueFrom(
        this.forumService.send({ cmd: 'unpin_message' }, { messageId, userId }),
      );

      return this.handleServiceResponse(result, 'Failed to unpin message');
    } catch (error) {
      this.handleError(error, 'Failed to unpin message');
    }
  }

  // Delete message
  @Delete('workspaces/:workspaceId/messages/:messageId')
  async deleteMessage(
    @Param('workspaceId') workspaceId: string,
    @Param('messageId') messageId: string,
    @Body() body: { userId: string },
  ): Promise<any> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await firstValueFrom(
        this.forumService.send({ cmd: 'delete_message' }, { messageId, userId: body.userId }),
      );

      return this.handleServiceResponse(result, 'Failed to delete message');
    } catch (error) {
      this.handleError(error, 'Failed to delete message');
    }
  }

  // Delete reply
  @Delete('messages/:messageId/replies/:replyId')
  async deleteReply(
    @Param('messageId') messageId: string,
    @Param('replyId') replyId: string,
    @Body() body: { userId: string },
  ): Promise<any> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await firstValueFrom(
        this.forumService.send({ cmd: 'delete_reply' }, { replyId, userId: body.userId }),
      );

      return this.handleServiceResponse(result, 'Failed to delete reply');
    } catch (error) {
      this.handleError(error, 'Failed to delete reply');
    }
  }
}
