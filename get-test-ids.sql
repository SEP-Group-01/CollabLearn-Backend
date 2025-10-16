-- Get sample Thread ID and User ID for testing
-- Run these queries in your database to get the IDs you need

-- Get a sample thread ID
SELECT id, name, workspace_id 
FROM threads 
ORDER BY created_at DESC 
LIMIT 3;

-- Get a sample user ID  
SELECT id, email, first_name 
FROM users 
ORDER BY created_at DESC 
LIMIT 3;

-- Get workspace info
SELECT id, title 
FROM workspaces 
ORDER BY created_at DESC 
LIMIT 3;

-- Check if you have any existing quizzes
SELECT id, title, thread_id, creator_id 
FROM quizzes 
ORDER BY created_at DESC 
LIMIT 3;