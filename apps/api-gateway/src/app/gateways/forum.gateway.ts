import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

interface CreateMessageData {
  groupId: number;
  userId: string;
  content: string;
}

interface CreateReplyData {
  messageId: number;
  userId: string;
  content: string;
  groupId: number;
}

interface ToggleLikeData {
  messageId?: number;
  replyId?: number;
  userId: string;
  groupId: number;
  type: 'message' | 'reply';
}

interface JoinGroupData {
  groupId: number;
  userId: string;
}

interface PinMessageData {
  messageId: number;
  userId: string;
  groupId: number;
  action: 'pin' | 'unpin';
}

interface TypingData {
  groupId: number;
  userId: string;
  isTyping: boolean;
}

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

  private readonly logger = new Logger(ForumGateway.name);
  private groupClients = new Map<string, Set<Socket>>();
  private userSockets = new Map<string, Socket>();

  constructor(
    @Inject('FORUM_SERVICE')
    private readonly forumService: ClientProxy,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Forum client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Forum client disconnected: ${client.id}`);
    
    // Clean up client from all group rooms
    this.groupClients.forEach((clients, groupId) => {
      clients.delete(client);
      if (clients.size === 0) {
        this.groupClients.delete(groupId);
      }
    });

    // Remove from user socket mapping
    for (const [userId, socket] of this.userSockets.entries()) {
      if (socket === client) {
        this.userSockets.delete(userId);
        break;
      }
    }
  }

  private addClientToGroup(groupId: string, client: Socket) {
    if (!this.groupClients.has(groupId)) {
      this.groupClients.set(groupId, new Set());
    }
    this.groupClients.get(groupId)!.add(client);
  }

  private removeClientFromGroup(groupId: string, client: Socket) {
    if (this.groupClients.has(groupId)) {
      this.groupClients.get(groupId)!.delete(client);
      if (this.groupClients.get(groupId)!.size === 0) {
        this.groupClients.delete(groupId);
      }
    }
  }

  private broadcastToGroup(groupId: string, event: string, data: any, excludeClient?: Socket) {
    const clients = this.groupClients.get(groupId);
    if (clients) {
      clients.forEach((client) => {
        if (client !== excludeClient) {
          try {
            client.emit(event, data);
          } catch (error) {
            this.logger.error(`Error broadcasting to client:`, error);
          }
        }
      });
    }
  }

  @SubscribeMessage('join-group')
  async handleJoinGroup(
    @MessageBody() data: JoinGroupData,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`User ${data.userId} joining group ${data.groupId}`);
      
      const groupId = data.groupId.toString();
      
      // Add client to group room
      this.addClientToGroup(groupId, client);
      
      // Store user socket mapping
      this.userSockets.set(data.userId, client);
      
      // Send confirmation to client
      client.emit('group-joined', {
        success: true, 
        message: `Joined group ${data.groupId}`,
        groupId: data.groupId 
      });

      // Notify other clients in the group
      this.broadcastToGroup(groupId, 'user-joined', {
        userId: data.userId,
        message: 'User joined the group',
      }, client);
      
    } catch (error) {
      this.logger.error('Error joining group:', error);
      client.emit('error', { message: 'Failed to join group' });
    }
  }

  @SubscribeMessage('leave-group')
  async handleLeaveGroup(
    @MessageBody() data: JoinGroupData,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`User ${data.userId} leaving group ${data.groupId}`);
      
      const groupId = data.groupId.toString();
      
      // Remove client from group room
      this.removeClientFromGroup(groupId, client);
      
      // Remove from user socket mapping
      this.userSockets.delete(data.userId);
      
      // Send confirmation to client
      client.emit('group-left', {
        success: true, 
        message: `Left group ${data.groupId}`,
        groupId: data.groupId 
      });

      // Notify other clients in the group
      this.broadcastToGroup(groupId, 'user-left', {
        userId: data.userId,
        message: 'User left the group',
      }, client);
      
    } catch (error) {
      this.logger.error('Error leaving group:', error);
      client.emit('error', { message: 'Failed to leave group' });
    }
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @MessageBody() data: CreateMessageData,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Creating message for group ${data.groupId} from user ${data.userId}`);
      
      // Forward to forum service via TCP
      const result = await firstValueFrom(
        this.forumService.send({ cmd: 'create_message' }, {
          groupId: data.groupId,
          authorId: data.userId,
          content: data.content,
        })
      );

      if (result.success) {
        const groupId = data.groupId.toString();
        
        // Broadcast new message to all clients in the group
        this.broadcastToGroup(groupId, 'new-message', {
          message: result.data,
          groupId: data.groupId,
        });

        // Send confirmation to sender
        client.emit('message-sent', { success: true, message: result.data });
      } else {
        throw new Error(result.error || 'Failed to create message');
      }
      
    } catch (error) {
      this.logger.error('Error sending message:', error);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  @SubscribeMessage('send-reply')
  async handleSendReply(
    @MessageBody() data: CreateReplyData,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Creating reply for message ${data.messageId} from user ${data.userId}`);
      
      // Forward to forum service via TCP
      const result = await firstValueFrom(
        this.forumService.send({ cmd: 'create_reply' }, {
          messageId: data.messageId,
          authorId: data.userId,
          content: data.content,
        })
      );

      if (result.success) {
        const groupId = data.groupId.toString();
        
        // Broadcast new reply to all clients in the group
        this.broadcastToGroup(groupId, 'new-reply', {
          reply: result.data,
          messageId: data.messageId,
          groupId: data.groupId,
        });

        // Send confirmation to sender
        client.emit('reply-sent', { success: true, reply: result.data });
      } else {
        throw new Error(result.error || 'Failed to create reply');
      }
      
    } catch (error) {
      this.logger.error('Error sending reply:', error);
      client.emit('error', { message: 'Failed to send reply' });
    }
  }

  @SubscribeMessage('toggle-like')
  async handleToggleLike(
    @MessageBody() data: ToggleLikeData,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Toggling like for ${data.type} from user ${data.userId}`);
      
      let result: any;
      
      if (data.type === 'message' && data.messageId) {
        result = await firstValueFrom(
          this.forumService.send({ cmd: 'toggle_message_like' }, {
            messageId: data.messageId,
            userId: data.userId,
          })
        );
      } else if (data.type === 'reply' && data.messageId && data.replyId) {
        result = await firstValueFrom(
          this.forumService.send({ cmd: 'toggle_reply_like' }, {
            messageId: data.messageId,
            replyId: data.replyId,
            userId: data.userId,
          })
        );
      } else {
        throw new Error('Invalid like toggle data');
      }

      if (result.success) {
        const groupId = data.groupId.toString();
        
        // Broadcast like update to all clients in the group
        this.broadcastToGroup(groupId, 'like-updated', {
          ...data,
          liked: result.data.liked,
          likeCount: result.data.likeCount,
        });

        // Send confirmation to sender
        client.emit('like-toggled', { success: true, ...result.data });
      } else {
        throw new Error(result.error || 'Failed to toggle like');
      }
      
    } catch (error) {
      this.logger.error('Error toggling like:', error);
      client.emit('error', { message: 'Failed to toggle like' });
    }
  }

  @SubscribeMessage('pin-message')
  async handlePinMessage(
    @MessageBody() data: PinMessageData,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`${data.action}ning message ${data.messageId} by user ${data.userId}`);
      
      const command = data.action === 'pin' ? 'pin_message' : 'unpin_message';
      
      const result = await firstValueFrom(
        this.forumService.send({ cmd: command }, {
          messageId: data.messageId,
          userId: data.userId,
        })
      );

      if (result.success) {
        const groupId = data.groupId.toString();
        
        // Broadcast pin/unpin update to all clients in the group
        this.broadcastToGroup(groupId, 'message-pin-updated', {
          messageId: data.messageId,
          isPinned: data.action === 'pin',
          groupId: data.groupId,
        });

        // Send confirmation to sender
        client.emit('message-pinned', { success: true, data: result.data });
      } else {
        throw new Error(result.error || `Failed to ${data.action} message`);
      }
      
    } catch (error) {
      this.logger.error('Error pinning/unpinning message:', error);
      client.emit('error', { message: `Failed to ${data.action} message` });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: TypingData,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const groupId = data.groupId.toString();
      
      // Broadcast typing status to others in the group (not to sender)
      this.broadcastToGroup(groupId, 'user-typing', {
        userId: data.userId,
        isTyping: data.isTyping,
      }, client);
      
    } catch (error) {
      this.logger.error('Error handling typing:', error);
    }
  }

  @SubscribeMessage('get-messages')
  async handleGetMessages(
    @MessageBody() data: { groupId: number; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Getting messages for group ${data.groupId}`);
      
      const result = await firstValueFrom(
        this.forumService.send({ cmd: 'get_group_messages' }, {
          groupId: data.groupId,
          userId: data.userId,
        })
      );

      if (result.success) {
        client.emit('messages-loaded', { 
          messages: result.data, 
          groupId: data.groupId 
        });
      } else {
        throw new Error(result.error || 'Failed to get messages');
      }
      
    } catch (error) {
      this.logger.error('Error getting messages:', error);
      client.emit('error', { message: 'Failed to load messages' });
    }
  }

  // Method to send notifications to specific users
  sendNotificationToUser(userId: string, notification: any) {
    const socket = this.userSockets.get(userId);
    if (socket) {
      try {
        socket.emit('notification', notification);
      } catch (error) {
        this.logger.error(`Error sending notification to user ${userId}:`, error);
      }
    }
  }

  // Method to broadcast updates to a group
  broadcastToGroupExternal(groupId: number, event: string, data: any) {
    this.broadcastToGroup(groupId.toString(), event, data);
  }
}