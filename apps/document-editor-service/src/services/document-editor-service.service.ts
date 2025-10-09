import { Injectable, Logger } from '@nestjs/common';
import * as Y from 'yjs';
import { DocumentManagementService } from './document-management.service';
import { DocumentExportService } from './document-export.service';
import { MediaService } from './media.service';
import { RedisService } from './redis.service';
import { DatabaseService } from './database.service';
import { FirebaseStorageService } from './firebase-storage.service';

@Injectable()
export class DocumentEditorServiceService {
  private readonly logger = new Logger(DocumentEditorServiceService.name);
  private documents = new Map<string, Y.Doc>();
  private collaborators = new Map<string, Set<string>>();
  private awareness = new Map<string, Map<string, any>>();

  constructor(
    private readonly documentManagementService: DocumentManagementService,
    private readonly documentExportService: DocumentExportService,
    private readonly mediaService: MediaService,
    private readonly redisService: RedisService,
    private readonly databaseService: DatabaseService,
    private readonly firebaseStorageService: FirebaseStorageService,
  ) {}

  getHello(): string {
    return 'Document Editor Service with Y.js and Redis is running!';
  }

  private applyContentFallback(ydoc: Y.Doc, content: string): void {
    try {
      const ytext = ydoc.getText('content');
      ytext.delete(0, ytext.length);
      ytext.insert(0, content || '');
      this.logger.debug(`Applied content fallback: ${content?.length || 0} characters`);
    } catch (error) {
      this.logger.error(`Failed to apply content fallback:`, error);
      // If even the fallback fails, just ensure we have an empty document
      const ytext = ydoc.getText('content');
      if (ytext.length === 0) {
        ytext.insert(0, '');
      }
    }
  }

  private async getOrCreateDocument(documentId: string): Promise<Y.Doc> {
    if (!this.documents.has(documentId)) {
      // Try to load from Redis first
      let ydoc = await this.redisService.loadYjsDocument(documentId);
      
      if (!ydoc) {
        // Create new document if not found in Redis
        ydoc = new Y.Doc();
        const ytext = ydoc.getText('content');
        if (ytext.length === 0) {
          ytext.insert(0, 'Welcome to the collaborative document!');
        }
        
        // Save to Redis
        await this.redisService.saveYjsDocument(documentId, ydoc);
      }

      this.documents.set(documentId, ydoc);
      
      // Set up real-time event handling for this document
      await this.setupDocumentEventHandling(documentId);
    }
    
    return this.documents.get(documentId)!;
  }

  private async setupDocumentEventHandling(documentId: string): Promise<void> {
    // Subscribe to Redis events for this document
    await this.redisService.subscribeToDocumentEvents(documentId, (event) => {
      this.handleDocumentEvent(documentId, event);
    });
  }

  private async handleDocumentEvent(documentId: string, event: any): Promise<void> {
    this.logger.debug(`Handling event for document ${documentId}:`, event.type);
    
    switch (event.type) {
      case 'yjs-update':
        await this.handleYjsUpdateEvent(documentId, event);
        break;
      case 'awareness-update':
        await this.handleAwarenessUpdateEvent(documentId, event);
        break;
      case 'user-join':
        await this.handleUserJoinEvent(documentId, event);
        break;
      case 'user-leave':
        await this.handleUserLeaveEvent(documentId, event);
        break;
    }
  }

  private async handleYjsUpdateEvent(documentId: string, event: any): Promise<void> {
    const ydoc = await this.getOrCreateDocument(documentId);
    const update = Buffer.from(event.data.update, 'base64');
    
    Y.applyUpdate(ydoc, update);
    
    // Save updated document to Redis
    await this.redisService.saveYjsDocument(documentId, ydoc);
  }

  private async handleAwarenessUpdateEvent(documentId: string, event: any): Promise<void> {
    await this.redisService.setUserAwareness(documentId, event.data.userId, event.data.awareness);
  }

  private async handleUserJoinEvent(documentId: string, event: any): Promise<void> {
    await this.redisService.addCollaborator(documentId, event.data.userId);
  }

