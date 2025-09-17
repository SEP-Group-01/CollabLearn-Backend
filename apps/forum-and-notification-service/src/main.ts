import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ForumAndNotificationServiceModule } from './forum-and-notification-service.module';

async function bootstrap() {
  const app = await NestFactory.create(ForumAndNotificationServiceModule);

  // Enable CORS
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:5173'], // Add your frontend URLs
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

  const port = process.env.PORT ?? 3003;
  await app.listen(port);
  console.log(`Forum and Notification Service is running on port ${port}`);
}
bootstrap().catch((error) => {
  console.error('Failed to start the application:', error);
  process.exit(1);
});
