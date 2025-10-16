-- Enable the moddatetime extension
create extension if not exists moddatetime;
-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    google_id VARCHAR(255) UNIQUE,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    image_url TEXT
);

-- Workspaces table
-- Create updated workspaces table
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                   -- MEKA UUID RANDOM GENERATE WENNA DANNA ONE #############################
  title VARCHAR(255) NOT NULL,                 -- title (instead of just name)
  image_url TEXT,                              -- store the image path/URL
  description TEXT,
  join_policy VARCHAR(10) DEFAULT 'Anyone',      --MEKA REPLACE KARNNA JOIN POLICY KIYALA #######################
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  tag VARCHAR(20)
);

CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to store thread metadata
CREATE TABLE IF NOT EXISTS threads (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    total_estimated_hours DECIMAL(5,2) DEFAULT 0.00,  -- MEKA METHNA THIYN EKA HODAI WORKSPACE EKAKA NTHUWA
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workspace members table
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                                 -- MEKA UUID RANDOM GENERATE WENNA DANNA ONE #############################
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE thread_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE workspace_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE thread_moderators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table (for chat and replies)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                   -- MEKA UUID RANDOM GENERATE WENNA DANNA ONE #############################
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES messages(id) ON DELETE CASCADE, -- NULL for top-level messages MEKA REPLY WLATA NEDA????????????????
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Message likes table
CREATE TABLE message_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);

-- Table to store study resources (videos, documents, quizzes, etc.)
CREATE TABLE thread_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES threads(id),
  user_id UUID REFERENCES users(id),
  resource_type VARCHAR(20) CHECK (resource_type IN ('document', 'video', 'link')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  estimated_completion_time integer DEFAULT 0, -- in minutes
  
  -- Firebase Storage fields (the key integration points)
  firebase_path VARCHAR(500),     -- Storage path in Firebase
  firebase_url VARCHAR(1000),     -- Download URL from Firebase
  file_name VARCHAR(255),         -- Original filename
  file_size BIGINT,              -- File size in bytes
  mime_type VARCHAR(100),        -- File MIME type
  
  -- Standard fields
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE resource_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES thread_resources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review VARCHAR(250) NOT NULL,
  ratings FLOAT NOT NULL,
  attachment_url VARCHAR(1024)
);

-- Table to track user progress on resources
CREATE TABLE IF NOT EXISTS user_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES thread_resources(id) ON DELETE CASCADE,
    completion_status VARCHAR(50) NOT NULL DEFAULT 'not_started' 
        CHECK (completion_status IN ('not_started', 'in_progress', 'completed', 'needs_revision')),
    progress_percentage DECIMAL(5,2) DEFAULT 0.00 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to store user's available time slots
CREATE TABLE IF NOT EXISTS study_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week VARCHAR(20) NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')), -- SHOULD BE ENUM
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_free BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_time > start_time)
);

-- Enhanced study plans table
CREATE TABLE IF NOT EXISTS study_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    input_data JSONB NOT NULL, -- Original request data
    result JSONB, -- Generated plan result
    total_weeks INTEGER DEFAULT 0,
    coverage_percentage DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to store scheduled tasks from generated plans
CREATE TABLE IF NOT EXISTS scheduled_tasks (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id  UUID NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_id  UUID NOT NULL REFERENCES thread_resources(id) ON DELETE CASCADE, --MEKATA FK EKK VIDIYT SLOT EKA ENNA ONE NEDA
    thread_id UUID REFERENCES threads(id),
    sequence_in_resource INT DEFAULT 1,
    week_number INTEGER NOT NULL,
    day_of_week VARCHAR(20) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    allocated_time_minutes INTEGER NOT NULL,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES study_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (resource_id) REFERENCES study_resources(id) ON DELETE CASCADE
);

CREATE TABLE document_query_prompt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_id  UUID NOT NULL REFERENCES study_resources(id) ON DELETE CASCADE,
  prompt JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chatbot_response (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES document_query_prompt(id) ON DELETE CASCADE,
  response JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(50) NOT NULL,
  description VARCHAR(100),
  allocated_time INT,
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE linked_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id),
  resource_name VARCHAR(20)
);

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question VARCHAR(250) NOT NULL,
  attachment_url VARCHAR(1024),
  marks FLOAT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE answer_option (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_sequence_letter VARCHAR(1) NOT NULL CHECK (answer_sequence_letter IN ('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j')),
  answer VARCHAR(500),
  image_url VARCHAR(1024),
  is_correct BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE quiz_attempt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_nummber INTEGER,
  time_taken TIME,
  marks FLOAT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  completed BOOLEAN DEFAULT FALSE
);

CREATE TABLE user_answer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES quiz_attempt(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL CHECK (
    answer ~ '^[a-z](,[a-z])*$'
  ),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- Create replies table for threaded conversations
-- This migration creates a dedicated replies table to handle message replies properly

CREATE TABLE IF NOT EXISTS replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_replies_parent_message ON replies (parent_message_id);
CREATE INDEX IF NOT EXISTS idx_replies_user ON replies (user_id);
CREATE INDEX IF NOT EXISTS idx_replies_workspace ON replies (workspace_id);
CREATE INDEX IF NOT EXISTS idx_replies_created_at ON replies (created_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_replies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER replies_updated_at
    BEFORE UPDATE ON replies
    FOR EACH ROW
    EXECUTE FUNCTION update_replies_updated_at();

-- Add reply_count column to messages table to track number of replies
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS reply_count INTEGER DEFAULT 0;

-- Create function to update reply count when replies are added/removed
CREATE OR REPLACE FUNCTION update_message_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE messages 
        SET reply_count = reply_count + 1 
        WHERE id = NEW.parent_message_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE messages 
        SET reply_count = reply_count - 1 
        WHERE id = OLD.parent_message_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update reply count
CREATE TRIGGER replies_insert_update_count
    AFTER INSERT ON replies
    FOR EACH ROW
    EXECUTE FUNCTION update_message_reply_count();

CREATE TRIGGER replies_delete_update_count
    AFTER DELETE ON replies
    FOR EACH ROW
    EXECUTE FUNCTION update_message_reply_count();
