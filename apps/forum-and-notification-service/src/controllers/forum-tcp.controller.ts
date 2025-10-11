import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ForumService } from '../services/forum.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { CreateReplyDto } from '../dto/create-reply.dto';
import { ToggleLikeDto } from '../dto/toggle-like.dto';

@Controller()
export class ForumTcpController {
  private readonly logger = new Logger(ForumTcpController.name);

  constructor(private readonly forumService: ForumService) {}

  // Get group messages via TCP
  @MessagePattern({ cmd: 'get-workspace-forum-messages' })
  async getGroupMessages(
    @Payload() data: { workspaceId: string; userId?: string },
  ) {
    try {
      // Use workspaceId as string (UUID)
      const workspaceId = data.workspaceId;
      const userId = data.userId || 'anonymous';

      this.logger.log(
        `TCP: Getting messages for workspace ${data.workspaceId}`,
      );
      const messages = await this.forumService.getGroupMessages(
        workspaceId,
        userId,
      );
      return { success: true, data: messages };
    } catch (error) {
      this.logger.error('Error getting workspace forum messages:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Create message via TCP
  @MessagePattern({ cmd: 'create-workspace-forum-message' })
  async createMessage(
    @Payload()
    data: {
      workspaceId: string;
      authorId: string;
      content: string;
      parentMessageId?: string;
    },
  ) {
    try {
      // Use workspaceId as string and create DTO
      const createMessageDto: CreateMessageDto = {
        workspaceId: data.workspaceId,
        authorId: data.authorId,
        content: data.content,
      };

      this.logger.log(
        `TCP: Creating message for workspace ${data.workspaceId}`,
      );
      const message = await this.forumService.createMessage(createMessageDto);
      return { success: true, data: message };
    } catch (error) {
      this.logger.error('Error creating workspace forum message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Create reply via TCP
  @MessagePattern({ cmd: 'create_reply' })
  async createReply(@Payload() createReplyDto: CreateReplyDto) {
    try {
      this.logger.log(
        `TCP: Creating reply for message ${createReplyDto.messageId}`,
      );
      const reply = await this.forumService.createReply(createReplyDto);
      return { success: true, data: reply };
    } catch (error) {
      this.logger.error('Error creating reply:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Toggle message like via TCP
  @MessagePattern({ cmd: 'toggle-workspace-forum-message-like' })
  async toggleMessageLike(
    @Payload() data: { workspaceId: string; messageId: string; userId: string },
  ) {
    try {
      // Convert messageId to number and create DTO
      const toggleLikeDto: ToggleLikeDto = {
        messageId: parseInt(data.messageId),
        userId: data.userId,
      };

      this.logger.log(
        `TCP: Toggling like for message ${data.messageId} in workspace ${data.workspaceId}`,
      );
      const result = await this.forumService.toggleMessageLike(toggleLikeDto);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Error toggling workspace forum message like:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Toggle reply like via TCP
  @MessagePattern({ cmd: 'toggle_reply_like' })
  async toggleReplyLike(
    @Payload() data: { messageId: number; replyId: number; userId: string },
  ) {
    try {
      this.logger.log(`TCP: Toggling like for reply ${data.replyId}`);
      const result = await this.forumService.toggleReplyLike(
        data.messageId,
        data.replyId,
        data.userId,
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Error toggling reply like:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Pin message via TCP
  @MessagePattern({ cmd: 'pin-workspace-forum-message' })
  async pinMessage(
    @Payload() data: { workspaceId: string; messageId: string; userId: string },
  ) {
    try {
      // Convert messageId to number
      const messageId = parseInt(data.messageId);

      this.logger.log(
        `TCP: Pinning message ${data.messageId} in workspace ${data.workspaceId}`,
      );
      const result = await this.forumService.pinMessage(messageId, data.userId);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Error pinning workspace forum message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Legacy TCP endpoints for backward compatibility
  @MessagePattern({ cmd: 'get_group_messages' })
  async getGroupMessagesLegacy(
    @Payload() data: { groupId: number; userId: string },
  ) {
    return this.getGroupMessages({
      workspaceId: data.groupId.toString(),
      userId: data.userId,
    });
  }

  @MessagePattern({ cmd: 'create_message' })
  async createMessageLegacy(
    @Payload()
    legacyDto: {
      groupId: number;
      authorId: string;
      content: string;
    },
  ) {
    return this.createMessage({
      workspaceId: legacyDto.groupId.toString(),
      authorId: legacyDto.authorId,
      content: legacyDto.content,
    });
  }

  @MessagePattern({ cmd: 'toggle_message_like' })
  async toggleMessageLikeLegacy(@Payload() toggleLikeDto: ToggleLikeDto) {
    return this.toggleMessageLike({
      workspaceId: '0', // placeholder
      messageId: toggleLikeDto.messageId.toString(),
      userId: toggleLikeDto.userId,
    });
  }

  // Health check via TCP
  @MessagePattern({ cmd: 'health_check' })
  healthCheck() {
    return {
      success: true,
      data: {
        status: 'ok',
        service: 'forum-service',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
