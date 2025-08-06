import { NestFactory } from '@nestjs/core';
import { ForumAndNotificationServiceModule } from './forum-and-notification-service.module';

async function bootstrap() {
  const app = await NestFactory.create(ForumAndNotificationServiceModule);
  await app.listen(process.env.port ?? 3003);
}
bootstrap();
