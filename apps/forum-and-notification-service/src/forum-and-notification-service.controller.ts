import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ForumAndNotificationServiceService } from './forum-and-notification-service.service';
import { ForumService } from './services/forum.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { ToggleLikeDto } from './dto/toggle-like.dto';

@Controller('forum')
export class ForumAndNotificationServiceController {
  constructor(
    private readonly forumAndNotificationServiceService: ForumAndNotificationServiceService,
    private readonly forumService: ForumService,
  ) {}

  @Get()
  getHello(): string {
    return this.forumAndNotificationServiceService.getHello();
  }

  @Get('groups/:groupId/messages')
  async getGroupMessages(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Query('userId') userId: string, // UUID string
  ) {
    return this.forumService.getGroupMessages(groupId, userId);
  }

  @Post('messages')
  async createMessage(@Body() createMessageDto: CreateMessageDto) {
    return this.forumService.createMessage(createMessageDto);
  }

  @Post('replies')
  async createReply(@Body() createReplyDto: CreateReplyDto) {
    return this.forumService.createReply(createReplyDto);
  }

  @Post('messages/like')
  async toggleMessageLike(@Body() toggleLikeDto: ToggleLikeDto) {
    return this.forumService.toggleMessageLike(toggleLikeDto);
  }

  @Post('replies/like')
  async toggleReplyLike(
    @Body() body: { messageId: number; replyId: number; userId: string },
  ) {
    return this.forumService.toggleReplyLike(
      body.messageId,
      body.replyId,
      body.userId,
    );
  }

  @Put('messages/:messageId/pin')
  async pinMessage(
    @Param('messageId', ParseIntPipe) messageId: number,
    @Query('userId') userId: string, // UUID string
  ) {
    return this.forumService.pinMessage(messageId, userId);
  }

  @Put('messages/:messageId/unpin')
  async unpinMessage(
    @Param('messageId', ParseIntPipe) messageId: number,
    @Query('userId') userId: string, // UUID string
  ) {
    return this.forumService.unpinMessage(messageId, userId);
  }
}
