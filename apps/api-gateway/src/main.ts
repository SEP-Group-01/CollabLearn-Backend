import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

const logger = new Logger('API-Gateway');

class CustomSocketIOAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });
    
    logger.log('🔌 Socket.IO server created with enhanced configuration');
    return server;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Enable CORS for frontend
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://collab-learn-frontend-lw2za9epr-ramalthejitha20-4961s-projects.vercel.app',
      /^https:\/\/.*\.vercel\.app$/, // Allow all Vercel preview deployments
      configService.get('FRONTEND_URL'),
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'Access-Control-Allow-Headers',
      'Origin',
    ],
    exposedHeaders: ['*'],
    preflightContinue: false,
    optionsSuccessStatus: 200,
  });

  // --- 1️⃣ TCP for NestJS microservices ---ok
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: { host: '0.0.0.0', port: 3001 }, // Use a different port from HTTP
  });

  // --- 2️⃣ Kafka for reply handling ---
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'api-gateway-microservice',
        brokers: [configService.get('KAFKA_BROKERS') || 'localhost:9092'],
      },
      consumer: {
        groupId: 'gateway-reply-consumer',
      },
    },
  });

  // Set global prefix for all REST endpoints except health
  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });

  // WebSocket Adapter - Using custom Socket.IO adapter for better namespace support
  app.useWebSocketAdapter(new CustomSocketIOAdapter(app));

  // Start all microservices (TCP + Kafka)
  await app.startAllMicroservices();

  // Start HTTP server (REST endpoints for frontend)
  await app.listen(3000);

  logger.log('✅ API Gateway is running');
  logger.log('🌐 HTTP listening on port 3000');
  logger.log('🔌 TCP microservice listening on port 3001');
  logger.log('📩 Kafka microservice configured for reply handling');
  logger.log('📩 Kafka client configured via ClientsModule');
  logger.log('🔗 WebSocket adapter configured for document, forum, and quiz collaboration');
  logger.log('🚀 Socket.IO namespaces: /collaboration, /forum, /quiz');
}
void bootstrap();
