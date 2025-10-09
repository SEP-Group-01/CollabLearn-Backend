import { NestFactory } from '@nestjs/core';
import { DocumentEditorServiceModule } from './document-editor-service.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

const logger = new Logger('DocumentEditorService');

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    DocumentEditorServiceModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: 3006,
      },
    },
  );

  await app.listen();
  logger.log('🚀 Document Editor Service is listening on TCP port 3006');
}
bootstrap();
