import { Controller, Get } from '@nestjs/common';
import { DocumentEditorServiceService } from './document-editor-service.service';

@Controller()
export class DocumentEditorServiceController {
  constructor(
    private readonly documentEditorServiceService: DocumentEditorServiceService,
  ) {}

  @Get()
  getHello(): string {
    return this.documentEditorServiceService.getHello();
  }
}
