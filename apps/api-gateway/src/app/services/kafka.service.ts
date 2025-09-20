import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import {
  ClientKafka,
  MessagePattern,
  Payload,
  Ctx,
  KafkaContext,
} from '@nestjs/microservices';
import { lastValueFrom, firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class KafkaService implements OnModuleInit {
  private subscribedTopics = new Set<string>();
  private pendingRequests = new Map<
    string,
    { resolve: Function; reject: Function; timestamp: number }
  >();
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds timeout

  constructor(
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {
    // Start cleanup interval for expired requests
    setInterval(() => this.cleanupExpiredRequests(), 10000); // Clean up every 10 seconds
  }

  async onModuleInit() {
    // Pre-subscribe to request topics (NestJS will automatically handle .reply topics)
    const requestTopics = [
      'document-query.chats',
      'document-query.search-documents',
      'document-query.get-document-summary',
      'document-query.documents',
    ];

    // Also subscribe to reply topics manually for our message pattern handlers
    const replyTopics = [
      'document-query.chats.reply',
      'document-query.search-documents.reply',
      'document-query.get-document-summary.reply',
      'document-query.documents.reply',
    ];

    console.log('[KafkaService] Pre-subscribing to response topics...');
    for (const topic of requestTopics) {
      console.log(`[KafkaService] Subscribing to response for topic: ${topic}`);
      this.kafkaClient.subscribeToResponseOf(topic);
      this.subscribedTopics.add(topic);
      console.log(
        `[KafkaService] Pre-subscribed to response topic for: ${topic} (expects ${topic}.reply)`,
      );
    }

    console.log(
      '[KafkaService] Manually subscribing to reply topics for message patterns...',
    );
    for (const replyTopic of replyTopics) {
      console.log(`[KafkaService] Manually subscribing to: ${replyTopic}`);
      this.kafkaClient.subscribeToResponseOf(replyTopic.replace('.reply', ''));
      this.subscribedTopics.add(replyTopic);
    }

    // Connect to Kafka
    console.log('[KafkaService] Connecting to Kafka...');
    await this.kafkaClient.connect();
    console.log('[KafkaService] Connected to Kafka successfully');

    // Debug: Check consumer configuration
    console.log('[KafkaService] DEBUG: Kafka client consumer group info:');
    console.log(
      '[KafkaService] DEBUG: Consumer exists:',
      !!this.kafkaClient.consumer,
    );

    // Add a small delay to ensure subscriptions are complete
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log('[KafkaService] DEBUG: Subscription setup complete');
  }

  /**
   * Send a message to a Kafka topic and wait for a response (EXPERIMENTAL: Event-based)
   * @param topic - The Kafka topic to send the message to
   * @param message - The message payload to send
   * @returns Promise with the response from the consumer
   */
  async sendMessage(topic: string, message: any): Promise<any> {
    try {
      // Ensure we're subscribed to the response topic
      if (!this.subscribedTopics.has(topic)) {
        console.log(
          `[KafkaService] Has not subscribed to response topic: ${topic}`,
        );
      }

      console.log(`[KafkaService] Sending message to topic: ${topic}`, message);

      // Generate our own correlation ID for event-based pattern
      const correlationId = uuidv4();
      const messageWithId = { ...message, __correlationId: correlationId };

      console.log(
        `[KafkaService] Using emit() with correlationId: ${correlationId}`,
      );

      // Create a promise that will be resolved when we receive the reply
      return new Promise((resolve, reject) => {
        // Store the promise resolvers with correlation ID
        this.pendingRequests.set(correlationId, {
          resolve,
          reject,
          timestamp: Date.now(),
        });

        // Set up timeout
        setTimeout(() => {
          if (this.pendingRequests.has(correlationId)) {
            this.pendingRequests.delete(correlationId);
            reject(
              new Error(
                `Request timeout after ${this.REQUEST_TIMEOUT}ms for correlation ID: ${correlationId}`,
              ),
            );
          }
        }, this.REQUEST_TIMEOUT);

        // Emit the message
        this.kafkaClient.emit(topic, messageWithId);
        console.log(
          `[KafkaService] Emitted message with correlation ID: ${correlationId}, waiting for reply...`,
        );
      });
    } catch (error) {
      console.error(
        `[KafkaService] Error sending message to topic: ${topic}`,
        error,
      );
      console.error(`[KafkaService] Error stack:`, error.stack);
      throw error;
    }
  }

  /**
   * Add a topic to be subscribed during initialization (restart required)
   * This method is mainly for documentation - actual subscription happens in onModuleInit
   * @param topic - The topic to subscribe to responses for
   */
  addTopicForSubscription(topic: string): void {
    console.log(
      `[KafkaService] Topic ${topic} will be subscribed on next service restart`,
    );
    // This is mainly for tracking - actual subscription requires service restart
  }

  /**
   * Get a list of topics that should be subscribed (for configuration reference)
   * @param topics - Array of topics that should be added to onModuleInit
   */
  getRecommendedTopics(topics: string[]): string[] {
    console.log(
      `[KafkaService] Recommended topics for onModuleInit: ${topics.join(', ')}`,
    );
    return topics;
  }

  /**
   * Send a fire-and-forget message (no response expected)
   * @param topic - The Kafka topic to send the message to
   * @param message - The message payload to send
   */
  async emit(topic: string, message: any): Promise<void> {
    try {
      console.log(
        `[KafkaService] Emitting message to topic: ${topic}`,
        message,
      );
      this.kafkaClient.emit(topic, message);
    } catch (error) {
      console.error(
        `[KafkaService] Error emitting message to topic: ${topic}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get the list of subscribed topics
   * @returns Array of subscribed topic names
   */
  getSubscribedTopics(): string[] {
    return Array.from(this.subscribedTopics);
  }

  /**
   * Get the Kafka client instance for direct access if needed
   * @returns ClientKafka instance
   */
  getKafkaClient(): ClientKafka {
    return this.kafkaClient;
  }

  /**
   * Generic reply handler for all reply topics (public method for controller use)
   */
  public handleReply(topic: string, message: any, context: KafkaContext) {
    console.log(`[KafkaService] Received reply from topic: ${topic}`, message);

    // Extract correlation ID from message key or headers
    const kafkaMessage = context.getMessage();
    let correlationId: string | null = null;

    // Try to get correlation ID from message key first
    if (kafkaMessage.key) {
      correlationId = kafkaMessage.key.toString();
      console.log(
        `[KafkaService] Found correlation ID in message key: ${correlationId}`,
      );
    }

    // If not in key, try headers
    if (!correlationId && kafkaMessage.headers) {
      const headers = kafkaMessage.headers;
      if (headers['kafka_correlationId']) {
        correlationId = headers['kafka_correlationId'].toString();
        console.log(
          `[KafkaService] Found correlation ID in headers: ${correlationId}`,
        );
      }
    }

    // If still not found, try payload
    if (
      !correlationId &&
      message &&
      typeof message === 'object' &&
      message.__correlationId
    ) {
      correlationId = message.__correlationId;
      console.log(
        `[KafkaService] Found correlation ID in payload: ${correlationId}`,
      );
    }

    if (!correlationId) {
      console.error(
        `[KafkaService] No correlation ID found in reply from topic: ${topic}`,
      );
      return;
    }

    // Check if we have a pending request for this correlation ID
    const pendingRequest = this.pendingRequests.get(correlationId);
    if (pendingRequest) {
      console.log(
        `[KafkaService] Resolving pending request for correlation ID: ${correlationId}`,
      );
      this.pendingRequests.delete(correlationId);
      pendingRequest.resolve(message);
    } else {
      console.warn(
        `[KafkaService] No pending request found for correlation ID: ${correlationId}`,
      );
    }
  }

  /**
   * Clean up expired pending requests to prevent memory leaks
   */
  private cleanupExpiredRequests() {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [correlationId, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.REQUEST_TIMEOUT) {
        expiredIds.push(correlationId);
        request.reject(
          new Error(`Request expired for correlation ID: ${correlationId}`),
        );
      }
    }

    for (const id of expiredIds) {
      this.pendingRequests.delete(id);
    }

    if (expiredIds.length > 0) {
      console.log(
        `[KafkaService] Cleaned up ${expiredIds.length} expired requests`,
      );
    }
  }
}
