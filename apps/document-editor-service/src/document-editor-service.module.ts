import { Module } from '@nestjs/common';
import { DocumentEditorServiceController } from './document-editor-service.controller';
import { DocumentEditorServiceService } from './document-editor-service.service';

@Module({
  imports: [],
  controllers: [DocumentEditorServiceController],
  providers: [DocumentEditorServiceService],
})
export class DocumentEditorServiceModule {}
