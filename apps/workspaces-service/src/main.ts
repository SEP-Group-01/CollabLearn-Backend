import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { WorkspacesServiceModule } from './workspaces-service.module';
import { Logger } from '@nestjs/common';

const logger = new Logger('WorkspacesService');

async function bootstrap() {
  // Create HTTP application for REST API endpoints
  const httpApp = await NestFactory.create(WorkspacesServiceModule);

  // Enable CORS for frontend access
  httpApp.enableCors();

  // Start HTTP server on port 3003
  await httpApp.listen(3003);
  logger.log('Workspaces Service HTTP server is running on port 3003');

  // Also create microservice for message patterns (if needed by API Gateway)
  const microservice =
    await NestFactory.createMicroservice<MicroserviceOptions>(
      WorkspacesServiceModule,
      {
        transport: Transport.TCP,
        options: {
          host: '0.0.0.0',
          port: 3003, // Same port for microservice
        },
      },
    );

  await microservice.listen();
  logger.log('Workspaces Microservice is running on port 3003');
}

void bootstrap();
