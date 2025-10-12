import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as Y from 'yjs';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redis: Redis;
  private subscriber: Redis;
  private publisher: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisConfig = {
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB', 0),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };

    try {
      // Main Redis client for general operations
      this.redis = new Redis(redisConfig);
      
      // Dedicated publisher for pub/sub
      this.publisher = new Redis(redisConfig);
      
      // Dedicated subscriber for pub/sub
      this.subscriber = new Redis(redisConfig);

      await Promise.all([
        this.redis.connect(),
        this.publisher.connect(),
        this.subscriber.connect(),
      ]);

      this.logger.log('✅ Redis connections established');
    } catch (error) {
      this.logger.error('❌ Failed to connect to Redis:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await Promise.all([
      this.redis?.disconnect(),
      this.publisher?.disconnect(),
      this.subscriber?.disconnect(),
    ]);
    this.logger.log('Redis connections closed');
  }

  // Document State Management
  async saveYjsDocument(documentId: string, ydoc: Y.Doc): Promise<void> {
    const key = `document:${documentId}:state`;
    const state = Y.encodeStateAsUpdate(ydoc);
    const base64State = Buffer.from(state).toString('base64');
    
    await this.redis.setex(key, 3600, base64State); // 1 hour TTL
    this.logger.debug(`Saved document state: ${documentId}`);
  }

  async loadYjsDocument(documentId: string): Promise<Y.Doc | null> {
    const key = `document:${documentId}:state`;
    const base64State = await this.redis.get(key);
    
    if (!base64State) {
      return null;
    }

    try {
      const state = Buffer.from(base64State, 'base64');
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, state);
      
      this.logger.debug(`Loaded document state: ${documentId}`);
      return ydoc;
    } catch (error) {
      this.logger.error(`Failed to load document ${documentId}:`, error);
      return null;
    }
  }

  // User Presence/Awareness Management
  async setUserAwareness(documentId: string, userId: string, awareness: any): Promise<void> {
    const key = `document:${documentId}:awareness:${userId}`;
    const data = JSON.stringify({
      ...awareness,
      timestamp: Date.now(),
    });
    
    await this.redis.setex(key, 30, data); // 30 second TTL for presence
  }

  async getUserAwareness(documentId: string): Promise<Record<string, any>> {
    const pattern = `document:${documentId}:awareness:*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length === 0) {
      return {};
    }

    const values = await this.redis.mget(...keys);
    const awareness: Record<string, any> = {};
    
    keys.forEach((key, index) => {
      const userId = key.split(':').pop()!;
      const data = values[index];
      
      if (data) {
        try {
          awareness[userId] = JSON.parse(data);
        } catch (error) {
          this.logger.warn(`Invalid awareness data for ${userId}:`, error);
        }
      }
    });

    return awareness;
  }

  async removeUserAwareness(documentId: string, userId: string): Promise<void> {
    const key = `document:${documentId}:awareness:${userId}`;
    await this.redis.del(key);
  }

  // Collaborator Management
  async addCollaborator(documentId: string, userId: string): Promise<void> {
    const key = `document:${documentId}:collaborators`;
    await this.redis.sadd(key, userId);
    await this.redis.expire(key, 3600); // 1 hour TTL
  }

  async removeCollaborator(documentId: string, userId: string): Promise<void> {
    const key = `document:${documentId}:collaborators`;
    await this.redis.srem(key, userId);
    
    // Also remove user info
    const userInfoKey = `document:${documentId}:user:${userId}`;
    await this.redis.del(userInfoKey);
  }

  async getCollaborators(documentId: string): Promise<string[]> {
    const key = `document:${documentId}:collaborators`;
    return await this.redis.smembers(key);
  }

  // User Information Management
  async setUserInfo(documentId: string, userId: string, userInfo: any): Promise<void> {
    const key = `document:${documentId}:user:${userId}`;
    await this.redis.setex(key, 3600, JSON.stringify(userInfo)); // 1 hour TTL
  }

  async getUserInfo(documentId: string, userId: string): Promise<any | null> {
    const key = `document:${documentId}:user:${userId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async getAllUserInfo(documentId: string): Promise<Record<string, any>> {
    const collaborators = await this.getCollaborators(documentId);
    const userInfos: Record<string, any> = {};
    
    for (const userId of collaborators) {
      const userInfo = await this.getUserInfo(documentId, userId);
      if (userInfo) {
        userInfos[userId] = userInfo;
      }
    }
    
    return userInfos;
  }

  // Real-time Event Publishing
  async publishDocumentEvent(documentId: string, event: any): Promise<void> {
    const channel = `document:${documentId}:events`;
    const message = JSON.stringify({
      ...event,
      timestamp: Date.now(),
    });
    
    await this.publisher.publish(channel, message);
    this.logger.debug(`Published event to ${channel}:`, event.type);
  }

  async subscribeToDocumentEvents(
    documentId: string,
    callback: (event: any) => void
  ): Promise<void> {
    const channel = `document:${documentId}:events`;
    
    await this.subscriber.subscribe(channel);
    
    this.subscriber.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        try {
          const event = JSON.parse(message);
          callback(event);
        } catch (error) {
          this.logger.error('Failed to parse event message:', error);
        }
      }
    });
  }

  async unsubscribeFromDocumentEvents(documentId: string): Promise<void> {
    const channel = `document:${documentId}:events`;
    await this.subscriber.unsubscribe(channel);
  }

  // WebSocket Session Management
  async setUserSession(userId: string, sessionData: any): Promise<void> {
    const key = `session:${userId}`;
    await this.redis.setex(key, 86400, JSON.stringify(sessionData)); // 24 hours
  }

  async getUserSession(userId: string): Promise<any | null> {
    const key = `session:${userId}`;
    const data = await this.redis.get(key);
    
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      this.logger.error(`Invalid session data for ${userId}:`, error);
      return null;
    }
  }

  async removeUserSession(userId: string): Promise<void> {
    const key = `session:${userId}`;
    await this.redis.del(key);
  }

  // Document Metadata Caching
  async cacheDocumentMetadata(documentId: string, metadata: any): Promise<void> {
    const key = `document:${documentId}:metadata`;
    await this.redis.setex(key, 3600, JSON.stringify(metadata));
  }

  async getDocumentMetadata(documentId: string): Promise<any | null> {
    const key = `document:${documentId}:metadata`;
    const data = await this.redis.get(key);
    
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      this.logger.error(`Invalid metadata for ${documentId}:`, error);
      return null;
    }
  }

  // Lock Management for Document Operations
  async acquireDocumentLock(documentId: string, userId: string, ttl = 10): Promise<boolean> {
    const key = `document:${documentId}:lock`;
    const result = await this.redis.set(key, userId, 'EX', ttl, 'NX');
    return result === 'OK';
  }

  async releaseDocumentLock(documentId: string, userId: string): Promise<boolean> {
    const key = `document:${documentId}:lock`;
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    const result = await this.redis.eval(script, 1, key, userId);
    return result === 1;
  }

  // Health Check
  async ping(): Promise<string> {
    return await this.redis.ping();
  }

  // Generic Redis operations
  getRedisClient(): Redis {
    return this.redis;
  }

  getPublisher(): Redis {
    return this.publisher;
  }

  getSubscriber(): Redis {
    return this.subscriber;
  }
}