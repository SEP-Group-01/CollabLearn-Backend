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
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://collab-learn-frontend.vercel.app', // Add your deployed frontend
    ],
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

  // User joins a workspace room
  @SubscribeMessage('join-group')
  async handleJoinGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string; userId: string },
  ) {
    const { workspaceId, userId } = data;
    const roomName = `workspace-${workspaceId}`;

    // Join the user to the room
    await client.join(roomName);

    // Store user info for this socket
    client.data = { userId, workspaceId };

    this.logger.log(`User ${userId} joined workspace ${workspaceId}`);

    // Optionally, notify other users in the group that someone joined
    client.to(roomName).emit('user-joined', {
      userId,
      message: `User ${userId} joined the workspace`,
    });

    return { success: true, message: `Joined workspace ${workspaceId}` };
  }

  // User leaves a group room
  @SubscribeMessage('leave-group')
  async handleLeaveGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string; userId: string },
  ) {
    const { workspaceId, userId } = data;
    const roomName = `workspace-${workspaceId}`;

    await client.leave(roomName);
    this.userSockets.delete(userId);

    this.logger.log(`User ${userId} left workspace ${workspaceId}`);

    // Optionally, notify other users in the group that someone left
    client.to(roomName).emit('user-left', {
      userId,
      message: `User ${userId} left the workspace`,
    });

    return { success: true, message: `Left workspace ${workspaceId}` };
  }

  // Real-time message creation
  @SubscribeMessage('send-message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    messageData: {
      workspaceId: string; // Changed from groupId number to workspaceId string
      userId: string;
      content: string;
      parentId?: number;
    },
  ) {
    try {
      // Create message using existing service
      const newMessage = await this.forumService.createMessage({
        workspaceId: messageData.workspaceId,
        authorId: messageData.userId, // Use authorId as per DTO
        content: messageData.content,
      });

      const roomName = `workspace-${messageData.workspaceId}`;

      // Broadcast new message to all users in the workspace
      this.server.to(roomName).emit('new-message', {
        message: newMessage,
        workspaceId: messageData.workspaceId,
      });

      this.logger.log(
        `New message broadcasted to workspace ${messageData.workspaceId}`,
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
      workspaceId: string; // Changed from groupId to workspaceId
    },
  ) {
    try {
      // Create reply using existing service
      const newReply = await this.forumService.createReply({
        messageId: replyData.messageId,
        authorId: replyData.userId, // Use authorId as per DTO
        content: replyData.content,
      });

      const roomName = `workspace-${replyData.workspaceId}`;

      // Broadcast new reply to all users in the workspace
      this.server.to(roomName).emit('new-reply', {
        reply: newReply,
        messageId: replyData.messageId,
        workspaceId: replyData.workspaceId,
      });

      this.logger.log(
        `New reply broadcasted to workspace ${replyData.workspaceId}`,
      );

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
      workspaceId: string; // Changed from groupId to workspaceId
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

      const roomName = `workspace-${likeData.workspaceId}`;

      // Broadcast like update to all users in the workspace
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
    @MessageBody()
    data: { workspaceId: string; userId: string; isTyping: boolean },
  ) {
    const roomName = `workspace-${data.workspaceId}`;

    // Broadcast typing status to others in the workspace (not to sender)
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
      workspaceId: string; // Changed from groupId to workspaceId
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

      const roomName = `workspace-${data.workspaceId}`;

      // Broadcast pin/unpin update to all users in the workspace
      this.server.to(roomName).emit('message-pin-updated', {
        messageId: data.messageId,
        isPinned: data.action === 'pin',
        workspaceId: data.workspaceId,
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

  // Method to broadcast updates to a workspace
  broadcastToWorkspace(workspaceId: string, event: string, data: any) {
    const roomName = `workspace-${workspaceId}`;
    this.server.to(roomName).emit(event, data);
  }
}
