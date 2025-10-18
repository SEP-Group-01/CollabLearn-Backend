-- Migration: Add excerpt_text column to message_document_references
-- Date: 2024
-- Description: Adds excerpt_text column to store reference text excerpts for conversation history

-- Add excerpt_text column
ALTER TABLE message_document_references 
ADD COLUMN IF NOT EXISTS excerpt_text TEXT;

-- Add index for better query performance if needed
CREATE INDEX IF NOT EXISTS idx_message_references_resource ON message_document_references(resource_id);

-- Add comment to document the column
COMMENT ON COLUMN message_document_references.excerpt_text IS 'Text excerpt from the referenced document chunk';
