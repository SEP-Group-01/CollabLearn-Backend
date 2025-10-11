import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { DocumentEditorGateway } from '../gateways/document-editor.gateway';

@Injectable()
export class RedisBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisBridgeService.name);
  private redisSubscriber: Redis;
  private gateway: DocumentEditorGateway;

  constructor() {
    // Initialize Redis subscriber
    this.redisSubscriber = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 10000,
    });
  }

  async onModuleInit() {
    try {
      await this.redisSubscriber.connect();
      this.logger.log('Connected to Redis for document event bridging');

      // Subscribe to document events
      await this.redisSubscriber.psubscribe('document:*');

      // Handle Redis messages
      this.redisSubscriber.on('pmessage', (pattern, channel, message) => {
        this.handleRedisMessage(pattern, channel, message);
      });

      this.redisSubscriber.on('error', (error) => {
        this.logger.error('Redis subscriber error:', error);
      });

      this.redisSubscriber.on('close', () => {
        this.logger.warn('Redis subscriber connection closed');
      });

    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
    }
  }

  async onModuleDestroy() {
    if (this.redisSubscriber) {
      await this.redisSubscriber.disconnect();
      this.logger.log('Disconnected from Redis');
    }
  }

  setGateway(gateway: DocumentEditorGateway) {
    this.gateway = gateway;
  }

  private handleRedisMessage(pattern: string, channel: string, message: string) {
    try {
      this.logger.log(`Received Redis message on channel: ${channel}`);
      
      const eventData = JSON.parse(message);
      const documentId = this.extractDocumentIdFromChannel(channel);

      if (!documentId || !this.gateway) {
        this.logger.warn(`Invalid document ID or gateway not set for channel: ${channel}`);
        return;
      }

      // Forward the event to WebSocket clients based on event type
      switch (eventData.type) {
        case 'user-join':
          this.gateway.broadcastToDocument(documentId, {
            event: 'collaborator:joined',
            data: { 
              userId: eventData.data.userId, 
              documentId: documentId,
              ...eventData.data 
            },
          });
          break;

        case 'user-leave':
          this.gateway.broadcastToDocument(documentId, {
            event: 'collaborator:left',
            data: { 
              userId: eventData.data.userId, 
              documentId: documentId,
              ...eventData.data 
            },
          });
          break;

        case 'awareness-update':
          this.gateway.broadcastToDocument(documentId, {
            event: 'awareness:update',
            data: {
              documentId: documentId,
              userId: eventData.data.userId,
              awareness: eventData.data.awareness,
            },
          });
          break;

        case 'document-change':
          this.gateway.broadcastToDocument(documentId, {
            event: 'document:changed',
            data: {
              documentId: documentId,
              userId: eventData.data.userId,
              changeData: eventData.data.changeData,
              timestamp: eventData.data.timestamp,
            },
          });
          break;

        case 'yjs-update':
          this.gateway.broadcastToDocument(documentId, {
            event: 'yjs:update',
            data: {
              documentId: documentId,
              userId: eventData.data.userId,
              update: eventData.data.update,
            },
          });
          break;

        case 'version-saved':
          this.gateway.broadcastToDocument(documentId, {
            event: 'version:saved',
            data: {
              documentId: documentId,
              versionId: eventData.data.versionId,
              userId: eventData.data.userId,
              label: eventData.data.label,
            },
          });
          break;

        case 'permission-changed':
          this.gateway.broadcastToDocument(documentId, {
            event: 'permission:changed',
            data: {
              documentId: documentId,
              userId: eventData.data.userId,
              targetUserId: eventData.data.targetUserId,
              permission: eventData.data.permission,
            },
          });
          break;

        default:
          this.logger.warn(`Unknown event type received: ${eventData.type}`);
      }

    } catch (error) {
      this.logger.error('Error handling Redis message:', error);
    }
  }

  private extractDocumentIdFromChannel(channel: string): string | null {
    // Channel format: document:{documentId}
    const match = channel.match(/^document:(.+)$/);
    return match ? match[1] : null;
  }

  /**
   * Publish a real-time event to Redis for distribution
   */
  async publishDocumentEvent(documentId: string, event: {
    type: string;
    data: any;
  }) {
    try {
      const channel = `document:${documentId}`;
      const message = JSON.stringify({
        type: event.type,
        data: event.data,
        timestamp: new Date().toISOString(),
      });

      await this.redisSubscriber.publish(channel, message);
      this.logger.log(`Published event ${event.type} to channel: ${channel}`);
    } catch (error) {
      this.logger.error('Error publishing Redis event:', error);
    }
  }
}