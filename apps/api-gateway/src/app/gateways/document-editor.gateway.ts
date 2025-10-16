import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { RedisBridgeService } from '../services/redis-bridge.service';

@WebSocketGateway({
  namespace: '/collaboration',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  },
  transports: ['websocket'],
})
export class DocumentEditorGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DocumentEditorGateway.name);
  private documentClients = new Map<string, Set<Socket>>();

  constructor(
    @Inject('DOCUMENT_EDITOR_SERVICE')
    private readonly documentEditorService: ClientProxy,
    private readonly redisBridgeService: RedisBridgeService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('DocumentEditorGateway initialized');
    // Register this gateway with the Redis bridge service
    this.redisBridgeService.setGateway(this);
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Clean up client from all document rooms
    this.documentClients.forEach((clients, documentId) => {
      clients.delete(client);
      if (clients.size === 0) {
        this.documentClients.delete(documentId);
      }
    });
  }

  private addClientToDocument(documentId: string, client: Socket) {
    if (!this.documentClients.has(documentId)) {
      this.documentClients.set(documentId, new Set());
    }
    this.documentClients.get(documentId)!.add(client);
    client.join(`document-${documentId}`);
  }

  private removeClientFromDocument(documentId: string, client: Socket) {
    if (this.documentClients.has(documentId)) {
      this.documentClients.get(documentId)!.delete(client);
      if (this.documentClients.get(documentId)!.size === 0) {
        this.documentClients.delete(documentId);
      }
    }
    client.leave(`document-${documentId}`);
  }

  private _broadcastToDocument(documentId: string, message: any, excludeClient?: Socket) {
    // Use Socket.IO room broadcasting
    if (excludeClient) {
      excludeClient.to(`document-${documentId}`).emit('collaboration-event', message);
    } else {
      this.server.to(`document-${documentId}`).emit('collaboration-event', message);
    }
  }

  /**
   * Public method to broadcast messages to document clients
   * Used by RedisBridgeService to forward Redis events
   */
  public broadcastToDocument(documentId: string, message: any, excludeClient?: Socket) {
    this._broadcastToDocument(documentId, message, excludeClient);
  }

  @SubscribeMessage('document:join')
  async handleJoinDocument(
    @MessageBody() data: { documentId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`User ${data.userId} joining document ${data.documentId}`);
      
      // Extract user information from WebSocket handshake query
      const query = client.handshake.query;
      const userInfo = {
        id: data.userId,
        name: query.userName as string || 'Unknown User',
        avatar: query.userAvatar as string || 'U',
        color: query.userColor as string || '#4caf50',
      };
      
      // Add client to document room
      this.addClientToDocument(data.documentId, client);
      
      const result = await this.documentEditorService
        .send('document.join', { 
          documentId: data.documentId, 
          userId: data.userId,
          userInfo: userInfo
        })
        .toPromise();
      
      client.emit('document:joined', result);

      // Get updated collaborator list
      const collaboratorsResult = await this.documentEditorService
        .send('document.collaborators', { documentId: data.documentId })
        .toPromise();

      // Notify all clients about the updated user list
      this.broadcastToDocument(data.documentId, {
        event: 'user-update',
        type: 'user-update',
        data: { users: collaboratorsResult.collaborators || [] },
      });

      // Also notify about collaborator joined
      this.broadcastToDocument(data.documentId, {
        event: 'collaborator:joined',
        data: { userId: data.userId, documentId: data.documentId, userInfo: userInfo },
      }, client);
      
    } catch (error) {
      this.logger.error('Error joining document:', error);
      client.emit('error', { message: 'Failed to join document' });
    }
  }

  @SubscribeMessage('document:leave')
  async handleLeaveDocument(
    @MessageBody() data: { documentId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`User ${data.userId} leaving document ${data.documentId}`);
      
      // Remove client from document room
      this.removeClientFromDocument(data.documentId, client);
      
      const result = await this.documentEditorService
        .send('document.leave', { documentId: data.documentId, userId: data.userId })
        .toPromise();
      
      client.emit('document:left', result);

      // Get updated collaborator list
      const collaboratorsResult = await this.documentEditorService
        .send('document.collaborators', { documentId: data.documentId })
        .toPromise();

      // Notify all remaining clients about the updated user list
      this.broadcastToDocument(data.documentId, {
        event: 'user-update',
        type: 'user-update',
        data: { users: collaboratorsResult.collaborators || [] },
      });

      // Also notify about collaborator left
      this.broadcastToDocument(data.documentId, {
        event: 'collaborator:left',
        data: { userId: data.userId, documentId: data.documentId },
      });
      
    } catch (error) {
      this.logger.error('Error leaving document:', error);
      client.emit('error', { message: 'Failed to leave document' });
    }
  }

  @SubscribeMessage('yjs:update')
  async handleYjsUpdate(
    @MessageBody() data: { documentId: string; userId: string; update: ArrayBuffer },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Y.js update for document ${data.documentId} from user ${data.userId}`);
      
      // Convert ArrayBuffer to Uint8Array
      const updateArray = new Uint8Array(data.update);
      
      const result = await this.documentEditorService
        .send('document.yjs.update', {
          documentId: data.documentId,
          userId: data.userId,
          update: updateArray,
        })
        .toPromise();
      
      // Broadcast the Y.js update to all other clients in the document
      this.broadcastToDocument(data.documentId, {
        event: 'yjs:update',
        data: {
          documentId: data.documentId,
          userId: data.userId,
          update: Array.from(updateArray), // Convert to regular array for JSON serialization
        },
      }, client);

      // Send confirmation to sender
      client.emit('yjs:update-confirmed', result);
      
    } catch (error) {
      this.logger.error('Error applying Y.js update:', error);
      client.emit('error', { message: 'Failed to apply Y.js update' });
    }
  }

  @SubscribeMessage('yjs:sync-request')
  async handleYjsSyncRequest(
    @MessageBody() data: { documentId: string; stateVector?: number[] },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Y.js sync request for document ${data.documentId}`);
      
      if (data.stateVector) {
        // Client has state, get updates since their state
        const stateVector = new Uint8Array(data.stateVector);
        const result = await this.documentEditorService
          .send('document.yjs.updateSince', {
            documentId: data.documentId,
            stateVector: stateVector,
          })
          .toPromise();
        
        client.emit('yjs:sync-update', {
          documentId: data.documentId,
          update: Array.from(result.update),
        });
      } else {
        // Client has no state, get full document state
        const result = await this.documentEditorService
          .send('document.get', { documentId: data.documentId })
          .toPromise();
        
        client.emit('yjs:sync-update', {
          documentId: data.documentId,
          update: Array.from(result.yDocState),
        });
      }
      
    } catch (error) {
      this.logger.error('Error handling Y.js sync request:', error);
      client.emit('error', { message: 'Failed to sync document' });
    }
  }

  @SubscribeMessage('awareness:update')
  async handleAwarenessUpdate(
    @MessageBody() data: { documentId: string; userId: string; awareness: any },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Awareness update for document ${data.documentId} from user ${data.userId}`);
      
      const result = await this.documentEditorService
        .send('document.awareness.update', {
          documentId: data.documentId,
          userId: data.userId,
          awareness: data.awareness,
        })
        .toPromise();
      
      // Broadcast awareness update to all other clients
      this.broadcastToDocument(data.documentId, {
        event: 'awareness:update',
        data: {
          documentId: data.documentId,
          userId: data.userId,
          awareness: data.awareness,
        },
      }, client);
      
    } catch (error) {
      this.logger.error('Error updating awareness:', error);
      client.send(JSON.stringify({
        event: 'error',
        data: { message: 'Failed to update awareness' },
      }));
    }
  }

  @SubscribeMessage('document:get')
  async handleGetDocument(
    @MessageBody() data: { documentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Getting document ${data.documentId}`);
      
      const result = await this.documentEditorService
        .send('document.get', { documentId: data.documentId })
        .toPromise();
      
      client.emit('document:data', result);
    } catch (error) {
      this.logger.error('Error getting document:', error);
      client.emit('error', { message: 'Failed to get document' });
    }
  }

  // Legacy update handler for non-Y.js clients
  @SubscribeMessage('document:update')
  async handleDocumentUpdate(
    @MessageBody() data: { documentId: string; userId: string; content: any; operation: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Legacy document update ${data.documentId} by user ${data.userId}`);
      
      const result = await this.documentEditorService
        .send('document.update', {
          documentId: data.documentId,
          userId: data.userId,
          content: data.content,
          operation: data.operation,
        })
        .toPromise();
      
      // Broadcast the update to all connected clients
      this.broadcastToDocument(data.documentId, {
        event: 'document:updated',
        data: result,
      }, client);

      // Send confirmation to the sender
      client.emit('document:update-confirmed', result);
    } catch (error) {
      this.logger.error('Error updating document:', error);
      client.emit('error', { message: 'Failed to update document' });
    }
  }

  @SubscribeMessage('collaboration-event')
  async handleCollaborationEvent(
    @MessageBody() message: { type: string; documentId: string; userId: string; data?: any; timestamp?: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Collaboration event: ${message.type} for document ${message.documentId} from user ${message.userId}`);
      
      switch (message.type) {
        case 'content-update':
          // Handle content update
          if (message.data?.content) {
            await this.handleDocumentUpdate(
              {
                documentId: message.documentId,
                userId: message.userId,
                content: message.data.content,
                operation: 'content-update'
              },
              client
            );
          }
          break;
          
        case 'cursor-update':
          // Handle cursor update - publish to Redis for proper distribution
          await this.handleCursorUpdate(
            {
              documentId: message.documentId,
              userId: message.userId,
              cursor: message.data?.cursor || message.data,
            },
            client
          );
          break;
          
        case 'awareness-update':
          // Handle awareness update
          await this.handleAwarenessUpdate(
            {
              documentId: message.documentId,
              userId: message.userId,
              awareness: message.data?.user || message.data,
            },
            client
          );
          break;
          
        case 'user-list-request':
          // Handle request for current user list
          await this.handleUserListRequest(message.documentId, client);
          break;
          
        default:
          this.logger.warn(`Unknown collaboration event type: ${message.type}`);
      }
      
    } catch (error) {
      this.logger.error('Error handling collaboration event:', error);
      client.emit('error', { message: 'Failed to process collaboration event' });
    }
  }

  /**
   * Handle request for current document collaborators
   */
  async handleUserListRequest(documentId: string, client: Socket) {
    try {
      this.logger.log(`User list request for document ${documentId}`);
      
      // Get current collaborators from the document service
      const result = await this.documentEditorService
        .send('document.collaborators', { documentId })
        .toPromise();
      
      // Send the user list to the requesting client
      client.emit('collaboration-event', {
        event: 'user-update',
        type: 'user-update',
        data: { users: result.collaborators || [] },
      });
      
    } catch (error) {
      this.logger.error('Error getting user list:', error);
      client.emit('error', { message: 'Failed to get user list' });
    }
  }

  async handleCursorUpdate(data: { documentId: string; userId: string; cursor: any }, client: Socket) {
    try {
      // Send cursor update to document service to publish to Redis
      await this.documentEditorService
        .send('document.cursor.update', {
          documentId: data.documentId,
          userId: data.userId,
          cursor: data.cursor,
        })
        .toPromise();
      
    } catch (error) {
      this.logger.error('Error handling cursor update:', error);
      // Fallback to direct broadcast if document service fails
      this.broadcastToDocument(data.documentId, {
        event: 'cursor-update',
        type: 'cursor-update',
        userId: data.userId,
        data: { cursor: data.cursor },
      }, client);
    }
  }
}