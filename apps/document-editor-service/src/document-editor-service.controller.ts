import { Controller, Get } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
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

  @MessagePattern('document.get')
  async getDocument(@Payload() data: { documentId: string }) {
    return this.documentEditorServiceService.getDocument(data.documentId);
  }

  @MessagePattern('document.create')
  async createDocument(@Payload() data: any) {
    return this.documentEditorServiceService.createDocument(data);
  }

  @MessagePattern('document.yjs.update')
  async applyYjsUpdate(
    @Payload() data: { documentId: string; userId: string; update: Uint8Array },
  ) {
    return this.documentEditorServiceService.applyYjsUpdate(data);
  }

  @MessagePattern('document.yjs.stateVector')
  async getYjsStateVector(@Payload() data: { documentId: string }) {
    return this.documentEditorServiceService.getYjsStateVector(data.documentId);
  }

  @MessagePattern('document.yjs.updateSince')
  async getYjsUpdateSince(
    @Payload() data: { documentId: string; stateVector: Uint8Array },
  ) {
    return this.documentEditorServiceService.getYjsUpdateSince(
      data.documentId,
      data.stateVector,
    );
  }

  @MessagePattern('document.awareness.update')
  async updateAwareness(
    @Payload() data: { documentId: string; userId: string; awareness: any },
  ) {
    return this.documentEditorServiceService.updateAwareness(data);
  }

  @MessagePattern('document.update')
  async updateDocument(
    @Payload()
    data: {
      documentId: string;
      userId: string;
      content: any;
      operation: string;
    },
  ) {
    return this.documentEditorServiceService.updateDocument(data);
  }

  @MessagePattern('document.delete')
  async deleteDocument(@Payload() data: { documentId: string }) {
    return this.documentEditorServiceService.deleteDocument(data.documentId);
  }

  @MessagePattern('document.join')
  async joinDocument(@Payload() data: { documentId: string; userId: string }) {
    return this.documentEditorServiceService.joinDocument(
      data.documentId,
      data.userId,
    );
  }

  @MessagePattern('document.leave')
  async leaveDocument(@Payload() data: { documentId: string; userId: string }) {
    return this.documentEditorServiceService.leaveDocument(
      data.documentId,
      data.userId,
    );
  }

  @MessagePattern('document.collaborators')
  async getCollaborators(@Payload() data: { documentId: string }) {
    return this.documentEditorServiceService.getCollaborators(data.documentId);
  }

  @MessagePattern('document.share')
  async shareDocument(
    @Payload() data: { documentId: string; [key: string]: any },
  ) {
    return this.documentEditorServiceService.shareDocument(data);
  }
}
