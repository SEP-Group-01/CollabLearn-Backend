-- Supabase Database Schema for Document Editor Service
-- Migration: 004_document_storage_schema.sql

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Documents table - Core document metadata
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT, -- Latest content as plain text for search
    yjs_state BYTEA, -- Y.js document state for collaborative editing
    thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
    created_by UUID NOT NULL, -- User ID who created the document
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    
    -- Document settings
    is_public BOOLEAN DEFAULT FALSE,
    allow_comments BOOLEAN DEFAULT TRUE,
    allow_suggestions BOOLEAN DEFAULT TRUE,
    
    -- Search and indexing
    content_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || COALESCE(content, ''))) STORED,
    
    CONSTRAINT documents_title_not_empty CHECK (LENGTH(title) > 0)
);

-- Document versions table - Version control
CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    yjs_state BYTEA, -- Y.js state at this version
    label VARCHAR(100), -- Optional version label
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    size_bytes INTEGER NOT NULL DEFAULT 0,
    
    -- Change tracking
    changes_summary JSONB, -- Summary of what changed
    is_auto_save BOOLEAN DEFAULT FALSE,
    
    UNIQUE(document_id, version_number)
);

-- Document permissions table
CREATE TABLE IF NOT EXISTS document_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    permission_level VARCHAR(10) NOT NULL CHECK (permission_level IN ('read', 'write', 'admin')),
    granted_by UUID NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration
    is_active BOOLEAN DEFAULT TRUE,
    
    UNIQUE(document_id, user_id, is_active) -- One active permission per user per document
);

-- Document collaborators table - Active real-time collaborators
CREATE TABLE IF NOT EXISTS document_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'away', 'offline')),
    cursor_position JSONB, -- Current cursor/selection position
    awareness_data JSONB, -- Y.js awareness data
    
    UNIQUE(document_id, user_id)
);

-- Document audit log table
CREATE TABLE IF NOT EXISTS document_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexing for queries
    CONSTRAINT valid_action CHECK (action IN (
        'created', 'updated', 'deleted', 'restored',
        'version_saved', 'version_restored',
        'permission_changed', 'permission_granted', 'permission_revoked',
        'user_joined', 'user_left',
        'shared', 'unshared',
        'exported', 'imported',
        'media_uploaded', 'media_deleted'
    ))
);

-- Media files table
CREATE TABLE IF NOT EXISTS document_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    firebase_path TEXT NOT NULL, -- Path in Firebase Storage
    firebase_url TEXT, -- Public download URL
    uploaded_by UUID NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Media metadata
    width INTEGER, -- For images/videos
    height INTEGER, -- For images/videos
    duration_seconds INTEGER, -- For videos/audio
    thumbnail_firebase_path TEXT, -- Thumbnail in Firebase
    
    CONSTRAINT valid_size CHECK (size_bytes > 0)
);

-- Document comments table (for collaboration features)
CREATE TABLE IF NOT EXISTS document_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES document_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    position JSONB, -- Position in document (Y.js position)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    
    CONSTRAINT content_not_empty CHECK (LENGTH(content) > 0)
);

-- Document templates table
CREATE TABLE IF NOT EXISTS document_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    yjs_template BYTEA, -- Template Y.js state
    category VARCHAR(50) DEFAULT 'general',
    is_public BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usage_count INTEGER DEFAULT 0,
    
    CONSTRAINT template_name_not_empty CHECK (LENGTH(name) > 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_thread_id ON documents(thread_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);
CREATE INDEX IF NOT EXISTS idx_documents_content_search ON documents USING GIN(content_vector);
CREATE INDEX IF NOT EXISTS idx_documents_not_deleted ON documents(id) WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_created_at ON document_versions(document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_permissions_document_id ON document_permissions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_permissions_user_id ON document_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_document_permissions_active ON document_permissions(document_id, user_id) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_document_collaborators_document_id ON document_collaborators(document_id);
CREATE INDEX IF NOT EXISTS idx_document_collaborators_user_id ON document_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_document_collaborators_active ON document_collaborators(document_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_document_audit_log_document_id ON document_audit_log(document_id);
CREATE INDEX IF NOT EXISTS idx_document_audit_log_user_id ON document_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_document_audit_log_timestamp ON document_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_document_audit_log_action ON document_audit_log(action);

CREATE INDEX IF NOT EXISTS idx_document_media_document_id ON document_media(document_id);
CREATE INDEX IF NOT EXISTS idx_document_media_uploaded_by ON document_media(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_document_media_not_deleted ON document_media(document_id) WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_document_comments_document_id ON document_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_user_id ON document_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_not_deleted ON document_comments(document_id) WHERE is_deleted = FALSE;

-- Row Level Security (RLS) policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for documents
CREATE POLICY "Users can view documents they have permission to" ON documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM document_permissions dp 
            WHERE dp.document_id = documents.id 
            AND dp.user_id = auth.uid() 
            AND dp.is_active = TRUE
        ) OR is_public = TRUE
    );

CREATE POLICY "Users can update documents they have write permission to" ON documents
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM document_permissions dp 
            WHERE dp.document_id = documents.id 
            AND dp.user_id = auth.uid() 
            AND dp.permission_level IN ('write', 'admin')
            AND dp.is_active = TRUE
        )
    );

-- Functions for automatic updates
CREATE OR REPLACE FUNCTION update_document_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_document_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_document_updated_at();

-- Function to auto-increment version numbers
CREATE OR REPLACE FUNCTION set_version_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.version_number IS NULL THEN
        NEW.version_number = COALESCE(
            (SELECT MAX(version_number) FROM document_versions WHERE document_id = NEW.document_id),
            0
        ) + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_version_number
    BEFORE INSERT ON document_versions
    FOR EACH ROW
    EXECUTE FUNCTION set_version_number();

-- View for document with latest version info and thread details
CREATE OR REPLACE VIEW documents_with_latest_version AS
SELECT 
    d.*,
    dv.version_number as latest_version,
    dv.created_at as last_version_created_at,
    dv.created_by as last_version_created_by,
    t.name as thread_name,
    t.workspace_id
FROM documents d
LEFT JOIN LATERAL (
    SELECT version_number, created_at, created_by
    FROM document_versions 
    WHERE document_id = d.id 
    ORDER BY version_number DESC 
    LIMIT 1
) dv ON true
LEFT JOIN threads t ON d.thread_id = t.id
WHERE d.is_deleted = FALSE;