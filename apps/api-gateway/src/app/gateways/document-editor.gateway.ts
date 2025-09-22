import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class DocumentEditorGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DocumentEditorGateway.name);
  private documentClients = new Map<string, Set<WebSocket>>();

  constructor(
    @Inject('DOCUMENT_EDITOR_SERVICE')
    private readonly documentEditorService: ClientProxy,
  ) {}

  handleConnection(client: WebSocket) {
    this.logger.log(`Client connected`);
  }

  handleDisconnect(client: WebSocket) {
    this.logger.log(`Client disconnected`);
    // Clean up client from all document rooms
    this.documentClients.forEach((clients, documentId) => {
      clients.delete(client);
      if (clients.size === 0) {
        this.documentClients.delete(documentId);
      }
    });
  }

  private addClientToDocument(documentId: string, client: WebSocket) {
    if (!this.documentClients.has(documentId)) {
      this.documentClients.set(documentId, new Set());
    }
    this.documentClients.get(documentId)!.add(client);
  }

  private removeClientFromDocument(documentId: string, client: WebSocket) {
    if (this.documentClients.has(documentId)) {
      this.documentClients.get(documentId)!.delete(client);
      if (this.documentClients.get(documentId)!.size === 0) {
        this.documentClients.delete(documentId);
      }
    }
  }

  private broadcastToDocument(documentId: string, message: any, excludeClient?: WebSocket) {
    const clients = this.documentClients.get(documentId);
    if (clients) {
      const messageStr = JSON.stringify(message);
      clients.forEach((client) => {
        if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
        }
      });
    }
  }

  @SubscribeMessage('document:join')
  async handleJoinDocument(
    @MessageBody() data: { documentId: string; userId: string },
    @ConnectedSocket() client: WebSocket,
  ) {
    try {
      this.logger.log(`User ${data.userId} joining document ${data.documentId}`);
      
      // Add client to document room
      this.addClientToDocument(data.documentId, client);
      
      const result = await this.documentEditorService
        .send('document.join', { documentId: data.documentId, userId: data.userId })
        .toPromise();
      
      client.send(JSON.stringify({
        event: 'document:joined',
        data: result,
      }));

      // Notify other clients
      this.broadcastToDocument(data.documentId, {
        event: 'collaborator:joined',
        data: { userId: data.userId, documentId: data.documentId },
      }, client);
      
    } catch (error) {
      this.logger.error('Error joining document:', error);
      client.send(JSON.stringify({
        event: 'error',
        data: { message: 'Failed to join document' },
      }));
    }
  }

  @SubscribeMessage('document:leave')
  async handleLeaveDocument(
    @MessageBody() data: { documentId: string; userId: string },
    @ConnectedSocket() client: WebSocket,
  ) {
    try {
      this.logger.log(`User ${data.userId} leaving document ${data.documentId}`);
      
      // Remove client from document room
      this.removeClientFromDocument(data.documentId, client);
      
      const result = await this.documentEditorService
        .send('document.leave', { documentId: data.documentId, userId: data.userId })
        .toPromise();
      
      client.send(JSON.stringify({
        event: 'document:left',
        data: result,
      }));

      // Notify other clients
      this.broadcastToDocument(data.documentId, {
        event: 'collaborator:left',
        data: { userId: data.userId, documentId: data.documentId },
      }, client);
      
    } catch (error) {
      this.logger.error('Error leaving document:', error);
      client.send(JSON.stringify({
        event: 'error',
        data: { message: 'Failed to leave document' },
      }));
    }
  }

  @SubscribeMessage('yjs:update')
  async handleYjsUpdate(
    @MessageBody() data: { documentId: string; userId: string; update: ArrayBuffer },
    @ConnectedSocket() client: WebSocket,
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
      client.send(JSON.stringify({
        event: 'yjs:update-confirmed',
        data: result,
      }));
      
    } catch (error) {
      this.logger.error('Error applying Y.js update:', error);
      client.send(JSON.stringify({
        event: 'error',
        data: { message: 'Failed to apply Y.js update' },
      }));
    }
  }

  @SubscribeMessage('yjs:sync-request')
  async handleYjsSyncRequest(
    @MessageBody() data: { documentId: string; stateVector?: number[] },
    @ConnectedSocket() client: WebSocket,
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
        
        client.send(JSON.stringify({
          event: 'yjs:sync-update',
          data: {
            documentId: data.documentId,
            update: Array.from(result.update),
          },
        }));
      } else {
        // Client has no state, get full document state
        const result = await this.documentEditorService
          .send('document.get', { documentId: data.documentId })
          .toPromise();
        
        client.send(JSON.stringify({
          event: 'yjs:sync-update',
          data: {
            documentId: data.documentId,
            update: Array.from(result.yDocState),
          },
        }));
      }
      
    } catch (error) {
      this.logger.error('Error handling Y.js sync request:', error);
      client.send(JSON.stringify({
        event: 'error',
        data: { message: 'Failed to sync document' },
      }));
    }
  }

  @SubscribeMessage('awareness:update')
  async handleAwarenessUpdate(
    @MessageBody() data: { documentId: string; userId: string; awareness: any },
    @ConnectedSocket() client: WebSocket,
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
    @ConnectedSocket() client: WebSocket,
  ) {
    try {
      this.logger.log(`Getting document ${data.documentId}`);
      
      const result = await this.documentEditorService
        .send('document.get', { documentId: data.documentId })
        .toPromise();
      
      client.send(JSON.stringify({
        event: 'document:data',
        data: result,
      }));
    } catch (error) {
      this.logger.error('Error getting document:', error);
      client.send(JSON.stringify({
        event: 'error',
        data: { message: 'Failed to get document' },
      }));
    }
  }

  // Legacy update handler for non-Y.js clients
  @SubscribeMessage('document:update')
  async handleDocumentUpdate(
    @MessageBody() data: { documentId: string; userId: string; content: any; operation: string },
    @ConnectedSocket() client: WebSocket,
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
      client.send(JSON.stringify({
        event: 'document:update-confirmed',
        data: result,
      }));
    } catch (error) {
      this.logger.error('Error updating document:', error);
      client.send(JSON.stringify({
        event: 'error',
        data: { message: 'Failed to update document' },
      }));
    }
  }
}