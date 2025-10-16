-- Quick database verification queries
-- Run these to check if you have the required data for testing

-- 1. Check if core tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'workspaces', 'threads', 'quizzes', 'questions', 'answer_option', 'quiz_attempt', 'user_answer')
ORDER BY table_name;

-- 2. Check for sample users (get user IDs for testing)
SELECT id, email, first_name, last_name 
FROM users 
LIMIT 5;

-- 3. Check for sample workspaces
SELECT id, title, description 
FROM workspaces 
LIMIT 5;

-- 4. Check for sample threads (get thread IDs for testing)
SELECT id, workspace_id, name, description 
FROM threads 
LIMIT 5;

-- 5. Check existing quizzes
SELECT id, title, thread_id, creator_id, created_at 
FROM quizzes 
ORDER BY created_at DESC 
LIMIT 5;

-- 6. Quick counts to see what data you have
SELECT 
  (SELECT COUNT(*) FROM users) as user_count,
  (SELECT COUNT(*) FROM workspaces) as workspace_count,
  (SELECT COUNT(*) FROM threads) as thread_count,
  (SELECT COUNT(*) FROM quizzes) as quiz_count;

-- 7. Sample workspace admins (for permission testing)
SELECT wa.id, u.email, w.title 
FROM workspace_admins wa
JOIN users u ON wa.user_id = u.id
JOIN workspaces w ON wa.workspace_id = w.id
LIMIT 5;