import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { WorkspacesServiceModule } from './workspaces-service.module';
import { Logger } from '@nestjs/common';

const logger = new Logger('WorkspacesService');

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    WorkspacesServiceModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: 3002,
      },
    },
  );

  await app.listen();
  logger.log('Workspaces Service is running');
  logger.log('Workspaces Service is listening on port 3002');
}
bootstrap();
