import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as Y from 'yjs';

export interface Document {
  id: string;
  title: string;
  content: string;
  yjs_state: Buffer;
  thread_id: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  last_accessed_at: Date;
  is_deleted: boolean;
  is_public: boolean;
  allow_comments: boolean;
  allow_suggestions: boolean;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  content: string;
  yjs_state: Buffer;
  label?: string;
  created_by: string;
  created_at: Date;
  size_bytes: number;
  changes_summary?: any;
  is_auto_save: boolean;
}

export interface DocumentPermission {
  id: string;
  document_id: string;
  user_id: string;
  permission_level: 'read' | 'write' | 'admin';
  granted_by: string;
  granted_at: Date;
  expires_at?: Date;
  is_active: boolean;
}

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  public readonly supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration is missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.logger.log('✅ Supabase client initialized');
  }

  // Document CRUD Operations
  async createDocument(data: {
    title: string;
    content: string;
    yjs_state: Buffer;
    thread_id: string;
    created_by: string;
    is_public?: boolean;
  }): Promise<Document> {
    const { data: document, error } = await this.supabase
      .from('documents')
      .insert({
        title: data.title,
        content: data.content,
        yjs_state: data.yjs_state,
        thread_id: data.thread_id,
        created_by: data.created_by,
        is_public: data.is_public || false,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create document:', error);
      throw new Error(`Failed to create document: ${error.message}`);
    }

    this.logger.log(`Document created: ${document.id}`);
    return document;
  }

  async getDocument(documentId: string): Promise<Document | null> {
    const { data: document, error } = await this.supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('is_deleted', false)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Document not found
      }
      this.logger.error('Failed to get document:', error);
      throw new Error(`Failed to get document: ${error.message}`);
    }

    return document;
  }

  async updateDocument(documentId: string, updates: {
    title?: string;
    content?: string;
    yjs_state?: Buffer;
    last_accessed_at?: Date;
  }): Promise<Document> {
    const { data: document, error } = await this.supabase
      .from('documents')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to update document:', error);
      throw new Error(`Failed to update document: ${error.message}`);
    }

    return document;
  }

  async deleteDocument(documentId: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('documents')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
      })
      .eq('id', documentId);

    if (error) {
      this.logger.error('Failed to delete document:', error);
      return false;
    }

    this.logger.log(`Document deleted: ${documentId}`);
    return true;
  }

  async getDocumentsByThread(threadId: string, userId: string): Promise<Document[]> {
    // Return all documents in the thread (no permission filtering)
    // This allows all users to access all shared documents in a thread
    const { data: documents, error } = await this.supabase
      .from('documents')
      .select('*')
      .eq('thread_id', threadId)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false });

    if (error) {
      this.logger.error('Failed to get thread documents:', error);
      throw new Error(`Failed to get thread documents: ${error.message}`);
    }

    return documents || [];
  }

  async getDocumentsByWorkspace(workspaceId: string, userId: string): Promise<Document[]> {
    const { data: documents, error } = await this.supabase
      .from('documents_with_latest_version')
      .select(`
        *,
        document_permissions!inner(permission_level)
      `)
      .eq('workspace_id', workspaceId)
      .eq('is_deleted', false)
      .eq('document_permissions.user_id', userId)
      .eq('document_permissions.is_active', true);

    if (error) {
      this.logger.error('Failed to get workspace documents:', error);
      throw new Error(`Failed to get workspace documents: ${error.message}`);
    }

    return documents || [];
  }

  // Version Control
  async saveVersion(data: {
    document_id: string;
    content: string;
    yjs_state: Buffer;
    created_by: string;
    label?: string;
    is_auto_save?: boolean;
  }): Promise<DocumentVersion> {
    const { data: version, error } = await this.supabase
      .from('document_versions')
      .insert({
        document_id: data.document_id,
        content: data.content,
        yjs_state: data.yjs_state,
        created_by: data.created_by,
        label: data.label,
        size_bytes: data.content.length,
        is_auto_save: data.is_auto_save || false,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to save version:', error);
      throw new Error(`Failed to save version: ${error.message}`);
    }

    this.logger.log(`Version saved: ${version.id} for document: ${data.document_id}`);
    return version;
  }

  async getVersionHistory(documentId: string, limit = 50): Promise<DocumentVersion[]> {
    const { data: versions, error } = await this.supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error('Failed to get version history:', error);
      throw new Error(`Failed to get version history: ${error.message}`);
    }

    return versions || [];
  }

  async getVersion(documentId: string, versionId: string): Promise<DocumentVersion | null> {
    const { data: version, error } = await this.supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .eq('id', versionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error('Failed to get version:', error);
      throw new Error(`Failed to get version: ${error.message}`);
    }

    return version;
  }

  // Permissions Management
  async setPermission(data: {
    document_id: string;
    user_id: string;
    permission_level: 'read' | 'write' | 'admin';
    granted_by: string;
    expires_at?: Date;
  }): Promise<DocumentPermission> {
    // First, deactivate any existing permissions for this user on this document
    await this.supabase
      .from('document_permissions')
      .update({ is_active: false })
      .eq('document_id', data.document_id)
      .eq('user_id', data.user_id)
      .eq('is_active', true);

    // Then create the new permission
    const { data: permission, error } = await this.supabase
      .from('document_permissions')
      .insert({
        document_id: data.document_id,
        user_id: data.user_id,
        permission_level: data.permission_level,
        granted_by: data.granted_by,
        expires_at: data.expires_at?.toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to set permission:', error);
      throw new Error(`Failed to set permission: ${error.message}`);
    }

    this.logger.log(`Permission set: ${data.permission_level} for user ${data.user_id} on document ${data.document_id}`);
    return permission;
  }

  async getDocumentPermissions(documentId: string): Promise<DocumentPermission[]> {
    const { data: permissions, error } = await this.supabase
      .from('document_permissions')
      .select('*')
      .eq('document_id', documentId)
      .eq('is_active', true);

    if (error) {
      this.logger.error('Failed to get permissions:', error);
      throw new Error(`Failed to get permissions: ${error.message}`);
    }

    return permissions || [];
  }

  async checkPermission(
    documentId: string,
    userId: string,
    requiredLevel: 'read' | 'write' | 'admin'
  ): Promise<boolean> {
    const { data: permission, error } = await this.supabase
      .from('document_permissions')
      .select('permission_level')
      .eq('document_id', documentId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .single();

    if (error || !permission) {
      return false;
    }

    const hierarchy = { read: 1, write: 2, admin: 3 };
    return hierarchy[permission.permission_level] >= hierarchy[requiredLevel];
  }

  // Audit Logging
  async logAuditEntry(data: {
    document_id: string;
    user_id: string;
    action: string;
    details?: any;
    ip_address?: string;
    user_agent?: string;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('document_audit_log')
      .insert({
        document_id: data.document_id,
        user_id: data.user_id,
        action: data.action,
        details: data.details,
        ip_address: data.ip_address,
        user_agent: data.user_agent,
      });

    if (error) {
      this.logger.error('Failed to log audit entry:', error);
      // Don't throw error here as it's logging - just log the failure
    }
  }

  async getAuditLog(documentId: string, limit = 100): Promise<any[]> {
    const { data: logs, error } = await this.supabase
      .from('document_audit_log')
      .select('*')
      .eq('document_id', documentId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error('Failed to get audit log:', error);
      throw new Error(`Failed to get audit log: ${error.message}`);
    }

    return logs || [];
  }

  // Media Management
  async saveMediaMetadata(data: {
    document_id: string;
    filename: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    firebase_path: string;
    firebase_url?: string;
    uploaded_by: string;
    width?: number;
    height?: number;
    duration_seconds?: number;
    thumbnail_firebase_path?: string;
  }): Promise<any> {
    this.logger.log('💾 [Database] Saving media metadata:', {
      document_id: data.document_id,
      filename: data.filename,
      size_bytes: data.size_bytes,
      mime_type: data.mime_type,
      uploaded_by: data.uploaded_by,
      firebase_path: data.firebase_path,
      hasFirebaseUrl: !!data.firebase_url
    });

    const { data: media, error } = await this.supabase
      .from('document_media')
      .insert(data)
      .select()
      .single();

    if (error) {
      this.logger.error('❌ [Database] Failed to save media metadata:', error);
      throw new Error(`Failed to save media metadata: ${error.message}`);
    }

    this.logger.log('✅ [Database] Media metadata saved successfully:', media.id);
    return media;
  }

  async getDocumentMedia(documentId: string): Promise<any[]> {
    const { data: media, error } = await this.supabase
      .from('document_media')
      .select('*')
      .eq('document_id', documentId)
      .eq('is_deleted', false)
      .order('uploaded_at', { ascending: false });

    if (error) {
      this.logger.error('Failed to get document media:', error);
      throw new Error(`Failed to get document media: ${error.message}`);
    }

    return media || [];
  }

  async deleteMediaMetadata(fileId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('document_media')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', fileId);

    if (error) {
      this.logger.error('Failed to delete media metadata:', error);
      return false;
    }

    return true;
  }

  // Collaborator Management (for active sessions)
  async addCollaborator(documentId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('document_collaborators')
      .upsert({
        document_id: documentId,
        user_id: userId,
        last_activity_at: new Date().toISOString(),
        status: 'active',
      });

    if (error) {
      this.logger.error('Failed to add collaborator:', error);
    }
  }

  async removeCollaborator(documentId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('document_collaborators')
      .delete()
      .eq('document_id', documentId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error('Failed to remove collaborator:', error);
    }
  }

  async updateCollaboratorActivity(documentId: string, userId: string, awareness?: any): Promise<void> {
    const { error } = await this.supabase
      .from('document_collaborators')
      .upsert({
        document_id: documentId,
        user_id: userId,
        last_activity_at: new Date().toISOString(),
        status: 'active',
        awareness_data: awareness,
      });

    if (error) {
      this.logger.error('Failed to update collaborator activity:', error);
    }
  }

  async getActiveCollaborators(documentId: string): Promise<any[]> {
    const { data: collaborators, error } = await this.supabase
      .from('document_collaborators')
      .select('*')
      .eq('document_id', documentId)
      .eq('status', 'active')
      .gte('last_activity_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Active in last 5 minutes

    if (error) {
      this.logger.error('Failed to get active collaborators:', error);
      return [];
    }

    return collaborators || [];
  }

  // Document Search
  async searchDocuments(query: string, workspaceId: string, userId: string, limit = 20): Promise<Document[]> {
    const { data: documents, error } = await this.supabase
      .from('documents_with_latest_version')
      .select(`
        *,
        document_permissions!inner(permission_level)
      `)
      .eq('workspace_id', workspaceId)
      .eq('is_deleted', false)
      .eq('document_permissions.user_id', userId)
      .eq('document_permissions.is_active', true)
      .textSearch('content_vector', query)
      .limit(limit);

    if (error) {
      this.logger.error('Failed to search documents:', error);
      throw new Error(`Failed to search documents: ${error.message}`);
    }

    return documents || [];
  }

  async searchDocumentsByThread(query: string, threadId: string, userId: string, limit = 20): Promise<Document[]> {
    const { data: documents, error } = await this.supabase
      .from('documents')
      .select(`
        *,
        document_permissions!inner(permission_level)
      `)
      .eq('thread_id', threadId)
      .eq('is_deleted', false)
      .eq('document_permissions.user_id', userId)
      .eq('document_permissions.is_active', true)
      .textSearch('content_vector', query)
      .limit(limit);

    if (error) {
      this.logger.error('Failed to search thread documents:', error);
      throw new Error(`Failed to search thread documents: ${error.message}`);
    }

    return documents || [];
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('documents')
        .select('id')
        .limit(1);

      return !error;
    } catch (error) {
      this.logger.error('Database ping failed:', error);
      return false;
    }
  }

  // Get Supabase client for advanced operations
  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }

  // Document Access Requests
  async createAccessRequest(data: {
    document_id: string;
    user_id: string;
    requested_permission: 'read' | 'write';
    message?: string;
  }): Promise<any> {
    const { data: result, error } = await this.supabase
      .from('document_access_requests')
      .insert({
        document_id: data.document_id,
        user_id: data.user_id,
        requested_permission: data.requested_permission,
        message: data.message,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Error creating access request:', error);
      throw new Error(`Failed to create access request: ${error.message}`);
    }

    return result;
  }

  async getPendingAccessRequestsByThread(threadId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('pending_document_access_requests')
      .select('*')
      .eq('thread_id', threadId)
      .order('requested_at', { ascending: false });

    if (error) {
      this.logger.error('Error fetching pending access requests:', error);
      throw new Error(`Failed to fetch pending access requests: ${error.message}`);
    }

    return data || [];
  }

  async updateAccessRequestStatus(
    requestId: string,
    status: 'approved' | 'rejected',
    handledBy: string,
    rejectionReason?: string,
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('document_access_requests')
      .update({
        status,
        handled_by: handledBy,
        handled_at: new Date().toISOString(),
        rejection_reason: rejectionReason,
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      this.logger.error('Error updating access request status:', error);
      throw new Error(`Failed to update access request: ${error.message}`);
    }

    return data;
  }

  async getAccessRequest(requestId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('document_access_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error) {
      this.logger.error('Error fetching access request:', error);
      throw new Error(`Failed to fetch access request: ${error.message}`);
    }

    return data;
  }

  async hasExistingAccessRequest(documentId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('document_access_requests')
      .select('id')
      .eq('document_id', documentId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .limit(1);

    if (error) {
      this.logger.error('Error checking existing access request:', error);
      return false;
    }

    return (data?.length || 0) > 0;
  }
}