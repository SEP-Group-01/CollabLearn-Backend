import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { lastValueFrom, firstValueFrom } from 'rxjs';

@Injectable()
export class KafkaService implements OnModuleInit {
  private subscribedTopics = new Set<string>();

  constructor(
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // Pre-subscribe to common topics that we know we'll use
    const commonTopics = [
      'document-query.get-chats',
      'document-query.search-documents',
      'document-query.get-document-summary',
    ];

    console.log('[KafkaService] Pre-subscribing to response topics...');
    for (const topic of commonTopics) {
      this.kafkaClient.subscribeToResponseOf(topic);
      this.subscribedTopics.add(topic);
      console.log(
        `[KafkaService] Pre-subscribed to response topic for: ${topic} (expects ${topic}.reply)`,
      );
    }

    // Connect to Kafka
    console.log('[KafkaService] Connecting to Kafka...');
    await this.kafkaClient.connect();
    console.log('[KafkaService] Connected to Kafka successfully');
  }

  /**
   * Send a message to a Kafka topic and wait for a response
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

      // Generate a unique correlation ID and include it in the message
      const correlationId = `${topic}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const messageWithId = { ...message, __correlationId: correlationId };

      console.log(
        `[KafkaService] Sending message to topic: ${topic} with correlationId: ${correlationId}`,
        messageWithId,
      );

      // Add timeout to prevent hanging indefinitely
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('Kafka request timeout after 10 seconds')),
          10000,
        );
      });

      // NestJS Kafka client - we'll use the correlationId in the payload as backup
      const responsePromise = lastValueFrom(
        this.kafkaClient.send(topic, messageWithId),
      );

      const response = await Promise.race([responsePromise, timeoutPromise]);

      console.log(
        `[KafkaService] Received response from topic: ${topic} with correlationId: ${correlationId}`,
        response,
      );
      return response;
    } catch (error) {
      console.error(
        `[KafkaService] Error sending message to topic: ${topic}`,
        error,
      );
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
}