  private async handleUserLeaveEvent(documentId: string, event: any): Promise<void> {
    await this.redisService.removeCollaborator(documentId, event.data.userId);
    await this.redisService.removeUserAwareness(documentId, event.data.userId);
  }

  async getDocument(documentId: string, userId?: string) {
    this.logger.log(`Getting document: ${documentId}${userId ? ` for user: ${userId}` : ''}`);
    
    try {
      // First try to get document from database
      const dbDocument = await this.databaseService.getDocument(documentId);
      
      if (!dbDocument) {
        throw new Error(`Document ${documentId} not found`);
      }

      // Check permissions if userId is provided
      if (userId) {
        const hasPermission = await this.databaseService.checkPermission(
          documentId, 
          userId, 
          'read'
        );
        
        if (!hasPermission && !dbDocument.is_public) {
          throw new Error(`User ${userId} does not have permission to access document ${documentId}`);
        }
      }

      // Load or create Y.js document
      const ydoc = await this.getOrCreateDocument(documentId);
      
      // If we have stored Y.js state, apply it with error handling
      if (dbDocument.yjs_state && dbDocument.yjs_state.length > 0) {
        try {
          // Validate that yjs_state is a valid Buffer
          const yjsBuffer = Buffer.isBuffer(dbDocument.yjs_state) 
            ? dbDocument.yjs_state 
            : Buffer.from(dbDocument.yjs_state);
          
          // Only apply if buffer has content
          if (yjsBuffer.length > 0) {
            Y.applyUpdate(ydoc, yjsBuffer);
            this.logger.debug(`Applied Y.js state from database for document: ${documentId}`);
          } else {
            this.logger.warn(`Empty Y.js state buffer for document: ${documentId}, using content fallback`);
            this.applyContentFallback(ydoc, dbDocument.content);
          }
        } catch (yjsError) {
          this.logger.error(`Failed to apply Y.js state for document ${documentId}:`, yjsError.message);
          this.logger.warn(`Falling back to content-based initialization for document: ${documentId}`);
          this.applyContentFallback(ydoc, dbDocument.content);
        }
      } else if (dbDocument.content) {
        // Fallback: if no Y.js state but we have content, set it
        this.logger.debug(`No Y.js state found, using content fallback for document: ${documentId}`);
        this.applyContentFallback(ydoc, dbDocument.content);
      } else {
        // No content at all, initialize with empty document
        this.logger.debug(`No content found, initializing empty document: ${documentId}`);
        const ytext = ydoc.getText('content');
        if (ytext.length === 0) {
          ytext.insert(0, '');
        }
      }

      // Update last accessed time
      await this.databaseService.updateDocument(documentId, {
        last_accessed_at: new Date(),
      });

      return {
        id: dbDocument.id,
        title: dbDocument.title,
        content: ydoc.getText('content').toString(),
        yDocState: Y.encodeStateAsUpdate(ydoc),
        createdBy: dbDocument.created_by,
        createdAt: dbDocument.created_at,
        updatedAt: dbDocument.updated_at,
        threadId: dbDocument.thread_id,
        isPublic: dbDocument.is_public,
        allowComments: dbDocument.allow_comments,
        allowSuggestions: dbDocument.allow_suggestions,
      };
    } catch (error) {
      this.logger.error(`❌ Error getting document ${documentId}:`, error);
      throw new Error(`Failed to get document: ${error.message}`);
    }
  }

