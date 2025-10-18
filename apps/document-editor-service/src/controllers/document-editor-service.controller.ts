import { Controller, Get } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DocumentEditorServiceService } from '../services/document-editor-service.service';

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
  async getDocument(@Payload() data: { documentId: string; userId?: string }) {
    return this.documentEditorServiceService.getDocument(data.documentId, data.userId);
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

  @MessagePattern('document.cursor.update')
  async updateCursor(
    @Payload() data: { documentId: string; userId: string; cursor: any },
  ) {
    return this.documentEditorServiceService.updateCursor(data);
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
  async joinDocument(@Payload() data: { documentId: string; userId: string; userInfo?: any }) {
    return this.documentEditorServiceService.joinDocument(
      data.documentId,
      data.userId,
      data.userInfo,
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

  // Version Control
  @MessagePattern('document.version.save')
  async saveDocumentVersion(
    @Payload() data: { documentId: string; userId: string; label?: string },
  ) {
    return this.documentEditorServiceService.saveDocumentVersion(data);
  }

  @MessagePattern('document.version.history')
  async getDocumentVersionHistory(@Payload() data: { documentId: string }) {
    return this.documentEditorServiceService.getDocumentVersionHistory(data.documentId);
  }

  @MessagePattern('document.version.restore')
  async restoreDocumentVersion(
    @Payload() data: { documentId: string; versionId: string; userId: string },
  ) {
    return this.documentEditorServiceService.restoreDocumentVersion(data);
  }

  // Permissions
  @MessagePattern('document.permission.set')
  async setDocumentPermission(
    @Payload() data: {
      documentId: string;
      userId: string;
      permission: 'read' | 'write' | 'admin';
      grantedBy: string;
    },
  ) {
    return this.documentEditorServiceService.setDocumentPermission(data);
  }

  @MessagePattern('document.permission.get')
  async getDocumentPermissions(@Payload() data: { documentId: string }) {
    return this.documentEditorServiceService.getDocumentPermissions(data.documentId);
  }

  @MessagePattern('document.permission.check')
  async checkDocumentPermission(
    @Payload() data: {
      documentId: string;
      userId: string;
      permission: 'read' | 'write' | 'admin';
    },
  ) {
    return this.documentEditorServiceService.checkDocumentPermission(data);
  }

  // Export
  @MessagePattern('document.export')
  async exportDocument(
    @Payload() data: {
      documentId: string;
      format: 'pdf' | 'docx' | 'html';
      includeMetadata?: boolean;
      includeVersionHistory?: boolean;
    },
  ) {
    return this.documentEditorServiceService.exportDocument(data);
  }

  @MessagePattern('document.backup')
  async createDocumentBackup(@Payload() data: { documentId: string }) {
    return this.documentEditorServiceService.createDocumentBackup(data.documentId);
  }

  // Media
  @MessagePattern('document.media.upload')
  async uploadMedia(
    @Payload() data: {
      file: Express.Multer.File;
      documentId: string;
      userId: string;
      workspaceId?: string;
      threadId?: string;
      imagePosition?: number;
    },
  ) {
    return this.documentEditorServiceService.uploadMedia(data);
  }

  @MessagePattern('document.media.list')
  async getDocumentMedia(@Payload() data: { documentId: string }) {
    return this.documentEditorServiceService.getDocumentMedia(data.documentId);
  }

  @MessagePattern('document.media.delete')
  async deleteMedia(@Payload() data: { fileId: string; userId: string }) {
    return this.documentEditorServiceService.deleteMedia(data);
  }

  @MessagePattern('document.getByThread')
  async getDocumentsByThread(@Payload() data: { threadId: string; userId: string }) {
    return this.documentEditorServiceService.getDocumentsByThread(data.threadId, data.userId);
  }

  // Document Access Requests
  @MessagePattern('document.access.request')
  async requestDocumentAccess(
    @Payload() data: {
      documentId: string;
      userId: string;
      requestedPermission: 'read' | 'write';
      message?: string;
    },
  ) {
    return this.documentEditorServiceService.requestDocumentAccess(data);
  }

  @MessagePattern('document.access.requests.pending')
  async getPendingAccessRequests(@Payload() data: { threadId: string; userId: string }) {
    return this.documentEditorServiceService.getPendingAccessRequests(data.threadId, data.userId);
  }

  @MessagePattern('document.access.request.approve')
  async approveAccessRequest(
    @Payload() data: { requestId: string; userId: string },
  ) {
    return this.documentEditorServiceService.approveAccessRequest(data.requestId, data.userId);
  }

  @MessagePattern('document.access.request.reject')
  async rejectAccessRequest(
    @Payload() data: { requestId: string; userId: string; rejectionReason?: string },
  ) {
    return this.documentEditorServiceService.rejectAccessRequest(data);
  }
}
