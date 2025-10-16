import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { ForumAndNotificationServiceModule } from './forum-and-notification-service.module';

const logger = new Logger('ForumAndNotificationService');

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

  // --- TCP Microservice for API Gateway communication ---
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
  const port = parseInt(configService.get('FORUM_SERVICE_PORT') || '3004');
  await app.listen(port);

  logger.log('✅ Forum and Notification Service is running');
  logger.log(`🌐 HTTP/WebSocket listening on port ${port}`);

  if (enableTcp) {
    logger.log(
      `🔌 TCP microservice listening on port ${parseInt(configService.get('FORUM_TCP_PORT') || '3004')}`,
    );
  }

  logger.log('📩 Notifications will be handled within the forum service');
}
bootstrap().catch((error) => {
  console.error('Failed to start the application:', error);
  process.exit(1);
});
