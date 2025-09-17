import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

const logger = new Logger('API-Gateway');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Enable CORS for frontend
  app.enableCors({
    origin: configService.get('FRONTEND_URL'),
    credentials: true,
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
        brokers: [configService.get('KAFKA_BROKERS') || 'kafka:9092'], // Replace with localhost:9093 for local dev
      },
      consumer: {
        groupId: 'gateway-reply-consumer',
      },
    },
  });

  // Start all microservices (TCP + Kafka)
  await app.startAllMicroservices();

  // Start HTTP server (REST endpoints for frontend)
  await app.listen(3000);

  logger.log('✅ API Gateway is running');
  logger.log('🌐 HTTP listening on port 3000');
  logger.log('🔌 TCP microservice listening on port 3001');
  logger.log('📩 Kafka microservice configured for reply handling');
  logger.log('📩 Kafka client configured via ClientsModule');
}
bootstrap();

// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app/app.module';
// import { MicroserviceOptions, Transport} from '@nestjs/microservices';
// import { ConfigService } from '@nestjs/config';
// import { Logger } from '@nestjs/common';

// const logger = new Logger('API-Gateway');

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   const configService = app.get(ConfigService);

//   app.enableCors({
//   origin: configService.get('FRONTEND_URL'),
//   credentials: true,
//   });

//   app.connectMicroservice<MicroserviceOptions>({
//     transport: Transport.TCP,
//     options: { host: '0.0.0.0', port: 3000 }
//   });
//   await app.startAllMicroservices();
//   await app.listen(3000);
//   logger.log('API Gateway is running');
//   logger.log('API Gateway is listening on port 3000');
// }
// bootstrap();
