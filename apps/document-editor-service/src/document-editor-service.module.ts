import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DocumentEditorServiceController } from './controllers/document-editor-service.controller';
import { DocumentEditorServiceService } from './services/document-editor-service.service';
import { DocumentManagementService } from './services/document-management.service';
import { DocumentExportService } from './services/document-export.service';
import { MediaService } from './services/media.service';
import { RedisService } from './services/redis.service';
import { DatabaseService } from './services/database.service';
import { FirebaseStorageService } from './services/firebase-storage.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [DocumentEditorServiceController],
  providers: [
    DocumentEditorServiceService,
    DocumentManagementService,
    DocumentExportService,
    MediaService,
    RedisService,
    DatabaseService,
    FirebaseStorageService,
  ],
})
export class DocumentEditorServiceModule {}
