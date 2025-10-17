import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { QuizServiceModule } from './quiz-service.module';
import { Logger } from '@nestjs/common';

const logger = new Logger('QuizService');

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    QuizServiceModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: 3009,
      },
    },
  );

  await app.listen();
  logger.log('🚀 Quiz Service is listening on port 3009');
}

void bootstrap();
