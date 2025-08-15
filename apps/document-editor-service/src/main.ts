import { NestFactory } from '@nestjs/core';
import { DocumentEditorServiceModule } from './document-editor-service.module';

async function bootstrap() {
  const app = await NestFactory.create(DocumentEditorServiceModule);
  await app.listen(process.env.port ?? 3002);
}
bootstrap();
