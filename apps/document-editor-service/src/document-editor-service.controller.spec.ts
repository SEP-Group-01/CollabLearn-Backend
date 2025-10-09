import { Test, TestingModule } from '@nestjs/testing';
import { DocumentEditorServiceController } from './services/document-editor-service.controller';
import { DocumentEditorServiceService } from './services/document-editor-service.service';

describe('DocumentEditorServiceController', () => {
  let documentEditorServiceController: DocumentEditorServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [DocumentEditorServiceController],
      providers: [DocumentEditorServiceService],
    }).compile();

    documentEditorServiceController = app.get<DocumentEditorServiceController>(
      DocumentEditorServiceController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(documentEditorServiceController.getHello()).toBe('Hello World!');
    });
  });
});
