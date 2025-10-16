-- Migration to fix quiz_attempt table for proper time handling
-- This migration adds expires_at column and fixes time_taken column

-- Add expires_at column to track when attempts should expire
ALTER TABLE quiz_attempt ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;

-- Change time_taken from TIME to INTERVAL for better time tracking
-- Note: This will require data migration if there's existing data
-- First backup existing data if needed, then drop and recreate
ALTER TABLE quiz_attempt ALTER COLUMN time_taken TYPE INTERVAL USING time_taken::INTERVAL;

-- Add index for efficient querying of expired attempts
CREATE INDEX idx_quiz_attempt_expires_at ON quiz_attempt(expires_at) WHERE completed = false;

-- Add index for efficient querying of user attempts
CREATE INDEX idx_quiz_attempt_user_quiz ON quiz_attempt(user_id, quiz_id, created_at);