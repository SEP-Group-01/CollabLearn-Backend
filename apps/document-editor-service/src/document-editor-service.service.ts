import { Injectable, Logger } from '@nestjs/common';
import * as Y from 'yjs';

@Injectable()
export class DocumentEditorServiceService {
  private readonly logger = new Logger(DocumentEditorServiceService.name);
  private documents = new Map<string, Y.Doc>();
  private collaborators = new Map<string, Set<string>>();
  private awareness = new Map<string, Map<string, any>>();

  getHello(): string {
    return 'Document Editor Service with Y.js is running!';
  }

  private getOrCreateDocument(documentId: string): Y.Doc {
    if (!this.documents.has(documentId)) {
      const ydoc = new Y.Doc();
      this.documents.set(documentId, ydoc);
      this.collaborators.set(documentId, new Set());
      this.awareness.set(documentId, new Map());

      // Initialize document with basic structure
      const ytext = ydoc.getText('content');
      if (ytext.length === 0) {
        ytext.insert(0, 'Welcome to the collaborative document!');
      }
    }
    return this.documents.get(documentId)!;
  }

  async getDocument(documentId: string) {
    this.logger.log(`Getting document: ${documentId}`);
    const ydoc = this.getOrCreateDocument(documentId);
    const ytext = ydoc.getText('content');

    return {
      id: documentId,
      content: ytext.toString(),
      yDocState: Y.encodeStateAsUpdate(ydoc),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async createDocument(data: any) {
    const documentId = data.documentId || `doc_${Date.now()}`;
    this.logger.log(`Creating document: ${documentId}`);

    const ydoc = this.getOrCreateDocument(documentId);

    if (data.content) {
      const ytext = ydoc.getText('content');
      ytext.delete(0, ytext.length);
      ytext.insert(0, data.content);
    }

    return {
      id: documentId,
      title: data.title || 'New Document',
      content: ydoc.getText('content').toString(),
      yDocState: Y.encodeStateAsUpdate(ydoc),
      createdBy: data.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async applyYjsUpdate(data: {
    documentId: string;
    userId: string;
    update: Uint8Array;
  }) {
    this.logger.log(
      `Applying Y.js update to document: ${data.documentId} from user: ${data.userId}`,
    );

    const ydoc = this.getOrCreateDocument(data.documentId);

    // Apply the Y.js update
    Y.applyUpdate(ydoc, data.update);

    return {
      documentId: data.documentId,
      userId: data.userId,
      content: ydoc.getText('content').toString(),
      success: true,
      timestamp: new Date(),
    };
  }

  async getYjsStateVector(documentId: string) {
    this.logger.log(`Getting Y.js state vector for document: ${documentId}`);
    const ydoc = this.getOrCreateDocument(documentId);
    return {
      documentId,
      stateVector: Y.encodeStateVector(ydoc),
    };
  }

  async getYjsUpdateSince(documentId: string, stateVector: Uint8Array) {
    this.logger.log(
      `Getting Y.js updates since state vector for document: ${documentId}`,
    );
    const ydoc = this.getOrCreateDocument(documentId);
    return {
      documentId,
      update: Y.encodeStateAsUpdate(ydoc, stateVector),
    };
  }

  async updateDocument(data: {
    documentId: string;
    userId: string;
    content: any;
    operation: string;
  }) {
    this.logger.log(
      `Legacy update for document: ${data.documentId} by user: ${data.userId}`,
    );

    const ydoc = this.getOrCreateDocument(data.documentId);
    const ytext = ydoc.getText('content');

    // For legacy compatibility - replace entire content
    if (data.operation === 'replace' && typeof data.content === 'string') {
      ytext.delete(0, ytext.length);
      ytext.insert(0, data.content);
    }

    return {
      documentId: data.documentId,
      userId: data.userId,
      content: ytext.toString(),
      operation: data.operation,
      timestamp: new Date(),
    };
  }

  async deleteDocument(documentId: string) {
    this.logger.log(`Deleting document: ${documentId}`);
    const deleted = this.documents.delete(documentId);
    this.collaborators.delete(documentId);
    this.awareness.delete(documentId);
    return { deleted, documentId };
  }

  async joinDocument(documentId: string, userId: string) {
    this.logger.log(`User ${userId} joining document: ${documentId}`);

    if (!this.collaborators.has(documentId)) {
      this.collaborators.set(documentId, new Set());
    }

    const collaboratorSet = this.collaborators.get(documentId);
    if (collaboratorSet) {
      collaboratorSet.add(userId);
    }

    const ydoc = this.getOrCreateDocument(documentId);
    const activeCollaborators = this.collaborators.get(documentId)
      ? Array.from(this.collaborators.get(documentId)!)
      : [];

    return {
      document: {
        id: documentId,
        content: ydoc.getText('content').toString(),
        yDocState: Y.encodeStateAsUpdate(ydoc),
      },
      collaborators: activeCollaborators,
      joinedUser: userId,
    };
  }

  async leaveDocument(documentId: string, userId: string) {
    this.logger.log(`User ${userId} leaving document: ${documentId}`);

    if (this.collaborators.has(documentId)) {
      const collaboratorSet = this.collaborators.get(documentId);
      if (collaboratorSet) {
        collaboratorSet.delete(userId);
      }
    }

    // Remove from awareness
    if (this.awareness.has(documentId)) {
      this.awareness.get(documentId)!.delete(userId);
    }

    const activeCollaborators = this.collaborators.has(documentId)
      ? Array.from(this.collaborators.get(documentId)!)
      : [];

    return {
      documentId,
      collaborators: activeCollaborators,
      leftUser: userId,
    };
  }

  async updateAwareness(data: {
    documentId: string;
    userId: string;
    awareness: any;
  }) {
    this.logger.log(
      `Updating awareness for user ${data.userId} in document: ${data.documentId}`,
    );

    if (!this.awareness.has(data.documentId)) {
      this.awareness.set(data.documentId, new Map());
    }

    this.awareness.get(data.documentId)!.set(data.userId, {
      ...data.awareness,
      timestamp: new Date(),
    });

    return {
      documentId: data.documentId,
      userId: data.userId,
      awareness: this.awareness.get(data.documentId)!.get(data.userId),
    };
  }

  async getCollaborators(documentId: string) {
    this.logger.log(`Getting collaborators for document: ${documentId}`);

    const activeCollaborators = this.collaborators.has(documentId)
      ? Array.from(this.collaborators.get(documentId)!)
      : [];

    const awarenessData = this.awareness.has(documentId)
      ? Object.fromEntries(this.awareness.get(documentId)!)
      : {};

    return {
      documentId,
      collaborators: activeCollaborators,
      awareness: awarenessData,
    };
  }

  async shareDocument(data: { documentId: string; [key: string]: any }) {
    this.logger.log(`Sharing document: ${data.documentId}`);

    const ydoc = this.documents.get(data.documentId);
    if (!ydoc) {
      throw new Error('Document not found');
    }

    return {
      documentId: data.documentId,
      shared: true,
      shareData: data,
    };
  }
}
