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
  @MessagePattern({ cmd: 'get_group_messages' })
  async getGroupMessages(@Payload() data: { groupId: number; userId: string }) {
    try {
      this.logger.log(`TCP: Getting messages for group ${data.groupId}`);
      const messages = await this.forumService.getGroupMessages(
        data.groupId,
        data.userId,
      );
      return { success: true, data: messages };
    } catch (error) {
      this.logger.error('Error getting group messages:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Create message via TCP
  @MessagePattern({ cmd: 'create_message' })
  async createMessage(@Payload() createMessageDto: CreateMessageDto) {
    try {
      this.logger.log(
        `TCP: Creating message for group ${createMessageDto.groupId}`,
      );
      const message = await this.forumService.createMessage(createMessageDto);
      return { success: true, data: message };
    } catch (error) {
      this.logger.error('Error creating message:', error);
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
  @MessagePattern({ cmd: 'toggle_message_like' })
  async toggleMessageLike(@Payload() toggleLikeDto: ToggleLikeDto) {
    try {
      this.logger.log(
        `TCP: Toggling like for message ${toggleLikeDto.messageId}`,
      );
      const result = await this.forumService.toggleMessageLike(toggleLikeDto);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Error toggling message like:', error);
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
  @MessagePattern({ cmd: 'pin_message' })
  async pinMessage(@Payload() data: { messageId: number; userId: string }) {
    try {
      this.logger.log(`TCP: Pinning message ${data.messageId}`);
      const result = await this.forumService.pinMessage(
        data.messageId,
        data.userId,
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Error pinning message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Unpin message via TCP
  @MessagePattern({ cmd: 'unpin_message' })
  async unpinMessage(@Payload() data: { messageId: number; userId: string }) {
    try {
      this.logger.log(`TCP: Unpinning message ${data.messageId}`);
      const result = await this.forumService.unpinMessage(
        data.messageId,
        data.userId,
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Error unpinning message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
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
