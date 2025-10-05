-- Test Data Setup for CollabLearn Resource Management Testing
-- Run this SQL in your Supabase SQL Editor before testing with Postman

-- Insert test user (matches Postman test UUID)
INSERT INTO users (
    id,
    email,
    first_name,
    last_name,
    email_verified,
    created_at,
    updated_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'testuser@collablearn.com',
    'Test',
    'User',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert test workspace (matches Postman test UUID)
INSERT INTO workspaces (
    id,
    title,
    description,
    join_policy,
    created_at,
    updated_at
) VALUES (
    '123e4567-e89b-12d3-a456-426614174000',
    'Test Workspace for Resources',
    'Workspace for testing resource management functionality',
    'Anyone',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert test thread (matches Postman test UUID)
INSERT INTO threads (
    id,
    workspace_id,
    name,
    description,
    total_estimated_hours,
    created_at,
    updated_at
) VALUES (
    '987fcdeb-51a2-43d1-9f12-123456789abc',
    '123e4567-e89b-12d3-a456-426614174000',
    'Test Thread for Resources',
    'Thread for testing document, video, and link resources',
    5.00,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert test user as workspace member (CRITICAL for API permissions!)
INSERT INTO workspace_members (
    workspace_id,
    user_id,
    joined_at
) VALUES (
    '123e4567-e89b-12d3-a456-426614174000',
    '550e8400-e29b-41d4-a716-446655440000',
    NOW()
);

-- Verify the data was inserted correctly
SELECT 'Users:' as table_name, id, email, first_name, last_name FROM users WHERE id = '550e8400-e29b-41d4-a716-446655440000'
UNION ALL
SELECT 'Workspaces:', id::text, title, '', '' FROM workspaces WHERE id = '123e4567-e89b-12d3-a456-426614174000'
UNION ALL
SELECT 'Threads:', id::text, name, '', '' FROM threads WHERE id = '987fcdeb-51a2-43d1-9f12-123456789abc';

-- Also create the thread_resources table if it doesn't exist
CREATE TABLE IF NOT EXISTS thread_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resource_type VARCHAR(20) CHECK (resource_type IN ('document', 'video', 'link')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- URL field for link resources
    url TEXT, -- For link resources

    -- Firebase Storage fields (for document/video resources)
    firebase_path VARCHAR(500),
    firebase_url VARCHAR(1000),
    file_name VARCHAR(255),
    file_size BIGINT,
    mime_type VARCHAR(100),

    -- Standard fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add the url column if the table already exists without it
ALTER TABLE thread_resources ADD COLUMN IF NOT EXISTS url TEXT;

-- Verify thread_resources table exists
SELECT 'thread_resources table exists' as status;