  async createDocument(data: any) {
    this.logger.log(`Creating document with data:`, { 
      title: data.title, 
      threadId: data.threadId, 
      userId: data.userId,
      hasContent: !!data.content 
    });

    try {
      // Generate document ID if not provided
      const documentId = data.documentId || `doc_${Date.now()}`;

      // Create Y.js document with proper initialization
      const ydoc = new Y.Doc();
      const ytext = ydoc.getText('content');

      // Set initial content if provided, otherwise set empty string
      const initialContent = data.content || '';
      if (ytext.length === 0) {
        ytext.insert(0, initialContent);
      }

      // Get Y.js state as buffer - ensure it's valid
      const yjsState = Y.encodeStateAsUpdate(ydoc);
      if (!yjsState || yjsState.length === 0) {
        this.logger.warn(`Generated empty Y.js state for document ${documentId}, creating minimal state`);
        // Force a small update to ensure valid state
        ytext.insert(ytext.length, '');
        const newYjsState = Y.encodeStateAsUpdate(ydoc);
        this.logger.debug(`Created Y.js state with length: ${newYjsState.length}`);
      }

      // Store document in our map before database operations
      this.documents.set(documentId, ydoc);

      // Store in Supabase database
      const dbDocument = await this.databaseService.createDocument({
        title: data.title || 'New Document',
        content: ytext.toString(),
        yjs_state: Buffer.from(Y.encodeStateAsUpdate(ydoc)),
        thread_id: data.threadId,
        created_by: data.userId,
        is_public: data.isPublic || false,
      });

      this.logger.log(`✅ Document created in database: ${dbDocument.id}`);

      // Save to Redis for real-time collaboration
      await this.redisService.saveYjsDocument(dbDocument.id, ydoc);

      // Set up document permissions for the creator
      await this.databaseService.setPermission({
        document_id: dbDocument.id,
        user_id: data.userId,
        permission_level: 'admin',
        granted_by: data.userId,
      });

      // Log audit entry
      await this.databaseService.logAuditEntry({
        document_id: dbDocument.id,
        user_id: data.userId,
        action: 'created',
        details: {
          title: dbDocument.title,
          thread_id: data.threadId,
          is_public: data.isPublic || false,
        },
      });

      this.logger.log(`✅ Document setup completed: ${dbDocument.id}`);

      return {
        id: dbDocument.id,
        title: dbDocument.title,
        content: dbDocument.content,
        yDocState: yjsState,
        createdBy: dbDocument.created_by,
        createdAt: dbDocument.created_at,
        updatedAt: dbDocument.updated_at,
        threadId: dbDocument.thread_id,
        isPublic: dbDocument.is_public,
      };
    } catch (error) {
      this.logger.error(`❌ Error creating document:`, error);
      throw new Error(`Failed to create document: ${error.message}`);
    }
  }

  async applyYjsUpdate(data: {
    documentId: string;
    userId: string;
    update: Uint8Array;
  }) {
    this.logger.log(
      `Applying Y.js update to document: ${data.documentId} from user: ${data.userId}`,
    );

    try {
      const ydoc = await this.getOrCreateDocument(data.documentId);

      // Apply the Y.js update
      Y.applyUpdate(ydoc, data.update);

      // Save to Redis for real-time collaboration
      await this.redisService.saveYjsDocument(data.documentId, ydoc);

      // Update database with latest content and Y.js state
      await this.databaseService.updateDocument(data.documentId, {
        content: ydoc.getText('content').toString(),
        yjs_state: Buffer.from(Y.encodeStateAsUpdate(ydoc)),
      });

      // Log audit entry for the update
      await this.databaseService.logAuditEntry({
        document_id: data.documentId,
        user_id: data.userId,
        action: 'updated',
        details: {
          updateType: 'yjs-update',
          contentLength: ydoc.getText('content').length,
        },
      });

      // Publish real-time event to other services/instances
      await this.redisService.publishDocumentEvent(data.documentId, {
        type: 'yjs-update',
        data: {
          userId: data.userId,
          update: Buffer.from(data.update).toString('base64'),
        },
      });

      return {
        documentId: data.documentId,
        userId: data.userId,
        content: ydoc.getText('content').toString(),
        success: true,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`❌ Error applying Y.js update to document ${data.documentId}:`, error);
      throw new Error(`Failed to apply update: ${error.message}`);
    }
  }

  async getYjsStateVector(documentId: string) {
    this.logger.log(`Getting Y.js state vector for document: ${documentId}`);
    const ydoc = await this.getOrCreateDocument(documentId);
    return {
      documentId,
      stateVector: Y.encodeStateVector(ydoc),
    };
  }

