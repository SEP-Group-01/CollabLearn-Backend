-- Fix existing quiz attempts that don't have expires_at set
-- This script sets expires_at for existing incomplete attempts

-- First, let's add expires_at for all incomplete attempts based on their creation time and quiz allocated time
UPDATE quiz_attempt 
SET expires_at = (
  quiz_attempt.created_at + (quizzes.allocated_time * INTERVAL '1 minute')
)
FROM quizzes 
WHERE quiz_attempt.quiz_id = quizzes.id 
  AND quiz_attempt.completed = false 
  AND quiz_attempt.expires_at IS NULL;

-- Auto-complete any attempts that are already expired
UPDATE quiz_attempt 
SET 
  completed = true,
  time_taken = INTERVAL '00:30:00', -- Default to 30 minutes if no allocated time
  marks = 0
WHERE completed = false 
  AND expires_at < NOW();

-- Update attempts with proper time_taken based on quiz allocated time for those that expired
UPDATE quiz_attempt 
SET time_taken = (
  SELECT (allocated_time * INTERVAL '1 minute')
  FROM quizzes 
  WHERE quizzes.id = quiz_attempt.quiz_id
)
WHERE completed = true 
  AND marks = 0 
  AND time_taken = INTERVAL '00:30:00'
  AND expires_at < NOW();