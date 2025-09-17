import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ForumService } from '../services/forum.service';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
  },
  namespace: '/forum',
})
export class ForumGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('ForumGateway');
  private userSockets = new Map<string, string>(); // userId -> socketId

  constructor(private readonly forumService: ForumService) {}

  // Connection handling
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Remove user from active users map
    for (const [userId, socketId] of this.userSockets.entries()) {
      if (socketId === client.id) {
        this.userSockets.delete(userId);
        break;
      }
    }
  }

  // User joins a group room
  @SubscribeMessage('join-group')
  async handleJoinGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: number; userId: string },
  ) {
    const { groupId, userId } = data;
    const roomName = `group-${groupId}`;

    // Join the room
    await client.join(roomName);

    // Store user socket mapping
    this.userSockets.set(userId, client.id);

    this.logger.log(`User ${userId} joined group ${groupId}`);

    // Notify others in the group that user joined
    client.to(roomName).emit('user-joined', {
      userId,
      message: 'User joined the group',
    });

    return { success: true, message: `Joined group ${groupId}` };
  }

  // User leaves a group room
  @SubscribeMessage('leave-group')
  async handleLeaveGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: number; userId: string },
  ) {
    const { groupId, userId } = data;
    const roomName = `group-${groupId}`;

    await client.leave(roomName);
    this.userSockets.delete(userId);

    this.logger.log(`User ${userId} left group ${groupId}`);

    // Notify others in the group that user left
    client.to(roomName).emit('user-left', {
      userId,
      message: 'User left the group',
    });

    return { success: true, message: `Left group ${groupId}` };
  }

  // Real-time message creation
  @SubscribeMessage('send-message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    messageData: {
      groupId: number;
      userId: string;
      content: string;
      parentId?: number;
    },
  ) {
    try {
      // Create message using existing service
      const newMessage = await this.forumService.createMessage({
        groupId: messageData.groupId,
        authorId: messageData.userId, // Use authorId as per DTO
        content: messageData.content,
      });

      const roomName = `group-${messageData.groupId}`;

      // Broadcast new message to all users in the group
      this.server.to(roomName).emit('new-message', {
        message: newMessage,
        groupId: messageData.groupId,
      });

      this.logger.log(
        `New message broadcasted to group ${messageData.groupId}`,
      );

      return { success: true, message: newMessage };
    } catch (error: unknown) {
      this.logger.error('Error sending message:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  // Real-time reply creation
  @SubscribeMessage('send-reply')
  async handleSendReply(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    replyData: {
      messageId: number;
      userId: string;
      content: string;
      groupId: number;
    },
  ) {
    try {
      // Create reply using existing service
      const newReply = await this.forumService.createReply({
        messageId: replyData.messageId,
        authorId: replyData.userId, // Use authorId as per DTO
        content: replyData.content,
      });

      const roomName = `group-${replyData.groupId}`;

      // Broadcast new reply to all users in the group
      this.server.to(roomName).emit('new-reply', {
        reply: newReply,
        messageId: replyData.messageId,
        groupId: replyData.groupId,
      });

      this.logger.log(`New reply broadcasted to group ${replyData.groupId}`);

      return { success: true, reply: newReply };
    } catch (error: unknown) {
      this.logger.error('Error sending reply:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  // Real-time like/unlike
  @SubscribeMessage('toggle-like')
  async handleToggleLike(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    likeData: {
      messageId?: number;
      replyId?: number;
      userId: string;
      groupId: number;
      type: 'message' | 'reply';
    },
  ) {
    try {
      let result: { liked: boolean; likeCount: number };

      if (likeData.type === 'message' && likeData.messageId) {
        result = await this.forumService.toggleMessageLike({
          messageId: likeData.messageId,
          userId: likeData.userId,
        });
      } else if (
        likeData.type === 'reply' &&
        likeData.messageId &&
        likeData.replyId
      ) {
        result = await this.forumService.toggleReplyLike(
          likeData.messageId,
          likeData.replyId,
          likeData.userId,
        );
      } else {
        return { success: false, error: 'Invalid like data' };
      }

      const roomName = `group-${likeData.groupId}`;

      // Broadcast like update to all users in the group
      this.server.to(roomName).emit('like-updated', {
        ...likeData,
        liked: result.liked,
        likeCount: result.likeCount,
      });

      return { success: true, ...result };
    } catch (error: unknown) {
      this.logger.error('Error toggling like:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  // Typing indicator
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: number; userId: string; isTyping: boolean },
  ) {
    const roomName = `group-${data.groupId}`;

    // Broadcast typing status to others in the group (not to sender)
    client.to(roomName).emit('user-typing', {
      userId: data.userId,
      isTyping: data.isTyping,
    });
  }

  // Message pinning/unpinning
  @SubscribeMessage('pin-message')
  async handlePinMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      messageId: number;
      userId: string;
      groupId: number;
      action: 'pin' | 'unpin';
    },
  ) {
    try {
      let result: any;

      if (data.action === 'pin') {
        result = await this.forumService.pinMessage(
          data.messageId,
          data.userId,
        );
      } else {
        result = await this.forumService.unpinMessage(
          data.messageId,
          data.userId,
        );
      }

      const roomName = `group-${data.groupId}`;

      // Broadcast pin/unpin update to all users in the group
      this.server.to(roomName).emit('message-pin-updated', {
        messageId: data.messageId,
        isPinned: data.action === 'pin',
        groupId: data.groupId,
      });

      return { success: true, data: result };
    } catch (error: unknown) {
      this.logger.error('Error pinning/unpinning message:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  // Method to send notifications to specific users
  sendNotificationToUser(userId: string, notification: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit('notification', notification);
    }
  }

  // Method to broadcast updates to a group
  broadcastToGroup(groupId: number, event: string, data: any) {
    const roomName = `group-${groupId}`;
    this.server.to(roomName).emit(event, data);
  }
}
