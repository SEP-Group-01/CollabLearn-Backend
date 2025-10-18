-- Migration: 005_document_access_requests.sql
-- Document Access Request System

-- Table to store document access requests
CREATE TABLE IF NOT EXISTS document_access_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_permission VARCHAR(10) NOT NULL CHECK (requested_permission IN ('read', 'write')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    message TEXT, -- Optional message from requester
    
    -- Request handling
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    handled_by UUID REFERENCES users(id), -- Admin/moderator who handled the request
    handled_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Prevent duplicate pending requests
    UNIQUE(document_id, user_id, status)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_access_requests_document_id 
    ON document_access_requests(document_id);
CREATE INDEX IF NOT EXISTS idx_document_access_requests_user_id 
    ON document_access_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_document_access_requests_status 
    ON document_access_requests(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_document_access_requests_document_pending 
    ON document_access_requests(document_id, status) WHERE status = 'pending';

-- Function to auto-grant permission when request is approved
CREATE OR REPLACE FUNCTION handle_approved_access_request()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run when status changes to 'approved'
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        -- Insert permission into document_permissions table
        INSERT INTO document_permissions (
            document_id,
            user_id,
            permission_level,
            granted_by,
            granted_at,
            is_active
        ) VALUES (
            NEW.document_id,
            NEW.user_id,
            NEW.requested_permission,
            NEW.handled_by,
            NOW(),
            TRUE
        )
        ON CONFLICT (document_id, user_id, is_active) 
        DO UPDATE SET 
            permission_level = EXCLUDED.permission_level,
            granted_by = EXCLUDED.granted_by,
            granted_at = NOW();
        
        -- Log audit entry
        INSERT INTO document_audit_log (
            document_id,
            user_id,
            action,
            details
        ) VALUES (
            NEW.document_id,
            NEW.user_id,
            'permission_granted',
            jsonb_build_object(
                'permission_level', NEW.requested_permission,
                'granted_by', NEW.handled_by,
                'request_id', NEW.id
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-grant permission on approval
CREATE TRIGGER trigger_handle_approved_access_request
    AFTER UPDATE ON document_access_requests
    FOR EACH ROW
    WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
    EXECUTE FUNCTION handle_approved_access_request();

-- View for pending requests with user and document details
CREATE OR REPLACE VIEW pending_document_access_requests AS
SELECT 
    dar.id,
    dar.document_id,
    dar.user_id,
    dar.requested_permission,
    dar.message,
    dar.requested_at,
    d.title as document_title,
    d.thread_id,
    t.workspace_id,
    u.first_name || ' ' || u.last_name as requester_name,
    u.email as requester_email,
    u.image_url as requester_image
FROM document_access_requests dar
JOIN documents d ON dar.document_id = d.id
JOIN threads t ON d.thread_id = t.id
JOIN users u ON dar.user_id = u.id
WHERE dar.status = 'pending'
ORDER BY dar.requested_at DESC;

-- Row Level Security
ALTER TABLE document_access_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own requests
CREATE POLICY "Users can view their own access requests" ON document_access_requests
    FOR SELECT USING (user_id = auth.uid());

-- Policy: Users can create access requests
CREATE POLICY "Users can create access requests" ON document_access_requests
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy: Admins/moderators can view all requests for their documents
CREATE POLICY "Admins can view requests for their documents" ON document_access_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM documents d
            JOIN threads t ON d.thread_id = t.id
            WHERE d.id = document_access_requests.document_id
            AND (
                EXISTS (
                    SELECT 1 FROM workspace_admins wa 
                    WHERE wa.workspace_id = t.workspace_id 
                    AND wa.user_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM thread_moderators tm 
                    WHERE tm.thread_id = t.id 
                    AND tm.user_id = auth.uid()
                )
            )
        )
    );

-- Policy: Admins/moderators can update requests
CREATE POLICY "Admins can handle access requests" ON document_access_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM documents d
            JOIN threads t ON d.thread_id = t.id
            WHERE d.id = document_access_requests.document_id
            AND (
                EXISTS (
                    SELECT 1 FROM workspace_admins wa 
                    WHERE wa.workspace_id = t.workspace_id 
                    AND wa.user_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM thread_moderators tm 
                    WHERE tm.thread_id = t.id 
                    AND tm.user_id = auth.uid()
                )
            )
        )
    );

-- Comments
COMMENT ON TABLE document_access_requests IS 'Stores user requests for document access permissions';
COMMENT ON COLUMN document_access_requests.requested_permission IS 'Permission level requested: read or write';
COMMENT ON COLUMN document_access_requests.status IS 'Request status: pending, approved, or rejected';
COMMENT ON COLUMN document_access_requests.message IS 'Optional message from user explaining why they need access';
