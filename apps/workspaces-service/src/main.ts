import { NestFactory } from '@nestjs/core';
import { WorkspacesServiceModule } from './workspaces-service.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkspacesServiceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
