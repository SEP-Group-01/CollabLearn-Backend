import { NestFactory } from '@nestjs/core';
import { QuizServiceModule } from './quiz-service.module';

async function bootstrap() {
  const app = await NestFactory.create(QuizServiceModule);
  await app.listen(process.env.port ?? 3004);
}
bootstrap();
