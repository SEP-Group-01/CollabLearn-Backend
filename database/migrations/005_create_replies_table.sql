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

-- Initialize reply_count for existing messages
UPDATE messages 
SET reply_count = 0 
WHERE reply_count IS NULL;

COMMENT ON TABLE replies IS 'Stores replies to forum messages, creating threaded conversations';
COMMENT ON COLUMN replies.parent_message_id IS 'References the original message being replied to';
COMMENT ON COLUMN replies.content IS 'The reply content/text';
COMMENT ON COLUMN messages.reply_count IS 'Cached count of replies to this message';
