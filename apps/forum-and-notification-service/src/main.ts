import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { ForumAndNotificationServiceModule } from './forum-and-notification-service.module';

const logger = new Logger('ForumService');

async function bootstrap() {
  const app = await NestFactory.create(ForumAndNotificationServiceModule);
  const configService = app.get(ConfigService);

  // Enable CORS for WebSocket connections
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:5173'], // Frontend URLs
    credentials: true,
  });

  // Enable validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // --- 1️⃣ TCP Microservice for API Gateway communication (Optional) ---
  const enableTcp = configService.get('ENABLE_TCP') !== 'false';
  if (enableTcp) {
    try {
      app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.TCP,
        options: {
          host: '0.0.0.0',
          port: parseInt(configService.get('FORUM_TCP_PORT') || '3004'),
        },
      });
      logger.log('🔌 TCP microservice configured');
    } catch {
      logger.warn(
        '⚠️ TCP microservice configuration failed, continuing without TCP',
      );
    }
  }

  // --- 2️⃣ Kafka for event publishing (Optional) ---
  const enableKafka = configService.get('ENABLE_KAFKA') !== 'false';
  if (enableKafka) {
    try {
      app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'forum-service',
            brokers: [configService.get('KAFKA_BROKERS') || 'localhost:9092'],
          },
          consumer: {
            groupId: 'forum-service-consumer',
          },
        },
      });
      logger.log('📩 Kafka microservice configured');
    } catch {
      logger.warn(
        '⚠️ Kafka microservice configuration failed, continuing without Kafka',
      );
    }
  }

  // Start microservices (only if configured)
  try {
    await app.startAllMicroservices();
    logger.log('🚀 Microservices started successfully');
  } catch (error) {
    logger.warn(
      '⚠️ Some microservices failed to start, continuing with HTTP/WebSocket only',
    );
    logger.warn(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Start HTTP server (for WebSocket connections and health checks)
  const port = parseInt(configService.get('FORUM_SERVICE_PORT') || '3003');
  await app.listen(port);

  logger.log('✅ Forum and Notification Service is running');
  logger.log(`🌐 HTTP/WebSocket listening on port ${port}`);

  if (enableTcp) {
    logger.log(
      `🔌 TCP microservice listening on port ${parseInt(configService.get('FORUM_TCP_PORT') || '3004')}`,
    );
  }

  if (enableKafka) {
    logger.log('📩 Kafka microservice configured for event publishing');
  } else {
    logger.log('📩 Kafka disabled - running in standalone mode');
  }
}
bootstrap().catch((error) => {
  console.error('Failed to start the application:', error);
  process.exit(1);
});
