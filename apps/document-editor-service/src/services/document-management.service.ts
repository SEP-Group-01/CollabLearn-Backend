import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from './database.service';
import * as Y from 'yjs';

export interface DocumentVersion {
  id: string;
  documentId: string;
  content: string;
  createdAt: Date;
  createdBy: string;
  label?: string;
  size: number;
}

export interface DocumentPermission {
  userId: string;
  documentId: string;
  permission: 'read' | 'write' | 'admin';
  grantedBy: string;
  grantedAt: Date;
}

export interface AuditLogEntry {
  id: string;
  documentId: string;
  userId: string;
  action: string;
  details: any;
  timestamp: Date;
  ipAddress?: string;
}

@Injectable()
export class DocumentManagementService {
  private readonly logger = new Logger(DocumentManagementService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  // Version Control
  async saveVersion(data: {
    documentId: string;
    content: string;
    userId: string;
    label?: string;
    ydoc?: Y.Doc;
  }): Promise<DocumentVersion> {
    this.logger.log(`Saving version for document: ${data.documentId}`);

    const yjsState = data.ydoc ? Y.encodeStateAsUpdate(data.ydoc) : null;

    const version = await this.databaseService.saveVersion({
      document_id: data.documentId,
      content: data.content,
      yjs_state: yjsState ? Buffer.from(yjsState) : Buffer.alloc(0),
      created_by: data.userId,
      label: data.label,
      is_auto_save: data.label === 'Auto-save',
    });

    // Log audit entry
    await this.databaseService.logAuditEntry({
      document_id: data.documentId,
      user_id: data.userId,
      action: 'version_saved',
      details: { versionId: version.id, label: data.label },
    });

    return {
      id: version.id,
      documentId: version.document_id,
      content: version.content,
      createdAt: new Date(version.created_at),
      createdBy: version.created_by,
      label: version.label,
      size: version.size_bytes,
    };
  }

  async getVersionHistory(documentId: string): Promise<DocumentVersion[]> {
    this.logger.log(`Getting version history for document: ${documentId}`);
    
    const versions = await this.databaseService.getVersionHistory(documentId);
    
    return versions.map(v => ({
      id: v.id,
      documentId: v.document_id,
      content: v.content,
      createdAt: new Date(v.created_at),
      createdBy: v.created_by,
      label: v.label,
      size: v.size_bytes,
    }));
  }

  async getVersion(documentId: string, versionId: string): Promise<DocumentVersion | null> {
    const version = await this.databaseService.getVersion(documentId, versionId);
    
    if (!version) {
      return null;
    }

    return {
      id: version.id,
      documentId: version.document_id,
      content: version.content,
      createdAt: new Date(version.created_at),
      createdBy: version.created_by,
      label: version.label,
      size: version.size_bytes,
    };
  }

  async restoreVersion(data: {
    documentId: string;
    versionId: string;
    userId: string;
  }): Promise<{ success: boolean; content?: string; yjsState?: Buffer }> {
    this.logger.log(`Restoring version ${data.versionId} for document: ${data.documentId}`);

    const version = await this.databaseService.getVersion(data.documentId, data.versionId);
    if (!version) {
      return { success: false };
    }

    // Log audit entry
    await this.databaseService.logAuditEntry({
      document_id: data.documentId,
      user_id: data.userId,
      action: 'version_restored',
      details: { versionId: data.versionId, restoredFrom: version.created_at },
    });

    return {
      success: true,
      content: version.content,
      yjsState: version.yjs_state,
    };
  }

  // Permissions Management
  async setPermission(data: {
    documentId: string;
    userId: string;
    permission: 'read' | 'write' | 'admin';
    grantedBy: string;
  }): Promise<DocumentPermission> {
    this.logger.log(`Setting permission for user ${data.userId} on document ${data.documentId}: ${data.permission}`);

    const permission = await this.databaseService.setPermission({
      document_id: data.documentId,
      user_id: data.userId,
      permission_level: data.permission,
      granted_by: data.grantedBy,
    });

    // Log audit entry
    await this.databaseService.logAuditEntry({
      document_id: data.documentId,
      user_id: data.grantedBy,
      action: 'permission_changed',
      details: { targetUserId: data.userId, permission: data.permission },
    });

    return {
      userId: permission.user_id,
      documentId: permission.document_id,
      permission: permission.permission_level,
      grantedBy: permission.granted_by,
      grantedAt: new Date(permission.granted_at),
    };
  }

  async getPermissions(documentId: string): Promise<Record<string, string>> {
    const permissions = await this.databaseService.getDocumentPermissions(documentId);
    
    const result: Record<string, string> = {};
    permissions.forEach(permission => {
      result[permission.user_id] = permission.permission_level;
    });

    return result;
  }

  async checkPermission(
    documentId: string,
    userId: string,
    requiredPermission: 'read' | 'write' | 'admin'
  ): Promise<boolean> {
    return await this.databaseService.checkPermission(documentId, userId, requiredPermission);
  }

  // Audit Trail
  async logAuditEntry(data: {
    documentId: string;
    userId: string;
    action: string;
    details: any;
    ipAddress?: string;
  }): Promise<AuditLogEntry> {
    await this.databaseService.logAuditEntry({
      document_id: data.documentId,
      user_id: data.userId,
      action: data.action,
      details: data.details,
      ip_address: data.ipAddress,
    });

    this.logger.log(`Audit log entry: ${data.action} by ${data.userId} on ${data.documentId}`);
    
    // Return a compatible format
    return {
      id: 'generated-by-db',
      documentId: data.documentId,
      userId: data.userId,
      action: data.action,
      details: data.details,
      timestamp: new Date(),
      ipAddress: data.ipAddress,
    };
  }

  async getAuditLog(documentId: string, limit = 100): Promise<AuditLogEntry[]> {
    const logs = await this.databaseService.getAuditLog(documentId, limit);
    
    return logs.map(log => ({
      id: log.id,
      documentId: log.document_id,
      userId: log.user_id,
      action: log.action,
      details: log.details,
      timestamp: new Date(log.timestamp),
      ipAddress: log.ip_address,
    }));
  }

  // Auto-save functionality
  async autoSave(data: {
    documentId: string;
    content: string;
    userId: string;
    ydoc?: Y.Doc;
  }): Promise<void> {
    // Auto-save every 30 seconds if content changed
    await this.saveVersion({
      ...data,
      label: 'Auto-save',
    });
  }

  // Document statistics
  async getDocumentStats(documentId: string): Promise<{
    versionCount: number;
    lastModified: Date;
    collaboratorCount: number;
    auditLogCount: number;
  }> {
    const [versions, permissions, auditLog] = await Promise.all([
      this.databaseService.getVersionHistory(documentId, 1),
      this.databaseService.getDocumentPermissions(documentId),
      this.databaseService.getAuditLog(documentId, 1),
    ]);

    const versionHistory = await this.databaseService.getVersionHistory(documentId);

    return {
      versionCount: versionHistory.length,
      lastModified: versions.length > 0 ? new Date(versions[0].created_at) : new Date(),
      collaboratorCount: permissions.length,
      auditLogCount: auditLog.length,
    };
  }
}