  async getYjsUpdateSince(documentId: string, stateVector: Uint8Array) {
    this.logger.log(
      `Getting Y.js updates since state vector for document: ${documentId}`,
    );
    const ydoc = await this.getOrCreateDocument(documentId);
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

    const ydoc = await this.getOrCreateDocument(data.documentId);
    const ytext = ydoc.getText('content');

    // For legacy compatibility - replace entire content
    if ((data.operation === 'replace' || data.operation === 'content-update') && typeof data.content === 'string') {
      ytext.delete(0, ytext.length);
      ytext.insert(0, data.content);
      
      // Save to Redis after content change
      await this.redisService.saveYjsDocument(data.documentId, ydoc);
      
      // Also save to database for persistence
      try {
        await this.databaseService.updateDocument(data.documentId, {
          content: data.content,
          last_accessed_at: new Date(),
        });
        this.logger.log(`Document ${data.documentId} saved to database`);
      } catch (error) {
        this.logger.error(`Error saving document ${data.documentId} to database:`, error);
      }
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

    // Add to Redis collaborators
    await this.redisService.addCollaborator(documentId, userId);

    // Publish join event
    await this.redisService.publishDocumentEvent(documentId, {
      type: 'user-join',
      data: { userId },
    });

    const ydoc = await this.getOrCreateDocument(documentId);
    const activeCollaborators = await this.redisService.getCollaborators(documentId);

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

    // Remove from Redis
    await this.redisService.removeCollaborator(documentId, userId);
    await this.redisService.removeUserAwareness(documentId, userId);

    // Publish leave event
    await this.redisService.publishDocumentEvent(documentId, {
      type: 'user-leave',
      data: { userId },
    });

    const activeCollaborators = await this.redisService.getCollaborators(documentId);

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

    // Update in Redis
    await this.redisService.setUserAwareness(data.documentId, data.userId, data.awareness);

    // Publish awareness event
    await this.redisService.publishDocumentEvent(data.documentId, {
      type: 'awareness-update',
      data: {
        userId: data.userId,
        awareness: data.awareness,
      },
    });

    return {
      documentId: data.documentId,
      userId: data.userId,
      awareness: data.awareness,
    };
  }

  async getCollaborators(documentId: string) {
    this.logger.log(`Getting collaborators for document: ${documentId}`);

    const activeCollaborators = await this.redisService.getCollaborators(documentId);
    const awarenessData = await this.redisService.getUserAwareness(documentId);

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

  // Version Control Methods
  async saveDocumentVersion(data: {
    documentId: string;
    userId: string;
    label?: string;
  }) {
    const ydoc = await this.getOrCreateDocument(data.documentId);
    const content = ydoc.getText('content').toString();
    
    return await this.documentManagementService.saveVersion({
      documentId: data.documentId,
      content,
      userId: data.userId,
      label: data.label,
    });
  }

  async getDocumentVersionHistory(documentId: string) {
    return await this.documentManagementService.getVersionHistory(documentId);
  }

  async restoreDocumentVersion(data: {
    documentId: string;
    versionId: string;
    userId: string;
  }) {
    const result = await this.documentManagementService.restoreVersion(data);
    
    if (result.success && result.content) {
      // Update the Yjs document with restored content
      const ydoc = await this.getOrCreateDocument(data.documentId);
      const ytext = ydoc.getText('content');
      ytext.delete(0, ytext.length);
      ytext.insert(0, result.content);
    }
    
    return result;
  }

  // Permission Methods
  async setDocumentPermission(data: {
    documentId: string;
    userId: string;
    permission: 'read' | 'write' | 'admin';
    grantedBy: string;
  }) {
    return await this.documentManagementService.setPermission(data);
  }

  async getDocumentPermissions(documentId: string) {
    return await this.documentManagementService.getPermissions(documentId);
  }

  async checkDocumentPermission(data: {
    documentId: string;
    userId: string;
    permission: 'read' | 'write' | 'admin';
  }) {
    return await this.documentManagementService.checkPermission(
      data.documentId,
      data.userId,
      data.permission
    );
  }

  // Export Methods
  async exportDocument(data: {
    documentId: string;
    format: 'pdf' | 'docx' | 'html';
    includeMetadata?: boolean;
    includeVersionHistory?: boolean;
  }) {
    const ydoc = await this.getOrCreateDocument(data.documentId);
    const content = ydoc.getText('content').toString();
    
    return await this.documentExportService.exportDocument(
      data.documentId,
      content,
      {
        format: data.format,
        includeMetadata: data.includeMetadata,
        includeVersionHistory: data.includeVersionHistory,
      }
    );
  }

  async createDocumentBackup(documentId: string) {
    const ydoc = await this.getOrCreateDocument(documentId);
    const content = ydoc.getText('content').toString();
    const versions = await this.documentManagementService.getVersionHistory(documentId);
    const permissions = await this.documentManagementService.getPermissions(documentId);
    const auditLog = await this.documentManagementService.getAuditLog(documentId);
    
    return await this.documentExportService.createBackup(
      documentId,
      content,
      versions,
      Object.entries(permissions).map(([userId, permission]) => ({ userId, permission })),
      auditLog
    );
  }

  // Media Methods
  async uploadMedia(data: {
    file: Express.Multer.File;
    documentId: string;
    userId: string;
  }) {
    return await this.mediaService.uploadFile(data.file, data.documentId, data.userId);
  }

  async getDocumentMedia(documentId: string) {
    return await this.mediaService.getDocumentMedia(documentId);
  }

  async deleteMedia(data: { fileId: string; userId: string }) {
    return await this.mediaService.deleteFile(data.fileId, data.userId);
  }

  // Get documents by thread ID with user permissions
  async getDocumentsByThread(threadId: string, userId: string) {
    try {
      this.logger.debug(`Getting documents for thread ${threadId} for user ${userId}`);
      
      // Get all documents for this thread from database
      const { data: documents, error } = await this.databaseService.supabase
        .from('documents')
        .select(`
          id,
          title,
          created_by,
          created_at,
          updated_at,
          thread_id,
          is_public,
          allow_comments,
          allow_suggestions
        `)
        .eq('thread_id', threadId)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (error) {
        this.logger.error('Error fetching documents:', error);
        throw error;
      }

      if (!documents || documents.length === 0) {
        this.logger.debug(`No documents found for thread ${threadId}`);
        return [];
      }

      // Check permissions and get collaborator info for each document
      const transformedDocuments = await Promise.all(
        documents.map(async (doc) => {
          // Determine user permission
          let userPermission = 'read';
          if (doc.created_by === userId) {
            userPermission = 'admin';
          } else if (!doc.is_public) {
            // Check document_permissions table
            const { data: permission } = await this.databaseService.supabase
              .from('document_permissions')
              .select('permission_level')
              .eq('document_id', doc.id)
              .eq('user_id', userId)
              .eq('is_active', true)
              .single();
            
            if (permission) {
              userPermission = permission.permission_level;
            } else if (!doc.is_public) {
              // No permission and not public, skip this document
              return null;
            }
          }

          // Check if user is currently editing
          const { data: collaborator } = await this.databaseService.supabase
            .from('document_collaborators')
            .select('user_id, joined_at, is_active')
            .eq('document_id', doc.id)
            .eq('user_id', userId)
            .eq('is_active', true)
            .single();

          // Get last active collaborator
          const { data: lastEditor } = await this.databaseService.supabase
            .from('document_collaborators')
            .select('user_id, joined_at')
            .eq('document_id', doc.id)
            .eq('is_active', true)
            .order('joined_at', { ascending: false })
            .limit(1)
            .single();

          return {
            id: doc.id,
            title: doc.title,
            createdBy: doc.created_by,
            createdAt: doc.created_at,
            updatedAt: doc.updated_at,
            threadId: doc.thread_id,
            isPublic: doc.is_public,
            allowComments: doc.allow_comments,
            allowSuggestions: doc.allow_suggestions,
            userPermission: userPermission,
            isCurrentlyEditing: collaborator ? collaborator.is_active : false,
            lastEditedBy: lastEditor ? lastEditor.user_id : null,
            lastEditedAt: lastEditor ? lastEditor.joined_at : null
          };
        })
      );

      // Filter out null entries (documents with no permission)
      const filteredDocuments = transformedDocuments.filter(doc => doc !== null);

      this.logger.debug(`Found ${filteredDocuments.length} documents for thread ${threadId}`);
      return filteredDocuments;
    } catch (error) {
      this.logger.error(`Error getting documents by thread ${threadId}:`, error);
      throw error;
    }
  }
}
